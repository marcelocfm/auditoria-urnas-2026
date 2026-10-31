import type { Lang } from './i18n'

const W = 1080
const H = 1350
const MARGEM = 96
const SITE = 'auditoria-urnas-2026.vercel.app'

// verdict colors match the fact-check badges on the page
const COR_VEREDITO: Record<string, string> = {
  verdadeiro: '#34d399',
  falso: '#f87171',
  ressalva: '#fbbf24',
  nao_verificavel: '#a3a3a3',
}

function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(/\s+/)) {
    const teste = atual ? `${atual} ${palavra}` : palavra
    if (ctx.measureText(teste).width > largura && atual) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = teste
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Draws a text block, shrinking the font until it fits in maxAltura; returns the y after the block. */
function bloco(ctx: CanvasRenderingContext2D, texto: string, y: number, peso: string, tamanho: number, cor: string, maxAltura: number): number {
  let t = tamanho
  let linhas: string[]
  for (;;) {
    ctx.font = `${peso} ${t}px "Public Sans", Arial, sans-serif`
    linhas = quebrarLinhas(ctx, texto, W - 2 * MARGEM)
    if (linhas.length * t * 1.3 <= maxAltura || t <= 22) break
    t -= 2
  }
  ctx.fillStyle = cor
  ctx.textAlign = 'left'
  for (const l of linhas) {
    y += t * 1.3
    ctx.fillText(l, MARGEM, y)
  }
  return y
}

async function gerarPng({ afirmacao, veredito, rotulo, resumo, lang }: CardFato): Promise<Blob | null> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const en = lang === 'en'

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = COR_VEREDITO[veredito] ?? '#a3a3a3'
  ctx.fillRect(0, 0, 14, H)

  ctx.font = '600 30px "Public Sans", Arial, sans-serif'
  ctx.fillStyle = '#8c8c8c'
  ctx.fillText(en ? 'Fact check · Brazil 2026 presidential election' : 'Fact check · Eleição para Presidente 2026', MARGEM, 150)

  let y = bloco(ctx, `“${afirmacao}”`, 210, '800', 60, '#f2f2f2', 470)

  y += 60
  ctx.font = '800 40px "Public Sans", Arial, sans-serif'
  const larg = ctx.measureText(rotulo).width + 48
  ctx.strokeStyle = COR_VEREDITO[veredito] ?? '#a3a3a3'
  ctx.lineWidth = 4
  ctx.strokeRect(MARGEM, y, larg, 70)
  ctx.fillStyle = COR_VEREDITO[veredito] ?? '#a3a3a3'
  ctx.fillText(rotulo, MARGEM + 24, y + 49)

  bloco(ctx, resumo, y + 110, '400', 36, '#cfcfcf', H - (y + 110) - 220)

  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(MARGEM, H - 190, W - 2 * MARGEM, 2)
  ctx.font = '600 30px "Public Sans", Arial, sans-serif'
  ctx.fillStyle = '#8c8c8c'
  ctx.fillText(en ? 'Check it yourself, with the TSE’s open data:' : 'Confira você mesmo, com os dados abertos do TSE:', MARGEM, H - 130)
  ctx.font = '700 38px "IBM Plex Mono", Consolas, monospace'
  ctx.fillStyle = '#f2f2f2'
  ctx.fillText(SITE, MARGEM, H - 80)

  return new Promise((ok) => canvas.toBlob(ok, 'image/png'))
}

export type CardFato = { afirmacao: string; veredito: string; rotulo: string; resumo: string; lang: Lang }

/** Shares the card through the phone's share sheet (WhatsApp etc.); falls back to a download. */
export async function compartilharCard(card: CardFato): Promise<void> {
  const blob = await gerarPng(card)
  if (!blob) return
  const arquivo = new File([blob], 'fact-check-urnas-2026.png', { type: 'image/png' })
  const texto = `${card.lang === 'en' ? 'Fact check' : 'Checagem'}: https://${SITE}/#/fatos`
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], text: texto })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo.name
  a.click()
  URL.revokeObjectURL(url)
}
