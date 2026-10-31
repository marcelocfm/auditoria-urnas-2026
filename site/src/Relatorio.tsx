import type { ReactNode } from 'react'
import { useT } from './i18n'

function Linha({ verificacao, resultado }: { verificacao: string; resultado: string }) {
  return (
    <tr>
      <td className="py-3 pr-4 align-top">{verificacao}</td>
      <td className="num py-3 text-right align-top font-semibold whitespace-nowrap">{resultado}</td>
    </tr>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-linha pt-10">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h2>
      <div className="mt-5 max-w-[68ch] space-y-4 leading-relaxed text-suave">{children}</div>
    </section>
  )
}

/** One-page summary of the audit, meant to be the link sent to press and experts. */
export function Relatorio() {
  const t = useT()
  const link = (href: string, texto: string) => (
    <a href={href} className="text-tinta underline underline-offset-2">
      {texto}
    </a>
  )

  return (
    <div className="space-y-12">
      <section>
        <p className="max-w-[66ch] text-lg leading-relaxed">
          {t(
            'Conferimos, com os arquivos públicos do TSE, o 2º turno da eleição para Presidente de 25/10/2026 (Lula × Flávio Bolsonaro). Todo o código e os dados estão abertos. O site não toma lado: mostra o que confere, o que está errado e o que não dá para verificar.',
            'Using the TSE’s public files, we checked the 2nd round of the Oct 25, 2026 presidential election (Lula × Flávio Bolsonaro). All code and data are open. The site takes no side: it shows what checks out, what is wrong and what cannot be verified.',
          )}
        </p>
        <p className="num mt-6 text-2xl font-bold">
          Lula 64.256.232 (51,79%) × Flávio Bolsonaro 59.826.041 (48,21%)
        </p>
        <p className="mt-1 text-suave">{t('Diferença: 4.430.191 votos.', 'Margin: 4,430,191 votes.')}</p>
      </section>

      <Bloco titulo={t('O que verificamos', 'What we checked')}>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[420px] text-[15px] text-tinta">
            <tbody className="divide-y divide-linha">
              <Linha verificacao={t('Soma dos boletins de urna igual ao resultado oficial', 'Sum of ballot-box reports equals the official result')} resultado={t('0 diferenças', '0 differences')} />
              <Linha verificacao={t('Recontagem voto a voto (RDV) igual ao boletim', 'Vote-by-vote recount (RDV) equals the report')} resultado="499.178 / 499.178" />
              <Linha verificacao={t('Imagem impressa do boletim igual ao boletim digital', 'Printed report image equals the digital report')} resultado="499.178 / 499.178" />
              <Linha verificacao={t('Hashes SHA-512 dos arquivos iguais aos assinados pela urna', 'File SHA-512 hashes equal those signed by the machine')} resultado="3.993.422 / 3.993.422" />
              <Linha verificacao={t('Assinatura digital de cada urna válida', 'Each machine’s digital signature valid')} resultado="499.178 / 499.178" />
              <Linha verificacao={t('Certificado de cada urna assinado pela autoridade do TSE', 'Each machine certificate signed by the TSE authority')} resultado="499.178 / 499.178" />
              <Linha verificacao={t('Votos no log sem eleitor liberado antes', 'Votes in the log with no voter released first')} resultado="0" />
              <Linha verificacao={t('Pacotes de arquivos alterados depois de 26/10', 'File packages changed after Oct 26')} resultado="0 / 28" />
            </tbody>
          </table>
        </div>
      </Bloco>

      <Bloco titulo={t('O que encontramos de errado ou fora do comum', 'What we found wrong or out of the ordinary')}>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t('334 registros de “O voto do eleitor NÃO foi registrado”, quase todos por falha do teclado. Nos 89 que abrimos, a urna reiniciou e o eleitor seguinte votou.', '334 “The voter’s vote was NOT registered” records, nearly all keypad failures. In the 89 we opened, the machine restarted and the next voter voted.')}</li>
          <li>{t('62 erros de assinatura ou integridade nos logs; em Lamim (MG) a urna se recusou a rodar e foi trocada.', '62 signature or integrity errors in the logs; in Lamim (MG) the machine refused to run and was replaced.')}</li>
          <li>{t('O certificado publicado da autoridade “AC URNA”, da qual dependem 99.928 urnas antigas, venceu em 18/07/2026, antes da eleição. O TSE não explicou.', 'The published certificate of the “AC URNA” authority, on which 99,928 older machines depend, expired on July 18, 2026, before the election. The TSE has not explained it.')}</li>
          <li>{t('O TSE não publica o hash dos pacotes com os arquivos das urnas nem os certificados das raízes, nem documenta como verificar a assinatura.', 'The TSE publishes neither the hash of the machine-file packages nor the root certificates, and does not document how to verify the signature.')}</li>
          <li>{t('Duas seções fecharam depois das 20h (Duas Barras/RJ e Chapada Gaúcha/MG) por urna travada; nos dois casos o último voto foi antes das 17h.', 'Two stations closed after 8 pm (Duas Barras/RJ and Chapada Gaúcha/MG) because the machine froze; in both the last vote was before 5 pm.')}</li>
          <li>{t('Fatos incomuns: primeira virada no 2º turno, pesquisas erraram por cerca de 2,8 pontos, comparecimento subiu 2,96 milhões.', 'Unusual facts: first 2nd-round reversal, polls off by about 2.8 points, turnout up 2.96 million.')}</li>
        </ul>
        <p>{link('#/inconsistencias', t('Lista completa, com os números exatos', 'Full list, with exact figures'))}</p>
      </Bloco>

      <Bloco titulo={t('O que não dá para verificar com os arquivos', 'What the files cannot verify')}>
        <p>
          {t(
            'Os arquivos provam que nada foi alterado depois que cada urna os gerou. Não provam que o programa dentro da urna registrou o voto como o eleitor digitou: se isso tivesse acontecido, todos os arquivos sairiam coerentes e assinados. A única prova independente do TSE é o boletim impresso e colado na porta de cada seção.',
            'The files prove nothing was changed after each machine produced them. They do not prove the program inside the machine recorded the vote as typed: had that failed, every file would still come out consistent and signed. The only evidence independent of the TSE is the report printed and posted on each station’s door.',
          )}
        </p>
      </Bloco>

      <Bloco titulo={t('Como ajudar', 'How to help')}>
        <p>
          {t(
            'Se você tem foto do boletim de urna da porta de uma seção, abra “Confira a sua seção”, leia o QR Code e toque em “Publicar esta conferência”. Uma única divergência real, confirmada com a foto, seria prova concreta. Se tudo bater, isso também fica registrado.',
            'If you have a photo of a station’s door report, open “Check your station”, scan the QR code and tap “Publish this check”. A single real mismatch, confirmed by the photo, would be concrete evidence. If everything matches, that is recorded too.',
          )}
        </p>
        <p>{link('#/verifique', t('Painel de conferências e código aberto', 'Checks panel and open code'))}</p>
      </Bloco>
    </div>
  )
}
