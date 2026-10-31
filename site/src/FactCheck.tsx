import { useState, type ReactNode } from 'react'
import { TabelaColorida } from './TabelaColorida'
import { colorir, colorirTexto } from './colorNum'
import { loc, num, signedNum } from './format'
import { useLang, useT } from './i18n'
import type { Alegacoes, Urnas } from './Investigacao'
import type { ForenseData } from './SimuladorForense'

export type FactData = {
  abstencao: { turno: number; aptos: number; comparecimento: number; abstencao_pct: number }[]
  biometria: { sem_biometria_1t: number; sem_biometria_2t: number; pct_1t: number; pct_2t: number }
  por_comparecimento: { faixa: string; secoes: number; votantes_a_mais: number; variacao_lula_pp: number; variacao_flavio_pp: number }[]
  extremos: { secoes: number; lula_1t: number; flavio_1t: number; lula_2t: number; flavio_2t: number; municipios: string[] }
  extremos_flavio: number
  relatorio: {
    sem_apos_17h: { secoes_excluidas: number; secoes: number; votantes_excluidos: number; flavio_pct_restante: number; votantes_17h15: number }
    por_fechamento: { faixa: string; secoes: number; votantes: number; lula_1t: number; lula_2t: number }[]
    sp_19h: { secoes: number; capital: number; lula_1t: number; lula_2t: number; saldo_lula: number }
  }
  mesario: null | {
    urnas: number
    votos: number
    liberados_mesario: number
    pct: number
    habilitacao_manual: number
    liberados_apos_17h: number
    urnas_acima_20pct: number
    urnas_mesario_20_ou_mais: number
    urnas_mesario_50_ou_mais: number
    maior_por_mesario: number
    faixas: { faixa: string; urnas: number; liberados: number; lula_vs_cidade_pp: number; flavio_vs_cidade_pp: number }[]
    por_mesario: { grupo: string; urnas: number; liberados: number; votos_lula_flavio: number; lula_vs_cidade_pp: number; flavio_vs_cidade_pp: number }[]
  }
  log: {
    urnas: number
    erros: number
    habilitados: number
    computados: number
    votos_sem_habilitacao: number
    urnas_com_voto_sem_habilitacao: number
    intervalos_menores_10s: number
    urnas_rajada_5: number
    menor_intervalo_s: number
    por_biometria: number
  }
}

type Veredito = 'verdadeiro' | 'falso' | 'ressalva' | 'nao_verificavel'

const VEREDITO: Record<Veredito, [string, string]> = {
  verdadeiro: ['Verdadeiro', 'True'],
  falso: ['Falso', 'False'],
  ressalva: ['Verdadeiro, com ressalva', 'True, with a caveat'],
  nao_verificavel: ['Não verificável', 'Not verifiable'],
}

const VEREDITO_COR: Record<Veredito, string> = {
  verdadeiro: 'border-emerald-500 bg-emerald-950 text-emerald-300',
  falso: 'border-red-500 bg-red-950 text-red-300',
  ressalva: 'border-amber-500 bg-amber-950 text-amber-300',
  nao_verificavel: 'border-purple-500 bg-purple-950 text-purple-300',
}

const VEREDITO_BORDA: Record<Veredito, string> = {
  verdadeiro: 'border-l-emerald-500',
  falso: 'border-l-red-500',
  ressalva: 'border-l-amber-500',
  nao_verificavel: 'border-l-purple-500',
}

const ROTULO_EN: Record<string, string> = {
  Caiu: 'Fell',
  'Subiu até 5 pontos': 'Rose up to 5 points',
  'Subiu mais de 5 pontos': 'Rose more than 5 points',
  Nenhum: 'None',
  'Até 5%': 'Up to 5%',
  '5% a 20%': '5% to 20%',
  'Mais de 20%': 'More than 20%',
  'Menos de 20': 'Fewer than 20',
  '20 a 49': '20 to 49',
  '50 a 99': '50 to 99',
  '100 ou mais': '100 or more',
  Sul: 'South',
  Sudeste: 'Southeast',
  'Centro-Oeste': 'Center-West',
  Norte: 'North',
  Nordeste: 'Northeast',
  Exterior: 'Abroad',
}

const dec = (v: number, d = 2) => v.toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d })
const pp = (v: number) => `${v > 0 ? '+' : ''}${dec(v)}`
const pc = (v: number) => `${dec(v)}%`

const FAIXA_FECHAMENTO_EN: Record<string, string> = {
  'Estados com outro fuso (relógio local antes das 17h)': 'States in other time zones (local clock before 5 pm)',
  '17h00 a 17h00min59': '5:00 to 5:00:59 pm',
  '17h01 a 17h14': '5:01 to 5:14 pm',
  '17h15 ou depois': '5:15 pm or later',
}

function TabelaHorariosFatos({ d }: { d: Alegacoes }) {
  const t = useT()
  const horas = [...new Set(d.emissao_vs_registro.map((r) => r.hora))].sort((a, b) => a - b)
  const valor = (turno: number, hora: number, k: 'emitidos' | 'registrados') =>
    num(d.emissao_vs_registro.find((r) => r.turno === turno && r.hora === hora)?.[k] ?? 0)
  return (
    <TabelaColorida
      cabecalho={[
        t('Hora (Brasília)', 'Hour (Brasília)'),
        t('1º turno: impressos na seção', '1st round: printed at the station'),
        t('1º turno: registrados no TSE', '1st round: registered by the TSE'),
        t('2º turno: impressos na seção', '2nd round: printed at the station'),
        t('2º turno: registrados no TSE', '2nd round: registered by the TSE'),
      ]}
      linhas={horas.map((h) => [`${h}h`, valor(1, h, 'emitidos'), valor(1, h, 'registrados'), valor(2, h, 'emitidos'), valor(2, h, 'registrados')])}
    />
  )
}

function Fonte({ links }: { links: [string, string][] }) {
  const t = useT()
  return (
    <p className="text-sm text-suave">
      {t('Fonte', 'Source')}:{' '}
      {links.map(([nome, url], i) => (
        <span key={url}>
          {i > 0 && ', '}
          <a className="underline underline-offset-2 hover:text-tinta" href={url} target="_blank" rel="noreferrer">
            {colorirTexto(nome)}
          </a>
        </span>
      ))}
      .
    </p>
  )
}

type EntradaFato = {
  afirmacao: string
  veredito: Veredito
  resumo: string
  detalhes?: ReactNode
}

function Item({ afirmacao, veredito, resumo, detalhes, abertoPadrao }: EntradaFato & { abertoPadrao?: boolean }) {
  const en = useLang() === 'en'
  return (
    <details open={abertoPadrao} className={`group border-t border-linha border-l-4 ${VEREDITO_BORDA[veredito]} py-6 pl-4 sm:pl-5`}>
      <summary className="flex cursor-pointer items-start gap-4">
        <span className="flex-1">
          <span className="block text-xl font-semibold tracking-tight text-balance">“{colorirTexto(afirmacao)}”</span>
          <span className={`mt-2.5 inline-block border px-2.5 py-0.5 text-sm font-bold tracking-tight ${VEREDITO_COR[veredito]}`}>
            {VEREDITO[veredito][en ? 1 : 0]}
          </span>
          <span className="mt-3 block max-w-[62ch] leading-relaxed text-suave">{colorirTexto(resumo)}</span>
        </span>
        <span aria-hidden className="mt-1 grid size-8 shrink-0 place-items-center border border-linha text-suave transition-transform group-open:rotate-45 group-hover:border-tinta group-hover:text-tinta">
          +
        </span>
      </summary>
      {detalhes && <div className="mt-6 max-w-[68ch] space-y-4 leading-relaxed">{colorir(detalhes)}</div>}
      <button
        type="button"
        onClick={() =>
          import('./cardFato').then((m) =>
            m.compartilharCard({ afirmacao, veredito, rotulo: VEREDITO[veredito][en ? 1 : 0], resumo, lang: en ? 'en' : 'pt' }),
          )
        }
        className="mt-6 min-h-10 cursor-pointer border border-linha px-4 text-sm font-semibold text-suave hover:border-tinta hover:text-tinta"
      >
        {en ? 'Share as image' : 'Compartilhar como imagem'}
      </button>
    </details>
  )
}

export function FactCheck({
  f,
  a,
  u,
  forense,
  lula,
  flavio,
}: {
  f: FactData
  a: Alegacoes
  u: Urnas
  forense?: ForenseData | null
  lula: number
  flavio: number
}) {
  const t = useT()
  const en = useLang() === 'en'
  const [filtro, setFiltro] = useState<Veredito | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [expandirTodos, setExpandirTodos] = useState(false)

  const rot = (s: string) => (en ? ROTULO_EN[s] ?? s : s)
  const [abs1, abs2] = [f.abstencao.find((x) => x.turno === 1)!, f.abstencao.find((x) => x.turno === 2)!]
  const frente = a.apuracao.filter((p) => p.boletins >= 50 && p.flavio > p.lula)
  const [ini, fim] = [frente[0]?.ate, frente[frente.length - 1]?.ate]
  const tr = a.transferencia
  const r = u.resumo
  const lg = f.log
  const ms = f.mesario
  const rel = f.relatorio
  const maiorModelo = Math.max(...u.modelo_urna.map((m) => Math.abs(m.desvio_vs_municipio_pp ?? 0)))
  const pctL = (100 * lula) / (lula + flavio)
  const grupo100 = ms?.por_mesario.find((g) => g.grupo === '100 ou mais')
  const faixa20 = ms?.faixas.find((x) => x.faixa === 'Mais de 20%')
  const faixa0 = ms?.faixas.find((x) => x.faixa === 'Nenhum')

  const itensForenses: EntradaFato[] = forense
    ? (() => {
        const foraNE = forense.regioes.filter((reg) => reg.regiao !== 'Nordeste')
        const lFora = foraNE.reduce((s, reg) => s + reg.lula_2t, 0)
        const fFora = foraNE.reduce((s, reg) => s + reg.flavio_2t, 0)
        const ne = forense.regioes.find((reg) => reg.regiao === 'Nordeste')!
        const ret = forense.retencao
        const digComp = forense.digitos.comparecimento_2t
        const digLula = forense.digitos.lula_2t
        const digFlavio = forense.digitos.flavio_2t

        let ueNovasSec = 0
        let ueNovasLula = 0
        let ueNovasFlavio = 0
        for (const [mask, sec, vl, vf] of forense.cubo) {
          if ((mask & 1) === 0) {
            ueNovasSec += sec
            ueNovasLula += vl
            ueNovasFlavio += vf
          }
        }
        const pctNovasL = (100 * ueNovasLula) / (ueNovasLula + ueNovasFlavio)

        return [
          {
            afirmacao: t(
              'Flávio venceu na maioria dos estados e nas regiões Sul, Sudeste e Centro-Oeste.',
              'Flávio won most states and the South, Southeast and Center-West regions.',
            ),
            veredito: 'ressalva' as const,
            resumo: t(
              `No 2º turno, Flávio venceu em ${forense.estados_vencidos.flavio_ufs_2t} das 27 UFs e abriu +${num(fFora - lFora)} votos fora do Nordeste (${pc((100 * fFora) / (lFora + fFora))} × ${pc((100 * lFora) / (lFora + fFora))}). Porém a eleição para Presidente soma todos os votos válidos do país: a vantagem de +${num(ne.saldo_lula_2t)} votos de Lula no Nordeste deu o saldo nacional de +${num(lula - flavio)}.`,
              `In the 2nd round, Flávio won ${forense.estados_vencidos.flavio_ufs_2t} of the 27 states/DF and led by +${num(fFora - lFora)} votes outside the Northeast (${pc((100 * fFora) / (lFora + fFora))} × ${pc((100 * lFora) / (lFora + fFora))}). However, Brazil’s presidency is decided by the national valid-vote sum: Lula’s +${num(ne.saldo_lula_2t)} lead in the Northeast produced the +${num(lula - flavio)} national margin.`,
            ),
            detalhes: (
              <>
                <TabelaColorida
                  cabecalho={[
                    t('Região', 'Region'),
                    t('Seções', 'Sections'),
                    'Lula (2ºT)',
                    'Flávio (2ºT)',
                    t('% Flávio', '% Flávio'),
                    t('Saldo (Lula − Flávio)', 'Margin (Lula − Flávio)'),
                  ]}
                  linhas={forense.regioes.map((reg) => [
                    rot(reg.regiao),
                    num(reg.secoes),
                    num(reg.lula_2t),
                    num(reg.flavio_2t),
                    pc(reg.pct_flavio_2t),
                    signedNum(reg.saldo_lula_2t),
                  ])}
                />
                <p className="text-sm">
                  <a href="#/forense" className="font-semibold text-tinta underline underline-offset-4 hover:opacity-80">
                    {t('Abrir o Simulador Forense interativo →', 'Open the interactive Forensic Simulator →')}
                  </a>
                </p>
              </>
            ),
          },
          {
            afirmacao: t(
              'Se contássemos apenas as urnas novas (UE2020 e UE2022), Flávio teria vencido.',
              'If only newer machines (UE2020 and UE2022) were counted, Flávio would have won.',
            ),
            veredito: 'falso' as const,
            resumo: t(
              `Somando exclusivamente as ${num(ueNovasSec)} urnas dos modelos UE2020 e UE2022, o resultado é Lula ${num(ueNovasLula)} (${pc(pctNovasL)}) × Flávio ${num(ueNovasFlavio)} (${pc(100 - pctNovasL)}) — vantagem de +${num(ueNovasLula - ueNovasFlavio)} votos para Lula.`,
              `Summing exclusively the ${num(ueNovasSec)} UE2020 and UE2022 machines, the result is Lula ${num(ueNovasLula)} (${pc(pctNovasL)}) × Flávio ${num(ueNovasFlavio)} (${pc(100 - pctNovasL)}) — a +${num(ueNovasLula - ueNovasFlavio)} vote lead for Lula.`,
            ),
            detalhes: (
              <p>
                {t(
                  'Você pode combinar esse filtro com outros 7 critérios técnicos (biometria, mesário, contingência, horário) em tempo real no ',
                  'You can combine this filter with 7 other technical criteria (biometrics, poll workers, contingency, closing time) in real time in the ',
                )}
                <a href="#/forense" className="font-semibold text-tinta underline underline-offset-4 hover:opacity-80">
                  {t('Simulador Forense', 'Forensic Simulator')}
                </a>
                .
              </p>
            ),
          },
          {
            afirmacao: t(
              'Em milhares de seções Flávio teve menos votos no 2º turno do que no 1º — votos dele foram apagados.',
              'In thousands of sections Flávio got fewer votes in the 2nd round than in the 1st — his votes were deleted.',
            ),
            veredito: 'falso' as const,
            resumo: t(
              `Flávio teve menos votos no 2º turno em ${num(ret.flavio_caiu_secoes)} seções, e Lula também caiu em ${num(ret.lula_caiu_secoes)}. Onde o comparecimento não caiu (${num(ret.flavio_caiu_comp_subiu_secoes)} seções), ${pc((100 * ret.flavio_caiu_ate_5) / ret.flavio_caiu_comp_subiu_secoes)} das oscilações foram de apenas 1 a 5 votos — efeito normal de quem faltou num turno e foi no outro. Em 100% das ${num(forense.integridade.urnas_binarias)} urnas eletrônicas, o RDV e os hashes SHA-512 batem com o boletim.`,
              `Flávio got fewer 2nd-round votes in ${num(ret.flavio_caiu_secoes)} sections, and Lula also dipped in ${num(ret.lula_caiu_secoes)}. Where turnout did not drop (${num(ret.flavio_caiu_comp_subiu_secoes)} sections), ${pc((100 * ret.flavio_caiu_ate_5) / ret.flavio_caiu_comp_subiu_secoes)} of shifts were just 1 to 5 votes — normal voter turnover between rounds. Across 100% of the ${num(forense.integridade.urnas_binarias)} electronic machines, the RDV and SHA-512 hashes match the report.`,
            ),
          },
          {
            afirmacao: t(
              'Os últimos dígitos dos votos nas seções violam a distribuição estatística esperada.',
              'The last digits of section vote counts violate the expected statistical distribution.',
            ),
            veredito: 'ressalva' as const,
            resumo: t(
              `Em ${num(digComp.secoes)} seções com 50+ votos, cada dígito final (0 a 9) do comparecimento aparece entre ${pc(Math.min(...digComp.pcts))} e ${pc(Math.max(...digComp.pcts))} (esperado: 10,00%; qui-quadrado = ${dec(digComp.chi2)}, dentro do limite de ${dec(digComp.critico_95)}). Nos votos de Lula o qui-quadrado é ${dec(digLula.chi2)}. Nos de Flávio, ${dec(digFlavio.chi2)}: acima do limite. Mas o desenho é uma rampa suave do 0 para o 9, sem pico em 0 ou 5, e a mesma rampa aparece nos votos de Lula quando as seções são separadas por tamanho. É efeito do tamanho limitado das seções, não sinal de número inventado.`,
              `Across ${num(digComp.secoes)} sections with 50+ votes, each ending digit (0 to 9) of turnout appears between ${pc(Math.min(...digComp.pcts))} and ${pc(Math.max(...digComp.pcts))} (expected: 10.00%; chi-squared = ${dec(digComp.chi2)}, inside the ${dec(digComp.critico_95)} threshold). For Lula’s votes chi-squared is ${dec(digLula.chi2)}. For Flávio’s, ${dec(digFlavio.chi2)}: above the threshold. But the shape is a smooth slope from 0 to 9, with no spike at 0 or 5, and the same slope shows up in Lula’s votes once stations are split by size. It comes from the limited size of stations, not from made-up numbers.`,
            ),
          },
        ]
      })()
    : []

  const itens: EntradaFato[] = [
    {
      afirmacao: t('É a primeira vez que quem liderou o 1º turno perde o 2º.', 'This is the first time the 1st-round leader lost the 2nd round.'),
      veredito: 'verdadeiro',
      resumo: t(
        'Desde a redemocratização, o candidato mais votado no 1º turno sempre venceu o 2º. Em 2026, Flávio liderou o 1º turno (47,03% × 45,16%) e Lula venceu o 2º.',
        'Since the return to democracy, the candidate who led the 1st round always won the 2nd. In 2026, Flávio led the 1st round (47.03% × 45.16%) and Lula won the 2nd.',
      ),
      detalhes: (
        <Fonte
          links={[
            ['Wikipédia', 'https://pt.wikipedia.org/wiki/Elei%C3%A7%C3%A3o_presidencial_no_Brasil_em_2026'],
            ['Nexo', 'https://www.nexojornal.com.br/expresso/2026/10/27/lula-de-virada-segundo-turno-virada-historica-lula-fatores'],
          ]}
        />
      ),
    },
    {
      afirmacao: t('Todas as pesquisas erraram.', 'Every poll got it wrong.'),
      veredito: 'verdadeiro',
      resumo: t(
        `Na véspera, Datafolha e Quaest davam Flávio 51% × Lula 49%, e a AtlasIntel 50,8% × 49,2%. O resultado foi Lula ${pc(pctL)} × Flávio ${pc(100 - pctL)} — cerca de 2,8 pontos de erro para cada candidato, acima da margem de 2 pontos.`,
        `On the eve of the vote, Datafolha and Quaest had Flávio 51% × Lula 49%, and AtlasIntel 50.8% × 49.2%. The result was Lula ${pc(pctL)} × Flávio ${pc(100 - pctL)} — an error of about 2.8 points per candidate, above the 2-point margin.`,
      ),
      detalhes: (
        <>
          <p>
            {t(
              'Erros desse tamanho já aconteceram antes, no sentido oposto: na véspera do 1º turno de 2022, o Datafolha dava Bolsonaro com 36% dos votos válidos, e ele teve 43,2% — cerca de 7 pontos de diferença. Pesquisa é uma estimativa por amostra; o resultado é a contagem dos votos, que é o que conferimos neste site.',
              'Errors of this size have happened before, in the opposite direction: on the eve of the 2022 1st round, Datafolha had Bolsonaro at 36% of valid votes, and he got 43.2% — about 7 points off. A poll is a sample estimate; the result is the count of the votes, which is what this site checks.',
            )}
          </p>
          <Fonte
            links={[
              ['CNN Brasil', 'https://cnnbrasil.com.br/eleicoes/ultimas-pesquisas-segundo-turno-eleicao'],
              ['Tribuna PR', 'https://www.tribunapr.com.br/eleicoes/2026/flavio-bolsonaro-e-lula-empatam-tecnicamente-a-vespera-do-2o-turno-aponta-atlasintel/amp/'],
              ['Metrópoles (2022)', 'https://www.metropoles.com/brasil/eleicoes-2022/datafolha-lula-tem-50-dos-votos-validos-bolsonaro-acumula-36'],
            ]}
          />
        </>
      ),
    },
    ...itensForenses,
    {
      afirmacao: t('Nunca votou mais gente no 2º turno do que no 1º.', 'More people never voted in the 2nd round than in the 1st.'),
      veredito: 'ressalva',
      resumo: t(
        `Em 2022 isso já tinha acontecido (abstenção de 20,95% para 20,59%). Mas em 2026 a queda foi bem maior: de ${pc(abs1.abstencao_pct)} para ${pc(abs2.abstencao_pct)} — ${num(abs2.comparecimento - abs1.comparecimento)} pessoas a mais.`,
        `It had already happened in 2022 (abstention from 20.95% to 20.59%). But in 2026 the drop was much bigger: from ${pc(abs1.abstencao_pct)} to ${pc(abs2.abstencao_pct)} — ${num(abs2.comparecimento - abs1.comparecimento)} more people.`,
      ),
      detalhes: (
        <>
          <p>{t('Verificamos se esses eleitores a mais têm cara de votos inseridos. Três testes:', 'We checked whether these extra voters look like inserted votes. Three tests:')}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              {t(
                `Eleitores liberados sem a digital: ${pc(f.biometria.pct_1t)} dos votantes no 1º turno e ${pc(f.biometria.pct_2t)} no 2º. Praticamente igual — os eleitores a mais foram identificados pela digital como os demais.`,
                `Voters released without a fingerprint: ${pc(f.biometria.pct_1t)} of voters in the 1st round and ${pc(f.biometria.pct_2t)} in the 2nd. Practically the same — the extra voters were identified by fingerprint like everyone else.`,
              )}
            </li>
            <li>
              {t(
                'Se votos tivessem sido inseridos, o ganho de um candidato se concentraria onde o comparecimento subiu. Não foi o que aconteceu: a variação foi parecida em todo tipo de seção, inclusive onde o comparecimento caiu.',
                'If votes had been inserted, one candidate’s gain would concentrate where turnout rose. That is not what happened: the change was similar in every kind of section, including where turnout fell.',
              )}
            </li>
            <li>
              {t(
                'O diário de cada urna registra cada eleitor liberado e cada voto (teste completo no item “votos sem eleitor”, abaixo).',
                'Each machine’s log records every voter released and every vote (full test in the “votes without a voter” item below).',
              )}
            </li>
          </ul>
          <TabelaColorida
            cabecalho={[
              t('Comparecimento na seção', 'Turnout in the section'),
              t('Seções', 'Sections'),
              t('Pessoas a mais', 'Extra people'),
              t('Variação Lula (pontos)', 'Change Lula (points)'),
              t('Variação Flávio (pontos)', 'Change Flávio (points)'),
            ]}
            linhas={f.por_comparecimento.map((x) => [rot(x.faixa), num(x.secoes), num(x.votantes_a_mais), pp(x.variacao_lula_pp), pp(x.variacao_flavio_pp)])}
          />
          <Fonte links={[['CUT / TSE (2022)', 'https://www.cut.org.br/noticias/total-de-abstencoes-caiu-de-20-95-para-20-59-entre-o-1-e-o-2-turno-da-eleicao-1f2f']]} />
        </>
      ),
    },
    {
      afirmacao: t('Votos foram colocados nas urnas sem eleitor.', 'Votes were put into the machines without a voter.'),
      veredito: lg.votos_sem_habilitacao === 0 ? 'falso' : 'ressalva',
      resumo: t(
        `O diário de ${num(lg.urnas)} urnas registra ${num(lg.habilitados)} eleitores liberados para votar e ${num(lg.computados)} votos computados. Votos computados sem um eleitor liberado antes: ${num(lg.votos_sem_habilitacao)}.`,
        `The logs of ${num(lg.urnas)} machines record ${num(lg.habilitados)} voters released to vote and ${num(lg.computados)} votes cast. Votes cast without a voter released first: ${num(lg.votos_sem_habilitacao)}.`,
      ),
      detalhes: (
        <>
          <p>
            {t(
              'Cada voto só pode ser registrado depois que o mesário libera um eleitor na urna (pela digital ou pelos dados do título). Contamos, em cada urna, quantas vezes um voto foi registrado sem um eleitor liberado antes dele, e também se houve votos em sequência rápida demais para uma pessoa (menos de 10 segundos entre um e outro).',
              'A vote can only be recorded after a poll worker releases a voter on the machine (by fingerprint or by ID data). In every machine we counted how many times a vote was recorded with no voter released before it, and whether votes came too fast for a person (less than 10 seconds apart).',
            )}
          </p>
          <ul className="num space-y-2">
            <li>
              {t('Urnas com algum voto sem eleitor liberado', 'Machines with any vote without a released voter')}: <strong>{num(lg.urnas_com_voto_sem_habilitacao)}</strong>
            </li>
            <li>
              {t('Intervalos de menos de 10 segundos entre dois votos', 'Gaps of less than 10 seconds between two votes')}: <strong>{num(lg.intervalos_menores_10s)}</strong>
            </li>
            <li>
              {t('Urnas com 5 ou mais votos seguidos a menos de 20 segundos um do outro', 'Machines with 5 or more votes in a row less than 20 seconds apart')}:{' '}
              <strong>{num(lg.urnas_rajada_5)}</strong>
            </li>
          </ul>
          <p className="text-suave">
            {t(
              'Os intervalos curtos estão todos em 3 urnas e são de 0 segundo: nelas o pacote traz o mesmo diário duas vezes (cópia da urna e cópia do cartão de memória), então cada voto aparece repetido. A recontagem dos votos guardados nessas 3 urnas bate com o boletim.',
              'The short gaps are all in 3 machines and are 0 seconds: their package contains the same log twice (machine copy and memory-card copy), so each vote appears duplicated. The recount of the votes stored in those 3 machines matches the report.',
            )}
          </p>
        </>
      ),
    },
    ms == null
      ? {
          afirmacao: t('Mesários liberaram (“preencheram”) votos no lugar dos eleitores.', 'Poll workers released (“filled in”) votes in place of voters.'),
          veredito: 'nao_verificavel',
          resumo: t(
            'Estamos contando, no diário de cada urna, quantos eleitores foram liberados por mesário e como essas seções votaram. O resultado aparece aqui assim que a contagem terminar.',
            'We are counting, in each machine’s log, how many voters were released by a poll worker and how those sections voted. The result will appear here when the count is done.',
          ),
        }
      : {
          afirmacao: t('Mesários liberaram (“preencheram”) votos no lugar dos eleitores.', 'Poll workers released (“filled in”) votes in place of voters.'),
          veredito: 'falso',
          resumo: t(
            `Quando a digital do eleitor falha, o mesário pode liberar a urna com a própria digital. Isso aconteceu ${num(ms.liberados_mesario)} vezes no 2º turno — ${pc(ms.pct)} dos votos (além de ${num(ms.habilitacao_manual)} pedidos de dado cadastral quando a digital não leu). As seções com muitas liberações por mesário não votaram de forma diferente numa mesma direção.`,
            `When a voter’s fingerprint fails, the poll worker may release the machine with their own fingerprint. This happened ${num(ms.liberados_mesario)} times in the 2nd round — ${pc(ms.pct)} of votes (alongside ${num(ms.habilitacao_manual)} birth-year checks when fingerprints failed). Sections with many poll-worker releases did not vote differently in any consistent direction.`,
          ),
          detalhes: (
            <>
              <p>
                {t(
                  'O diário de cada urna registra cada vez que um mesário libera um eleitor. Se mesários estivessem votando no lugar de eleitores a favor de um lado, as seções com mais liberações votariam mais nesse lado do que as outras seções da mesma cidade — e quanto mais liberações, maior a diferença.',
                  'Each machine’s log records every time a poll worker releases a voter. If poll workers were voting in place of voters for one side, sections with more releases would lean further to that side than the other sections in the same city — and the more releases, the bigger the gap.',
                )}
              </p>
              <TabelaColorida
                cabecalho={[
                  t('Votos liberados por mesário', 'Votes released by poll worker'),
                  t('Seções', 'Sections'),
                  t('Liberações', 'Releases'),
                  t('Lula vs. cidade (pontos)', 'Lula vs. city (points)'),
                  t('Flávio vs. cidade (pontos)', 'Flávio vs. city (points)'),
                ]}
                linhas={ms.faixas.map((x) => [rot(x.faixa), num(x.urnas), num(x.liberados), pp(x.lula_vs_cidade_pp), pp(x.flavio_vs_cidade_pp)])}
              />
              {faixa20 && faixa0 && (
                <p>
                  {t(
                    `As seções com mais de 20% de liberações por mesário votaram ${dec(Math.abs(faixa20.lula_vs_cidade_pp))} ponto ${faixa20.lula_vs_cidade_pp >= 0 ? 'mais em Lula' : 'mais em Flávio'} que a própria cidade — mas as seções sem nenhuma liberação também votaram ${dec(Math.abs(faixa0.lula_vs_cidade_pp))} ponto ${faixa0.lula_vs_cidade_pp >= 0 ? 'mais em Lula' : 'mais em Flávio'}, e as faixas do meio ficaram perto de zero. Não há o padrão de “quanto mais liberação, mais votos para um lado”.`,
                    `Sections with more than 20% poll-worker releases voted ${dec(Math.abs(faixa20.lula_vs_cidade_pp))} point ${faixa20.lula_vs_cidade_pp >= 0 ? 'more for Lula' : 'more for Flávio'} than their own city — but sections with no releases at all also voted ${dec(Math.abs(faixa0.lula_vs_cidade_pp))} point ${faixa0.lula_vs_cidade_pp >= 0 ? 'more for Lula' : 'more for Flávio'}, and the middle bands were close to zero. There is no “more releases, more votes for one side” pattern.`,
                  )}
                </p>
              )}
              <p>
                {t(
                  `Também olhamos o maior número de eleitores liberados por um único mesário em cada seção. O máximo foi ${num(ms.maior_por_mesario)}.`,
                  `We also looked at the largest number of voters released by a single poll worker in each section. The maximum was ${num(ms.maior_por_mesario)}.`,
                )}
              </p>
              <TabelaColorida
                cabecalho={[
                  t('Liberados por um só mesário', 'Released by one poll worker'),
                  t('Seções', 'Sections'),
                  t('Votos (Lula + Flávio)', 'Votes (Lula + Flávio)'),
                  t('Lula vs. cidade (pontos)', 'Lula vs. city (points)'),
                  t('Flávio vs. cidade (pontos)', 'Flávio vs. city (points)'),
                ]}
                linhas={ms.por_mesario.map((x) => [rot(x.grupo), num(x.urnas), num(x.votos_lula_flavio), pp(x.lula_vs_cidade_pp), pp(x.flavio_vs_cidade_pp)])}
              />
              {grupo100 && (
                <p>
                  {t(
                    `Em ${num(grupo100.urnas)} seções, um único mesário liberou 100 eleitores ou mais — padrão de leitor de digital com defeito. Essas seções votaram, em média, ${dec(Math.abs(grupo100.lula_vs_cidade_pp))} ponto ${grupo100.lula_vs_cidade_pp >= 0 ? 'mais em Lula' : 'mais em Flávio'} que as próprias cidades e somam ${num(grupo100.votos_lula_flavio)} votos.`,
                    `In ${num(grupo100.urnas)} sections, a single poll worker released 100 or more voters — the pattern of a faulty fingerprint reader. On average these sections voted ${dec(Math.abs(grupo100.lula_vs_cidade_pp))} point ${grupo100.lula_vs_cidade_pp >= 0 ? 'more for Lula' : 'more for Flávio'} than their own cities, and total ${num(grupo100.votos_lula_flavio)} votes.`,
                  )}
                </p>
              )}
              <p className="text-suave">
                {t(
                  'A digital de quem liberou cada voto fica gravada e é enviada ao TSE, mas esse arquivo não é público (contém dado biométrico). Por isso não dá para verificar daqui quem encostou o dedo — só quantas liberações houve e como as seções votaram.',
                  'The fingerprint of whoever released each vote is stored and sent to the TSE, but that file is not public (it contains biometric data). So we cannot check from here whose finger it was — only how many releases there were and how the sections voted.',
                )}
              </p>
              <Fonte
                links={[
                  ['TSE', 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/como-a-justica-eleitoral-identifica-o-eleitor-na-secao-e-blinda-a-votacao-contra-fraudes'],
                  ['Lupa', 'https://www.agencialupa.org/eleicoes/2026/10/24/e-falso-que-mesarios-podem-votar-no-lugar-de-eleitores-ausentes/'],
                ]}
              />
            </>
          ),
        },
    {
      afirmacao: t('As urnas de Serafina Corrêa (RS) tinham votos pré-registrados para Lula.', 'The machines in Serafina Corrêa (RS) had votes pre-registered for Lula.'),
      veredito: 'falso',
      resumo: t(
        'As 40 urnas da cidade abriram às 8h00 e o log de nenhuma delas tem voto antes disso. Flávio venceu lá com 8.163 votos contra 2.511 de Lula (76,5%). Log, boletim e recontagem voto a voto têm os mesmos 10.968 votos. No país inteiro, nenhuma urna registra voto antes da abertura: os votos que aparecem antes das 8h no relógio da urna são de MT, MS, AM, RO, AC e RR, que abrem às 6h ou 7h no horário local, ou seja, 8h de Brasília.',
        'All 40 machines in the town opened at 8:00 am and none of their logs has a vote before that. Flávio won there with 8,163 votes against 2,511 for Lula (76.5%). Log, report and vote-by-vote recount all show the same 10,968 votes. Nationwide, no machine records a vote before opening: votes showing before 8 am on the machine clock are from MT, MS, AM, RO, AC and RR, which open at 6 or 7 am local time, i.e. 8 am Brasília time.',
      ),
      detalhes: <Fonte links={[['Aos Fatos', 'https://www.aosfatos.org/noticias/e-falso-que-urnas-tinham-votos-pre-registrados-para-lula-em-serafina-correa-rs/']]} />,
    },
    {
      afirmacao: t(
        'Os dados batem, mas a fraude foi dentro da urna: o programa gravou votos diferentes dos que as pessoas digitaram.',
        'The data adds up, but the fraud happened inside the machine: the software recorded votes different from what people typed.',
      ),
      veredito: 'nao_verificavel',
      resumo: t(
        `Os arquivos não conseguem responder isso. Recontamos, um por um, os votos guardados dentro de ${num(r.com_rdv)} urnas, e em todas a recontagem é igual ao boletim. Mas um programa adulterado gravaria o voto errado já na hora da tecla, e todos os arquivos continuariam batendo entre si.`,
        `The files cannot answer this. We recounted, one by one, the votes stored inside ${num(r.com_rdv)} machines, and in every one the recount equals the report. But tampered software would record the wrong vote at the moment of the keypress, and every file would still match the others.`,
      ),
      detalhes: (
        <>
          <p>
            {t(
              'O que os arquivos provam: nada foi alterado depois que a urna gravou os votos (boletim, RDV, log, assinatura e certificado conferem em todas as urnas). O que não provam: que o programa gravou o que o eleitor digitou.',
              'What the files prove: nothing was changed after the machine recorded the votes (report, RDV, log, signature and certificate match in every machine). What they do not prove: that the software recorded what the voter typed.',
            )}
          </p>
          <p>
            {t(
              'O teste que cobre esse ponto é o Teste de Integridade: urnas sorteadas na véspera recebem, no dia da eleição, uma votação em cédulas de papel, filmada, e no fim o boletim é comparado com as cédulas. No 2º turno, segundo a Justiça Eleitoral, não houve divergência no TSE (2 urnas, 389 votos), em São Paulo (33 urnas), em Alagoas (23) e em Santa Catarina (27). É um teste por amostra, feito e divulgado pela própria Justiça Eleitoral, que não conseguimos refazer de fora.',
              'The test that covers this is the Integrity Test: machines drawn the day before receive, on election day, a filmed vote using paper ballots, and at the end the report is compared with the ballots. In the 2nd round, according to the Electoral Courts, there was no discrepancy at the TSE (2 machines, 389 votes), in São Paulo (33 machines), Alagoas (23) or Santa Catarina (27). It is a sample test, run and reported by the Electoral Courts themselves, which we cannot redo from outside.',
            )}
          </p>
          <p>
            {t(
              'A urna também confere a assinatura do próprio programa antes de funcionar. Em Lamim (MG), a assinatura não bateu e a urna se recusou a abrir a votação (página Inconsistências). Para um programa adulterado rodar, ele precisaria estar assinado com a chave do TSE.',
              'The machine also checks its own software signature before running. In Lamim (MG) the signature failed and the machine refused to open voting (Inconsistencies page). For tampered software to run, it would have to be signed with the TSE key.',
            )}
          </p>
          <Fonte
            links={[
              ['TSE', 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/teste-de-integridade-do-2o-turno-no-tse-confirma-correspondencia-entre-cedulas-e-votos-nas-urnas'],
              ['TRE-SP', 'https://www.tre-sp.jus.br/comunicacao/noticias/2026/Outubro/teste-de-integridade-das-urnas-no-2o-turno-e-concluido-sem-divergencias-em-sao-paulo'],
              ['TRE-SC', 'https://www.tre-sc.jus.br/comunicacao/noticias/2026/Outubro/teste-de-integridade-confirma-seguranca-da-urna-e-reforca-a-transparencia-das-eleicoes-2026'],
              ['Cada Minuto (AL)', 'https://www.cadaminuto.com.br/noticia/2026/10/27/eleicoes-2026-23-urnas-eletronicas-foram-auditadas-durante-o-2-turno-em-al'],
            ]}
          />
        </>
      ),
    },
    {
      afirmacao: t('Flávio estava ganhando até as 17h.', 'Flávio was winning until 5 pm.'),
      veredito: 'falso',
      resumo: t(
        `Às 17h, só 0,4% das urnas tinham sido registradas no TSE, quase todas do exterior. Na contagem parcial, Flávio esteve à frente entre ${ini} e ${fim} (horário de Brasília), porque Sul e Centro-Oeste foram registrados antes do Nordeste e do Sudeste.`,
        `At 5 pm, only 0.4% of the machines had been registered by the TSE, almost all from abroad. In the partial count, Flávio was ahead between ${ini} and ${fim} (Brasília time), because the South and Center-West were registered before the Northeast and Southeast.`,
      ),
      detalhes: (
        <>
          <p>
            {t(
              'Com a prorrogação até as 19h, o TSE só passou a registrar os boletins depois das 19h. Mas a grande maioria das urnas fechou e imprimiu o boletim às 17h — o resultado de cada seção já estava colado na porta antes de a contagem começar:',
              'With voting extended until 7 pm, the TSE only began registering reports after 7 pm. But the vast majority of machines closed and printed their reports at 5 pm — each section’s result was already posted on the door before the count began:',
            )}
          </p>
          <TabelaHorariosFatos d={a} />
        </>
      ),
    },
    {
      afirmacao: t('A prorrogação até as 19h decidiu a eleição.', 'The extension until 7 pm decided the election.'),
      veredito: 'falso',
      resumo: t(
        `Pelos diários das urnas, ${num(u.apos_horario.apos_17h)} votos foram dados depois das 17h e ${num(u.apos_horario.apos_19h)} depois das 19h. A diferença final foi de ${num(lula - flavio)} votos.`,
        `According to the machine logs, ${num(u.apos_horario.apos_17h)} votes were cast after 5 pm and ${num(u.apos_horario.apos_19h)} after 7 pm. The final gap was ${num(lula - flavio)} votes.`,
      ),
    },
    {
      afirmacao: t(
        'Sem as urnas que funcionaram depois das 17h, Flávio teria 52,39% e venceria (“Relatório Pericial Independente”).',
        'Without the machines that ran past 5 pm, Flávio would have 52.39% and win (“Independent Forensic Report”).',
      ),
      veredito: 'falso',
      resumo: t(
        `A conta existe: refizemos e deu os mesmos ${pc(rel.sem_apos_17h.flavio_pct_restante)}. Mas, para chegar nela, o relatório joga fora ${num(rel.sem_apos_17h.secoes_excluidas)} das ${num(rel.sem_apos_17h.secoes)} seções (${num(rel.sem_apos_17h.votantes_excluidos)} votantes, 70% do país): todas as que fecharam a partir de 17h01. Isso é o normal: a urna só fecha depois que o último eleitor da fila vota. O próprio relatório fala em 2,5 milhões de votantes depois das 17h, mas tira 90 milhões da conta.`,
        `The arithmetic is real: we redid it and got the same ${pc(rel.sem_apos_17h.flavio_pct_restante)}. But to get there the report throws out ${num(rel.sem_apos_17h.secoes_excluidas)} of ${num(rel.sem_apos_17h.secoes)} stations (${num(rel.sem_apos_17h.votantes_excluidos)} voters, 70% of the country): every one that closed at 5:01 pm or later. That is normal: a machine only closes after the last voter in line has voted. The report itself speaks of 2.5 million voters after 5 pm, yet removes 90 million from the count.`,
      ),
      detalhes: (
        <>
          <p>
            {t(
              'Separando as seções pelo horário em que fecharam, Lula subiu quase o mesmo tanto do 1º para o 2º turno em todos os grupos. As que fecharam mais tarde já eram mais Lula no 1º turno, porque são seções grandes de cidade, com fila:',
              'Splitting stations by closing time, Lula rose by almost the same amount from the 1st to the 2nd round in every group. Those that closed later already leaned Lula in the 1st round, because they are large city stations with lines:',
            )}
          </p>
          <TabelaColorida
            cabecalho={[t('Fechou', 'Closed'), t('Seções', 'Stations'), t('Lula 1º turno', 'Lula 1st round'), t('Lula 2º turno', 'Lula 2nd round')]}
            linhas={rel.por_fechamento.map((r) => [en ? FAIXA_FECHAMENTO_EN[r.faixa] ?? r.faixa : r.faixa, num(r.secoes), pc(r.lula_1t), pc(r.lula_2t)])}
          />
          <p>
            {t(
              'O relógio da urna marca a hora local. Desde 2022 a votação fecha às 17h de Brasília no país todo, por isso estados com outro fuso aparecem fechando às 15h ou 16h.',
              'The machine clock shows local time. Since 2022 voting closes at 5 pm Brasília time nationwide, so states in other time zones appear to close at 3 or 4 pm.',
            )}
          </p>
          <Fonte
            links={[
              ['Lupa', 'https://www.agencialupa.org/eleicoes/2026/10/30/documento-falso-distorce-dados-do-tse-para-alegar-fraude-na-eleicao-presidencial-de-2026/'],
              ['Núcleo', 'https://nucleo.jor.br/republicacao/2026/10/29/relatorio-apocrifo-distorce-microdados-do-tse-para-alegar-fraude-eleitoral/'],
            ]}
          />
        </>
      ),
    },
    {
      afirmacao: t(
        `Em São Paulo, ${num(rel.sp_19h.secoes)} seções passaram das 19h e deram ${pc(rel.sp_19h.lula_2t)} a Lula.`,
        `In São Paulo, ${num(rel.sp_19h.secoes)} stations stayed open past 7 pm and gave Lula ${pc(rel.sp_19h.lula_2t)}.`,
      ),
      veredito: 'ressalva',
      resumo: t(
        `Os números estão certos. Mas ${num(rel.sp_19h.capital)} dessas seções ficam na capital, e no 1º turno, sem prorrogação nenhuma, as mesmas seções já tinham dado ${pc(rel.sp_19h.lula_1t)} a Lula. Juntas, deram a Lula uma vantagem de ${num(rel.sp_19h.saldo_lula)} votos, contra uma diferença nacional de ${num(lula - flavio)}.`,
        `The numbers are right. But ${num(rel.sp_19h.capital)} of these stations are in the city of São Paulo, and in the 1st round, with no extension at all, the same stations had already given Lula ${pc(rel.sp_19h.lula_1t)}. Together they gave Lula a ${num(rel.sp_19h.saldo_lula)}-vote edge, against a national gap of ${num(lula - flavio)}.`,
      ),
    },
    {
      afirmacao: t('8,6 milhões de pessoas votaram sem biometria.', '8.6 million people voted without biometrics.'),
      veredito: 'ressalva',
      resumo: t(
        `Verdade: ${num(f.biometria.sem_biometria_2t)} votantes (${pc(f.biometria.pct_2t)}) foram liberados sem a digital no 2º turno. No 1º turno foram ${num(f.biometria.sem_biometria_1t)} (${pc(f.biometria.pct_1t)}), quase a mesma proporção. Quem não tem digital cadastrada ou cuja digital falha vota com documento conferido pelo mesário.`,
        `True: ${num(f.biometria.sem_biometria_2t)} voters (${pc(f.biometria.pct_2t)}) were released without a fingerprint in the 2nd round. In the 1st round it was ${num(f.biometria.sem_biometria_1t)} (${pc(f.biometria.pct_1t)}), nearly the same share. People with no fingerprint on file, or whose fingerprint fails, vote after the poll worker checks their ID.`,
      ),
    },
    {
      afirmacao: t('O crescimento de Lula entre os turnos é matematicamente impossível.', 'Lula’s growth between rounds is mathematically impossible.'),
      veredito: 'falso',
      resumo: t(
        `Lula ganhou ${num(tr.ganho_lula)} votos e Flávio ${num(tr.ganho_flavio)}. Somados, saem exatamente de votos de outros candidatos no 1º turno (${num(tr.outros_1t)}), brancos e nulos a menos (${num(tr.queda_brancos_nulos)}) e eleitores a mais (${num(tr.novos_votantes)}). A conta fecha em cada uma das ${num(tr.secoes)} seções.`,
        `Lula gained ${num(tr.ganho_lula)} votes and Flávio ${num(tr.ganho_flavio)}. Combined, they come exactly from votes for other 1st-round candidates (${num(tr.outros_1t)}), fewer blank and null votes (${num(tr.queda_brancos_nulos)}) and extra voters (${num(tr.novos_votantes)}). The numbers add up in each of the ${num(tr.secoes)} sections.`,
      ),
    },
    {
      afirmacao: t('Há seções em que Flávio teve zero votos.', 'There are sections where Flávio got zero votes.'),
      veredito: 'ressalva',
      resumo: t(
        `Verdade: são ${num(f.extremos.secoes)} seções, com ${num(f.extremos.lula_2t)} votos para Lula, o mesmo número que circula nas redes. Mas não é coisa do 2º turno: no 1º turno, essas mesmas seções deram Lula ${num(f.extremos.lula_1t)} × Flávio ${num(f.extremos.flavio_1t)}. Também há ${num(f.extremos_flavio)} seções com zero votos para Lula.`,
        `True: there are ${num(f.extremos.secoes)} such sections, with ${num(f.extremos.lula_2t)} votes for Lula, the same figure circulating online. But this is not new in the 2nd round: in the 1st round the same sections gave Lula ${num(f.extremos.lula_1t)} × Flávio ${num(f.extremos.flavio_1t)}. There are also ${num(f.extremos_flavio)} sections with zero votes for Lula.`,
      ),
      detalhes: (
        <p>
          {t('Ficam principalmente em', 'They are mostly in')}: {f.extremos.municipios.join(', ')} —{' '}
          {t('municípios com grandes terras indígenas.', 'municipalities with large Indigenous territories.')}
        </p>
      ),
    },
    {
      afirmacao: t('124 mil urnas tiveram votos só para Lula.', '124,000 machines had votes only for Lula.'),
      veredito: 'falso',
      resumo: t(
        `Contamos nos boletins das 499.207 seções: são ${num(f.extremos.secoes)} seções com todos os votos válidos para Lula (somando ${num(f.extremos.lula_2t)} votos), não 124 mil. O total de votos que circula está certo; o número de urnas, não. Outras ${num(f.extremos_flavio)} seções deram todos os votos válidos a Flávio.`,
        `We counted across the reports of all 499,207 stations: ${num(f.extremos.secoes)} stations gave every valid vote to Lula (${num(f.extremos.lula_2t)} votes in total), not 124,000. The vote total being shared is right; the number of machines is not. Another ${num(f.extremos_flavio)} stations gave every valid vote to Flávio.`,
      ),
      detalhes: <Fonte links={[['Fato ou Boato', 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/e-falso-que-124-mil-urnas-tenham-registrado-votos-apenas-para-lula-no-2o-turno-das-eleicoes-2026']]} />,
    },
    {
      afirmacao: t(
        'A soma de três boletins em Teixeira de Freitas (BA) prova fraude: a diferença dá 164 votos, e o TSE mostra 93.',
        'Adding up three reports in Teixeira de Freitas (BA) proves fraud: the gap is 164 votes, but the TSE shows 93.',
      ),
      veredito: 'falso',
      resumo: t(
        'A cidade tem 303 seções. Somando todas, Flávio venceu por 41.454 a 41.361, ou seja, 93 votos, como mostra o TSE. Flávio ganhou em 175 seções e Lula em 128. Três seções escolhidas entre as melhores de Flávio dão uma diferença maior que a da cidade: só as três melhores somam 331 votos de vantagem. As outras seções compensam.',
        'The city has 303 stations. Adding all of them, Flávio won 41,454 to 41,361, i.e. by 93 votes, as the TSE shows. Flávio won 175 stations and Lula 128. Three stations picked from Flávio’s best give a bigger gap than the city’s: his top three alone add up to a 331-vote lead. The other stations offset it.',
      ),
      detalhes: (
        <Fonte
          links={[
            ['Aos Fatos', 'https://www.aosfatos.org/noticias/soma-votos-tres-secoes-ba-nao-comprova-fraude/'],
            ['Fato ou Boato', 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/soma-de-tres-boletins-de-urna-nao-comprova-fraude-na-eleicao-presidencial-em-teixeira-de-freitas-ba'],
          ]}
        />
      ),
    },
    {
      afirmacao: t('Urnas mais antigas favoreceram um candidato.', 'Older machines favoured a candidate.'),
      veredito: 'falso',
      resumo: t(
        `Comparando cada urna com as outras da mesma cidade, a maior diferença entre modelos foi de ${dec(maiorModelo)} ponto percentual.`,
        `Comparing each machine with the others in the same city, the largest difference between models was ${dec(maiorModelo)} percentage point.`,
      ),
    },
    {
      afirmacao: t('O presidente dos EUA disse que a eleição foi fraudada.', 'The US president said the election was rigged.'),
      veredito: 'ressalva',
      resumo: t(
        'Donald Trump disse em 26/10 que a eleição “pareceu fraudada”, citando a forma da apuração e a prorrogação do horário. Ele não apresentou dados. Os dois pontos estão verificados acima.',
        'On Oct 26, Donald Trump said the election “looked rigged”, citing the way it was tabulated and the extended voting hours. He presented no data. Both points are checked above.',
      ),
      detalhes: (
        <Fonte
          links={[
            ['Euronews', 'https://www.euronews.com/2026/10/26/trump-says-brazil-election-looked-rigged-without-giving-evidence'],
            ['Bloomberg', 'https://www.bloomberg.com/news/articles/2026-10-26/trump-says-brazil-election-looked-rigged-after-lula-victory'],
          ]}
        />
      ),
    },
  ]

  const ordemVereditos: Veredito[] = ['verdadeiro', 'ressalva', 'falso', 'nao_verificavel']
  const contagens = ordemVereditos
    .map((v) => ({ veredito: v, total: itens.filter((item) => item.veredito === v).length }))
    .filter((c) => c.total > 0)

  const termo = busca.trim().toLowerCase()
  const visiveis = itens.filter((item) => {
    if (filtro !== 'todos' && item.veredito !== filtro) return false
    if (!termo) return true
    return item.afirmacao.toLowerCase().includes(termo) || item.resumo.toLowerCase().includes(termo)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t('Filtrar por veredito', 'Filter by verdict')}>
          <button
            type="button"
            onClick={() => setFiltro('todos')}
            aria-pressed={filtro === 'todos'}
            className={`min-h-10 cursor-pointer border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              filtro === 'todos' ? 'border-tinta bg-tinta text-fundo' : 'border-linha bg-papel text-suave hover:border-tinta hover:text-tinta'
            }`}
          >
            {t('Todos', 'All')} <span className={`num ml-1 font-bold ${filtro === 'todos' ? 'text-fundo' : 'text-tinta'}`}>{itens.length}</span>
          </button>
          {contagens.map(({ veredito, total }) => {
            const ativo = filtro === veredito
            return (
              <button
                key={veredito}
                type="button"
                onClick={() => setFiltro(ativo ? 'todos' : veredito)}
                aria-pressed={ativo}
                className={`min-h-10 cursor-pointer border px-3.5 py-1.5 text-sm font-semibold transition-opacity ${VEREDITO_COR[veredito]} ${
                  filtro !== 'todos' && !ativo ? 'opacity-45 hover:opacity-85' : ''
                }`}
              >
                {VEREDITO[veredito][en ? 1 : 0]} <span className="num ml-1.5 font-extrabold opacity-90">({total})</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t('Filtrar afirmações…', 'Filter claims…')}
            aria-label={t('Filtrar afirmações', 'Filter claims')}
            className="min-h-10 flex-1 sm:w-52 border border-linha bg-papel px-3 text-sm text-tinta placeholder:text-suave/70 focus:border-tinta focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setExpandirTodos((v) => !v)}
            className="min-h-10 cursor-pointer border border-linha bg-papel px-3 text-xs font-mono font-semibold text-suave hover:border-tinta hover:text-tinta"
          >
            {expandirTodos ? t('Recolher todos', 'Collapse all') : t('Expandir todos', 'Expand all')}
          </button>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="border border-linha bg-papel p-6 text-sm text-suave">
          {t('Nenhuma afirmação encontrada para esse filtro.', 'No claim matches this filter.')}
        </p>
      ) : (
        <div className="border-b border-linha" key={expandirTodos ? 'expanded' : 'collapsed'}>
          {visiveis.map((item) => (
            <Item key={item.afirmacao} {...item} abertoPadrao={expandirTodos} />
          ))}
        </div>
      )}
    </div>
  )
}
