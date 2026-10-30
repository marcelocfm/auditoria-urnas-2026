import { useState } from 'react'
import { num, pct } from './format'
import { useLang, useT } from './i18n'
import { Tabela } from './Investigacao'

type Totais = {
  secoes: number
  aptos: number
  comparecimento: number
  lula: number
  flavio: number
  outros: number
  brancos: number
  nulos: number
}

type Pais = { pais: string; turnos: Record<string, Totais>; cidades: Record<string, Record<string, Totais>> }

const PAIS_EN: Record<string, string> = {
  'Estados Unidos': 'United States',
  Portugal: 'Portugal',
  Japão: 'Japan',
  'Reino Unido': 'United Kingdom',
  Itália: 'Italy',
  França: 'France',
  Alemanha: 'Germany',
  Espanha: 'Spain',
  Canadá: 'Canada',
  Irlanda: 'Ireland',
  Suíça: 'Switzerland',
  'Países Baixos': 'Netherlands',
  Austrália: 'Australia',
  Argentina: 'Argentina',
  Paraguai: 'Paraguay',
  Bélgica: 'Belgium',
  Israel: 'Israel',
  Líbano: 'Lebanon',
  Chile: 'Chile',
  México: 'Mexico',
  Suécia: 'Sweden',
  China: 'China',
  'Coreia do Sul': 'South Korea',
  Rússia: 'Russia',
  'Emirados Árabes': 'United Arab Emirates',
}

const MINUSCULAS = new Set(['de', 'del', 'la', 'do', 'da'])
const formatarCidade = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')

export type ExteriorData = { principais: Pais[]; total: Record<string, Totais>; paises_com_secao: number }

function Placar({ titulo, dados }: { titulo: string; dados?: Totais }) {
  const t = useT()
  if (!dados) return null
  const validos = dados.lula + dados.flavio + dados.outros
  const barraLula = validos > 0 ? (100 * dados.lula) / validos : 50
  const barraFlavio = validos > 0 ? (100 * dados.flavio) / validos : 50

  return (
    <div className="border border-linha bg-papel p-5">
      <p className="font-semibold">{titulo}</p>
      {validos > 0 && (
        <div className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden bg-fundo" aria-hidden>
          <div className="bg-tinta" style={{ width: `${barraLula.toFixed(1)}%` }} />
          {dados.outros > 0 && <div className="bg-[#454545]" style={{ width: `${(100 - barraLula - barraFlavio).toFixed(1)}%` }} />}
          <div className="bg-[#8c8c8c]" style={{ width: `${barraFlavio.toFixed(1)}%` }} />
        </div>
      )}
      <dl className="num mt-3.5 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5">
        <dt>Lula (13)</dt>
        <dd className="text-right font-semibold">{num(dados.lula)}</dd>
        <dd className="text-right text-suave">{pct(dados.lula, validos)}</dd>
        <dt>Flávio Bolsonaro (22)</dt>
        <dd className="text-right font-semibold">{num(dados.flavio)}</dd>
        <dd className="text-right text-suave">{pct(dados.flavio, validos)}</dd>
        {dados.outros > 0 && (
          <>
            <dt className="text-suave">{t('Outros candidatos', 'Other candidates')}</dt>
            <dd className="text-right">{num(dados.outros)}</dd>
            <dd className="text-right text-suave">{pct(dados.outros, validos)}</dd>
          </>
        )}
        <dt className="text-suave">{t('Brancos e nulos', 'Blank and null')}</dt>
        <dd className="text-right">{num(dados.brancos + dados.nulos)}</dd>
        <dd />
        <dt className="text-suave">{t('Votaram / eleitores', 'Voted / registered')}</dt>
        <dd className="col-span-2 text-right">
          {num(dados.comparecimento)} {t('de', 'of')} {num(dados.aptos)}
        </dd>
      </dl>
    </div>
  )
}

export function Exterior({ d }: { d: ExteriorData }) {
  const t = useT()
  const en = useLang() === 'en'
  const [sel, setSel] = useState(d.principais[0].pais)
  const pais = d.principais.find((p) => p.pais === sel)!
  const nomePais = (nome: string) => (en ? PAIS_EN[nome] ?? nome : nome)
  const cidades = Object.entries(pais.cidades).sort((a, b) => (b[1]['2']?.comparecimento ?? 0) - (a[1]['2']?.comparecimento ?? 0))
  const tot2 = d.total['2']
  const totValidos2 = tot2.lula + tot2.flavio

  return (
    <div className="space-y-8">
      <div className="num flex flex-wrap items-baseline justify-between gap-4 border border-linha bg-papel px-5 py-4 text-sm">
        <span className="font-semibold">{t('Total mundial no exterior (2º turno)', 'Worldwide abroad total (2nd round)')}</span>
        <span className="text-suave">
          Lula <strong className="text-tinta">{num(tot2.lula)}</strong> ({pct(tot2.lula, totValidos2)}) · Flávio{' '}
          <strong className="text-tinta">{num(tot2.flavio)}</strong> ({pct(tot2.flavio, totValidos2)}) ·{' '}
          {num(tot2.secoes)} {t('seções em', 'stations across')} {d.paises_com_secao} {t('países', 'countries')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('Países', 'Countries')}>
        {d.principais.map((p) => (
          <button
            key={p.pais}
            type="button"
            role="tab"
            aria-selected={p.pais === sel}
            onClick={() => setSel(p.pais)}
            className={`min-h-10 cursor-pointer border px-3.5 text-sm font-medium transition-colors ${
              p.pais === sel ? 'border-tinta bg-tinta text-fundo' : 'border-linha bg-papel text-suave hover:border-tinta hover:text-tinta'
            }`}
          >
            {nomePais(p.pais)}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-3xl font-bold tracking-tight">{nomePais(pais.pais)}</h2>
        <p className="mt-1 text-suave">
          {num(pais.turnos['2']?.secoes)} {t('seções em', 'polling stations in')} {cidades.length}{' '}
          {cidades.length === 1 ? t('cidade', 'city') : t('cidades', 'cities')}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Placar titulo={t('2º turno', '2nd round')} dados={pais.turnos['2']} />
          <Placar titulo={t('1º turno', '1st round')} dados={pais.turnos['1']} />
        </div>
      </div>

      {cidades.length > 1 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">{t('Por cidade, 2º turno', 'By city, 2nd round')}</h3>
          <Tabela
            cabecalho={[
              t('Cidade', 'City'),
              'Lula',
              'Flávio',
              t('Votaram', 'Voted'),
              t('Eleitores', 'Registered'),
            ]}
            linhas={cidades.map(([nome, turnosCidade]) => {
              const c = turnosCidade['2']
              return [formatarCidade(nome), num(c?.lula), num(c?.flavio), num(c?.comparecimento), num(c?.aptos)]
            })}
          />
        </div>
      )}

      <p className="text-sm text-suave">
        {t(
          `Brasileiros votaram em ${d.paises_com_secao} países. Aqui aparecem os ${d.principais.length} maiores colégios no exterior.`,
          `Brazilians voted in ${d.paises_com_secao} countries. Shown above are the ${d.principais.length} largest overseas electorates.`,
        )}
      </p>
    </div>
  )
}
