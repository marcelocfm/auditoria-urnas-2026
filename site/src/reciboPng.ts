import { num, pct, signedNum } from './format'
import type { Lang } from './i18n'
import type { SecaoBaseComparavel } from './qrBu'

function desenharLinhaTracejada(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(87, 85, 79, 0.55)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.restore()
}

function desenharPar(
  ctx: CanvasRenderingContext2D,
  esq: string,
  dir: string,
  x: number,
  largura: number,
  y: number,
  negrito = false,
  suaveEsq = false,
) {
  ctx.font = `${negrito ? '700' : '400'} 28px "IBM Plex Mono", Consolas, monospace`
  ctx.fillStyle = suaveEsq ? '#57554f' : '#141414'
  ctx.textAlign = 'left'
  ctx.fillText(esq, x, y)

  ctx.fillStyle = '#141414'
  ctx.textAlign = 'right'
  ctx.fillText(dir, x + largura, y)
}

export async function baixarImagemBoletimSecao({
  uf,
  secoes,
  lang,
}: {
  uf: string
  secoes: SecaoBaseComparavel[]
  lang: Lang
}): Promise<void> {
  const en = lang === 'en'
  const principal = secoes.find((s) => s.turno === 2) ?? secoes[0]
  if (!principal) return
  const t1 = secoes.find((s) => s.turno === 1)
  const t2 = secoes.find((s) => s.turno === 2)

  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Black background + subtle brutalist frame
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 3
  ctx.strokeRect(32, 32, W - 64, H - 64)

  // Brazilian flag badge
  const fx = 84
  const fy = 86
  const fw = 54
  const fh = 38
  ctx.fillStyle = '#009b3a'
  ctx.fillRect(fx, fy, fw, fh)
  ctx.fillStyle = '#fedf00'
  ctx.beginPath()
  ctx.moveTo(fx + fw / 2, fy + 4)
  ctx.lineTo(fx + fw - 5, fy + fh / 2)
  ctx.lineTo(fx + fw / 2, fy + fh - 4)
  ctx.lineTo(fx + 5, fy + fh / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#002776'
  ctx.beginPath()
  ctx.arc(fx + fw / 2, fy + fh / 2, 9.5, 0, Math.PI * 2)
  ctx.fill()

  // Kicker + Location header
  ctx.fillStyle = '#a3a3a3'
  ctx.textAlign = 'left'
  ctx.font = '600 22px "IBM Plex Mono", Consolas, monospace'
  ctx.fillText(
    en ? 'INDEPENDENT AUDIT · PUBLIC TSE FILES' : 'AUDITORIA INDEPENDENTE · ARQUIVOS PÚBLICOS DO TSE',
    fx + fw + 22,
    fy + 27,
  )

  ctx.fillStyle = '#f2f2f2'
  ctx.font = '800 48px "Public Sans", "Segoe UI", sans-serif'
  const tituloCidade = `${principal.municipio} (${uf})`
  ctx.fillText(tituloCidade.slice(0, 28), 84, 198)

  ctx.fillStyle = '#a3a3a3'
  ctx.font = '600 28px "IBM Plex Mono", Consolas, monospace'
  ctx.fillText(
    en
      ? `ZONE ${principal.zona} · SECTION ${principal.secao} · MACHINE #${principal.urna}`
      : `ZONA ${principal.zona} · SEÇÃO ${principal.secao} · URNA Nº ${principal.urna}`,
    84,
    246,
  )

  // Thermal printer slot + warm thermal paper (.boletim)
  const rx = 84
  const ry = 304
  const rw = W - 168
  const rh = 890

  ctx.fillStyle = '#1f1f1f'
  ctx.fillRect(rx - 16, ry - 12, rw + 32, 20)

  ctx.fillStyle = '#f4f2ec'
  ctx.fillRect(rx, ry, rw, rh - 20)

  // Zigzag torn paper bottom edge
  const zig = 20
  ctx.beginPath()
  for (let x = rx; x < rx + rw; x += zig) {
    const w2 = Math.min(zig, rx + rw - x)
    ctx.moveTo(x, ry + rh - 20)
    ctx.lineTo(x + w2, ry + rh - 20)
    ctx.lineTo(x + w2 / 2, ry + rh)
    ctx.closePath()
  }
  ctx.fill()

  const px = rx + 54
  const pw = rw - 108

  ctx.fillStyle = '#141414'
  ctx.textAlign = 'center'
  ctx.font = '700 32px "IBM Plex Mono", Consolas, monospace'
  ctx.fillText(
    en ? 'BALLOT-BOX REPORT — SECTION' : 'BOLETIM DE URNA — SEÇÃO ELEITORAL',
    rx + rw / 2,
    ry + 68,
  )

  ctx.fillStyle = '#57554f'
  ctx.font = '400 24px "IBM Plex Mono", Consolas, monospace'
  ctx.fillText(
    principal.turno === 2
      ? en
        ? 'President · 2nd round · 10/25/2026'
        : 'Presidente · 2º turno · 25/10/2026'
      : en
        ? 'President · 1st round · 10/04/2026'
        : 'Presidente · 1º turno · 04/10/2026',
    rx + rw / 2,
    ry + 108,
  )

  desenharLinhaTracejada(ctx, px, px + pw, ry + 142)

  const nominais = principal.lula + principal.flavio + principal.outros
  const somaUrna = nominais + principal.brancos + principal.nulos

  desenharPar(
    ctx,
    'Lula (13)',
    `${pct(principal.lula, nominais)}   ${num(principal.lula)}`,
    px,
    pw,
    ry + 196,
    true,
  )
  desenharPar(
    ctx,
    'Flávio Bolsonaro (22)',
    `${pct(principal.flavio, nominais)}   ${num(principal.flavio)}`,
    px,
    pw,
    ry + 250,
    true,
  )

  let cursorY = ry + 292
  if (principal.turno === 1 && principal.outros > 0) {
    desenharPar(
      ctx,
      en ? 'Other candidates' : 'Demais candidatos',
      num(principal.outros),
      px,
      pw,
      cursorY,
      false,
      true,
    )
    cursorY += 46
  }

  desenharLinhaTracejada(ctx, px, px + pw, cursorY)
  cursorY += 52

  desenharPar(ctx, en ? 'Registered voters' : 'Eleitores aptos', num(principal.aptos), px, pw, cursorY, false, true)
  cursorY += 44
  desenharPar(ctx, en ? 'Turnout' : 'Comparecimento', num(principal.comparecimento), px, pw, cursorY, true, false)
  cursorY += 44
  desenharPar(
    ctx,
    en ? 'Abstentions' : 'Abstenções',
    num(principal.aptos - principal.comparecimento),
    px,
    pw,
    cursorY,
    false,
    true,
  )
  cursorY += 44
  desenharPar(ctx, en ? 'Blank votes' : 'Brancos', num(principal.brancos), px, pw, cursorY, false, true)
  cursorY += 44
  desenharPar(ctx, en ? 'Null votes' : 'Nulos de urna', num(principal.nulos), px, pw, cursorY, false, true)

  cursorY += 34
  desenharLinhaTracejada(ctx, px, px + pw, cursorY)
  cursorY += 46

  if (t1 && t2) {
    ctx.fillStyle = '#57554f'
    ctx.textAlign = 'left'
    ctx.font = '400 22px "IBM Plex Mono", Consolas, monospace'
    const resumo1t = en
      ? `1st round: Lula ${num(t1.lula)} × Flávio ${num(t1.flavio)} | Shift: Lula ${signedNum(t2.lula - t1.lula)}, Flávio ${signedNum(t2.flavio - t1.flavio)}`
      : `1º turno: Lula ${num(t1.lula)} × Flávio ${num(t1.flavio)} | Variação: Lula ${signedNum(t2.lula - t1.lula)}, Flávio ${signedNum(t2.flavio - t1.flavio)}`
    ctx.fillText(resumo1t, px, cursorY)
  }

  // Bottom black verification seal inside receipt
  const barY = ry + rh - 118
  ctx.fillStyle = '#141414'
  ctx.fillRect(px, barY, pw, 64)
  ctx.fillStyle = '#f4f2ec'
  ctx.textAlign = 'center'
  ctx.font = '700 25px "IBM Plex Mono", Consolas, monospace'
  const contaFecha = somaUrna === principal.comparecimento
  ctx.fillText(
    contaFecha
      ? en
        ? `✓ Recorded sum (${num(somaUrna)}) matches official TSE report`
        : `✓ Soma da urna (${num(somaUrna)}) confere com o boletim do TSE`
      : `${num(somaUrna)} / ${num(principal.comparecimento)}`,
    rx + rw / 2,
    barY + 41,
  )

  // Footer URL
  ctx.fillStyle = '#a3a3a3'
  ctx.textAlign = 'left'
  ctx.font = '600 24px "IBM Plex Mono", Consolas, monospace'
  ctx.fillText('auditoria-urnas-2026.vercel.app', 84, H - 68)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#f2f2f2'
  ctx.fillText(en ? 'As urnas conferem?' : 'As urnas conferem?', W - 84, H - 68)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  const nomeArquivo = `boletim-${uf.toLowerCase()}-z${principal.zona}-s${principal.secao}.png`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
