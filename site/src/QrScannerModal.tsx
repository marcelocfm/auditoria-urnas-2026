import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from './i18n'
import { decodificarQrDeArquivo, decodificarQrDeCanvas, parseQrBu, type DadosQrBu } from './qrBu'

const EXEMPLO_QRBU_SP =
  'QRBU:1:1 VRQR:6.0 ORIG:VOTA PROC:2026 DTPL:20261025 TURN:2 FASE:O UNFE:SP MUNI:71072 ZONA:1 SECA:1 IDUE:2027601 CARG:1 APTO:363 COMP:266 13:145 22:112 NOMI:257 BRAN:3 NULO:6 TOTA:266 HASH:8F4E2C9A'

export function QrScannerModal({
  onDetectado,
  onFechar,
}: {
  onDetectado: (dados: DadosQrBu) => void
  onFechar: () => void
}) {
  const t = useT()
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [textoManual, setTextoManual] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const pararCamera = useCallback(() => {
    if (streamRef.current) {
      for (const trilha of streamRef.current.getTracks()) {
        trilha.stop()
      }
      streamRef.current = null
    }
    setCameraAtiva(false)
  }, [])

  useEffect(() => {
    return () => {
      pararCamera()
    }
  }, [pararCamera])

  const processarTextoQr = useCallback(
    (bruto: string) => {
      const dados = parseQrBu(bruto)
      if (!dados) {
        setErro(
          t(
            'QR Code lido, mas não segue o formato QRBU de Boletim de Urna do TSE.',
            'QR code read, but it does not match the TSE ballot-box QRBU format.',
          ),
        )
        return false
      }
      setErro(null)
      pararCamera()
      onDetectado(dados)
      return true
    },
    [onDetectado, pararCamera, t],
  )

  const iniciarCamera = async () => {
    setErro(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro(
        t(
          'Seu navegador não liberou acesso direto à câmera. Use o botão “Enviar foto do Boletim”.',
          'Your browser does not allow direct camera access. Use “Upload photo of the report”.',
        ),
      )
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraAtiva(true)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch {
      setErro(
        t(
          'Permissão de câmera negada ou indisponível. Envie uma foto do QR Code da galeria.',
          'Camera permission denied or unavailable. Upload a photo of the QR code instead.',
        ),
      )
    }
  }

  useEffect(() => {
    if (!cameraAtiva) return
    let cancelado = false
    const canvas = document.createElement('canvas')

    const intervalo = window.setInterval(async () => {
      const video = videoRef.current
      if (cancelado || !video || video.readyState < 2 || video.videoWidth === 0) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const lido = await decodificarQrDeCanvas(canvas)
      if (!cancelado && lido) {
        processarTextoQr(lido)
      }
    }, 280)

    return () => {
      cancelado = true
      window.clearInterval(intervalo)
    }
  }, [cameraAtiva, processarTextoQr])

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro(null)
    setProcessandoFoto(true)
    try {
      const texto = await decodificarQrDeArquivo(arquivo)
      if (!texto) {
        setErro(
          t(
            'Não foi possível localizar o QR Code nessa imagem. Fotografe mais de perto o quadrado final do boletim.',
            'Could not find a QR code in this image. Take a closer photo of the QR square at the bottom of the report.',
          ),
        )
        return
      }
      processarTextoQr(texto)
    } catch {
      setErro(t('Erro ao processar a imagem enviada.', 'Failed to process the uploaded image.'))
    } finally {
      setProcessandoFoto(false)
    }
  }

  return (
    <div className="space-y-4 border-2 border-tinta bg-papel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-linha pb-3">
        <div>
          <p className="font-mono text-xs tracking-wider text-suave uppercase">
            {t('Verificação direta do papel impresso (padrão QRBU / TSE)', 'Direct check of printed paper report (QRBU / TSE standard)')}
          </p>
          <h4 className="mt-1 text-lg font-bold">
            {t('Confrontar QR Code do Boletim de Urna com a base do TSE', 'Compare Ballot Report QR Code against the TSE database')}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => {
            pararCamera()
            onFechar()
          }}
          className="cursor-pointer border border-linha px-2.5 py-1 font-mono text-xs text-suave hover:border-tinta hover:text-tinta"
        >
          {t('Fechar ✕', 'Close ✕')}
        </button>
      </div>

      <p className="text-sm leading-relaxed text-suave">
        {t(
          'Aponte a câmera ou envie uma foto do QR Code impresso no final do Boletim de Urna afixado na seção. A leitura acontece 100% no seu aparelho (nenhuma foto sai do navegador).',
          'Point your camera or upload a photo of the QR code printed at the bottom of the Ballot Report posted at the station. Decoding runs 100% on your device (no photo leaves your browser).',
        )}
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center border border-tinta bg-tinta px-4 text-sm font-semibold text-fundo transition-opacity hover:opacity-85">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={processandoFoto}
            onChange={(e) => {
              void aoEscolherArquivo(e.target.files?.[0])
              e.currentTarget.value = ''
            }}
          />
          {processandoFoto
            ? t('Lendo QR Code da foto…', 'Reading QR code from photo…')
            : t('Enviar foto do Boletim / QR Code', 'Upload photo of Report / QR Code')}
        </label>

        {!cameraAtiva ? (
          <button
            type="button"
            onClick={() => void iniciarCamera()}
            className="min-h-11 cursor-pointer border border-tinta bg-fundo px-4 text-sm font-semibold text-tinta transition-colors hover:bg-tinta hover:text-fundo"
          >
            {t('Usar câmera ao vivo', 'Use live camera')}
          </button>
        ) : (
          <button
            type="button"
            onClick={pararCamera}
            className="min-h-11 cursor-pointer border border-linha bg-fundo px-4 text-sm font-semibold text-suave hover:border-tinta hover:text-tinta"
          >
            {t('Parar câmera', 'Stop camera')}
          </button>
        )}

        <button
          type="button"
          onClick={() => processarTextoQr(EXEMPLO_QRBU_SP)}
          className="min-h-11 cursor-pointer border border-linha bg-fundo px-3.5 font-mono text-xs text-suave transition-colors hover:border-tinta hover:text-tinta"
        >
          {t('Testar com exemplo real (SP · Z1 · S1)', 'Test with real sample (SP · Z1 · S1)')}
        </button>
      </div>

      {cameraAtiva && (
        <div className="relative overflow-hidden border border-tinta bg-fundo">
          <video ref={videoRef} playsInline muted className="max-h-80 w-full object-cover" />
          <div className="border-t border-linha bg-papel px-3 py-2 font-mono text-xs text-suave">
            {t('Enquadre o primeiro QR Code (QRBU:1) impresso no pé do boletim…', 'Frame the first QR code (QRBU:1) printed at the bottom of the report…')}
          </div>
        </div>
      )}

      {erro && (
        <p className="border border-linha bg-fundo px-4 py-3 text-sm text-tinta">
          {erro}
        </p>
      )}

      <details className="border-t border-linha pt-3 text-sm">
        <summary className="cursor-pointer font-mono text-xs text-suave hover:text-tinta">
          {t('+ Colar conteúdo bruto do QR Code (QRBU:1:...)', '+ Paste raw QR code payload (QRBU:1:...)')}
        </summary>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={textoManual}
            onChange={(e) => setTextoManual(e.target.value)}
            placeholder="QRBU:1:1 ... UNFE:SP ... ZONA:1 SECA:1 ... CARG:1 ..."
            className="min-h-10 flex-1 border border-linha bg-fundo px-3 font-mono text-xs text-tinta placeholder:text-suave/50 focus:border-tinta focus:outline-none"
          />
          <button
            type="button"
            onClick={() => processarTextoQr(textoManual)}
            disabled={!textoManual.trim()}
            className="min-h-10 cursor-pointer border border-tinta px-4 font-mono text-xs font-semibold text-tinta hover:bg-tinta hover:text-fundo disabled:opacity-40"
          >
            {t('Conferir payload', 'Verify payload')}
          </button>
        </div>
      </details>
    </div>
  )
}
