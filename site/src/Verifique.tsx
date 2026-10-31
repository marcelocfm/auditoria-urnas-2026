import { useState, type ReactNode } from 'react'
import { num } from './format'
import { useT } from './i18n'
import { Tabela } from './Investigacao'
import { Conferencias } from './Conferencias'

type Grade = { colunas: string[]; linhas: (string | number)[][] }

export type ListasData = {
  mesario_100: Grade
  comparecimento_20pp: Grade
  comparecimento_faixas: Grade
  trocas: {
    secoes: number
    urna_diferente_entre_turnos: number
    substituidas_no_dia: { urnas: number; votos: number; durante_votacao: number; rdv_confere: number }
    por_uf: Grade
  }
  log_bu: Grade
  log_bu_resumo: { secoes: number; em_urna_substituida: number; rdv_confere: number; votos_fora_do_log: number }
}

function baixarCsv(nome: string, g: Grade) {
  const esc = (v: string | number) => (typeof v === 'string' && /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))
  const texto = [g.colunas, ...g.linhas].map((l) => l.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function Lista({ titulo, texto, grade, arquivo, cabecalho, celulas }: {
  titulo: string
  texto: ReactNode
  grade: Grade
  arquivo: string
  cabecalho: string[]
  celulas: (linha: (string | number)[]) => ReactNode[]
}) {
  const t = useT()
  const [todas, setTodas] = useState(false)
  const visiveis = todas ? grade.linhas : grade.linhas.slice(0, 10)
  return (
    <div className="border-t border-linha pt-10">
      <h3 className="text-2xl font-bold tracking-tight">{titulo}</h3>
      <div className="mt-3 max-w-[66ch] leading-relaxed text-suave">{texto}</div>
      <div className="mt-6">
        <Tabela cabecalho={cabecalho} linhas={visiveis.map(celulas)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        {grade.linhas.length > 10 && (
          <button type="button" onClick={() => setTodas(!todas)} className="min-h-10 cursor-pointer border border-linha px-4 hover:border-tinta">
            {todas ? t('Mostrar só as 10 primeiras', 'Show only the first 10') : t(`Mostrar todas (${num(grade.linhas.length)})`, `Show all (${num(grade.linhas.length)})`)}
          </button>
        )}
        <button type="button" onClick={() => baixarCsv(arquivo, grade)} className="min-h-10 cursor-pointer border border-linha px-4 hover:border-tinta">
          {t('Baixar planilha (CSV)', 'Download spreadsheet (CSV)')}
        </button>
      </div>
    </div>
  )
}

const TSE_BU = 'https://dadosabertos.tse.jus.br/dataset/resultados-2026-boletim-de-urna'
const TSE_URNA = 'https://dadosabertos.tse.jus.br/dataset/resultados-2026-arquivos-transmitidos-para-totalizacao'

export function Verifique({ d }: { d: ListasData }) {
  const t = useT()
  const lb = d.log_bu_resumo
  const sub = d.trocas.substituidas_no_dia
  const link = (href: string, texto: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-tinta underline underline-offset-2">
      {texto}
    </a>
  )

  const passos: [string, ReactNode][] = [
    [
      t('Baixe os arquivos do TSE', 'Download the TSE files'),
      <>
        {t('Boletins de urna em planilha: ', 'Ballot-box reports as spreadsheets: ')}
        {link(TSE_BU, 'dadosabertos.tse.jus.br')}
        {t('. Arquivos gravados por cada urna (boletim assinado, registro de cada voto, log): ', '. Files written by each machine (signed report, record of every vote, log): ')}
        {link(TSE_URNA, t('pacotes por estado', 'packages by state'))}.
      </>,
    ],
    [
      t('Confira se o arquivo é o mesmo que usamos', 'Check the file is the same one we used'),
      <>
        {t('Cada arquivo tem uma impressão digital (hash SHA-512). Compare a do seu download com a nossa lista: ', 'Every file has a fingerprint (SHA-512 hash). Compare yours with our list: ')}
        {link('/data/manifesto_bweb.csv', t('planilhas', 'spreadsheets'))}
        {' · '}
        {link('/data/manifesto_urna.csv', t('pacotes das urnas', 'machine packages'))}
        {t('. No Windows: ', '. On Windows: ')}
        <code className="text-tinta">certutil -hashfile arquivo.zip SHA512</code>
      </>,
    ],
    [
      t('Rode os mesmos programas', 'Run the same programs'),
      <>
        {t('Todo o código está aberto em ', 'All the code is open at ')}
        {link('/metodo/download.py', '/metodo')}
        {t(
          '. Ordem: download.py, build.py, oficial.py, audit.py (soma dos boletins) e urna_audit.py (recontagem voto a voto). Precisa de Python 3 e das bibliotecas duckdb e pyarrow.',
          '. Order: download.py, build.py, oficial.py, audit.py (sum of the reports) and urna_audit.py (vote-by-vote recount). Needs Python 3 with the duckdb and pyarrow libraries.',
        )}
      </>,
    ],
    [
      t('Compare com o site', 'Compare with the site'),
      t(
        'Se algum número seu der diferente do nosso, a diferença é a notícia. Publique a planilha e o comando que você usou.',
        'If any of your numbers differs from ours, that difference is the news. Publish the spreadsheet and the command you used.',
      ),
    ],
  ]

  const glossario: [string, string][] = [
    [t('Boletim de urna (BU)', 'Ballot-box report (BU)'), t('Papel impresso pela urna às 17h com o total de votos da seção. Uma cópia fica colada na porta e o mesmo conteúdo vai, assinado, para o TSE.', 'Sheet printed by the machine at 5 pm with the station’s vote totals. A copy is posted on the door and the same content goes, signed, to the TSE.')],
    [t('RDV (registro digital do voto)', 'RDV (digital vote record)'), t('Arquivo com cada voto guardado separado, embaralhado, sem identificar o eleitor. Serve para recontar a seção voto a voto.', 'File holding every vote separately, shuffled, without identifying the voter. Lets anyone recount the station vote by vote.')],
    [t('Log da urna', 'Machine log'), t('Diário da urna: cada eleitor liberado, cada voto computado, cada erro, com hora.', 'The machine’s diary: every voter released, every vote recorded, every error, with timestamps.')],
    [t('Hash', 'Hash'), t('Impressão digital de um arquivo. Mudou um único caractere, o hash muda inteiro.', 'A file’s fingerprint. Change a single character and the whole hash changes.')],
    [t('Liberação por mesário', 'Poll-worker release'), t('Quando a digital do eleitor não é reconhecida, o mesário confere o documento e libera o voto com a própria digital.', 'When the voter’s fingerprint isn’t recognised, the poll worker checks the ID and releases the vote with their own fingerprint.')],
    [t('Urna substituída', 'Replaced machine'), t('Urna de reserva que entra no lugar de uma que quebrou no dia. Os votos já dados passam pelo cartão de memória.', 'Spare machine that replaces one that broke on the day. Votes already cast move over on the memory card.')],
  ]

  return (
    <div className="space-y-16">
      <Conferencias />

      <section>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Refaça a conta você mesmo', 'Redo the count yourself')}</h2>
        <ol className="mt-8 space-y-6">
          {passos.map(([titulo, corpo], i) => (
            <li key={titulo} className="grid grid-cols-[2.25rem_1fr] gap-x-3">
              <span className="num flex size-8 items-center justify-center border border-tinta font-bold">{i + 1}</span>
              <div>
                <p className="font-semibold">{titulo}</p>
                <p className="mt-1 max-w-[66ch] leading-relaxed text-suave">{corpo}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('O que não conseguimos verificar', 'What we could not verify')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border border-linha bg-papel p-5">
            <p className="font-semibold">{t('Assinatura digital das urnas', 'The machines’ digital signature')}</p>
            <p className="mt-2 text-sm leading-relaxed text-suave">
              {t(
                'O TSE não publica como verificar a assinatura das urnas. O método: as urnas novas usam Ed521 (padrão do ITI) e as antigas usam ECDSA P-521, os dois sobre um SHA-512 calculado duas vezes. Conferimos todas: 499.178 de 499.178 assinaturas válidas, cada urna com um certificado único, e os 499.178 certificados conferidos contra as autoridades intermediárias do TSE, sem nenhuma falha. O que continua sem verificação: os certificados das raízes (AC RAIZ UE e AC RAIZ UE v2) não estão publicados. Outros projetos abertos, como o DataUrnas-BR, chegaram ao mesmo resultado no 1º turno.',
                'The TSE does not publish how to verify the machines’ signatures. The method: newer machines use Ed521 (the ITI standard) and older ones use ECDSA P-521, both over a SHA-512 computed twice. We checked every one: 499,178 of 499,178 signatures are valid, each machine with a unique certificate, and all 499,178 certificates checked against the TSE’s intermediate authorities with no failure. Still unverified: the root certificates (AC RAIZ UE and AC RAIZ UE v2) are not published. Other open projects, such as DataUrnas-BR, reached the same result for the 1st round.',
              )}
            </p>
          </div>
          <div className="border border-linha bg-papel p-5">
            <p className="font-semibold">{t(`Log diferente do boletim em ${num(lb.secoes)} seções`, `Log differs from the report in ${num(lb.secoes)} stations`)}</p>
            <p className="mt-2 text-sm leading-relaxed text-suave">
              {t(
                `Em ${num(lb.secoes)} seções o número de votos no log não bate com o boletim: em algumas o log tem votos a mais (registro duplicado), em outras faltam de 1 a 36 votos. A recontagem voto a voto bate com o boletim em ${num(lb.rdv_confere)} das ${num(lb.secoes)}. Lista completa abaixo.`,
                `In ${num(lb.secoes)} stations the vote count in the log doesn’t match the report: in some the log has extra votes (duplicated record), in others 1 to 36 votes are missing. The vote-by-vote recount matches the report in ${num(lb.rdv_confere)} of the ${num(lb.secoes)}. Full list below.`,
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-12">
        <div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Seções fora do padrão', 'Out-of-pattern stations')}</h2>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-suave">
            {t(
              'Fora do padrão não quer dizer fraude. São as seções que mais merecem uma visita. Se você mora perto, confira o boletim na porta ou com quem trabalhou lá.',
              'Out of pattern does not mean fraud. These are the stations most worth a visit. If you live nearby, check the report on the door or ask the people who worked there.',
            )}
          </p>
        </div>

        <Lista
          titulo={t('Log com número de votos diferente do boletim', 'Log vote count differs from the report')}
          texto={t(
            'Votos no boletim, no log e na recontagem voto a voto (RDV). Urna tipo 4 = urna substituída no dia.',
            'Votes in the report, in the log and in the vote-by-vote recount (RDV). Machine type 4 = replaced on the day.',
          )}
          grade={d.log_bu}
          arquivo="log_diferente_do_boletim.csv"
          cabecalho={[t('Seção', 'Station'), t('Tipo', 'Type'), t('Boletim', 'Report'), 'Log', 'RDV', 'Lula', 'Flávio']}
          celulas={(l) => [`${l[1]} (${l[0]}) · ${t('zona', 'zone')} ${l[2]} · ${t('seção', 'station')} ${l[3]}`, l[4], num(+l[6]), num(+l[7]), num(+l[8]), num(+l[9]), num(+l[10])]}
        />

        <Lista
          titulo={t('Um mesário liberou 100 ou mais eleitores', 'One poll worker released 100+ voters')}
          texto={t(
            `São ${num(d.mesario_100.linhas.length)} seções. Costuma acontecer quando o leitor de digital falha. Nessas seções Flávio teve, em média, um pouco mais de votos que no resto da mesma cidade.`,
            `There are ${num(d.mesario_100.linhas.length)} stations. It usually happens when the fingerprint reader fails. In these stations Flávio got, on average, slightly more votes than in the rest of the same city.`,
          )}
          grade={d.mesario_100}
          arquivo="mesario_100_ou_mais.csv"
          cabecalho={[t('Seção', 'Station'), t('Maior nº por mesário', 'Most by one worker'), t('Liberados', 'Released'), t('Votaram', 'Voted'), 'Lula', 'Flávio']}
          celulas={(l) => [`${l[1]} (${l[0]}) · ${t('zona', 'zone')} ${l[2]} · ${t('seção', 'station')} ${l[3]}`, num(+l[4]), num(+l[5]), num(+l[6]), num(+l[7]), num(+l[8])]}
        />

        <Lista
          titulo={t('Comparecimento subiu 20 pontos ou mais', 'Turnout rose 20+ points')}
          texto={
            <>
              {t(
                'Entre o 1º e o 2º turno, em pontos do eleitorado da seção. Na maioria das seções a alta foi de menos de 5 pontos:',
                'Between the 1st and 2nd rounds, in points of the station’s electorate. In most stations the rise was under 5 points:',
              )}
              <span className="mt-3 block">
                {d.comparecimento_faixas.linhas.map((f) => `${f[0]}: ${num(+f[1])}`).join(' · ')}
              </span>
            </>
          }
          grade={d.comparecimento_20pp}
          arquivo="comparecimento_20pp.csv"
          cabecalho={[t('Seção', 'Station'), t('Eleitores', 'Registered'), t('Votaram 1º', 'Voted 1st'), t('Votaram 2º', 'Voted 2nd'), t('Subiu', 'Rose'), 'Lula', 'Flávio']}
          celulas={(l) => [`${l[1]} (${l[0]}) · ${t('zona', 'zone')} ${l[2]} · ${t('seção', 'station')} ${l[3]}`, num(+l[4]), num(+l[5]), num(+l[6]), `+${String(l[7]).replace('.', t(',', '.'))}`, num(+l[8]), num(+l[9])]}
        />

        <Lista
          titulo={t('Seções que votaram em urna reserva, por estado', 'Stations that voted on a spare machine, by state')}
          texto={t(
            `${num(sub.urnas)} seções votaram em urna reserva, com ${num(sub.votos)} votos. Em ${num(sub.durante_votacao)} a troca aconteceu com a votação em andamento (o log mostra as duas urnas); nas outras ${num(sub.urnas - sub.durante_votacao)}, a reserva assumiu antes do primeiro voto. A recontagem voto a voto bate com o boletim em ${num(sub.rdv_confere)} delas. Outras ${num(d.trocas.urna_diferente_entre_turnos)} seções usaram uma urna diferente da do 1º turno, o que é rotina: as urnas são redistribuídas entre os turnos. ZZ = exterior.`,
            `${num(sub.urnas)} stations voted on a spare machine, holding ${num(sub.votos)} votes. In ${num(sub.durante_votacao)} the swap happened while voting was under way (the log shows both machines); in the other ${num(sub.urnas - sub.durante_votacao)}, the spare took over before the first vote. The vote-by-vote recount matches the report in ${num(sub.rdv_confere)} of them. Another ${num(d.trocas.urna_diferente_entre_turnos)} stations used a different machine from the 1st round, which is routine: machines are redistributed between rounds. ZZ = abroad.`,
          )}
          grade={d.trocas.por_uf}
          arquivo="urnas_substituidas_por_uf.csv"
          cabecalho={[t('Estado', 'State'), t('Substituídas', 'Replaced'), t('Urnas', 'Machines'), '%']}
          celulas={(l) => [l[0], num(+l[1]), num(+l[2]), `${String(l[3]).replace('.', t(',', '.'))}%`]}
        />
      </section>

      <section>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Glossário', 'Glossary')}</h2>
        <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {glossario.map(([termo, def]) => (
            <div key={termo}>
              <dt className="font-semibold">{termo}</dt>
              <dd className="mt-1 leading-relaxed text-suave">{def}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
