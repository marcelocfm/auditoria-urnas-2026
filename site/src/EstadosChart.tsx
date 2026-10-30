import { useState } from 'react'
import { collatorPtBr, num, pct, signedNum, UFS } from './format'
import { useT } from './i18n'

export type LinhaEstado = { turno: number; uf: string; lula: number; flavio: number; outros: number; brancos_nulos: number }

// neutral greys on black (no party colours); order is fixed: Lula, Flávio, others
const COR = { lula: '#f2f2f2', flavio: '#8c8c8c', outros: '#454545' }

type Ordem = 'proporcao' | 'saldo' | 'alfabetica'

/** One 100% bar per state: share of valid votes. */
export function EstadosChart({ linhas }: { linhas: LinhaEstado[] }) {
  const t = useT()
  const [turno, setTurno] = useState(2)
  const [ordem, setOrdem] = useState<Ordem>('proporcao')
  const [hover, setHover] = useState<string | null>(null)

  const nome = (uf: string) => (uf === 'ZZ' ? t('Exterior', 'Abroad') : UFS[uf] ?? uf)

  const filtrados = linhas
    .filter((l) => l.turno === turno)
    .map((l) => ({ ...l, validos: l.lula + l.flavio + l.outros, saldo: l.lula - l.flavio }))

  const dados = [...filtrados].sort((a, b) => {
    if (ordem === 'saldo') return b.saldo - a.saldo
    if (ordem === 'alfabetica') return collatorPtBr.compare(nome(a.uf), nome(b.uf))
    return b.lula / b.validos - a.lula / a.validos
  })

  const ufsFlavio = filtrados.filter((d) => d.uf !== 'ZZ' && d.flavio > d.lula).length
  const ufsLula = filtrados.filter((d) => d.uf !== 'ZZ' && d.lula > d.flavio).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[2, 1].map((tt) => (
            <button
              key={tt}
              type="button"
              onClick={() => setTurno(tt)}
              aria-pressed={turno === tt}
              className={`min-h-10 cursor-pointer border px-4 text-sm font-semibold transition-colors ${
                turno === tt ? 'border-tinta bg-tinta text-fundo' : 'border-linha bg-papel text-suave hover:border-tinta hover:text-tinta'
              }`}
            >
              {tt === 1 ? t('1º turno', '1st round') : t('2º turno', '2nd round')}
            </button>
          ))}
          <div className="flex border border-linha text-xs" role="group" aria-label={t('Ordenar estados', 'Sort states')}>
            {(
              [
                ['proporcao', t('% Votos', '% Share')],
                ['saldo', t('Saldo bruto', 'Vote margin')],
                ['alfabetica', 'A–Z'],
              ] as const
            ).map(([k, rotulo]) => (
              <button
                key={k}
                type="button"
                onClick={() => setOrdem(k)}
                aria-pressed={ordem === k}
                className={`min-h-10 cursor-pointer px-3 font-medium transition-colors ${
                  ordem === k ? 'bg-linha text-tinta font-semibold' : 'bg-papel text-suave hover:text-tinta'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex flex-wrap gap-4 text-sm" aria-label={t('Legenda', 'Legend')}>
          {(
            [
              ['lula', 'Lula (13)'],
              ['flavio', 'Flávio Bolsonaro (22)'],
              ...(turno === 1 ? [['outros', t('Outros candidatos', 'Other candidates')]] : []),
            ] as [keyof typeof COR, string][]
          ).map(([k, rotulo]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-sm" style={{ background: COR[k] }} />
              {rotulo}
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-xs text-suave">
        {t(
          `Placar estadual (${turno}º turno): Flávio venceu em ${ufsFlavio} UFs · Lula venceu em ${ufsLula} UFs (e no Exterior).`,
          `State tally (${turno === 1 ? '1st' : '2nd'} round): Flávio won ${ufsFlavio} states/DF · Lula won ${ufsLula} states (plus Abroad).`,
        )}
      </p>

      <ul className="space-y-1.5">
        {dados.map((d) => {
          const pL = (100 * d.lula) / d.validos
          const pF = (100 * d.flavio) / d.validos
          const pO = 100 - pL - pF
          const ativo = hover === d.uf
          return (
            <li
              key={d.uf}
              className="grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[11rem_1fr]"
              onPointerEnter={() => setHover(d.uf)}
              onPointerLeave={() => setHover(null)}
              onClick={() => setHover(ativo ? null : d.uf)}
            >
              <span className={`truncate text-sm ${ativo ? 'text-tinta font-medium' : 'text-suave'}`}>{nome(d.uf)}</span>
              <div className="relative">
                <div className="flex h-6 gap-[2px] overflow-hidden rounded" role="img" aria-label={`${nome(d.uf)}: Lula ${pct(d.lula, d.validos)}, Flávio ${pct(d.flavio, d.validos)}`}>
                  <div className="flex items-center pl-1.5 text-[11px] font-semibold text-black num" style={{ width: `${pL}%`, background: COR.lula }}>
                    {pL >= 12 && pct(d.lula, d.validos)}
                  </div>
                  {pO > 0.05 && <div style={{ width: `${pO}%`, background: COR.outros }} />}
                  <div className="flex items-center justify-end pr-1.5 text-[11px] font-semibold text-black num" style={{ width: `${pF}%`, background: COR.flavio }}>
                    {pF >= 12 && pct(d.flavio, d.validos)}
                  </div>
                </div>
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-fundo" />
                {ativo && (
                  <div className="num pointer-events-none absolute top-7 left-0 z-10 rounded border border-linha bg-fundo px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold">{nome(d.uf)}</p>
                    <p>Lula: {num(d.lula)} ({pct(d.lula, d.validos)})</p>
                    <p>Flávio: {num(d.flavio)} ({pct(d.flavio, d.validos)})</p>
                    <p className="text-suave">
                      {t('Diferença (Lula − Flávio)', 'Margin (Lula − Flávio)')}: {signedNum(d.saldo)}
                    </p>
                    {d.outros > 0 && (
                      <p>
                        {t('Outros', 'Others')}: {num(d.outros)} ({pct(d.outros, d.validos)})
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-suave">
        {t(
          'Porcentagem dos votos válidos (sem brancos e nulos), somando os boletins de todas as urnas do estado. A marca preta no meio de cada barra é 50%.',
          'Share of valid votes (excluding blank and null), summing every ballot-box report in the state. The black mark in the middle of each bar is 50%.',
        )}
      </p>
    </div>
  )
}
