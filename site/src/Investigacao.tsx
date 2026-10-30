import { type ReactNode } from 'react'
import { loc, num, pct, signedNum } from './format'
import { useLang, useT } from './i18n'
import { MarginChart, type PontoApuracao } from './MarginChart'

export type Alegacoes = {
  apuracao: PontoApuracao[]
  chegada_por_regiao: { regiao: string; pct_lula: number; mediana_chegada: string; secoes: number }[]
  encerramento: { faixa: string; secoes: number; votantes: number; lula: number; flavio: number }[]
  transferencia: {
    ganho_lula: number
    ganho_flavio: number
    outros_1t: number
    queda_brancos_nulos: number
    novos_votantes: number
    secoes: number
    secoes_impossiveis: number
  }
  transferencia_regiao: {
    regiao: string
    ganho_lula: number
    ganho_flavio: number
    outros_1t: number
    queda_brancos_nulos: number
    novos_votantes: number
  }[]
  emissao_vs_registro: { turno: number; hora: number; emitidos: number; registrados: number }[]
}

/** BUs printed at the sections vs. registered by the TSE, per Brasília hour, both rounds side by side. */
export function TabelaHorarios({ d }: { d: Alegacoes }) {
  const t = useT()
  const horas = [...new Set(d.emissao_vs_registro.map((r) => r.hora))].sort((a, b) => a - b)
  const v = (turno: number, hora: number, k: 'emitidos' | 'registrados') =>
    num(d.emissao_vs_registro.find((r) => r.turno === turno && r.hora === hora)?.[k] ?? 0)
  return (
    <Tabela
      cabecalho={[
        t('Hora (Brasília)', 'Hour (Brasília)'),
        t('1º turno: impressos na seção', '1st round: printed at the station'),
        t('1º turno: registrados no TSE', '1st round: registered by the TSE'),
        t('2º turno: impressos na seção', '2nd round: printed at the station'),
        t('2º turno: registrados no TSE', '2nd round: registered by the TSE'),
      ]}
      linhas={horas.map((h) => [`${h}h`, v(1, h, 'emitidos'), v(1, h, 'registrados'), v(2, h, 'emitidos'), v(2, h, 'registrados')])}
    />
  )
}

export type Urnas = {
  resumo: Record<string, number> & { oficial: Record<string, number> }
  votos_por_hora: { hora_brasilia: number; votos: number }[]
  apos_horario: { apos_17h: number; apos_19h: number }
  modelo_urna: { modelo_urna: number; secoes: number; pct_lula_bruto: number; desvio_vs_municipio_pp: number | null }[]
  erros_log: { evento: string; ocorrencias: number }[]
  voto_nao_registrado: number
  divergencias?: Record<string, unknown>[]
}

const thClassName = 'py-2.5 pl-4 text-right text-sm font-medium first:pl-0 first:text-left'
const tdClassName = 'py-2.5 pl-4 text-right first:pl-0 first:text-left'

export function Tabela({
  cabecalho,
  linhas,
  rodape,
}: {
  cabecalho: string[]
  linhas: ReactNode[][]
  rodape?: ReactNode[]
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="num w-full min-w-[460px] text-[15px]">
        <thead className="border-b border-linha text-suave">
          <tr>
            {cabecalho.map((colTitle) => (
              <th key={colTitle} className={thClassName}>
                {colTitle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          {linhas.map((cells, rowIdx) => (
            <tr key={rowIdx}>
              {cells.map((cellContent, colIdx) => (
                <td key={colIdx} className={tdClassName}>
                  {cellContent}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape && (
          <tfoot className="border-t-2 border-tinta font-semibold">
            <tr>
              {rodape.map((cellContent, colIdx) => (
                <td key={colIdx} className={tdClassName}>
                  {cellContent}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** One question people are asking, the short answer up front, the evidence underneath. */
export function Duvida({
  pergunta,
  resposta,
  children,
  aberta = false,
}: {
  pergunta: string
  resposta: ReactNode
  children?: ReactNode
  aberta?: boolean
}) {
  return (
    <details className="group border-t border-linha py-7" open={aberta}>
      <summary className="flex cursor-pointer items-start gap-4">
        <span className="flex-1">
          <span className="block max-w-[36ch] text-xl font-bold tracking-tight text-balance sm:text-2xl">{pergunta}</span>
          <span className="mt-3 block max-w-[64ch] text-lg leading-relaxed text-suave">{resposta}</span>
        </span>
        <span
          aria-hidden
          className="mt-0.5 grid size-10 shrink-0 place-items-center border border-linha font-mono text-xl text-suave transition group-open:rotate-45 group-hover:border-tinta group-hover:text-tinta"
        >
          +
        </span>
      </summary>
      {children && <div className="mt-8 space-y-6 text-lg leading-relaxed [&>p]:max-w-[68ch]">{children}</div>}
    </details>
  )
}

const REGIAO_EN: Record<string, string> = {
  Norte: 'North',
  Nordeste: 'Northeast',
  'Centro-Oeste': 'Center-West',
  Sudeste: 'Southeast',
  Sul: 'South',
  Exterior: 'Abroad',
}

function useRegiao() {
  const en = useLang() === 'en'
  return (r: string) => (en ? REGIAO_EN[r] ?? r : r)
}

const dec = (v: number, min: number, max = min) => v.toLocaleString(loc(), { minimumFractionDigits: min, maximumFractionDigits: max })

export function Virada({ d }: { d: Alegacoes }) {
  const t = useT()
  const regiao = useRegiao()
  const total = d.apuracao[d.apuracao.length - 1].boletins
  const frente = d.apuracao.filter((p) => p.boletins >= 50 && p.flavio > p.lula)
  const ini = frente[0]?.ate ?? '19:45'
  const fim = frente[frente.length - 1]?.ate ?? '20:20'

  return (
    <Duvida
      pergunta={t('Como foi a apuração, hora a hora', 'How the count went, hour by hour')}
      resposta={t(
        `Os boletins chegam ao TSE em ritmos diferentes em cada região. Centro-Oeste e Sul enviaram primeiro; Nordeste e Sudeste, depois. Na contagem parcial, Flávio esteve à frente entre ${ini} e ${fim} e Lula a partir daí.`,
        `Reports reach the TSE at a different pace in each region. The Center-West and South came in first; the Northeast and Southeast later. In the partial count, Flávio was ahead between ${ini} and ${fim}, and Lula from then on.`,
      )}
    >
      <p>
        {t(
          'O gráfico reconstrói a apuração em intervalos de 5 minutos pelo horário em que cada boletim foi registrado no TSE. Abaixo da linha do meio, Flávio estava à frente; acima, Lula. Os horários são de Brasília (na Itália e em Portugal, some 4 e 3 horas).',
          'The chart rebuilds the count in 5-minute steps using the time each report was registered by the TSE. Below the middle line, Flávio was ahead; above it, Lula. Times are Brasília time (UTC−3; add 4 hours for Italy, 3 for the UK and Portugal).',
        )}
      </p>
      <MarginChart pontos={d.apuracao} totalBoletins={total} />
      <p>
        {t(
          'Por que o gráfico só começa às 19h? Porque no 2º turno a votação foi prorrogada até as 19h, e o TSE só passou a registrar os boletins depois disso. As urnas, porém, já tinham fechado e impresso os boletins às 17h, na grande maioria. No 1º turno, sem prorrogação, o registro começou logo às 17h:',
          'Why does the chart only start at 7 pm? In the 2nd round voting was extended until 7 pm, and the TSE only began registering reports after that. Most machines, however, had already closed and printed their reports at 5 pm. In the 1st round, with no extension, registration started right at 5 pm:',
        )}
      </p>
      <TabelaHorarios d={d} />
      <p className="text-suave">
        {t(
          'Ou seja: quando a contagem começou, o resultado de quase todas as urnas já estava impresso, colado na porta das seções e assinado pela urna havia duas horas.',
          'In other words: when the count began, the result of almost every machine had already been printed, posted on the polling station door and signed by the machine two hours earlier.',
        )}
      </p>
      <Tabela
        cabecalho={[t('Região', 'Region'), t('Seções', 'Sections'), t('Metade das urnas chegou às', 'Half the machines in by'), 'Lula', 'Flávio']}
        linhas={d.chegada_por_regiao.map((r) => [
          regiao(r.regiao),
          num(r.secoes),
          r.mediana_chegada,
          `${dec(r.pct_lula, 1)}%`,
          `${dec(100 - r.pct_lula, 1)}%`,
        ])}
      />
      <p className="text-suave">
        {t(
          'A ordem de chegada não altera nenhum voto: cada boletim já tinha sido impresso na porta da seção e assinado pela urna antes da transmissão.',
          'The arrival order changes no vote: each report had already been printed at the station and signed by the machine before transmission.',
        )}
      </p>
    </Duvida>
  )
}

export function Horario({ d, u }: { d: Alegacoes; u: Urnas | null }) {
  const t = useT()
  const final = d.apuracao[d.apuracao.length - 1]
  const margemFinal = final.lula - final.flavio
  const pergunta = t('Quantos votos foram dados depois das 17h', 'How many votes were cast after 5 pm')
  if (!u) {
    return (
      <Duvida
        pergunta={pergunta}
        resposta={t(
          'Estamos contando, pelo diário de cada urna, quantos votos foram dados depois das 17h. O número aparece aqui assim que a contagem terminar.',
          'We are counting, from each machine’s log, how many votes were cast after 5 pm. The number will appear here when the count is done.',
        )}
      />
    )
  }
  const apos17 = u.apos_horario.apos_17h
  const maxHoraVotos = Math.max(...u.votos_por_hora.map((h) => h.votos), 1)

  return (
    <Duvida
      pergunta={pergunta}
      resposta={t(
        `${num(apos17)} votos, no país inteiro, foram dados depois das 17h; ${num(u.apos_horario.apos_19h)} depois das 19h. A diferença final entre os candidatos foi de ${num(margemFinal)} votos.`,
        `${num(apos17)} votes, nationwide, were cast after 5 pm; ${num(u.apos_horario.apos_19h)} after 7 pm. The final gap between the candidates was ${num(margemFinal)} votes.`,
      )}
    >
      <p>
        {t(
          'Cada urna anota no seu diário (o log) a hora exata de cada voto. Contamos todos. O voto é secreto: o diário não diz em quem foi cada voto.',
          'Each machine writes the exact time of every vote in its log. We counted them all. The vote is secret: the log does not say who each vote was for.',
        )}
      </p>
      <ul className="num space-y-3 border border-linha bg-papel p-4 text-base sm:p-5">
        {[
          [t('Votos dados até as 17h (Brasil)', 'Votes cast until 5 pm (Brazil)'), num(u.votos_por_hora.reduce((s, h) => s + h.votos, 0) - apos17)],
          [t('Votos dados depois das 17h', 'Votes cast after 5 pm'), num(apos17)],
          [t('Votos dados depois das 19h', 'Votes cast after 7 pm'), num(u.apos_horario.apos_19h)],
          [t('Diferença final entre os candidatos', 'Final gap between the candidates'), num(margemFinal)],
        ].map(([label, val]) => (
          <li key={label} className="flex flex-wrap justify-between gap-x-4 border-b border-linha pb-2.5 last:border-none last:pb-0">
            <span className="text-suave">{label}</span>
            <span className="font-semibold text-tinta">{val}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border border-linha bg-papel p-4 sm:p-5">
        <p className="text-sm text-suave">{t('Votos dados em cada hora do dia (horário de Brasília)', 'Votes cast in each hour of the day (Brasília time)')}</p>
        <div className="num space-y-1.5 pt-2 text-sm">
          {u.votos_por_hora.map((item) => (
            <div key={item.hora_brasilia} className="grid grid-cols-[3rem_1fr_6.5rem] items-center gap-3">
              <span className="text-suave">{item.hora_brasilia}h</span>
              <div className="h-2.5 bg-linha">
                <div className="h-full bg-tinta" style={{ width: `${Math.max(0.5, (100 * item.votos) / maxHoraVotos).toFixed(1)}%` }} />
              </div>
              <span className="text-right">{num(item.votos)}</span>
            </div>
          ))}
        </div>
      </div>
      <p>
        {t(
          'Pela regra, quem já está na fila às 17h tem direito de votar. Em 2026, o STF também prorrogou o horário até as 19h no país inteiro, a pedido das duas campanhas, por causa de problemas no transporte e chuvas.',
          'By law, anyone already in line at 5 pm may vote. In 2026 the Supreme Court also extended voting until 7 pm nationwide, at the request of both campaigns, because of public-transport problems and rain.',
        )}
      </p>
      <p className="text-suave">
        {t('Às 17h, 0,4% das urnas tinham chegado ao TSE, quase todas do exterior.', 'At 5 pm, 0.4% of the machines had reached the TSE, almost all from abroad.')}
      </p>
    </Duvida>
  )
}

export function Crescimento({ d }: { d: Alegacoes }) {
  const t = useT()
  const regiao = useRegiao()
  const tr = d.transferencia
  const disponivel = tr.outros_1t + tr.queda_brancos_nulos + tr.novos_votantes

  return (
    <Duvida
      pergunta={t('De onde vieram os votos novos do 2º turno', 'Where the new 2nd-round votes came from')}
      resposta={t(
        `Do 1º para o 2º turno, Lula ganhou ${num(tr.ganho_lula)} votos e Flávio ${num(tr.ganho_flavio)}. Juntos, esses votos vieram de três lugares, que somam exatamente o mesmo número.`,
        `From the 1st to the 2nd round, Lula gained ${num(tr.ganho_lula)} votes and Flávio ${num(tr.ganho_flavio)}. Together, these votes came from three sources that add up to exactly the same number.`,
      )}
    >
      <div className="num grid gap-px border border-linha bg-linha sm:grid-cols-3">
        {[
          [tr.outros_1t, t('tinham votado em outros candidatos no 1º turno', 'had voted for other candidates in the 1st round')],
          [tr.queda_brancos_nulos, t('votaram em branco ou nulo no 1º turno e escolheram alguém no 2º', 'voted blank or null in the 1st round and picked someone in the 2nd')],
          [tr.novos_votantes, t('pessoas a mais foram votar no 2º turno', 'more people turned out in the 2nd round')],
        ].map(([valor, descricao]) => (
          <div key={descricao as string} className="bg-papel p-5">
            <p className="text-2xl font-bold">{num(valor as number)}</p>
            <p className="mt-1.5 text-sm text-suave">{descricao}</p>
          </div>
        ))}
      </div>
      <p>
        {t(
          `Somando: ${num(disponivel)} votos. Lula e Flávio, juntos, cresceram ${num(tr.ganho_lula + tr.ganho_flavio)}. É o mesmo número. Lula ficou com ${pct(tr.ganho_lula, disponivel)} desses votos e Flávio com ${pct(tr.ganho_flavio, disponivel)}.`,
          `Total: ${num(disponivel)} votes. Lula and Flávio together grew by ${num(tr.ganho_lula + tr.ganho_flavio)} — the same number. Lula took ${pct(tr.ganho_lula, disponivel)} of these votes and Flávio ${pct(tr.ganho_flavio, disponivel)}.`,
        )}
      </p>
      <p>
        {t(
          `A mesma conta foi feita em cada uma das ${num(tr.secoes)} seções. Em todas, o crescimento dos dois candidatos cabe nos votos que estavam disponíveis ali.`,
          `The same calculation was done for each of the ${num(tr.secoes)} sections. In all of them, both candidates’ growth fits within the votes available there.`,
        )}
      </p>
      <Tabela
        cabecalho={[
          t('Região', 'Region'),
          t('Lula ganhou', 'Lula gained'),
          t('Flávio ganhou', 'Flávio gained'),
          t('De outros candidatos', 'From other candidates'),
          t('De brancos e nulos', 'From blank and null'),
          t('Eleitores a mais', 'Extra voters'),
        ]}
        linhas={d.transferencia_regiao.map((r) => [
          regiao(r.regiao),
          signedNum(r.ganho_lula),
          signedNum(r.ganho_flavio),
          num(r.outros_1t),
          signedNum(r.queda_brancos_nulos),
          signedNum(r.novos_votantes),
        ])}
      />
    </Duvida>
  )
}

const NOMES_MODELO: Record<number, string> = {
  9: 'UE2009',
  10: 'UE2010',
  11: 'UE2011',
  13: 'UE2013',
  15: 'UE2015',
  20: 'UE2020',
  22: 'UE2022',
}

export function ModelosUrna({ u }: { u: Urnas | null }) {
  const t = useT()
  const pergunta = t('Comparação entre modelos de urna', 'Comparison between voting machine models')
  if (!u || !u.modelo_urna || u.modelo_urna.length === 0) {
    return (
      <Duvida
        pergunta={pergunta}
        resposta={t(
          'Estamos comparando os modelos de urna. O resultado aparece aqui assim que a contagem terminar.',
          'We are comparing machine models. The result will appear here when the count is done.',
        )}
      />
    )
  }
  const maior = Math.max(...u.modelo_urna.map((m) => Math.abs(m.desvio_vs_municipio_pp ?? 0)), 0)
  return (
    <Duvida
      pergunta={pergunta}
      resposta={t(
        `Comparando cada urna com as outras urnas da mesma cidade, a maior diferença entre modelos foi de ${dec(maior, 0, 2)} ponto percentual.`,
        `Comparing each machine with the other machines in the same city, the largest difference between models was ${dec(maior, 0, 2)} percentage point.`,
      )}
    >
      <p>
        {t(
          'Os modelos de urna não estão espalhados igualmente pelo país — por isso comparar a média nacional de cada modelo engana. O jeito certo é comparar modelos diferentes dentro da mesma cidade:',
          'Machine models are not spread evenly across the country, so comparing each model’s national average is misleading. The right test compares different models within the same city:',
        )}
      </p>
      <Tabela
        cabecalho={[
          t('Modelo', 'Model'),
          t('Urnas', 'Machines'),
          t('Lula / Flávio (média nacional)', 'Lula / Flávio (national average)'),
          t('Diferença para a mesma cidade', 'Difference vs. same city'),
        ]}
        linhas={u.modelo_urna.map((m) => [
          NOMES_MODELO[m.modelo_urna] ?? `${t('Modelo', 'Model')} ${m.modelo_urna}`,
          num(m.secoes),
          `${dec(m.pct_lula_bruto, 2)}% / ${dec(100 - m.pct_lula_bruto, 2)}%`,
          m.desvio_vs_municipio_pp == null
            ? '—'
            : `${m.desvio_vs_municipio_pp > 0 ? '+' : ''}${dec(m.desvio_vs_municipio_pp, 2)} ${t('ponto', 'pt')}`,
        ])}
      />
    </Duvida>
  )
}

export function Recontagem({ u }: { u: Urnas | null }) {
  const t = useT()
  const pergunta = t('Recontagem dos votos guardados dentro das urnas', 'Recount of the votes stored inside the machines')
  if (!u) {
    return (
      <Duvida
        pergunta={pergunta}
        resposta={t(
          'Estamos recontando, voto por voto, o registro interno de cada uma das urnas do 2º turno. O resultado aparece aqui assim que terminar.',
          'We are recounting, vote by vote, the internal record of every 2nd-round machine. The result will appear here when it is done.',
        )}
      />
    )
  }
  const r = u.resumo
  const papelLula = r.oficial['13'] - r.rdv_lula
  const papelFlavio = r.oficial['22'] - r.rdv_flavio
  const de = t('de', 'of')
  return (
    <Duvida
      pergunta={pergunta}
      resposta={t(
        `Recontamos um por um os votos guardados dentro de ${num(r.com_rdv)} urnas. Em todas, a recontagem deu exatamente o mesmo resultado do boletim impresso na seção.`,
        `We recounted, one by one, the votes stored inside ${num(r.com_rdv)} machines. In every one, the recount gave exactly the same result as the report printed at the polling station.`,
      )}
    >
      <p>
        {t(
          'Toda urna guarda cada voto separadamente, embaralhado para não identificar o eleitor. Esse arquivo se chama RDV (Registro Digital do Voto). Contamos os votos de cada RDV e comparamos com o boletim daquela urna — o digital e o impresso.',
          'Every machine stores each vote separately, shuffled so the voter cannot be identified. This file is the RDV (Digital Vote Record). We counted the votes in each RDV and compared them with that machine’s report — both the digital and the printed one.',
        )}
      </p>
      <ul className="num space-y-3 border border-linha bg-papel p-4 text-base sm:p-5">
        {[
          [t('Urnas em que a recontagem deu igual ao boletim', 'Machines where the recount matched the report'), `${num(r.com_rdv - r.rdv_diverge)} ${de} ${num(r.com_rdv)}`],
          [t('Boletim impresso igual ao boletim digital', 'Printed report identical to the digital report'), `${num(r.com_impresso - r.impresso_diverge)} ${de} ${num(r.com_impresso)}`],
          [t('Arquivos intactos desde que saíram da urna', 'Files unaltered since they left the machine'), `${num(r.hashes_ok)} ${de} ${num(r.hashes)} ${t('verificações', 'checks')}`],
          [t('Votos para Lula, recontados', 'Votes for Lula, recounted'), num(r.rdv_lula)],
          [t('Votos para Flávio, recontados', 'Votes for Flávio, recounted'), num(r.rdv_flavio)],
        ].map(([k, v]) => (
          <li key={k} className="flex flex-wrap justify-between gap-x-4 border-b border-linha pb-2.5 last:border-none last:pb-0">
            <span className="text-suave">{k}</span>
            <span className="font-semibold text-tinta">{v}</span>
          </li>
        ))}
      </ul>
      <p>
        {t(
          `Por que a recontagem dá ${num(papelLula)} votos a menos para Lula e ${num(papelFlavio)} a menos para Flávio que o resultado oficial? Porque 29 seções pequenas no exterior votaram em cédula de papel, e cédula não gera arquivo de urna. Os votos delas somam exatamente essa diferença.`,
          `Why does the recount give ${num(papelLula)} fewer votes to Lula and ${num(papelFlavio)} fewer to Flávio than the official result? Because 29 small sections abroad voted on paper ballots, which produce no machine file. Their votes add up to exactly that difference.`,
        )}
      </p>
      <p className="text-suave">
        {t(
          `O diário (log) de cada urna também anota cada voto. Ele bate com o boletim em ${num(r.com_log - r.log_diverge)} de ${num(r.com_log)} urnas. As outras ${num(r.log_diverge)} são, quase todas, urnas trocadas no meio da votação, em que o pacote traz só parte do diário da urna original; e três urnas em que a bateria acabou logo depois de um voto — o voto foi gravado, mas a anotação no diário não. Em todas elas, a recontagem do RDV bate com o boletim.`,
          `Each machine’s log also records every vote. It matches the report in ${num(r.com_log - r.log_diverge)} of ${num(r.com_log)} machines. The other ${num(r.log_diverge)} are almost all machines replaced during voting, where the package contains only part of the original machine’s log; plus three machines whose battery died right after a vote — the vote was stored, the log line was not. In all of them, the RDV recount matches the report.`,
        )}
      </p>
    </Duvida>
  )
}
