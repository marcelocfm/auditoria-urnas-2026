// The site is bilingual; App calls setLocale() when the reader switches language, before re-rendering.
let locale: 'pt-BR' | 'en-US' = 'pt-BR'
let numberFormatter = new Intl.NumberFormat(locale)
let percentFormatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function setLocale(lang: 'pt' | 'en') {
  locale = lang === 'en' ? 'en-US' : 'pt-BR'
  numberFormatter = new Intl.NumberFormat(locale)
  percentFormatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const loc = () => locale

export const collatorPtBr = new Intl.Collator('pt-BR', { sensitivity: 'base' })

export const num = (value: number | null | undefined): string =>
  value == null ? '—' : numberFormatter.format(value)

export const signedNum = (value: number | null | undefined): string => {
  if (value == null) return '—'
  if (value === 0) return '0'
  return value > 0 ? `+${numberFormatter.format(value)}` : `−${numberFormatter.format(Math.abs(value))}`
}

export const pct = (part: number, total: number): string =>
  total > 0 ? `${percentFormatter.format((100 * part) / total)}%` : '—'

export const UFS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
  ZZ: 'Exterior',
}
