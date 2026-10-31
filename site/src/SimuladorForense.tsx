import { useMemo, useState } from 'react'
import { loc, num, pct, signedNum } from './format'
import { useLang, useT } from './i18n'
import { Tabela } from './Investigacao'

export type SerieDigitos = {
  secoes: number
  chi2: number
  critico_95: number
  pcts: number[]
  contagens: number[]
}

export type ForenseData = {
  cubo_colunas: string[]
  cubo: [number, number, number, number, number][]
  regioes: {
    regiao: string
    ufs: number
    secoes: number
    lula_1t: number
    flavio_1t: number
    lula_2t: number
    flavio_2t: number
    pct_lula_2t: number
    pct_flavio_2t: number
    saldo_lula_2t: number
  }[]
  estados_vencidos: {
    flavio_ufs_1t: number
    lula_ufs_1t: number
    flavio_ufs_2t: number
    lula_ufs_2t: number
  }
  retencao: {
    secoes_pareadas: number
    flavio_caiu_secoes: number
    flavio_caiu_votos: number
    flavio_caiu_comp_subiu_secoes: number
    flavio_caiu_ate_5: number
    flavio_caiu_acima_20: number
    lula_caiu_secoes: number
    lula_caiu_votos: number
    lula_caiu_comp_subiu_secoes: number
  }
  integridade: {
    urnas_binarias: number
    versoes_distintas: number
    versao_software: string
    hashes_verificados: number
    hashes_ok: number
    rdv_divergentes: number
    img_divergentes: number
    votos_sem_habilitacao: number
    habilitacoes_manuais: number
    liberados_mesario: number
  }
  digitos: {
    comparecimento_2t: SerieDigitos
    lula_2t: SerieDigitos
    flavio_2t: SerieDigitos
  }
}

const REGIAO_EN: Record<string, string> = {
  Sul: 'South',
  Sudeste: 'Southeast',
  'Centro-Oeste': 'Center-West',
  Norte: 'North',
  Nordeste: 'Northeast',
  Exterior: 'Abroad',
}

type FiltroBit = {
  bit: number
  titulo: string
  detalhe: string
  geografico?: boolean
}

export function SimuladorForense({ d }: { d: ForenseData }) {
  const t = useT()
  const en = useLang() === 'en'
  const [mascaraExclusao, setMascaraExclusao] = useState(0)
  const [abaDigito, setAbaDigito] = useState<'comparecimento_2t' | 'lula_2t' | 'flavio_2t'>('comparecimento_2t')

  const filtros: FiltroBit[] = [
    {
      bit: 1,
      titulo: t('Excluir urnas anteriores a 2020 (UE2013, UE2015 e cédula)', 'Exclude pre-2020 machines (UE2013, UE2015 & paper)'),
      detalhe: t('Mantém apenas urnas UE2020 e UE2022 auditadas via pacote binário.', 'Keeps only UE2020 and UE2022 machines audited via binary package.'),
    },
    {
      bit: 2,
      titulo: t('Manter exclusivamente o modelo mais novo (UE2022)', 'Keep exclusively the newest model (UE2022)'),
      detalhe: t('Descarta todos os modelos anteriores (inclusive UE2020).', 'Discards every earlier model (including UE2020).'),
    },
    {
      bit: 4,
      titulo: t('Excluir seções com qualquer liberação por digital de mesário', 'Exclude sections with any poll-worker fingerprint release'),
      detalhe: t('Mantém só urnas com 0 liberações de mesário no log.', 'Keeps only machines with 0 poll-worker releases in the log.'),
    },
    {
      bit: 8,
      titulo: t('Excluir seções com mais de 5% de votantes sem biometria', 'Exclude sections with >5% voters without biometrics'),
      detalhe: t('Filtra locais onde mais de 5% votaram sem leitura da digital.', 'Filters out stations where >5% voted without fingerprint match.'),
    },
    {
      bit: 16,
      titulo: t('Excluir urnas substituídas, de contingência ou com log parcial', 'Exclude swapped/contingency machines or partial logs'),
      detalhe: t('Remove urnas trocadas entre turnos, contingência e divergências log×BU.', 'Removes machines swapped between rounds, contingency units, and log×BU gaps.'),
    },
    {
      bit: 32,
      titulo: t('Excluir seções com mais de 90% dos votos num só candidato', 'Exclude sections with >90% votes for a single candidate'),
      detalhe: t('Remove redutos extremos de ambos os candidatos.', 'Removes extreme strongholds of both candidates.'),
    },
    {
      bit: 64,
      titulo: t('Excluir seções onde o comparecimento subiu mais de 5 p.p.', 'Exclude sections where turnout rose by more than 5 pp'),
      detalhe: t('Testa se o aumento de votantes no 2º turno alterou o vencedor.', 'Tests whether higher 2nd-round turnout changed the winner.'),
    },
    {
      bit: 128,
      titulo: t('Excluir encerradas após 17h15 ou com mudança de aptos', 'Exclude stations closed after 5:15 pm or with voter-roll shifts'),
      detalhe: t('Remove seções com fila/prorrogação e variações de voto em trânsito.', 'Removes stations with late lines/extended hours and transit-vote shifts.'),
    },
  ]

  const calculo = useMemo(() => {
    let totSec = 0
    let totLula = 0
    let totFlavio = 0
    let incSec = 0
    let incLula = 0
    let incFlavio = 0
    let incComp = 0

    for (const [mask, sec, lula, flavio, comp] of d.cubo) {
      totSec += sec
      totLula += lula
      totFlavio += flavio
      if ((mask & mascaraExclusao) === 0) {
        incSec += sec
        incLula += lula
        incFlavio += flavio
        incComp += comp
      }
    }

    return {
      totSec,
      totLula,
      totFlavio,
      incSec,
      incLula,
      incFlavio,
      incComp,
      excSec: totSec - incSec,
      excLula: totLula - incLula,
      excFlavio: totFlavio - incFlavio,
    }
  }, [d.cubo, mascaraExclusao])

  const alternarBit = (bit: number) => {
    setMascaraExclusao((atual) => atual ^ bit)
  }

  const validosInc = calculo.incLula + calculo.incFlavio
  const saldoInc = calculo.incLula - calculo.incFlavio
  const pctLulaInc = validosInc > 0 ? (100 * calculo.incLula) / validosInc : 50
  const mascaraTecnicaMaxima = 1 | 4 | 8 | 16 | 32 | 64 | 128

  const presets: [string, number][] = [
    [t('Resultado oficial (todas)', 'Official count (all)'), 0],
    [t('Só UE2020 + UE2022', 'UE2020 + UE2022 only'), 1],
    [t('Só UE2022', 'UE2022 only'), 2],
    [t('Todos os filtros técnicos juntos', 'All technical filters together'), mascaraTecnicaMaxima],
  ]

  const serieAtual = d.digitos[abaDigito]
  const dec = (v: number, casas = 2) => v.toLocaleString(loc(), { minimumFractionDigits: casas, maximumFractionDigits: casas })
  const foraNordeste = d.regioes.filter((r) => r.regiao !== 'Nordeste')
  const lulaForaNE = foraNordeste.reduce((s, r) => s + r.lula_2t, 0)
  const flavioForaNE = foraNordeste.reduce((s, r) => s + r.flavio_2t, 0)
  const saldoNE = d.regioes.find((r) => r.regiao === 'Nordeste')?.saldo_lula_2t ?? 0

  return (
    <div className="space-y-20">
      {/* 1. Interactive Counterfactual Simulator */}
      <section className="space-y-6">
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t('Cenários prontos', 'Preset scenarios')}>
          {presets.map(([rotulo, valor]) => {
            const ativo = mascaraExclusao === valor
            return (
              <button
                key={rotulo}
                type="button"
                onClick={() => setMascaraExclusao(valor)}
                aria-pressed={ativo}
                className={`min-h-10 cursor-pointer border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  ativo ? 'border-tinta bg-tinta text-fundo' : 'border-linha bg-papel text-suave hover:border-tinta hover:text-tinta'
                }`}
              >
                {rotulo}
              </button>
            )
          })}
        </div>

        <div className="border-2 border-tinta bg-papel p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-4">
            <div>
              <p className="font-mono text-xs tracking-wider text-suave uppercase">
                {t('Recontagem instantânea das seções filtradas', 'Instant recount of filtered polling stations')}
              </p>
              <p className="num mt-1 text-sm text-suave">
                {t(
                  `${num(calculo.incSec)} de ${num(calculo.totSec)} seções incluídas (${pct(calculo.incSec, calculo.totSec)}) · ${num(calculo.excSec)} excluídas`,
                  `${num(calculo.incSec)} of ${num(calculo.totSec)} sections included (${pct(calculo.incSec, calculo.totSec)}) · ${num(calculo.excSec)} excluded`,
                )}
              </p>
            </div>
            {validosInc > 0 && (
              <span className="num border border-tinta bg-tinta px-3 py-1 font-mono text-xs font-bold uppercase text-fundo">
                {saldoInc > 0
                  ? t(`Lula à frente por ${num(saldoInc)} votos`, `Lula ahead by ${num(saldoInc)} votes`)
                  : t(`Flávio à frente por ${num(Math.abs(saldoInc))} votos`, `Flávio ahead by ${num(Math.abs(saldoInc))} votes`)}
              </span>
            )}
          </div>

          {validosInc === 0 ? (
            <p className="py-8 text-center text-suave">
              {t(
                'Nenhuma seção atende simultaneamente a todos os filtros marcados. Desmarque um critério.',
                'No polling station matches every checked filter simultaneously. Uncheck a criterion.',
              )}
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="num grid gap-4 sm:grid-cols-2">
                <div className="border border-linha bg-fundo p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">Lula (13)</span>
                    <span className="font-mono text-lg font-bold text-tinta">{pct(calculo.incLula, validosInc)}</span>
                  </div>
                  <p className="mt-1 font-mono text-2xl font-bold text-tinta sm:text-3xl">{num(calculo.incLula)}</p>
                  {calculo.excLula > 0 && (
                    <p className="mt-1 font-mono text-xs text-suave">
                      −{num(calculo.excLula)} {t('votos nas seções excluídas', 'votes in excluded sections')}
                    </p>
                  )}
                </div>

                <div className="border border-linha bg-fundo p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">Flávio Bolsonaro (22)</span>
                    <span className="font-mono text-lg font-bold text-tinta">{pct(calculo.incFlavio, validosInc)}</span>
                  </div>
                  <p className="mt-1 font-mono text-2xl font-bold text-tinta sm:text-3xl">{num(calculo.incFlavio)}</p>
                  {calculo.excFlavio > 0 && (
                    <p className="mt-1 font-mono text-xs text-suave">
                      −{num(calculo.excFlavio)} {t('votos nas seções excluídas', 'votes in excluded sections')}
                    </p>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="flex h-7 gap-0.5 overflow-hidden border border-linha bg-fundo">
                  <div
                    className="flex items-center pl-2.5 font-mono text-xs font-bold text-fundo"
                    style={{ width: `${pctLulaInc}%`, background: '#f2f2f2' }}
                  >
                    {pctLulaInc >= 15 && `13 · ${pct(calculo.incLula, validosInc)}`}
                  </div>
                  <div
                    className="flex items-center justify-end pr-2.5 font-mono text-xs font-bold text-tinta"
                    style={{ width: `${100 - pctLulaInc}%`, background: '#383838' }}
                  >
                    {100 - pctLulaInc >= 15 && `22 · ${pct(calculo.incFlavio, validosInc)}`}
                  </div>
                </div>
                <span aria-hidden className="pointer-events-none absolute -top-1 -bottom-1 left-1/2 w-0.5 -translate-x-1/2 bg-tinta" />
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {filtros.map((f) => {
            const marcado = (mascaraExclusao & f.bit) !== 0
            return (
              <label
                key={f.bit}
                className={`flex cursor-pointer items-start gap-3.5 border p-4 transition-colors ${
                  f.geografico ? 'sm:col-span-2 ' : ''
                }${marcado ? 'border-tinta bg-confere-claro' : 'border-linha bg-papel hover:border-suave'}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternarBit(f.bit)}
                  className="mt-1 size-4 shrink-0 accent-[#f2f2f2]"
                />
                <span className="space-y-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>{f.titulo}</span>
                    {f.geografico && (
                      <span className="border border-linha px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-suave uppercase">
                        {t('Recorte territorial', 'Territorial cut')}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs leading-relaxed text-suave">{f.detalhe}</span>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      {/* 2. Regional & State Arithmetic */}
      <section className="space-y-5 border-t border-linha pt-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('Resultado por região', 'Result by region')}
        </h2>
        <p className="num max-w-[66ch] leading-relaxed text-suave">
          {t(
            `No 2º turno, Flávio Bolsonaro venceu em ${d.estados_vencidos.flavio_ufs_2t} das 27 unidades da federação e liderou nas regiões Sul, Centro-Oeste e Sudeste — somando +${num(flavioForaNE - lulaForaNE)} votos de frente fora do Nordeste (${pct(flavioForaNE, lulaForaNE + flavioForaNE)} × ${pct(lulaForaNE, lulaForaNE + flavioForaNE)}). Como a eleição presidencial soma todos os votos válidos do país num colégio único, a vantagem de +${num(saldoNE)} votos de Lula no Nordeste superou essa margem em +${num(saldoNE - (flavioForaNE - lulaForaNE))} votos.`,
            `In the 2nd round, Flávio Bolsonaro won ${d.estados_vencidos.flavio_ufs_2t} of the 27 federative units and led in the South, Center-West and Southeast — building a +${num(flavioForaNE - lulaForaNE)} vote lead outside the Northeast (${pct(flavioForaNE, lulaForaNE + flavioForaNE)} × ${pct(lulaForaNE, lulaForaNE + flavioForaNE)}). Because Brazil’s presidential race totals all valid votes nationwide in a single pool, Lula’s +${num(saldoNE)} vote margin in the Northeast outweighed that lead by +${num(saldoNE - (flavioForaNE - lulaForaNE))} votes.`,
          )}
        </p>

        <Tabela
          cabecalho={[
            t('Região', 'Region'),
            t('Seções', 'Sections'),
            'Lula (2ºT)',
            'Flávio (2ºT)',
            t('% Flávio', '% Flávio'),
            t('Saldo (Lula − Flávio)', 'Margin (Lula − Flávio)'),
          ]}
          linhas={d.regioes.map((r) => [
            en ? REGIAO_EN[r.regiao] ?? r.regiao : r.regiao,
            num(r.secoes),
            num(r.lula_2t),
            num(r.flavio_2t),
            `${dec(r.pct_flavio_2t)}%`,
            signedNum(r.saldo_lula_2t),
          ])}
        />
      </section>

      {/* 3. Cryptographic & Firmware Census */}
      <section className="space-y-6 border-t border-linha pt-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('Integridade criptográfica, versão de software e retenção 1ºT → 2ºT', 'Cryptographic integrity, firmware version & 1st→2nd round retention')}
        </h2>
        <div className="num grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              `${num(d.integridade.urnas_binarias - d.integridade.rdv_divergentes)} / ${num(d.integridade.urnas_binarias)}`,
              t(`Urnas cuja recontagem voto a voto (RDV) bate com o boletim · ${num(d.integridade.rdv_divergentes)} divergências`, `Machines whose vote-by-vote recount (RDV) matches the tally · ${num(d.integridade.rdv_divergentes)} mismatches`),
            ],
            [
              `${num(d.integridade.hashes_ok)}`,
              t(`Arquivos com hash SHA-512 conferido, de ${num(d.integridade.hashes_verificados)}`, `Files with a matching SHA-512 hash, out of ${num(d.integridade.hashes_verificados)}`),
            ],
            [
              `${d.integridade.versoes_distintas}`,
              t(`Versão de software nas urnas eletrônicas (${d.integridade.versao_software})`, `Software build across electronic machines (${d.integridade.versao_software})`),
            ],
            [
              `${num(d.integridade.votos_sem_habilitacao)}`,
              t('Votos no log sem um eleitor liberado antes (o esperado é zero)', 'Votes in the log with no voter released first (expected: zero)'),
            ],
          ].map(([valor, desc]) => (
            <div key={desc} className="border border-linha bg-papel p-4">
              <p className="font-mono text-xl font-bold text-tinta">{valor}</p>
              <p className="mt-2 text-xs leading-relaxed text-suave">{desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 border border-linha bg-papel p-5">
          <h3 className="text-lg font-bold">
            {t('Teste de subtração de votos entre turnos na mesma seção', 'Cross-round vote subtraction test within the same section')}
          </h3>
          <p className="num text-sm leading-relaxed text-suave">
            {t(
              `Em ${num(d.retencao.secoes_pareadas)} seções comparadas entre o 1º e o 2º turno, Flávio teve menos votos nominais no 2º turno em ${num(d.retencao.flavio_caiu_secoes)} seções (e Lula em ${num(d.retencao.lula_caiu_secoes)}). Nas ${num(d.retencao.flavio_caiu_comp_subiu_secoes)} seções em que Flávio oscilou para baixo sem queda de comparecimento, ${pct(d.retencao.flavio_caiu_ate_5, d.retencao.flavio_caiu_comp_subiu_secoes)} variaram entre 1 e 5 votos — flutuação normal de rotatividade de eleitores — e apenas ${num(d.retencao.flavio_caiu_acima_20)} seções no país inteiro oscilaram mais de 20 votos.`,
              `Across ${num(d.retencao.secoes_pareadas)} sections paired between the 1st and 2nd rounds, Flávio had fewer nominal votes in the 2nd round in ${num(d.retencao.flavio_caiu_secoes)} sections (and Lula in ${num(d.retencao.lula_caiu_secoes)}). Among the ${num(d.retencao.flavio_caiu_comp_subiu_secoes)} sections where Flávio dipped without a turnout drop, ${pct(d.retencao.flavio_caiu_ate_5, d.retencao.flavio_caiu_comp_subiu_secoes)} varied by 1 to 5 votes — normal voter-turnover fluctuation — and only ${num(d.retencao.flavio_caiu_acima_20)} sections nationwide shifted by more than 20 votes.`,
            )}
          </p>
        </div>
      </section>

      {/* 4. Last-Digit Forensic Test (0-9) */}
      <section className="space-y-5 border-t border-linha pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t('Teste forense do último dígito (0 a 9)', 'Last-digit forensic uniformity test (0 to 9)')}
            </h2>
            <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-suave">
              {t(
                'Contagens adulteradas manualmente costumam concentrar dígitos finais em 0, 5 ou 7. Em urnas reais (seções com 50+ votos), cada algarismo final de 0 a 9 deve ocorrer perto de 10,00%.',
                'Manually fabricated tallies typically spike on ending digits 0, 5 or 7. In authentic ballot boxes (sections with 50+ votes), each final digit 0 through 9 should appear near 10.00%.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['comparecimento_2t', t('Comparecimento 2ºT', 'Turnout 2nd R.')],
                ['lula_2t', 'Lula 2ºT'],
                ['flavio_2t', 'Flávio 2ºT'],
              ] as const
            ).map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setAbaDigito(chave)}
                aria-pressed={abaDigito === chave}
                className={`min-h-9 cursor-pointer border px-3 text-xs font-semibold transition-colors ${
                  abaDigito === chave ? 'border-tinta bg-tinta text-fundo' : 'border-linha bg-papel text-suave hover:border-tinta hover:text-tinta'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 border border-linha bg-papel p-5">
          <div className="num flex flex-wrap items-center justify-between gap-2 text-xs text-suave">
            <span>
              {t(
                `Amostra: ${num(serieAtual.secoes)} seções · Esperado por dígito: 10,00%`,
                `Sample: ${num(serieAtual.secoes)} sections · Expected per digit: 10.00%`,
              )}
            </span>
            <span className="font-mono">
              χ² = <span className="font-semibold text-tinta">{dec(serieAtual.chi2)}</span>{' '}
              {serieAtual.chi2 <= serieAtual.critico_95 ? (
                <span className="ml-1.5 border border-tinta px-2 py-0.5 text-tinta">
                  {t('✓ Uniforme (p > 0,05)', '✓ Uniform (p > 0.05)')}
                </span>
              ) : (
                <span className="ml-1.5 border border-linha px-2 py-0.5 text-suave">
                  {t(`Não uniforme (χ² acima de ${dec(serieAtual.critico_95)})`, `Not uniform (χ² above ${dec(serieAtual.critico_95)})`)}
                </span>
              )}
            </span>
          </div>

          <div className="num space-y-2">
            {serieAtual.pcts.map((valorPct, digito) => {
              const largura = Math.min(100, (valorPct / 12) * 100)
              return (
                <div key={digito} className="grid grid-cols-[2rem_1fr_9.5rem] items-center gap-3 text-sm">
                  <span className="font-mono font-bold text-tinta">{digito}</span>
                  <div className="relative h-5 border border-linha bg-fundo">
                    <div className="h-full bg-tinta/80" style={{ width: `${largura.toFixed(2)}%` }} />
                    <span
                      aria-hidden
                      title="10,00%"
                      className="pointer-events-none absolute -top-0.5 -bottom-0.5 w-0.5 bg-tinta"
                      style={{ left: `${((10 / 12) * 100).toFixed(2)}%` }}
                    />
                  </div>
                  <span className="text-right font-mono text-xs">
                    <span className="font-semibold text-tinta">{dec(valorPct)}%</span>{' '}
                    <span className="text-suave">({num(serieAtual.contagens[digito])})</span>
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-suave">
            {t(
              'O traço vertical marca 10,00%. Quando o teste falha, o desenho é uma rampa suave de 0 a 9, não picos em 0 ou 5. A mesma rampa aparece nos votos de Lula quando as seções são separadas por tamanho (50–99, 100–199, 200+ votos): é efeito do tamanho limitado das seções, e atinge os dois candidatos.',
              'The vertical tick marks 10.00%. When the test fails, the shape is a smooth slope from 0 to 9, not spikes at 0 or 5. The same slope shows up in Lula’s votes once sections are split by size (50–99, 100–199, 200+ votes): it comes from the limited size of sections and affects both candidates.',
            )}
          </p>
        </div>
      </section>
    </div>
  )
}
