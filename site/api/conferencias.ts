import { neon } from '@neondatabase/serverless'
import { compararQrComBase, parseQrBu, type SecaoBaseComparavel } from '../src/qrBu.js'

// Citizen checks of printed ballot-box reports (QR code) against the TSE files.
// Only public data is stored: the QR text printed on the report and the comparison result. No personal data.

const sql = neon(process.env.DATABASE_URL!)
let pronto: Promise<unknown> | null = null

function garantirTabela() {
  pronto ??= sql`CREATE TABLE IF NOT EXISTS conferencias (
      id bigserial PRIMARY KEY,
      qr_sha256 text UNIQUE NOT NULL,
      uf text NOT NULL,
      zona int NOT NULL,
      secao int NOT NULL,
      turno int NOT NULL,
      confere boolean NOT NULL,
      itens jsonb NOT NULL,
      qr text NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now()
    )`
  return pronto
}

type Grade = { colunas: string[]; linhas: (string | number)[][] }
const cacheUf = new Map<string, Grade>()

async function baseDaSecao(origem: string, uf: string, turno: number, zona: number, secao: number): Promise<SecaoBaseComparavel | null> {
  let g = cacheUf.get(uf)
  if (!g) {
    const r = await fetch(`${origem}/data/secoes/${uf}.json`)
    if (!r.ok) return null
    g = (await r.json()) as Grade
    cacheUf.set(uf, g)
  }
  const c = Object.fromEntries(g.colunas.map((nome, i) => [nome, i]))
  const linha = g.linhas.find((l) => +l[c.turno] === turno && +l[c.zona] === zona && +l[c.secao] === secao)
  if (!linha) return null
  return Object.fromEntries(g.colunas.map((nome, i) => [nome, nome === 'municipio' ? linha[i] : +linha[i]])) as SecaoBaseComparavel
}

async function sha256(texto: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function GET() {
  await garantirTabela()
  const [totais] = await sql`SELECT count(*)::int total, count(*) FILTER (WHERE NOT confere)::int divergentes,
                                    count(DISTINCT (uf, zona, secao, turno))::int secoes FROM conferencias`
  const porUf = await sql`SELECT uf, count(*)::int total, count(*) FILTER (WHERE NOT confere)::int divergentes
                          FROM conferencias GROUP BY uf ORDER BY total DESC`
  const divergencias = await sql`SELECT uf, zona, secao, turno, itens, qr, criado_em FROM conferencias
                                 WHERE NOT confere ORDER BY criado_em DESC LIMIT 200`
  return json({ ...totais, por_uf: porUf, divergencias })
}

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { qr?: unknown } | null
  const texto = typeof corpo?.qr === 'string' ? corpo.qr.trim() : ''
  if (!texto || texto.length > 8000) return json({ erro: 'QR ausente ou grande demais' }, 400)
  const dados = parseQrBu(texto)
  if (!dados || !dados.temCargoPresidente || dados.turno == null) {
    return json({ erro: 'Só conferências do QR com os votos de Presidente (CARG:1) são registradas' }, 400)
  }
  // the comparison is redone here from the QR text, so the client cannot just declare a mismatch
  const base = await baseDaSecao(new URL(req.url).origin, dados.uf, dados.turno, dados.zona, dados.secao)
  if (!base) return json({ erro: 'Seção não encontrada nos dados do TSE' }, 404)
  const resultado = compararQrComBase(dados, base)
  await garantirTabela()
  const inserido = await sql`INSERT INTO conferencias (qr_sha256, uf, zona, secao, turno, confere, itens, qr)
      VALUES (${await sha256(texto)}, ${dados.uf}, ${dados.zona}, ${dados.secao}, ${dados.turno},
              ${resultado.confereTudo}, ${JSON.stringify(resultado.itens)}, ${texto})
      ON CONFLICT (qr_sha256) DO NOTHING RETURNING id`
  return json({ registrado: inserido.length > 0, repetido: inserido.length === 0, confere: resultado.confereTudo })
}
