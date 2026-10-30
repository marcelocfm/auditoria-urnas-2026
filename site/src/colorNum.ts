import { Children, cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'

const NUM_TOKEN_RE = /[+−-]?\d+(?:[.,:/]\d+)*(?:%|º|ª|st|nd|rd|th|h\b|s\b|\+)?|\bzero\b/gi

export function colorirTexto(texto: string): ReactNode {
  const partes: ReactNode[] = []
  let cursor = 0
  for (const match of texto.matchAll(NUM_TOKEN_RE)) {
    const idx = match.index ?? 0
    let token = match[0]
    let inicio = idx
    if ((token[0] === '+' || token[0] === '-' || token[0] === '−') && idx > 0 && /[\p{L}\p{N}]/u.test(texto[idx - 1])) {
      token = token.slice(1)
      inicio = idx + 1
    }
    if (inicio > cursor) {
      partes.push(texto.slice(cursor, inicio))
    }
    const cor = token.startsWith('+')
      ? 'text-emerald-400'
      : token.startsWith('-') || token.startsWith('−')
        ? 'text-red-400'
        : 'text-tinta'
    partes.push(
      createElement('span', { key: inicio, className: `num font-semibold ${cor}` }, token),
    )
    cursor = inicio + token.length
  }
  if (cursor === 0) return texto
  if (cursor < texto.length) partes.push(texto.slice(cursor))
  return partes
}

export function colorir(node: ReactNode): ReactNode {
  if (typeof node === 'string') return colorirTexto(node)
  if (typeof node === 'number') return colorirTexto(String(node))
  if (Array.isArray(node)) return Children.map(node, colorir)
  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children != null) {
    return cloneElement(node as ReactElement<{ children?: ReactNode }>, undefined, colorir(node.props.children))
  }
  return node
}
