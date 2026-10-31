import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Bandeira } from './Bandeira'
import { CHECAGENS_EN } from './checagensEn'
import { EstadosChart, type LinhaEstado } from './EstadosChart'
import type { ExteriorData } from './Exterior'
import type { FactData } from './FactCheck'
import { loc, num, pct, setLocale, signedNum, UFS } from './format'
import { LangProvider, useLang, useT, type Lang } from './i18n'
import {
  Crescimento,
  Horario,
  ModelosUrna,
  Recontagem,
  Tabela,
  Virada,
  type Alegacoes,
  type Urnas,
} from './Investigacao'
import { SectionLookup } from './SectionLookup'
import type { ForenseData } from './SimuladorForense'
import type { ListasData } from './Verifique'
import type { InconsistenciasData } from './Inconsistencias'
import type { Auditoria } from './types'
import { useJsonResource } from './useJson'

const Exterior = lazy(() => import('./Exterior').then((m) => ({ default: m.Exterior })))
const FactCheck = lazy(() => import('./FactCheck').then((m) => ({ default: m.FactCheck })))
const Relatorio = lazy(() => import('./Relatorio').then((m) => ({ default: m.Relatorio })))
const Inconsistencias = lazy(() => import('./Inconsistencias').then((m) => ({ default: m.Inconsistencias })))
const Verifique = lazy(() => import('./Verifique').then((m) => ({ default: m.Verifique })))
const SimuladorForense = lazy(() => import('./SimuladorForense').then((m) => ({ default: m.SimuladorForense })))

function Boletim({ data }: { data: Auditoria }) {
  const t = useT()
  const candidatos = data.candidatos.filter((c) => c.turno === 2)
  const resumo = data.resumo.find((r) => r.turno === 2)!
  const validos = candidatos.reduce((s, c) => s + c.bu, 0)

  const linha = (nome: string, votos: number, numero?: number, percentual?: string) => (
    <div key={nome} className="flex justify-between gap-3">
      <span className="truncate">
        {nome}
        {numero != null && <span className="ml-1.5 text-suave">{numero}</span>}
      </span>
      <span className="whitespace-nowrap">
        {percentual && <span className="mr-2 text-[11px] text-suave">{percentual}</span>}
        {num(votos)}
      </span>
    </div>
  )

  return (
    <div className="w-[min(100%,27rem)]">
      <div aria-hidden className="relative z-10 h-2.5 rounded-full bg-[#1d1d1d] ring-1 ring-white/10" />
      <div className="impressora -mt-1">
        <div className="boletim num w-full rotate-[0.6deg] px-6 pt-7 pb-10 font-mono text-[13px] leading-6">
          <p className="text-center font-semibold">{t('BOLETIM DE URNA — BRASIL', 'BALLOT-BOX REPORT — BRAZIL')}</p>
          <p className="text-center text-suave">{t('Presidente, 2º turno, 25/10/2026', 'President, 2nd round, 10/25/2026')}</p>
          <p className="my-3 border-t border-dashed border-suave/60" />
          {candidatos.map((c) => linha(c.nome, c.bu, c.numero, pct(c.bu, validos)))}
          <p className="my-3 border-t border-dashed border-suave/60" />
          {linha(t('Brancos', 'Blank'), resumo.bu.brancos)}
          {linha(t('Nulos', 'Null'), resumo.bu.nulos)}
          <div className="flex justify-between font-semibold">
            <span>{t('Total de votantes', 'Total voters')}</span>
            <span>{num(resumo.bu.comparecimento)}</span>
          </div>
          <p className="my-3 border-t border-dashed border-suave/60" />
          <p className="text-suave">
            {t('Soma de', 'Sum of')} {num(resumo.bu.secoes)} {t('urnas', 'machines')}
          </p>
          <p className="mt-3 bg-tinta px-2.5 py-1.5 font-semibold text-papel">
            {t('✓ Igual ao resultado oficial do TSE', '✓ Same as the official TSE result')}
          </p>
        </div>
      </div>
    </div>
  )
}

function Bloco({ id, titulo, intro, children }: { id: string; titulo: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="max-w-[26ch] text-3xl font-bold tracking-tight text-balance sm:text-4xl">{titulo}</h2>
      {intro && <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-suave">{intro}</p>}
      <div className="mt-10">{children}</div>
    </section>
  )
}

function Passos() {
  const t = useT()
  const etapas = [
    [
      t('Na seção', 'At the polling station'),
      t(
        'Quando a votação termina, a urna imprime o boletim com o total de votos e ele é colado na porta da seção. Qualquer pessoa pode fotografar.',
        'When voting ends, the machine prints a report with the vote totals and it is posted on the polling station door. Anyone can photograph it.',
      ),
    ],
    [
      t('No TSE', 'At the TSE'),
      t(
        'O mesmo boletim, assinado pela urna, é enviado ao TSE. O TSE publica na internet o boletim e os arquivos de cada urna.',
        'The same report, signed by the machine, is sent to the TSE (the electoral court), which publishes every report and machine file online.',
      ),
    ],
    [
      t('Aqui', 'Here'),
      t(
        'Baixamos os arquivos das 499 mil urnas, somamos tudo sozinhos, recontamos cada voto guardado na urna e comparamos com o resultado oficial.',
        'We downloaded the files of all 499,000 machines, added everything up ourselves, recounted every vote stored in each machine and compared it with the official result.',
      ),
    ],
  ]
  return (
    <ol className="grid gap-px border border-linha bg-linha sm:grid-cols-3">
      {etapas.map(([titulo, texto], i) => (
        <li key={titulo} className="bg-papel p-6">
          <span className="num font-mono text-2xl text-suave">0{i + 1}</span>
          <h3 className="mt-3 text-xl font-bold">{titulo}</h3>
          <p className="mt-2 text-base leading-relaxed text-suave">{texto}</p>
        </li>
      ))}
    </ol>
  )
}

function Detalhes({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group border-t border-linha py-5">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-lg font-semibold">
        <span>{titulo}</span>
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center border border-linha text-lg font-light text-suave transition group-open:rotate-45 group-hover:border-tinta group-hover:text-tinta"
        >
          +
        </span>
      </summary>
      <div className="mt-5 space-y-4 leading-relaxed">{children}</div>
    </details>
  )
}

function TabelaEstados({ data }: { data: Auditoria }) {
  const t = useT()
  const [turno, setTurno] = useState<1 | 2>(2)
  const linhas = data.por_uf.filter((l) => l.turno === turno)
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([2, 1] as const).map((tt) => (
          <button
            key={tt}
            type="button"
            onClick={() => setTurno(tt)}
            className={`min-h-10 cursor-pointer border px-4 text-sm font-semibold transition-colors ${
              turno === tt ? 'border-tinta bg-tinta text-fundo' : 'border-linha bg-papel text-suave hover:border-tinta hover:text-tinta'
            }`}
          >
            {tt === 1 ? t('1º turno', '1st round') : t('2º turno', '2nd round')}
          </button>
        ))}
      </div>
      <Tabela
        cabecalho={[t('Estado', 'State'), 'Lula', t('Diferença', 'Difference'), 'Flávio', t('Diferença', 'Difference'), t('Votantes', 'Voters')]}
        linhas={linhas.map((l) => [
          l.uf === 'ZZ' ? t('Exterior', 'Abroad') : UFS[l.uf] ?? l.uf,
          num(l.lula_bu),
          signedNum(l.lula_bu - l.lula_of),
          num(l.flavio_bu),
          signedNum(l.flavio_bu - l.flavio_of),
          num(l.comp),
        ])}
      />
      <p className="text-sm text-suave">
        {t(
          '“Diferença” é a soma das urnas do estado menos o resultado oficial do TSE.',
          '“Difference” is the sum of the state’s machines minus the official TSE result.',
        )}
      </p>
    </div>
  )
}

function Tecnico({ data }: { data: Auditoria }) {
  const t = useT()
  const en = useLang() === 'en'
  const scripts = [
    'download.py',
    'build.py',
    'oficial.py',
    'audit.py',
    'export_site.py',
    'estados_export.py',
    'claims_export.py',
    'der.py',
    'urna_audit.py',
    'urna_report.py',
    'log_forense.py',
    'mesario_pass.py',
    'factcheck_export.py',
    'forense_export.py',
    'exterior_export.py',
    'municipios_export.py',
  ]
  const arquivosOk = data.arquivos.filter((a) => a.confere).length
  const STATUS: Record<string, string> = {
    ok: t('✓ Sem erro', '✓ No error'),
    explicado: t('Tem explicação', 'Explained'),
    verificar: t('A verificar', 'To verify'),
    investigar: t('Diferença', 'Difference'),
  }
  return (
    <div className="border-b border-linha">
      <Detalhes titulo={t('Resultado do 1º turno, candidato por candidato', '1st-round result, candidate by candidate')}>
        <Tabela
          cabecalho={[t('Candidato', 'Candidate'), t('Soma das urnas', 'Sum of machines'), t('Oficial TSE', 'Official TSE'), t('Diferença', 'Difference')]}
          linhas={data.candidatos
            .filter((c) => c.turno === 1)
            .map((c) => [
              `${c.nome} (${c.numero})`,
              num(c.bu),
              c.oficial == null ? t('anulado*', 'annulled*') : num(c.oficial),
              c.oficial == null ? '—' : signedNum(c.bu - c.oficial),
            ])}
        />
        <p className="text-sm text-suave">
          {t(
            '* Candidato que estava na urna mas teve o registro barrado. Os votos dele contam como nulos — o TSE registra exatamente esse número como “nulos técnicos”.',
            '* A candidate who was on the ballot but whose registration was rejected. His votes count as null — the TSE records exactly this number as “technical nulls”.',
          )}
        </p>
      </Detalhes>

      <Detalhes titulo={t('Resultado por estado (tabela)', 'Result by state (table)')}>
        <TabelaEstados data={data} />
      </Detalhes>

      <Detalhes titulo={t('Todas as checagens feitas nos boletins', 'Every check run on the reports')}>
        <ul className="divide-y divide-linha border border-linha bg-papel">
          {data.checagens.map((c) => {
            const tr = en ? CHECAGENS_EN[c.titulo] : undefined
            return (
              <li key={c.titulo} className="space-y-1.5 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{tr?.titulo ?? c.titulo}</p>
                  <span className="text-sm text-suave">{STATUS[c.status] ?? c.status}</span>
                </div>
                <p className="num text-sm">{tr?.resultado ?? c.resultado}</p>
                <p className="text-sm text-suave">{tr?.nota ?? c.nota}</p>
              </li>
            )
          })}
        </ul>
      </Detalhes>

      <Detalhes titulo={t('Como refazer tudo isso no seu computador', 'How to redo all of this on your own computer')}>
        <p>
          {t('Todos os arquivos são públicos, no', 'Every file is public, at the')}{' '}
          <a
            className="underline underline-offset-2 hover:text-tinta"
            href="https://dadosabertos.tse.jus.br/dataset/resultados-2026-boletim-de-urna"
            target="_blank"
            rel="noreferrer"
          >
            {t('Portal de Dados Abertos do TSE', 'TSE Open Data Portal')}
          </a>
          . {t('Estes são os programas que usamos (Python e DuckDB):', 'These are the programs we used (Python and DuckDB):')}
        </p>
        <div className="flex flex-wrap gap-2 pt-1 font-mono text-sm">
          {scripts.map((f) => (
            <a key={f} className="border border-linha bg-papel px-2.5 py-1.5 hover:border-tinta" href={`/metodo/${f}`} target="_blank" rel="noreferrer">
              {f}
            </a>
          ))}
        </div>
        <p className="text-sm text-suave">
          {en
            ? `The ${data.arquivos.length} report files we downloaded from the TSE have a fingerprint (SHA-512 hash) identical to the one published by the TSE in ${arquivosOk} of ${data.arquivos.length} cases.`
            : `Os ${data.arquivos.length} arquivos de boletins que baixamos do TSE têm a impressão digital (hash SHA-512) idêntica à publicada pelo próprio TSE em ${arquivosOk} de ${data.arquivos.length} casos.`}
        </p>
      </Detalhes>

      <Detalhes titulo={t('O que esta verificação não cobre', 'What this verification does not cover')}>
        <ul className="list-disc space-y-2.5 pl-5 text-base text-suave">
          <li>
            {t(
              'O confronto com o papel impresso afixado na porta de cada seção depende de quem fotografou o boletim no local — você pode enviar a foto do QR Code direto em',
              'Comparing against the physical paper posted on each polling station door requires a photo taken on site — you can upload or scan the report QR code directly in',
            )}{' '}
            <a href="#secao" className="text-tinta underline underline-offset-2">
              {t('Confira a sua seção', 'Check your polling station')}
            </a>
            .
          </li>
          <li>
            {t(
              'Conferimos que os arquivos de cada urna são exatamente os que ela assinou (pelos hashes). A assinatura digital em si usa um algoritmo próprio do TSE (código 1.3.6.1.4.1.44588.2.1) que as ferramentas públicas não conseguem verificar.',
              'We checked that each machine’s files are exactly the ones it signed (via hashes). The digital signature itself uses a TSE-specific algorithm (code 1.3.6.1.4.1.44588.2.1) that public tools cannot verify.',
            )}
          </li>
          <li>
            {t(
              'Não analisa o programa da urna. Isso é feito no Teste Público de Segurança do TSE.',
              'It does not analyse the voting machine software. That is done in the TSE Public Security Test.',
            )}
          </li>
          <li>
            {t(
              'Os arquivos internos das urnas do 1º turno ainda não foram recontados (só os boletins).',
              'The machines’ internal files for the 1st round have not been recounted yet (only the reports).',
            )}
          </li>
          <li>
            {t(
              'A especificação pública dos arquivos é anterior a 2026. As diferenças que encontramos estão marcadas em',
              'The public file specification predates 2026. The differences we found are marked in',
            )}{' '}
            <a className="text-tinta underline underline-offset-2" href="/metodo/spec2026/bu.asn1">
              spec2026
            </a>
            .
          </li>
        </ul>
      </Detalhes>
    </div>
  )
}

function Recarregar({ texto, onClick }: { texto: string; onClick: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-linha bg-papel p-4 text-sm">
      <span className="text-suave">{texto}</span>
      <button type="button" onClick={onClick} className="min-h-10 cursor-pointer border border-tinta px-4 font-semibold hover:bg-tinta hover:text-fundo">
        {t('Tentar de novo', 'Try again')}
      </button>
    </div>
  )
}

type Rota = 'inicio' | 'fatos' | 'forense' | 'exterior' | 'verifique' | 'inconsistencias' | 'relatorio'

/** Pages behind the hash: "#/fatos", "#/forense", "#/exterior"; anything else is the main page (plain "#id" anchors scroll). */
function useRota(): Rota {
  const ler = (): Rota => {
    const h = window.location.hash
    if (h.startsWith('#/fatos')) return 'fatos'
    if (h.startsWith('#/forense')) return 'forense'
    if (h.startsWith('#/exterior')) return 'exterior'
    if (h.startsWith('#/verifique')) return 'verifique'
    if (h.startsWith('#/inconsistencias')) return 'inconsistencias'
    if (h.startsWith('#/relatorio')) return 'relatorio'
    return 'inicio'
  }
  const [rota, setRota] = useState<Rota>(ler)
  useEffect(() => {
    const mudou = () => {
      setRota(ler())
      const h = window.location.hash
      if (h.startsWith('#/')) {
        window.scrollTo(0, 0)
      } else if (h.length > 1) {
        requestAnimationFrame(() => document.getElementById(h.slice(1))?.scrollIntoView())
      }
    }
    window.addEventListener('hashchange', mudou)
    return () => window.removeEventListener('hashchange', mudou)
  }, [])
  return rota
}

/** Language: ?lang=en in the URL wins, then the reader's last choice, then the browser language. */
function useIdioma(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'en' || q === 'pt') return q
    try {
      const salvo = localStorage.getItem('lang')
      if (salvo === 'en' || salvo === 'pt') return salvo
    } catch {
      // storage blocked: fall through to the browser language
    }
    return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'
  })
  setLocale(lang)
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR'
    document.title = lang === 'en' ? 'Do the machines add up?' : 'As urnas conferem?'
    try {
      localStorage.setItem('lang', lang)
    } catch {
      // storage blocked: the choice simply isn't remembered
    }
  }, [lang])
  return [lang, setLang]
}

export default function App() {
  const [lang, setLang] = useIdioma()
  return (
    <LangProvider value={lang}>
      <Site lang={lang} setLang={setLang} />
    </LangProvider>
  )
}

function Site({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = useT()
  const rota = useRota()
  const auditoria = useJsonResource<Auditoria>('/data/auditoria.json')
  const alegacoes = useJsonResource<Alegacoes>('/data/alegacoes.json', rota === 'inicio' || rota === 'fatos')
  const urnas = useJsonResource<Urnas>('/data/urnas.json', rota === 'inicio' || rota === 'fatos' || rota === 'inconsistencias')
  const factcheck = useJsonResource<FactData>('/data/factcheck.json', rota === 'fatos')
  const forense = useJsonResource<ForenseData>('/data/forense.json', rota === 'forense' || rota === 'fatos')
  const exterior = useJsonResource<ExteriorData>('/data/exterior.json', rota === 'exterior')
  const listas = useJsonResource<ListasData>('/data/listas.json', rota === 'verifique' || rota === 'inconsistencias')
  const inconsist = useJsonResource<InconsistenciasData>('/data/inconsistencias.json', rota === 'inconsistencias')
  const estados = useJsonResource<LinhaEstado[]>('/data/estados.json', rota === 'inicio')
  const data = auditoria.data
  const secoes2T = data?.resumo.find((r) => r.turno === 2)?.bu.secoes
  const carregando = <p className="text-suave">{t('Carregando…', 'Loading…')}</p>
  const menu = (alvo: Rota, href: string, texto: string) => (
    <a
      href={href}
      aria-current={rota === alvo ? 'page' : undefined}
      className={`flex min-h-10 items-center border-b-2 px-1 text-sm font-semibold ${
        rota === alvo ? 'border-tinta text-tinta' : 'border-transparent text-suave hover:text-tinta'
      }`}
    >
      {texto}
    </a>
  )

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-linha bg-fundo/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
          <a href="#/" className="flex min-h-11 items-center gap-3 font-bold tracking-tight sm:text-lg">
            <Bandeira className="h-[21px] w-[30px] shrink-0 sm:h-[25px] sm:w-9" />
            <span className="whitespace-nowrap">{t('As urnas conferem?', 'Do the machines add up?')}</span>
          </a>
          <div className="order-last flex w-full items-center gap-5 overflow-x-auto">
            {menu('inicio', '#/', t('Apuração', 'Count'))}
            {menu('relatorio', '#/relatorio', t('Relatório', 'Report'))}
            {menu('fatos', '#/fatos', 'Fact check')}
            {menu('forense', '#/forense', t('Simulador', 'Forensics'))}
            {menu('exterior', '#/exterior', t('Exterior', 'Abroad'))}
            {menu('inconsistencias', '#/inconsistencias', t('Inconsistências', 'Inconsistencies'))}
            {menu('verifique', '#/verifique', t('Verifique', 'Verify'))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex border border-linha text-xs font-semibold" role="group" aria-label={t('Idioma', 'Language')}>
              {(['pt', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`min-h-9 min-w-9 cursor-pointer px-2 ${lang === l ? 'bg-tinta text-fundo' : 'text-suave hover:text-tinta'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a
              href="#secao"
              className="flex min-h-10 items-center rounded-full bg-tinta px-4 text-sm font-semibold whitespace-nowrap text-fundo transition-colors hover:bg-suave"
            >
              <span className="sm:hidden">{t('Sua seção', 'Your station')}</span>
              <span className="hidden sm:inline">{t('Confira a sua seção', 'Check your station')}</span>
            </a>
          </div>
        </nav>
      </header>

      {rota === 'relatorio' ? (
        <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20">
          <h1 className="max-w-[20ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
            {t('Relatório da auditoria', 'Audit report')}
          </h1>
          <div className="mt-10">
            <Suspense fallback={carregando}>
              <Relatorio />
            </Suspense>
          </div>
        </main>
      ) : rota === 'inconsistencias' ? (
        <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20">
          <h1 className="max-w-[18ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
            {t('Inconsistências', 'Inconsistencies')}
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-suave">
            {t(
              'Tudo o que encontramos de errado, estranho ou fora do comum, com o número exato. Sem conclusão: os fatos ficam aqui para cada um avaliar.',
              'Everything we found wrong, odd or out of the ordinary, with the exact number. No conclusions: the facts are here for everyone to judge.',
            )}
          </p>
          <div className="mt-12">
            {inconsist.status === 'error' || listas.status === 'error' || urnas.status === 'error' ? (
              <Recarregar texto={t('Não foi possível carregar os dados.', 'Could not load the data.')} onClick={() => { inconsist.reload(); listas.reload(); urnas.reload() }} />
            ) : inconsist.data && listas.data && urnas.data ? (
              <Suspense fallback={carregando}>
                <Inconsistencias d={inconsist.data} listas={listas.data} urnas={urnas.data} />
              </Suspense>
            ) : (
              carregando
            )}
          </div>
        </main>
      ) : rota === 'verifique' ? (
        <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20">
          <h1 className="max-w-[18ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
            {t('Verifique você mesmo', 'Verify it yourself')}
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-suave">
            {t(
              'Não confie no site: confira. Aqui estão os arquivos, o código, as seções que mais merecem uma visita e o que ainda não deu para verificar.',
              'Don’t trust this site: check it. Here are the files, the code, the stations most worth a visit and what we could not verify yet.',
            )}
          </p>
          <div className="mt-12">
            {listas.status === 'error' ? (
              <Recarregar texto={t('Não foi possível carregar as listas.', 'Could not load the lists.')} onClick={listas.reload} />
            ) : listas.data ? (
              <Suspense fallback={carregando}>
                <Verifique d={listas.data} />
              </Suspense>
            ) : (
              carregando
            )}
          </div>
        </main>
      ) : rota === 'exterior' ? (
        <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20">
          <h1 className="max-w-[18ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
            {t('Votos no exterior', 'Votes abroad')}
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-suave">
            {t(
              'Como votaram os brasileiros que moram fora, país por país. Escolha um país.',
              'How Brazilians living abroad voted, country by country. Pick a country.',
            )}
          </p>
          <div className="mt-12">
            {exterior.status === 'error' ? (
              <Recarregar texto={t('Não foi possível carregar os dados do exterior.', 'Could not load overseas data.')} onClick={exterior.reload} />
            ) : exterior.data ? (
              <Suspense fallback={carregando}>
                <Exterior d={exterior.data} />
              </Suspense>
            ) : (
              carregando
            )}
          </div>
        </main>
      ) : rota === 'forense' ? (
        <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20">
          <h1 className="max-w-[20ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
            {t('Simulador forense & testes de estresse', 'Forensic simulator & stress tests')}
          </h1>
          <p className="mt-6 max-w-[64ch] text-lg leading-relaxed text-suave">
            {t(
              'Teste qualquer hipótese sobre as 499.207 urnas do 2º turno: exclua modelos antigos, liberações por mesário, seções sem biometria, urnas de contingência ou compare os recortes regionais e os dígitos finais.',
              'Test any hypothesis across all 499,207 2nd-round voting machines: exclude older models, poll-worker releases, non-biometric sections, contingency units, or inspect regional cuts and ending digits.',
            )}
          </p>
          <div className="mt-12">
            {forense.status === 'error' ? (
              <Recarregar texto={t('Não foi possível carregar o cubo forense.', 'Could not load the forensic dataset.')} onClick={forense.reload} />
            ) : forense.data ? (
              <Suspense fallback={carregando}>
                <SimuladorForense d={forense.data} />
              </Suspense>
            ) : (
              carregando
            )}
          </div>
        </main>
      ) : rota === 'fatos' ? (
        <main className="mx-auto max-w-5xl px-4 pt-12 pb-28 sm:px-6 sm:pt-20">
          <h1 className="max-w-[18ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
            Fact check
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-suave">
            {t(
              'O que está sendo dito sobre a eleição para Presidente, conferido com os arquivos das urnas e com fontes públicas. Cada item mostra o veredito, a evidência e a fonte. Toque numa afirmação para abrir.',
              'What is being said about the presidential election, checked against the voting machine files and public sources. Each item shows the verdict, the evidence and the source. Tap a claim to open it.',
            )}
          </p>
          <div className="mt-10">
            {factcheck.data && alegacoes.data && urnas.data && data ? (
              <Suspense fallback={carregando}>
                <FactCheck
                  f={factcheck.data}
                  a={alegacoes.data}
                  u={urnas.data}
                  forense={forense.data}
                  lula={data.candidatos.find((c) => c.turno === 2 && c.numero === 13)!.bu}
                  flavio={data.candidatos.find((c) => c.turno === 2 && c.numero === 22)!.bu}
                />
              </Suspense>
            ) : (
              carregando
            )}
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 sm:px-6">
          <section className="grid items-center gap-14 pt-12 pb-20 sm:pt-20 sm:pb-28 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div>
              <h1 className="max-w-[16ch] text-[2.5rem] leading-[1.06] font-extrabold tracking-tight text-balance sm:text-6xl">
                {t('A apuração para Presidente, conferida urna por urna', 'The presidential count, checked machine by machine')}
              </h1>
              {auditoria.status === 'error' && (
                <div className="mt-8">
                  <Recarregar texto={t('Não foi possível carregar os dados.', 'The data could not be loaded.')} onClick={auditoria.reload} />
                </div>
              )}
              {auditoria.status === 'loading' && <p className="mt-8 text-suave">{t('Carregando os dados…', 'Loading the data…')}</p>}
              {data && (
                <p className="mt-8 max-w-[54ch] text-xl leading-relaxed text-suave">
                  {lang === 'en'
                    ? `We added up the report of each of the ${num(secoes2T)} voting machines in the 2nd round and recounted, one by one, the votes stored inside them.`
                    : `Somamos o boletim de cada uma das ${num(secoes2T)} urnas do 2º turno e recontamos, um por um, os votos guardados dentro delas.`}
                  <strong className="mt-4 block text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
                    {t('Soma das urnas = resultado oficial do TSE.', 'Sum of the machines = official TSE result.')}
                  </strong>
                </p>
              )}
              <p className="mt-6 max-w-[56ch] border-l-2 border-tinta pl-4 text-sm leading-relaxed text-suave">
                {t(
                  'Verificação independente e apartidária, feita só com os arquivos públicos do TSE. Sem vínculo com partidos, candidatos ou com o próprio TSE.',
                  'Independent, non-partisan verification using only the public files of the TSE, Brazil’s electoral court. No ties to parties, candidates or the TSE itself.',
                )}
              </p>
            </div>
            {data && (
              <div className="justify-self-center">
                <Boletim data={data} />
              </div>
            )}
          </section>

          <div className="space-y-24 pb-28 sm:space-y-32">
            <Bloco id="como" titulo={t('Como conferimos', 'How we checked')}>
              <Passos />
            </Bloco>

            <Bloco
              id="estados"
              titulo={t('Resultado por estado', 'Result by state')}
              intro={t(
                'Como cada estado votou, no 1º e no 2º turno. Toque numa barra para ver os números.',
                'How each state voted, in the 1st and 2nd round. Tap a bar to see the numbers.',
              )}
            >
              {estados.data ? <EstadosChart linhas={estados.data} /> : carregando}
            </Bloco>

            <Bloco
              id="duvidas"
              titulo={t('O que os dados mostram', 'What the data shows')}
              intro={t(
                'Os principais números do 2º turno, calculados a partir dos arquivos das urnas. Toque num tema para ver os detalhes.',
                'The key 2nd-round numbers, computed from the voting machine files. Tap a topic to see the details.',
              )}
            >
              {alegacoes.status === 'error' && (
                <Recarregar texto={t('Não foi possível carregar esta parte.', 'This part could not be loaded.')} onClick={alegacoes.reload} />
              )}
              {alegacoes.status === 'loading' && carregando}
              {alegacoes.data && (
                <div className="border-b border-linha">
                  <Virada d={alegacoes.data} />
                  <Horario d={alegacoes.data} u={urnas.data} />
                  <Crescimento d={alegacoes.data} />
                  <Recontagem u={urnas.data} />
                  <ModelosUrna u={urnas.data} />
                </div>
              )}
            </Bloco>

            <div className="grid gap-4 sm:grid-cols-2">
              <a href="#/fatos" className="group flex flex-col justify-between border border-linha bg-papel p-6 hover:border-tinta sm:p-8">
                <div>
                  <p className="text-2xl font-bold tracking-tight sm:text-3xl">Fact check</p>
                  <p className="mt-2.5 text-suave">
                    {t(
                      'Pesquisas, virada, prorrogação, biometria, mesários, urnas novas, estados vencidos e dígitos finais: 16 afirmações conferidas nos dados.',
                      'Polls, the comeback, extended hours, biometrics, poll workers, newer machines, states won and ending digits: 16 claims checked in the data.',
                    )}
                  </p>
                </div>
                <p className="mt-6 font-semibold underline underline-offset-4 group-hover:no-underline">
                  {t('Abrir o fact check →', 'Open the fact check →')}
                </p>
              </a>

              <a href="#/forense" className="group flex flex-col justify-between border border-linha bg-papel p-6 hover:border-tinta sm:p-8">
                <div>
                  <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {t('Simulador forense', 'Forensic simulator')}
                  </p>
                  <p className="mt-2.5 text-suave">
                    {t(
                      'Marque e desmarque filtros sobre as 499.207 urnas em tempo real (só UE2022, sem mesário, biometria, contingência) e veja a recontagem na hora.',
                      'Toggle filters across all 499,207 machines in real time (UE2022 only, zero poll-worker releases, biometrics, contingency) and see the live recount.',
                    )}
                  </p>
                </div>
                <p className="mt-6 font-semibold underline underline-offset-4 group-hover:no-underline">
                  {t('Testar hipóteses nos dados →', 'Test hypotheses on the data →')}
                </p>
              </a>
            </div>

            <Bloco
              id="secao"
              titulo={t('Confira a sua seção', 'Check your polling station')}
              intro={t(
                'A soma só vale se cada boletim estiver certo. Busque sua cidade para ver o total do município e da sua seção, envie uma foto do QR Code do boletim impresso ou gere a imagem do recibo da urna.',
                'The sum only holds if every report is right. Search your city to see municipality and station totals, upload or scan the printed report QR code, or download your machine’s receipt image.',
              )}
            >
              <SectionLookup />
            </Bloco>

            {data && (
              <Bloco
                id="detalhes"
                titulo={t('Para quem quer ver tudo', 'For those who want to see everything')}
                intro={t(
                  'Tabelas completas, como refazer a verificação e o que ela não cobre.',
                  'Full tables, how to redo the verification and what it does not cover.',
                )}
              >
                <Tecnico data={data} />
              </Bloco>
            )}
          </div>
        </main>
      )}

      <footer className="border-t border-linha">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-suave sm:px-6">
          <p>{t('Projeto independente. Dados públicos do Tribunal Superior Eleitoral.', 'Independent project. Public data from Brazil’s Superior Electoral Court (TSE).')}</p>
          <a
            href="https://github.com/marcelocfm"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-10 items-center gap-2 text-suave underline-offset-2 hover:text-tinta hover:underline"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-current">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            github.com/marcelocfm
          </a>
          {data && (
            <p>
              {t('Atualizado em', 'Updated on')} {new Date(data.gerado_em).toLocaleString(loc())}.
            </p>
          )}
        </div>
      </footer>
    </>
  )
}
