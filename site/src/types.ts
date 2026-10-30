export type Candidato = {
  turno: number
  numero: number
  nome: string
  partido: string | null
  bu: number
  oficial: number | null
  validos: number | null
}

type Totais = {
  aptos: number
  comparecimento: number
  brancos: number
  nulos: number
}

export type Resumo = {
  turno: number
  bu: Totais & { secoes: number }
  oficial: Totais & { nulos_tecnicos: number }
}

export type LinhaUF = {
  turno: number
  uf: string
  comp: number
  lula_bu: number
  lula_of: number
  flavio_bu: number
  flavio_of: number
}

export type Checagem = {
  titulo: string
  resultado: string
  status: 'ok' | 'explicado' | 'verificar' | 'investigar'
  nota: string
  linhas?: Record<string, string | number>[]
}

export type Arquivo = {
  arquivo: string
  url: string
  bytes: number
  sha512: string
  confere: boolean
}

export type Auditoria = {
  gerado_em: string
  candidatos: Candidato[]
  resumo: Resumo[]
  por_uf: LinhaUF[]
  checagens: Checagem[]
  arquivos: Arquivo[]
}

export type SecoesUF = {
  colunas: string[]
  linhas: (string | number)[][]
}
