import { useEffect, useState } from 'react'
import { num } from './format'
import { useLang, useT } from './i18n'
import type { ItemComparacaoQr } from './qrBu'

type Painel = {
  total: number
  divergentes: number
  secoes: number
  por_uf: { uf: string; total: number; divergentes: number }[]
  divergencias: { uf: string; zona: number; secao: number; turno: number; itens: ItemComparacaoQr[]; qr: string; criado_em: string }[]
}

/** Public panel of citizen checks: printed report (QR code) against the TSE files. */
export function Conferencias() {
  const t = useT()
  const en = useLang() === 'en'
  const [p, setP] = useState<Painel | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch('/api/conferencias')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setP)
      .catch(() => setErro(true))
  }, [])

  return (
    <section>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('Conferência coletiva dos boletins de papel', 'Citizen check of the paper reports')}</h2>
      <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-suave">
        {t(
          'O boletim colado na porta da seção é a única prova que não depende dos arquivos do TSE. Fotografe o QR Code dele em “Confira a sua seção” e toque em “Publicar esta conferência”. O resultado aparece aqui para todos.',
          'The report posted on the station door is the only evidence that does not depend on the TSE’s files. Photograph its QR code under “Check your station” and tap “Publish this check”. The result shows up here for everyone.',
        )}
      </p>

      {erro ? (
        <p className="mt-8 text-suave">{t('O painel não carregou agora. Tente mais tarde.', 'The panel did not load right now. Try again later.')}</p>
      ) : !p ? (
        <p className="mt-8 text-suave">{t('Carregando…', 'Loading…')}</p>
      ) : (
        <>
          <div className="num mt-8 grid gap-3 sm:grid-cols-3">
            {[
              [num(p.total), t('boletins conferidos', 'reports checked')],
              [num(p.secoes), t('seções diferentes', 'different stations')],
              [num(p.divergentes), t('com alguma diferença', 'with any mismatch')],
            ].map(([v, r], i) => (
              <div key={r} className="border border-linha bg-papel p-5">
                <p className={`text-3xl font-extrabold ${i === 2 ? 'text-amber-300' : 'text-tinta'}`}>{v}</p>
                <p className="mt-1 text-sm text-suave">{r}</p>
              </div>
            ))}
          </div>

          {p.total === 0 && (
            <p className="mt-6 text-suave">{t('Nenhuma conferência ainda. A primeira pode ser a sua.', 'No checks yet. The first one can be yours.')}</p>
          )}

          {p.divergencias.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-xl font-semibold">{t('Diferenças registradas', 'Recorded mismatches')}</h3>
              <p className="max-w-[66ch] text-sm leading-relaxed text-suave">
                {t(
                  'O servidor refaz a comparação a partir do texto do QR Code. Mas um texto de QR pode ser forjado: cada diferença só vale como prova depois de confirmada com a foto do boletim de papel.',
                  'The server redoes the comparison from the QR text. But QR text can be forged: each mismatch only counts as evidence once confirmed with a photo of the paper report.',
                )}
              </p>
              {p.divergencias.map((d) => (
                <div key={d.qr} className="border border-amber-300/60 bg-papel p-4 text-sm">
                  <p className="font-semibold">
                    {d.uf} · {t('zona', 'zone')} {d.zona} · {t('seção', 'station')} {d.secao} · {d.turno}º {t('turno', 'round')}
                  </p>
                  <ul className="num mt-2 space-y-1 font-mono text-xs">
                    {d.itens
                      .filter((i) => !i.igual)
                      .map((i) => (
                        <li key={i.campoPt}>
                          {en ? i.campoEn : i.campoPt}: {t('papel', 'paper')} {num(i.papel)} · TSE {num(i.tse)}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
