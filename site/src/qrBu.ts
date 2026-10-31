export type SecaoBaseComparavel = {
  turno: number
  municipio: string
  zona: number
  secao: number
  aptos: number
  comparecimento: number
  lula: number
  flavio: number
  outros: number
  brancos: number
  nulos: number
  urna: number
}

export type DadosQrBu = {
  /** Raw QR text exactly as read, kept so a published check can be re-verified by anyone */
  bruto: string
  parte: number
  totalPartes: number
  turno: number | null
  uf: string
  codigoMunicipio: number | null
  zona: number
  secao: number
  urna: number | null
  temCargoPresidente: boolean
  aptos: number | null
  comparecimento: number | null
  brancos: number | null
  nulos: number | null
  votosCandidatos: Record<number, number>
  hash: string | null
}

export type ItemComparacaoQr = {
  campoPt: string
  campoEn: string
  papel: number
  tse: number
  igual: boolean
}

export type ResultadoComparacaoQr = {
  temVotosPresidente: boolean
  confereTudo: boolean
  itens: ItemComparacaoQr[]
}

/**
 * Parses a standard TSE Boletim de Urna QR Code payload (QRBU:*).
 * Spec: "QR Code no boletim de urna: manual para criação de aplicativo de leitura" (TSE).
 */
export function parseQrBu(textoBruto: string): DadosQrBu | null {
  const limpo = textoBruto.trim()
  if (!limpo.includes('QRBU:')) return null

  const tokens = limpo.split(/\s+/)
  let parte = 1
  let totalPartes = 1
  let turno: number | null = null
  let uf = ''
  let codigoMunicipio: number | null = null
  let zona = 0
  let secao = 0
  let urna: number | null = null
  let hash: string | null = null

  let cargoAtual: number | null = null
  let temCargoPresidente = false
  let aptos: number | null = null
  let comparecimento: number | null = null
  let brancos: number | null = null
  let nulos: number | null = null
  const votosCandidatos: Record<number, number> = {}

  for (const tok of tokens) {
    if (tok.startsWith('QRBU:')) {
      const pedacos = tok.split(':')
      parte = Number(pedacos[1]) || 1
      totalPartes = Number(pedacos[2]) || 1
      continue
    }

    const idx = tok.indexOf(':')
    if (idx <= 0) continue
    const chave = tok.slice(0, idx).toUpperCase()
    const valor = tok.slice(idx + 1)

    switch (chave) {
      case 'TURN':
        turno = Number(valor) || null
        break
      case 'UNFE':
        uf = valor.toUpperCase()
        break
      case 'MUNI':
        codigoMunicipio = Number(valor) || null
        break
      case 'ZONA':
        zona = Number(valor) || 0
        break
      case 'SECA':
        secao = Number(valor) || 0
        break
      case 'IDUE':
        urna = Number(valor) || null
        break
      case 'CARG':
        cargoAtual = Number(valor)
        if (cargoAtual === 1) temCargoPresidente = true
        break
      // APTO/COMP sit in the section header, before any CARG block (TSE QR Code BU manual)
      case 'APTO':
        aptos = Number(valor)
        break
      case 'COMP':
        comparecimento = Number(valor)
        break
      case 'HASH':
        hash = valor
        cargoAtual = null
        break
      case 'ASSI':
        cargoAtual = null
        break
      default:
        if (cargoAtual === 1) {
          if (chave === 'BRAN') brancos = Number(valor)
          else if (chave === 'NULO') nulos = Number(valor)
          else if (/^\d{2}$/.test(chave)) {
            const numCand = Number(chave)
            const qtdVotos = Number(valor)
            if (!Number.isNaN(qtdVotos)) {
              votosCandidatos[numCand] = qtdVotos
            }
          }
        }
        break
    }
  }

  if (!uf || !zona || !secao) return null

  return {
    bruto: limpo,
    parte,
    totalPartes,
    turno,
    uf,
    codigoMunicipio,
    zona,
    secao,
    urna,
    temCargoPresidente,
    aptos,
    comparecimento,
    brancos,
    nulos,
    votosCandidatos,
    hash,
  }
}

export function compararQrComBase(qr: DadosQrBu, base: SecaoBaseComparavel): ResultadoComparacaoQr {
  const itens: ItemComparacaoQr[] = []

  if (qr.urna != null) {
    itens.push({
      campoPt: 'Nº de série da urna (IDUE)',
      campoEn: 'Machine serial # (IDUE)',
      papel: qr.urna,
      tse: base.urna,
      igual: qr.urna === base.urna,
    })
  }

  if (!qr.temCargoPresidente) {
    return {
      temVotosPresidente: false,
      confereTudo: itens.every((i) => i.igual),
      itens,
    }
  }

  if (qr.aptos != null) {
    itens.push({
      campoPt: 'Eleitores aptos',
      campoEn: 'Registered voters',
      papel: qr.aptos,
      tse: base.aptos,
      igual: qr.aptos === base.aptos,
    })
  }
  if (qr.comparecimento != null) {
    itens.push({
      campoPt: 'Comparecimento',
      campoEn: 'Turnout',
      papel: qr.comparecimento,
      tse: base.comparecimento,
      igual: qr.comparecimento === base.comparecimento,
    })
  }

  const lulaQr = qr.votosCandidatos[13] ?? 0
  const flavioQr = qr.votosCandidatos[22] ?? 0
  const outrosQr = Object.entries(qr.votosCandidatos)
    .filter(([numCand]) => Number(numCand) !== 13 && Number(numCand) !== 22)
    .reduce((acc, [, v]) => acc + v, 0)

  itens.push({
    campoPt: 'Lula (13)',
    campoEn: 'Lula (13)',
    papel: lulaQr,
    tse: base.lula,
    igual: lulaQr === base.lula,
  })
  itens.push({
    campoPt: 'Flávio Bolsonaro (22)',
    campoEn: 'Flávio Bolsonaro (22)',
    papel: flavioQr,
    tse: base.flavio,
    igual: flavioQr === base.flavio,
  })

  if (base.turno === 1 || outrosQr > 0) {
    itens.push({
      campoPt: 'Demais candidatos',
      campoEn: 'Other candidates',
      papel: outrosQr,
      tse: base.outros,
      igual: outrosQr === base.outros,
    })
  }

  if (qr.brancos != null) {
    itens.push({
      campoPt: 'Votos em branco',
      campoEn: 'Blank votes',
      papel: qr.brancos,
      tse: base.brancos,
      igual: qr.brancos === base.brancos,
    })
  }
  if (qr.nulos != null) {
    itens.push({
      campoPt: 'Votos nulos',
      campoEn: 'Null votes',
      papel: qr.nulos,
      tse: base.nulos,
      igual: qr.nulos === base.nulos,
    })
  }

  return {
    temVotosPresidente: true,
    confereTudo: itens.every((i) => i.igual),
    itens,
  }
}

type BarcodeDetectorNativo = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>
}

function obterDetectorNativo(): BarcodeDetectorNativo | null {
  const w = window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorNativo
  }
  if (!w.BarcodeDetector) return null
  try {
    return new w.BarcodeDetector({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

export async function decodificarQrDeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const nativo = obterDetectorNativo()
  if (nativo) {
    try {
      const codigos = await nativo.detect(canvas)
      const achado = codigos.find((c) => c.rawValue)?.rawValue
      if (achado) return achado
    } catch {
      // Fall through to pure-JS jsQR
    }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null
  const { default: jsQR } = await import('jsqr')
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const resultado = jsQR(imgData.data, imgData.width, imgData.height, {
    inversionAttempts: 'attemptBoth',
  })
  return resultado?.data ?? null
}

export async function decodificarQrDeArquivo(arquivo: File): Promise<string | null> {
  const bitmap = await createImageBitmap(arquivo)
  try {
    const nativo = obterDetectorNativo()
    if (nativo) {
      try {
        const codigos = await nativo.detect(bitmap)
        const achado = codigos.find((c) => c.rawValue)?.rawValue
        if (achado) return achado
      } catch {
        // Fall through to canvas scales
      }
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    // Test multiple scales so high-megapixel phone photos of dense QRBU codes decode reliably
    for (const maxLado of [1800, 1100, 2600]) {
      const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * escala))
      canvas.height = Math.max(1, Math.round(bitmap.height * escala))
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const texto = await decodificarQrDeCanvas(canvas)
      if (texto) return texto
    }
    return null
  } finally {
    bitmap.close()
  }
}
