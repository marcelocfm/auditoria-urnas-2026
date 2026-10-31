import type { ReactNode } from 'react'
import { num } from './format'
import { useLang, useT } from './i18n'
import type { Urnas } from './Investigacao'
import type { ListasData } from './Verifique'

type Grupo = { ocorrencias: number; eventos: { evento: string; ocorrencias: number }[] }
export type InconsistenciasData = Record<
  'voto_nao_registrado' | 'assinatura' | 'dados_inconsistentes' | 'gravacao_rdv' | 'leitor_digital' | 'limite_mesarios',
  Grupo
>

function Achado({ numero, titulo, children }: { numero: string; titulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 border-t border-linha py-7 sm:grid-cols-[11rem_1fr]">
      <p className="num text-3xl font-extrabold tracking-tight text-amber-300">{numero}</p>
      <div>
        <h3 className="text-lg font-semibold">{titulo}</h3>
        <div className="mt-2 max-w-[66ch] space-y-3 leading-relaxed text-suave">{children}</div>
      </div>
    </div>
  )
}

// English rendering of the machine log messages (the originals are kept on the Portuguese page)
const TRADUCAO_LOG: [string, string][] = [
  ['Erro inesperado durante a votação', 'Unexpected error during voting'],
  ['O voto do eleitor NÃO foi registrado', 'The voter’s vote was NOT registered'],
  ['Ocorreu um erro enquanto o eleitor regist', 'An error occurred while the voter was recording'],
  ['Não é possível continuar a execução', 'Cannot continue execution'],
  ['Erro inesperado', 'Unexpected error'],
  ['Erro ao inicializar assinatura.', 'Error initialising signature.'],
  ['Tire uma foto dessa tela', 'Take a photo of this screen'],
  ['Erro na verificação de assinatura do arquivo', 'Signature check error on file'],
  ['Validação do VOTA', 'Voting app validation'],
  ['Erro verificando assinatura do arquivo', 'Error checking signature of file'],
  ['Inicialização do aplicativo', 'App start-up'],
  ['Validando assinaturas', 'Validating signatures'],
  ['Erro na verificação de integridade do sistema. Desligue e ligu', 'System integrity check error. Switch off and on'],
  ['Falha ao validar assinatura UE pacote', 'Failed to validate machine package signature'],
  ['Falha ao validar assinatura', 'Failed to validate signature'],
  ['Desligue a urn', 'Switch off the machine'],
  ['Sincronização da MI para MV', 'Sync from internal to voting media'],
  ['Sincronização da MI para ME', 'Sync from internal to external media'],
  ['Os dados contidos na mídia de votação não correspondem aos dados contidos na ', 'Data on the voting media does not match the data on the '],
  ['Dados contidos na mídia de votação não correspondem aos dados contidos na urna. Desligu', 'Data on the voting media does not match the machine’s data. Switch off'],
  ['Validação dos arquivos estáticos', 'Static file validation'],
  ['Foi verificado que o arquivo de eleitores está inconsistente na mídia de', 'The voter file was found inconsistent on the media'],
  ['Foi detectado arquivo de processo eleitoral inconsistente na mídia de vo', 'An inconsistent election-process file was detected on the voting media'],
  ['Erro gravando RDV na Mídia Externa', 'Error writing the RDV to external media'],
  ['Erro gravando RDV na Mídia Interna', 'Error writing the RDV to internal media'],
  ['Captura da digital do eleitor', 'Voter fingerprint capture'],
  ['Falha na captura da digital', 'Fingerprint capture failed'],
  ['Ocorreu um erro durante captura da digital do eleitor.', 'An error occurred while capturing the voter’s fingerprint.'],
  ['Error ao encerrar captura - estado', 'Error ending capture - state'],
  ['Erro na aquisição da imagem', 'Image acquisition error'],
  ['Erro n', 'Error'],
  ['Limite de mesários registrados atingido. Limite máximo', 'Registered poll-worker limit reached. Maximum'],
  ['GAP erro', 'GAP error'],
  ['Tire uma foto dessa', 'Take a photo of this'],
  [' em /', ' in /'],
  ['Erro CFingerScanner', 'Error CFingerScanner'],
]

function traduzirLog(texto: string) {
  return TRADUCAO_LOG.reduce((acc, [pt, en]) => acc.split(pt).join(en), texto)
}

function Eventos({ g }: { g: Grupo }) {
  const en = useLang() === 'en'
  return (
    <ul className="space-y-1 font-mono text-xs">
      {g.eventos.map((e) => (
        <li key={e.evento}>
          <span className="text-tinta">{num(e.ocorrencias)}×</span> {en ? traduzirLog(e.evento) : e.evento}
        </li>
      ))}
    </ul>
  )
}

export function Inconsistencias({ d, listas, urnas }: { d: InconsistenciasData; listas: ListasData; urnas: Urnas }) {
  const t = useT()
  const r = urnas.resumo
  const difLula = r.oficial['13'] - r.bu_lula
  const difFlavio = r.oficial['22'] - r.bu_flavio
  const logBu = listas.log_bu.linhas

  return (
    <div className="space-y-16">
      <section>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Nos arquivos das urnas', 'In the machine files')}</h2>
        <div className="mt-6">
          <Achado numero={num(d.voto_nao_registrado.ocorrencias)} titulo={t('Erros “O voto do eleitor NÃO foi registrado”', 'Errors: “The voter’s vote was NOT registered”')}>
            <p>
              {t(
                'Mensagem gravada no log das urnas no dia da eleição, depois de um “erro inesperado durante a votação”. O log não diz o que aconteceu com o eleitor depois.',
                'Message written to the machine logs on election day after an “unexpected error during voting”. The log does not say what happened to the voter afterwards.',
              )}
            </p>
            <p>
              {t(
                'Abrimos seção por seção os casos da Bahia, do Acre e de Minas Gerais (89 registros em 56 seções). Quase todos foram falha do teclado da urna. Em todos os 89, a urna foi reiniciada e o eleitor seguinte foi liberado e votou, em geral de 5 a 10 minutos depois (o caso mais longo levou 106 minutos). O log não registra se era a mesma pessoa. Nessas 56 seções, log, boletim e recontagem voto a voto têm o mesmo total.',
                'We opened the Bahia, Acre and Minas Gerais cases one by one (89 records in 56 stations). Nearly all were a failure of the machine’s keypad. In all 89, the machine was restarted and the next voter was released and voted, usually 5 to 10 minutes later (the longest took 106 minutes). The log does not record whether it was the same person. In these 56 stations, log, report and vote-by-vote recount have the same total.',
              )}
            </p>
          </Achado>
          <Achado numero={num(d.assinatura.ocorrencias)} titulo={t('Erros de verificação de assinatura ou de integridade', 'Signature or integrity check errors')}>
            <p>{t('Registrados nos logs no dia da eleição:', 'Recorded in the logs on election day:')}</p>
            <Eventos g={d.assinatura} />
            <p>
              {t(
                'Na Bahia, abrimos os 3 casos. Em São Gonçalo dos Campos, zona 108, seção 131, a urna se recusou a iniciar 12 vezes, das 7h24 às 8h03, porque a assinatura de um arquivo não conferia, e foi trocada. Em outra seção, a verificação de integridade falhou às 11h37 e a urna também foi trocada. Na terceira, a urna não conseguiu assinar o boletim às 17h04 e foi reiniciada. Em Minas, também 3 seções: em Lamim (zona 87, seção 343), a assinatura do próprio programa de votação não conferiu 7 vezes, das 7h28 às 8h11, e a urna foi trocada; em Curvelo e em Nova Serrana houve um erro isolado de assinatura, às 16h49 e às 17h03. Nas 6 seções, log, boletim e recontagem voto a voto têm o mesmo total.',
                'In Bahia we opened all 3 cases. In São Gonçalo dos Campos, zone 108, station 131, the machine refused to start 12 times, from 7:24 to 8:03 am, because a file signature did not check out, and it was replaced. In another station the integrity check failed at 11:37 am and the machine was also replaced. In the third, the machine could not sign the report at 5:04 pm and was restarted. In Minas Gerais, also 3 stations: in Lamim (zone 87, station 343) the signature of the voting program itself failed to check 7 times, from 7:28 to 8:11 am, and the machine was replaced; in Curvelo and Nova Serrana there was a single signature error, at 4:49 and 5:03 pm. In all 6 stations, log, report and vote-by-vote recount have the same total.',
              )}
            </p>
          </Achado>
          <Achado numero={num(d.dados_inconsistentes.ocorrencias)} titulo={t('“Dados da mídia não correspondem aos da urna”', '“Media data does not match the machine’s”')}>
            <Eventos g={d.dados_inconsistentes} />
          </Achado>
          <Achado numero={num(d.gravacao_rdv.ocorrencias)} titulo={t('Erros ao gravar o registro de votos (RDV)', 'Errors writing the vote record (RDV)')}>
            <Eventos g={d.gravacao_rdv} />
          </Achado>
          <Achado numero={num(logBu.length)} titulo={t('Seções com log diferente do boletim', 'Stations whose log differs from the report')}>
            <p>{t('Número de votos no log, no boletim e na recontagem voto a voto (RDV):', 'Vote count in the log, in the report and in the vote-by-vote recount (RDV):')}</p>
            <ul className="space-y-1 font-mono text-xs">
              {logBu.map((l) => (
                <li key={`${l[0]}${l[2]}${l[3]}`}>
                  {l[1]} ({l[0]}) {t('zona', 'zone')} {l[2]} {t('seção', 'station')} {l[3]}: log {num(+l[7])} · {t('boletim', 'report')} {num(+l[6])} · RDV {num(+l[8])}
                </li>
              ))}
            </ul>
          </Achado>
          <Achado numero={num(d.leitor_digital.ocorrencias)} titulo={t('Falhas do leitor de digital', 'Fingerprint reader failures')}>
            <p>
              {t(
                `Mais ${num(d.limite_mesarios.ocorrencias)} alertas de “limite de mesários registrados atingido”.`,
                `Plus ${num(d.limite_mesarios.ocorrencias)} “poll-worker limit reached” alerts.`,
              )}
            </p>
            <Eventos g={d.leitor_digital} />
          </Achado>
          <Achado numero="2" titulo={t('Seções que fecharam depois das 20h de Brasília', 'Stations that closed after 8 pm Brasília time')}>
            <p>
              {t(
                'A prorrogação ia até as 19h. Duas Barras (RJ), zona 42, seção 108, fechou às 20h45: o último voto foi antes das 17h, a urna foi desligada às 17h16 com a votação suspensa e teve problemas para religar; boletim, log e recontagem têm os mesmos 221 votos. Chapada Gaúcha (MG), zona 320, seção 185, fechou às 23h04. As seções de Fernando de Noronha, que aparecem às 20h, estão em outro fuso. Abrimos o log de Chapada Gaúcha: o último voto foi às 16h27 (96 no total). Às 17h13 a urna foi desligada com a votação suspensa, sem encerrar. Seguiram-se tentativas de religar e testes até perto das 20h. Às 22h49 uma urna de contingência foi carregada, recebeu os dados e encerrou às 23h04. O log registra “arquivo de log corrompido” nessa passagem. Boletim, log e recontagem têm os mesmos 96 votos.',
                'The extension ran until 7 pm. Duas Barras (RJ), zone 42, station 108, closed at 8:45 pm: the last vote was before 5 pm, the machine was switched off at 5:16 pm with voting suspended and had trouble restarting; report, log and recount all show the same 221 votes. Chapada Gaúcha (MG), zone 320, station 185, closed at 11:04 pm. The Fernando de Noronha stations that show 8 pm are in another time zone. We opened the Chapada Gaúcha log: the last vote was at 4:27 pm (96 in total). At 5:13 pm the machine was switched off with voting suspended, not closed. Restart attempts and tests followed until about 8 pm. At 10:49 pm a contingency machine was loaded, took over the data and closed at 11:04 pm. The log records a “corrupted log file” during that handover. Report, log and recount all show the same 96 votes.',
              )}
            </p>
          </Achado>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Na divulgação do TSE', 'In the TSE’s publication')}</h2>
        <div className="mt-6">
          <Achado numero="1.092" titulo={t('Boletins registrados pelo TSE até as 18h59 do 2º turno', 'Reports registered by the TSE by 6:59 pm in the 2nd round')}>
            <p>
              {t(
                'Às 17h, 490.217 urnas já tinham impresso o boletim. No 1º turno, o TSE registrou 74.264 boletins na hora das 17h e 228.471 na das 18h. No 2º turno, foram 1.092 e 0. Pelos dados, o TSE recebeu 1.868 boletins entre 17h05 e 17h07, parou por quase duas horas e retomou às 19h03, com 5.651 boletins nesse minuto. O TSE anunciou que só retomaria o recebimento depois das 19h, por causa da prorrogação decidida pelo STF às 16h57.',
                'By 5 pm, 490,217 machines had printed their report. In the 1st round the TSE registered 74,264 reports in the 5 pm hour and 228,471 in the 6 pm hour. In the 2nd round, 1,092 and 0. The data show the TSE received 1,868 reports between 5:05 and 5:07 pm, stopped for almost two hours and resumed at 7:03 pm, with 5,651 reports in that minute. The TSE announced it would only resume receiving reports after 7 pm because of the extension ordered by the Supreme Court at 4:57 pm.',
              )}
            </p>
          </Achado>
          <Achado numero="63" titulo={t('Diferença nos votos depois das 17h', 'Gap in votes cast after 5 pm')}>
            <p>
              {t(
                `O TSE informou 34.393 votos depois das 17h. Os logs das urnas mostram ${num(urnas.apos_horario.apos_17h)}.`,
                `The TSE reported 34,393 votes after 5 pm. The machine logs show ${num(urnas.apos_horario.apos_17h)}.`,
              )}
            </p>
          </Achado>
          <Achado numero={`${num(difLula)} / ${num(difFlavio)}`} titulo={t('Votos no total oficial que não estão nos boletins eletrônicos', 'Votes in the official total that are not in the electronic reports')}>
            <p>
              {t(
                `Lula tem ${num(difLula)} votos e Flávio ${num(difFlavio)} a mais no total oficial do que na soma dos boletins das urnas eletrônicas. São seções do exterior apuradas em cédula de papel, que não têm arquivo de urna para conferir.`,
                `Lula has ${num(difLula)} and Flávio ${num(difFlavio)} more votes in the official total than in the sum of the electronic reports. They come from overseas stations counted on paper ballots, which have no machine file to check.`,
              )}
            </p>
          </Achado>
          <Achado numero="0" titulo={t('Hashes publicados para os pacotes das urnas', 'Hashes published for the machine packages')}>
            <p>
              {t(
                'O TSE publica o hash SHA-512 das planilhas de boletim, mas não dos 28 pacotes com os arquivos das urnas (boletim assinado, RDV e log). Sem isso, quem baixa não tem como provar que recebeu o mesmo arquivo que o TSE gerou. Publicamos os nossos na página Verifique.',
                'The TSE publishes the SHA-512 hash of the report spreadsheets, but not of the 28 packages holding the machine files (signed report, RDV and log). Without it, a downloader cannot prove they got the same file the TSE produced. We publish ours on the Verify page.',
              )}
            </p>
          </Achado>
          <Achado numero="06/10" titulo={t('Data de criação dos pacotes do 2º turno no catálogo', 'Creation date of the 2nd-round packages in the catalogue')}>
            <p>
              {t(
                'No portal de dados abertos, os pacotes de arquivos das urnas do 2º turno aparecem como criados em 06/10/2026, antes da votação de 25/10. Os arquivos em si têm data de 26/10/2026. Os pacotes do 1º turno aparecem como criados em 28/10.',
                'On the open-data portal, the 2nd-round machine packages are listed as created on Oct 6, 2026, before the Oct 25 vote. The files themselves are dated Oct 26, 2026. The 1st-round packages are listed as created on Oct 28.',
              )}
            </p>
          </Achado>
          <Achado numero="99.928" titulo={t('Urnas cujo certificado depende de uma autoridade com certificado vencido', 'Machines whose certificate depends on an authority with an expired certificate')}>
            <p>
              {t(
                'As urnas antigas (UE2013 e UE2015), 99.928 no 2º turno, têm certificado emitido pela “AC URNA”. O certificado publicado dessa autoridade venceu em 18/07/2026, três meses antes da eleição. Mesmo assim, os certificados das urnas que ela emitiu valem até 2027–2037, além do vencimento dela, o que as regras usuais de certificados não preveem. A AC URNA também continuou emitindo certificados de urna depois de vencer. O projeto aberto auditoria-2turno-eleicao2026 conta 54 certificados emitidos entre 20/07 e 19/10/2026, usados em 53 seções no 2º turno. Conferimos 2 deles direto no arquivo do TSE: as urnas das seções 71072/0004/0114 e 62634/0214/0003 de SP têm certificado emitido em 18/10 e 19/10/2026, entre os dois turnos. As assinaturas conferem com a chave da AC URNA; a explicação mais provável é um certificado renovado da AC URNA com a mesma chave, que o TSE não publicou. O mesmo projeto não encontrou diferença de voto nessas 53 seções em relação às vizinhas. Não encontramos explicação pública do TSE.',
                'The older machines (UE2013 and UE2015), 99,928 in the 2nd round, have certificates issued by “AC URNA”. That authority’s published certificate expired on July 18, 2026, three months before the election. Even so, the machine certificates it issued are valid until 2027–2037, beyond its own expiry, which standard certificate rules do not allow for. AC URNA also kept issuing machine certificates after it expired. The open project auditoria-2turno-eleicao2026 counts 54 certificates issued between Jul 20 and Oct 19, 2026, used in 53 stations in the 2nd round. We checked 2 of them directly in the TSE file: the machines of SP stations 71072/0004/0114 and 62634/0214/0003 have certificates issued on Oct 18 and Oct 19, 2026, between the two rounds. The signatures match the AC URNA key; the most likely explanation is a renewed AC URNA certificate with the same key that the TSE has not published. The same project found no vote difference in those 53 stations compared with their neighbours. We found no public explanation from the TSE.',
              )}
            </p>
          </Achado>
          <Achado numero="0" titulo={t('Especificação publicada pelo TSE para verificar a assinatura das urnas', 'Specification published by the TSE to verify the machines’ signatures')}>
            <p>
              {t(
                'Os certificados das urnas são emitidos por autoridades do próprio TSE (AC UE2022, AC UE2020 e AC URNA), fora da ICP-Brasil. O algoritmo aparece só como um código interno (1.3.6.1.4.1.44588.2.1), e o TSE não publica como verificá-lo. Chegamos ao método, o mesmo usado por outros projetos abertos: as urnas novas usam Ed521, padrão do ITI (DOC-ICP-01.01), e as antigas usam ECDSA P-521, os dois sobre um SHA-512 calculado duas vezes. No país inteiro, 499.178 de 499.178 assinaturas são válidas. Os certificados das autoridades intermediárias do TSE (AC UE2022, AC UE2020 e AC URNA) estão no pacote de documentação do próprio TSE. Com eles, conferimos que o certificado de todas as 499.178 urnas foi assinado pela autoridade correta, sem nenhuma falha. Os certificados das raízes (AC RAIZ UE e AC RAIZ UE v2) não estão publicados, então a cadeia para na autoridade intermediária.',
                'The machine certificates are issued by authorities run by the TSE itself (AC UE2022, AC UE2020 and AC URNA), outside Brazil’s ICP-Brasil. The algorithm only shows as an internal code (1.3.6.1.4.1.44588.2.1), and the TSE does not publish how to verify it. We reproduced the method, the same one other open projects use: newer machines use Ed521, the ITI standard (DOC-ICP-01.01), and older ones use ECDSA P-521, both over a SHA-512 computed twice. Nationwide, 499,178 of 499,178 signatures are valid. The certificates of the TSE’s intermediate authorities (AC UE2022, AC UE2020 and AC URNA) are in the TSE’s own documentation package. With them we checked that all 499,178 machine certificates were signed by the right authority, with no failure. The root certificates (AC RAIZ UE and AC RAIZ UE v2) are not published, so the chain stops at the intermediate authority.',
              )}
            </p>
          </Achado>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Fora do comum', 'Out of the ordinary')}</h2>
        <div className="mt-6">
          <Achado numero="1ª" titulo={t('Primeira vez que quem liderou o 1º turno perde o 2º', 'First time the 1st-round leader lost the 2nd round')}>
            <p>{t('Flávio liderou o 1º turno com 47,03% contra 45,16%.', 'Flávio led the 1st round with 47.03% against 45.16%.')}</p>
          </Achado>
          <Achado numero="~2,8 pp" titulo={t('Erro das pesquisas na véspera', 'Poll error on the eve of the vote')}>
            <p>{t('Datafolha e Quaest davam Flávio 51% × 49%; AtlasIntel, 50,8% × 49,2%. O resultado foi 48,21% × 51,79%.', 'Datafolha and Quaest had Flávio 51% × 49%; AtlasIntel 50.8% × 49.2%. The result was 48.21% × 51.79%.')}</p>
          </Achado>
          <Achado numero="+2,96 mi" titulo={t('Votantes a mais no 2º turno', 'Extra voters in the 2nd round')}>
            <p>{t('A abstenção caiu de 21,08% para 19,22%.', 'Abstention fell from 21.08% to 19.22%.')}</p>
          </Achado>
          <Achado numero="+3,4 pp" titulo={t('Salvador: a virada de Lula foi maior que no resto da Bahia e nas outras capitais', 'Salvador: Lula’s swing was larger than in the rest of Bahia and in other state capitals')}>
            <p>
              {t(
                'Do 1º para o 2º turno, Lula subiu 8,0 pontos em Salvador (65,3% → 73,2% dos válidos) e 4,6 no resto da Bahia. A diferença, 3,4 pontos, equivale a uns 54 mil votos. Nas outras capitais do Nordeste e em SP, RJ e BH, a capital ficou entre 0,3 e 2,5 pontos acima do resto do estado. O projeto aberto urna-lab chegou ao mesmo sinal por outro método.',
                'From the 1st to the 2nd round, Lula rose 8.0 points in Salvador (65.3% → 73.2% of valid votes) and 4.6 in the rest of Bahia. The 3.4-point gap is about 54,000 votes. In the other Northeast capitals and in SP, RJ and BH, the capital was between 0.3 and 2.5 points above the rest of the state. The open project urna-lab found the same signal using another method.',
              )}
            </p>
            <p>
              {t(
                'Em Salvador o comparecimento subiu 5,5% e brancos e nulos caíram de 7,3% para 4,3%, as maiores variações entre essas capitais. Isso é compatível com mobilização local, mas não encontramos a causa. Os boletins, a recontagem do RDV e as assinaturas das urnas de Salvador conferem. Os 54 mil votos são 1,2% da diferença nacional.',
                'In Salvador turnout rose 5.5% and blank and null votes fell from 7.3% to 4.3%, the largest changes among these capitals. That fits local mobilisation, but we did not find the cause. Salvador’s reports, RDV recount and machine signatures all match. The 54,000 votes are 1.2% of the national gap.',
              )}
            </p>
          </Achado>
          <Achado numero={num(listas.comparecimento_20pp.linhas.length)} titulo={t('Seções onde o comparecimento subiu 20 pontos ou mais', 'Stations where turnout rose 20+ points')}>
            <p>{t('Lista completa na página Verifique.', 'Full list on the Verify page.')}</p>
          </Achado>
          <Achado numero={num(listas.mesario_100.linhas.length)} titulo={t('Seções em que um único mesário liberou 100 ou mais eleitores', 'Stations where a single poll worker released 100+ voters')}>
            <p>{t('O maior número foi 265 liberações por um mesário. Abrimos o log das 49: as liberações acompanham o movimento de votos ao longo do dia, das 8h às 17h, sem concentração em nenhuma hora (no máximo 33% numa só hora). Depois das 17h, foram só 3 liberações somando as 49 seções. Lista completa na página Verifique.', 'The highest was 265 releases by one worker. We opened all 49 logs: releases follow the flow of votes through the day, from 8 am to 5 pm, with no concentration in any hour (at most 33% in a single hour). After 5 pm there were only 3 releases across all 49 stations. Full list on the Verify page.')}</p>
          </Achado>
        </div>
      </section>
    </div>
  )
}
