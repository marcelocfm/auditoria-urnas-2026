/**
 * Bandeira Nacional, Lei 5.700/1971 proportions: 20 × 14 modules, rhombus 1.7 from the edges,
 * globe radius 3.5, white band between radii 8 and 8.5 centred 2 modules left of the bottom midpoint.
 * Stars are simplified to a few dots; Spica stays alone above the band.
 */
const ESTRELAS: [number, number, number][] = [
  [10.9, 5.35, 0.15],
  [9.2, 7.45, 0.13],
  [10.6, 8.2, 0.18],
  [8.6, 8.4, 0.13],
  [11.6, 9.1, 0.18],
  [9.6, 9.5, 0.18],
  [12.4, 7.9, 0.12],
  [10.5, 10.4, 0.18],
  [8.1, 9.9, 0.12],
  [11.7, 10.5, 0.12],
]

export function Bandeira({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 14" className={className} role="img" aria-label="Bandeira do Brasil">
      <defs>
        <clipPath id="bandeira-globo">
          <circle cx="10" cy="7" r="3.5" />
        </clipPath>
        <path id="bandeira-lema" d="M -0.25 14 A 8.25 8.25 0 0 1 16.25 14" />
      </defs>
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M1.7 7 10 1.7 18.3 7 10 12.3Z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="3.5" fill="#002776" />
      <g clipPath="url(#bandeira-globo)">
        <circle cx="8" cy="14" r="8.25" fill="none" stroke="#fff" strokeWidth="0.5" />
        <text fontSize="0.36" fontWeight="700" fill="#009C3B" letterSpacing="0.02" dominantBaseline="central" fontFamily="sans-serif">
          <textPath href="#bandeira-lema" startOffset="57.8%" textAnchor="middle">
            ORDEM E PROGRESSO
          </textPath>
        </text>
        {ESTRELAS.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#fff" />
        ))}
      </g>
    </svg>
  )
}
