import { useEffect, useRef, useState } from 'react'
import { loc, num, signedNum } from './format'
import { useT } from './i18n'

export type PontoApuracao = {
  ate: string
  boletins: number
  lula: number
  flavio: number
}

const CHART_PADDING = { left: 68, right: 18, top: 26, bottom: 34 }

/** Lula − Flávio running margin as BUs reached the TSE (2nd round). */
export function MarginChart({ pontos, totalBoletins }: { pontos: PontoApuracao[]; totalBoletins: number }) {
  const t = useT()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(720)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(280, Math.round(entry.contentRect.width)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const validPoints = pontos.filter((point) => point.boletins >= 50)
  if (validPoints.length < 2) return null

  const isCompact = chartWidth < 520
  const chartHeight = isCompact ? 250 : 290
  const margins = validPoints.map((point) => point.lula - point.flavio)
  const maxAbsMargin = Math.max(...margins.map(Math.abs), 1)
  const domainLimit = Math.ceil(maxAbsMargin / 1e6) * 1e6

  const xCoord = (index: number) =>
    CHART_PADDING.left +
    (index / (validPoints.length - 1)) * (chartWidth - CHART_PADDING.left - CHART_PADDING.right)

  const yCoord = (marginValue: number) =>
    CHART_PADDING.top +
    ((domainLimit - marginValue) / (2 * domainLimit)) *
      (chartHeight - CHART_PADDING.top - CHART_PADDING.bottom)

  const linePath = margins
    .map((marginValue, index) => `${index === 0 ? 'M' : 'L'}${xCoord(index).toFixed(1)},${yCoord(marginValue).toFixed(1)}`)
    .join('')

  const gridTicks = [domainLimit, domainLimit / 2, 0, -domainLimit / 2, -domainLimit]
  const timeLabels = validPoints
    .map((point, index) => [index, point.ate] as const)
    .filter(([, timeText]) => timeText.endsWith(':00') || (!isCompact && timeText.endsWith(':30')))

  const activePoint = hoveredIndex != null ? validPoints[hoveredIndex] : validPoints[validPoints.length - 1]
  const activeMargin = activePoint.lula - activePoint.flavio
  const apuradoPct = totalBoletins > 0 ? ((100 * activePoint.boletins) / totalBoletins).toLocaleString(loc(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0'

  return (
    <figure className="border border-linha bg-papel">
      <div className="num flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-linha px-4 py-3 text-sm sm:px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-suave">
            {hoveredIndex != null
              ? `${t('Inspeção', 'Inspecting')} · ${activePoint.ate}`
              : `${t('Final', 'Final')} · ${activePoint.ate}`}
          </span>
          <span className="text-suave">
            {apuradoPct}% {t('das urnas', 'of machines')}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span>
            Lula <strong>{num(activePoint.lula)}</strong>
          </span>
          <span>
            Flávio <strong>{num(activePoint.flavio)}</strong>
          </span>
          <span className="font-mono text-xs text-suave">
            {t('Saldo', 'Margin')}: <strong className="text-tinta">{signedNum(activeMargin)}</strong>
          </span>
        </div>
      </div>

      <div ref={containerRef} className="p-3 sm:p-5">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          tabIndex={0}
          className="w-full touch-pan-y select-none focus:outline-none"
          role="img"
          aria-label={t(
            'Diferença acumulada de votos entre Lula e Flávio Bolsonaro conforme os boletins chegaram ao TSE',
            'Running vote margin between Lula and Flávio Bolsonaro as ballot reports reached the TSE',
          )}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            const svgX = ((event.clientX - bounds.left) / bounds.width) * chartWidth
            const plotWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right
            const nearestIndex = Math.round(((svgX - CHART_PADDING.left) / plotWidth) * (validPoints.length - 1))
            setHoveredIndex(Math.max(0, Math.min(validPoints.length - 1, nearestIndex)))
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setHoveredIndex((curr) => Math.max(0, (curr ?? validPoints.length - 1) - 1))
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              setHoveredIndex((curr) => Math.min(validPoints.length - 1, (curr ?? 0) + 1))
            } else if (event.key === 'Escape') {
              setHoveredIndex(null)
            }
          }}
        >
          {gridTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={CHART_PADDING.left}
                x2={chartWidth - CHART_PADDING.right}
                y1={yCoord(tick)}
                y2={yCoord(tick)}
                stroke="var(--color-linha)"
                strokeWidth={tick === 0 ? 2 : 1}
              />
              <text
                x={CHART_PADDING.left - 8}
                y={yCoord(tick) + 4}
                textAnchor="end"
                fill="var(--color-suave)"
                fontSize={12}
                fontFamily="var(--font-mono)"
              >
                {tick === 0
                  ? t('empate', 'tied')
                  : `${tick > 0 ? '+' : '−'}${Math.abs(tick / 1e6).toLocaleString(loc())}${t(' mi', 'M')}`}
              </text>
            </g>
          ))}

          {timeLabels.map(([index, timeText]) => (
            <text
              key={timeText}
              x={xCoord(index)}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="var(--color-suave)"
              fontSize={12}
              fontFamily="var(--font-mono)"
            >
              {timeText}
            </text>
          ))}

          <text x={CHART_PADDING.left + 8} y={CHART_PADDING.top - 8} fill="var(--color-suave)" fontSize={12}>
            {t('↑ Lula na frente', '↑ Lula ahead')}
          </text>
          <text x={CHART_PADDING.left + 8} y={chartHeight - CHART_PADDING.bottom - 8} fill="var(--color-suave)" fontSize={12}>
            {t('↓ Flávio na frente', '↓ Flávio ahead')}
          </text>

          <path d={linePath} fill="none" strokeWidth={2.5} strokeLinejoin="round" stroke="var(--color-tinta)" />

          {hoveredIndex != null && (
            <>
              <line
                x1={xCoord(hoveredIndex)}
                x2={xCoord(hoveredIndex)}
                y1={CHART_PADDING.top}
                y2={chartHeight - CHART_PADDING.bottom}
                stroke="var(--color-suave)"
                strokeDasharray="3 3"
              />
              <circle
                cx={xCoord(hoveredIndex)}
                cy={yCoord(margins[hoveredIndex])}
                r={5}
                fill="var(--color-tinta)"
                stroke="var(--color-papel)"
                strokeWidth={2}
              />
            </>
          )}
        </svg>
      </div>
      <figcaption className="px-4 pb-3 text-xs text-suave sm:px-5">
        {t(
          'Passe o cursor, deslize o dedo ou use as setas do teclado sobre o gráfico para inspecionar o saldo acumulado a cada 5 minutos (horário de Brasília).',
          'Move the cursor, drag your finger or use the keyboard arrow keys on the chart to inspect the running margin every 5 minutes (Brasília time).',
        )}
      </figcaption>
    </figure>
  )
}
