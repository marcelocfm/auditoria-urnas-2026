import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collatorPtBr, num, pct, signedNum, UFS } from './format'
import { useT } from './i18n'
import type { SecoesUF } from './types'

type SecaoDetalhe = {
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

type IndiceMunicipios = Map<string, Map<number, Map<number, (string | number)[][]>>>

type ItemCidade = {
  uf: string
  municipio: string
  chaveBusca: string
}

let cachedCidades: ItemCidade[] | null = null
let cachedCidadesPromise: Promise<ItemCidade[]> | null = null

function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function carregarIndiceCidades(): Promise<ItemCidade[]> {
  if (cachedCidades) return Promise.resolve(cachedCidades)
  if (cachedCidadesPromise) return cachedCidadesPromise

  cachedCidadesPromise = fetch('/data/municipios.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<Record<string, string[]>>
    })
    .then((mapa) => {
      const lista: ItemCidade[] = []
      for (const [sigla, nomes] of Object.entries(mapa)) {
        for (const nome of nomes) {
          lista.push({
            uf: sigla,
            municipio: nome,
            chaveBusca: `${normalizarBusca(nome)} ${sigla.toLowerCase()}`,
          })
        }
      }
      cachedCidades = lista
      return lista
    })
    .catch((err) => {
      cachedCidadesPromise = null
      throw err
    })

  return cachedCidadesPromise
}

const selectClassName =
  'mt-2 min-h-12 w-full cursor-pointer border border-linha bg-papel px-4 text-base text-tinta transition-colors hover:border-suave disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-linha'

function readInitialParams() {
  if (typeof window === 'undefined') {
    return { uf: '', municipio: '', zona: '', secao: '', hasDeepLink: false }
  }
  const params = new URLSearchParams(window.location.search)
  const rawUf = (params.get('uf') ?? '').toUpperCase()
  const uf = rawUf in UFS ? rawUf : ''
  const municipio = params.get('mun') ?? ''
  const zona = params.get('zona') ?? ''
  const secao = params.get('secao') ?? ''
  return {
    uf,
    municipio,
    zona,
    secao,
    hasDeepLink: Boolean(uf && municipio && zona && secao),
  }
}

function buildSectionIndex(payload: SecoesUF): { index: IndiceMunicipios; colPos: Record<string, number> } {
  const colPos: Record<string, number> = {}
  payload.colunas.forEach((colName, idx) => {
    colPos[colName] = idx
  })
  const munIdx = colPos.municipio
  const zonaIdx = colPos.zona
  const secaoIdx = colPos.secao

  const index: IndiceMunicipios = new Map()
  for (const row of payload.linhas) {
    const munName = String(row[munIdx])
    const zonaNum = Number(row[zonaIdx])
    const secaoNum = Number(row[secaoIdx])

    let zonasMap = index.get(munName)
    if (!zonasMap) {
      zonasMap = new Map()
      index.set(munName, zonasMap)
    }
    let secoesMap = zonasMap.get(zonaNum)
    if (!secoesMap) {
      secoesMap = new Map()
      zonasMap.set(zonaNum, secoesMap)
    }
    let turnRows = secoesMap.get(secaoNum)
    if (!turnRows) {
      turnRows = []
      secoesMap.set(secaoNum, turnRows)
    }
    turnRows.push(row)
  }
  return { index, colPos }
}

function tupleToSecao(row: (string | number)[], colPos: Record<string, number>): SecaoDetalhe {
  return {
    turno: Number(row[colPos.turno]),
    municipio: String(row[colPos.municipio]),
    zona: Number(row[colPos.zona]),
    secao: Number(row[colPos.secao]),
    aptos: Number(row[colPos.aptos]),
    comparecimento: Number(row[colPos.comparecimento]),
    lula: Number(row[colPos.lula]),
    flavio: Number(row[colPos.flavio]),
    outros: Number(row[colPos.outros]),
    brancos: Number(row[colPos.brancos]),
    nulos: Number(row[colPos.nulos]),
    urna: Number(row[colPos.urna]),
  }
}

function buildShareUrl(uf: string, municipio: string, zona: string, secao: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set('uf', uf)
  url.searchParams.set('mun', municipio)
  url.searchParams.set('zona', zona)
  url.searchParams.set('secao', secao)
  url.hash = 'secao'
  return url.toString()
}

export function SectionLookup() {
  const t = useT()
  const initial = useMemo(() => readInitialParams(), [])
  const [uf, setUf] = useState(initial.uf)
  const [reloadToken, setReloadToken] = useState(0)
  const [loadedState, setLoadedState] = useState<{
    key: string
    parsed: { index: IndiceMunicipios; colPos: Record<string, number> } | null
    error: boolean
  }>({ key: '', parsed: null, error: false })
  const [municipio, setMunicipio] = useState(initial.municipio)
  const [zona, setZona] = useState(initial.zona)
  const [secao, setSecao] = useState(initial.secao)
  const [copied, setCopied] = useState(false)

  // Quick city search state
  const [buscaCidade, setBuscaCidade] = useState('')
  const [cidades, setCidades] = useState<ItemCidade[]>(() => cachedCidades ?? [])
  const [menuAberto, setMenuAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const zonaSelectRef = useRef<HTMLSelectElement>(null)
  const jaRolouDeepLink = useRef(false)

  const garantirCidades = useCallback(() => {
    if (cidades.length > 0) return
    carregarIndiceCidades()
      .then((lista) => setCidades(lista))
      .catch(() => {
        // Fallback: dropdowns below remain 100% functional
      })
  }, [cidades.length])

  const sugestoesCidade = useMemo(() => {
    const q = normalizarBusca(buscaCidade)
    if (q.length < 2 || cidades.length === 0) return []
    const prefixos: ItemCidade[] = []
    const contidos: ItemCidade[] = []
    for (const item of cidades) {
      if (item.chaveBusca.startsWith(q)) {
        prefixos.push(item)
      } else if (item.chaveBusca.includes(q)) {
        contidos.push(item)
      }
      if (prefixos.length >= 8) break
    }
    return [...prefixos, ...contidos].slice(0, 8)
  }, [buscaCidade, cidades])

  const escolherCidade = useCallback((item: ItemCidade) => {
    setUf(item.uf)
    setMunicipio(item.municipio)
    setZona('')
    setSecao('')
    setBuscaCidade(`${item.municipio} (${item.uf === 'ZZ' ? 'Exterior' : item.uf})`)
    setMenuAberto(false)
    window.setTimeout(() => zonaSelectRef.current?.focus(), 60)
  }, [])

  const currentKey = uf ? `${uf}#${reloadToken}` : ''

  useEffect(() => {
    if (!uf) return
    let cancelled = false

    fetch(`/data/secoes/${uf}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<SecoesUF>
      })
      .then((payload) => {
        if (cancelled) return
        setLoadedState({ key: currentKey, parsed: buildSectionIndex(payload), error: false })
      })
      .catch(() => {
        if (!cancelled) setLoadedState({ key: currentKey, parsed: null, error: true })
      })

    return () => {
      cancelled = true
    }
  }, [uf, currentKey])

  const isCurrent = Boolean(uf) && loadedState.key === currentKey
  const indexedData = isCurrent ? loadedState.parsed : null
  const status: 'idle' | 'loading' | 'ready' | 'error' = !uf
    ? 'idle'
    : !isCurrent
      ? 'loading'
      : loadedState.error
        ? 'error'
        : 'ready'

  const municipios = useMemo(() => {
    if (!indexedData) return []
    return [...indexedData.index.keys()].sort(collatorPtBr.compare)
  }, [indexedData])

  const zonas = useMemo(() => {
    const zonasMap = indexedData?.index.get(municipio)
    if (!zonasMap) return []
    return [...zonasMap.keys()].sort((a, b) => a - b)
  }, [indexedData, municipio])

  const secoes = useMemo(() => {
    const secoesMap = indexedData?.index.get(municipio)?.get(Number(zona))
    if (!secoesMap) return []
    return [...secoesMap.keys()].sort((a, b) => a - b)
  }, [indexedData, municipio, zona])

  const secaoEncontrada = useMemo(() => {
    if (!indexedData || !municipio || !zona || !secao) return []
    const rawRows = indexedData.index.get(municipio)?.get(Number(zona))?.get(Number(secao))
    if (!rawRows) return []
    return rawRows
      .map((row) => tupleToSecao(row, indexedData.colPos))
      .sort((a, b) => a.turno - b.turno)
  }, [indexedData, municipio, zona, secao])

  // Keep browser URL synced whenever a complete station is selected
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (secaoEncontrada.length > 0 && uf && municipio && zona && secao) {
      const shareUrl = buildShareUrl(uf, municipio, zona, secao)
      window.history.replaceState(null, '', shareUrl)
      if (initial.hasDeepLink && !jaRolouDeepLink.current) {
        jaRolouDeepLink.current = true
        requestAnimationFrame(() => {
          document.getElementById('secao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [secaoEncontrada.length, uf, municipio, zona, secao, initial.hasDeepLink])

  const copyShareLink = useCallback(() => {
    if (typeof window === 'undefined' || !uf || !municipio || !zona || !secao) return
    const shareUrl = buildShareUrl(uf, municipio, zona, secao)
    window.history.replaceState(null, '', shareUrl)
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    })
  }, [uf, municipio, zona, secao])

  const t1 = secaoEncontrada.find((s) => s.turno === 1)
  const t2 = secaoEncontrada.find((s) => s.turno === 2)

  const whatsappHref = useMemo(() => {
    if (typeof window === 'undefined' || !uf || !municipio || !zona || !secao || secaoEncontrada.length === 0) {
      return ''
    }
    const shareUrl = buildShareUrl(uf, municipio, zona, secao)
    const placar2t = t2 ? ` (2ºT: Lula ${num(t2.lula)} × Flávio ${num(t2.flavio)})` : ''
    const msg = t(
      `Confira o boletim de urna da Seção ${secao}, Zona ${zona} — ${municipio}/${uf}${placar2t}: ${shareUrl}`,
      `Check the ballot-box report for Section ${secao}, Zone ${zona} — ${municipio}/${uf}${placar2t}: ${shareUrl}`,
    )
    return `https://wa.me/?text=${encodeURIComponent(msg)}`
  }, [uf, municipio, zona, secao, secaoEncontrada.length, t2, t])

  return (
    <div className="space-y-5">
      {/* Instant City Search across all 5,717 cities + overseas stations */}
      <div className="relative">
        <label className="block text-sm font-medium text-suave" htmlFor="busca-cidade-rapida">
          {t('Busca rápida de município ou cidade no exterior', 'Quick search by city or overseas station')}
        </label>
        <div className="relative mt-2">
          <input
            id="busca-cidade-rapida"
            type="search"
            autoComplete="off"
            value={buscaCidade}
            placeholder={t('Digite sua cidade (ex.: Campinas, Uberlândia, Lisboa)…', 'Type a city (e.g. São Paulo, Curitiba, Miami)…')}
            onFocus={() => {
              garantirCidades()
              setMenuAberto(true)
            }}
            onBlur={() => {
              window.setTimeout(() => setMenuAberto(false), 160)
            }}
            onChange={(event) => {
              garantirCidades()
              setBuscaCidade(event.target.value)
              setIndiceAtivo(0)
              setMenuAberto(true)
            }}
            onKeyDown={(event) => {
              if (!menuAberto || sugestoesCidade.length === 0) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setIndiceAtivo((idx) => (idx + 1) % sugestoesCidade.length)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setIndiceAtivo((idx) => (idx - 1 + sugestoesCidade.length) % sugestoesCidade.length)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const escolhido = sugestoesCidade[indiceAtivo]
                if (escolhido) escolherCidade(escolhido)
              } else if (event.key === 'Escape') {
                setMenuAberto(false)
              }
            }}
            className="min-h-12 w-full border border-linha bg-papel px-4 text-base text-tinta placeholder:text-suave/60 transition-colors hover:border-suave focus:border-tinta focus:outline-none"
          />
          {menuAberto && sugestoesCidade.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-30 mt-1 max-h-72 w-full divide-y divide-linha overflow-y-auto border border-tinta bg-fundo shadow-2xl"
            >
              {sugestoesCidade.map((item, idx) => {
                const ativo = idx === indiceAtivo
                return (
                  <li key={`${item.uf}-${item.municipio}`} role="option" aria-selected={ativo}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => escolherCidade(item)}
                      className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                        ativo ? 'bg-tinta text-fundo font-semibold' : 'text-tinta hover:bg-papel'
                      }`}
                    >
                      <span>{item.municipio}</span>
                      <span className={`font-mono text-xs ${ativo ? 'text-fundo' : 'text-suave'}`}>
                        {item.uf === 'ZZ' ? t('Exterior (ZZ)', 'Abroad (ZZ)') : `${UFS[item.uf] ?? item.uf} (${item.uf})`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block text-sm font-medium text-suave">
          {t('Estado', 'State')}
          <select
            className={selectClassName}
            value={uf}
            onChange={(event) => {
              setUf(event.target.value)
              setMunicipio('')
              setZona('')
              setSecao('')
              setBuscaCidade('')
            }}
          >
            <option value="">{t('Escolha…', 'Select…')}</option>
            {Object.entries(UFS).map(([sigla, nomeEstado]) => (
              <option key={sigla} value={sigla}>
                {sigla === 'ZZ' ? t('Exterior', 'Abroad') : nomeEstado} ({sigla})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-suave">
          {uf === 'ZZ' ? t('Cidade / País', 'City / Country') : t('Município', 'Municipality')}
          <select
            className={selectClassName}
            value={municipio}
            disabled={status !== 'ready'}
            onChange={(event) => {
              setMunicipio(event.target.value)
              setZona('')
              setSecao('')
            }}
          >
            <option value="">
              {status === 'loading' ? t('Carregando seções…', 'Loading stations…') : t('Escolha…', 'Select…')}
            </option>
            {municipios.map((nomeMun) => (
              <option key={nomeMun} value={nomeMun}>
                {nomeMun}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-suave">
          {t('Zona', 'Zone')}
          <select
            ref={zonaSelectRef}
            className={selectClassName}
            value={zona}
            disabled={!municipio || zonas.length === 0}
            onChange={(event) => {
              setZona(event.target.value)
              setSecao('')
            }}
          >
            <option value="">{t('Escolha…', 'Select…')}</option>
            {zonas.map((numeroZona) => (
              <option key={numeroZona} value={numeroZona}>
                {numeroZona}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-suave">
          {t('Seção', 'Section')}
          <select
            className={selectClassName}
            value={secao}
            disabled={!zona || secoes.length === 0}
            onChange={(event) => setSecao(event.target.value)}
          >
            <option value="">{t('Escolha…', 'Select…')}</option>
            {secoes.map((numeroSecao) => (
              <option key={numeroSecao} value={numeroSecao}>
                {numeroSecao}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-linha bg-papel p-4 text-sm">
          <span className="text-suave">
            {t(`Falha ao baixar o arquivo de seções de ${uf}.`, `Failed to download the stations file for ${uf}.`)}
          </span>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="cursor-pointer border border-tinta px-3 py-1.5 font-mono text-xs font-semibold text-tinta hover:bg-tinta hover:text-fundo"
          >
            {t('Tentar novamente', 'Try again')}
          </button>
        </div>
      )}

      {secaoEncontrada.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3 text-sm">
            <p className="text-sm font-medium text-tinta">
              {municipio} ({uf}) · {t('Zona', 'Zone')} {zona} · {t('Seção', 'Section')} {secao}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center border border-tinta bg-tinta px-3 py-1.5 font-mono text-xs font-semibold text-fundo transition-opacity hover:opacity-85"
                >
                  {t('Enviar no WhatsApp ↗', 'Share on WhatsApp ↗')}
                </a>
              )}
              <button
                type="button"
                onClick={copyShareLink}
                className="min-h-9 cursor-pointer border border-linha bg-papel px-3 py-1.5 font-mono text-xs text-tinta transition-colors hover:border-tinta"
              >
                {copied ? t('✓ Link copiado', '✓ Link copied') : t('Copiar link desta seção', 'Copy link to this station')}
              </button>
            </div>
          </div>

          {t1 && t2 && (
            <div className="num flex flex-wrap items-center justify-between gap-3 border border-linha bg-papel px-4 py-3 font-mono text-xs text-suave">
              <span>
                {t('Variação 1ºT → 2ºT', '1st → 2nd round shift')}: {t('Votantes', 'Voters')}{' '}
                <strong className="text-tinta">{signedNum(t2.comparecimento - t1.comparecimento)}</strong> · Lula{' '}
                <strong className="text-tinta">{signedNum(t2.lula - t1.lula)}</strong> · Flávio{' '}
                <strong className="text-tinta">{signedNum(t2.flavio - t1.flavio)}</strong>
              </span>
              <span>
                {t1.urna === t2.urna
                  ? t(`✓ Mesma urna física (nº ${t1.urna})`, `✓ Same physical machine (#${t1.urna})`)
                  : t(`Urna 1ºT nº ${t1.urna} → 2ºT nº ${t2.urna}`, `Machine 1st R. #${t1.urna} → 2nd R. #${t2.urna}`)}
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {secaoEncontrada.map((item) => {
              const nominalTotal = item.lula + item.flavio + item.outros
              const somaUrna = nominalTotal + item.brancos + item.nulos
              const contaFecha = somaUrna === item.comparecimento
              const lulaShareBar = item.lula + item.flavio > 0 ? (100 * item.lula) / (item.lula + item.flavio) : 50

              return (
                <div key={item.turno} className="border border-linha bg-papel p-5 sm:p-6">
                  <div className="mb-4 flex items-baseline justify-between border-b border-linha pb-3">
                    <h4 className="text-lg font-bold">
                      {item.turno === 1 ? t('1º turno', '1st round') : t('2º turno', '2nd round')}
                    </h4>
                    <span className="font-mono text-xs text-suave">
                      {t('URNA Nº', 'MACHINE #')} {item.urna}
                    </span>
                  </div>

                  {item.lula + item.flavio > 0 && (
                    <div className="mb-4 space-y-1">
                      <div className="flex h-2 w-full overflow-hidden bg-linha" aria-hidden>
                        <div className="bg-tinta" style={{ width: `${lulaShareBar.toFixed(1)}%` }} />
                      </div>
                      <div className="num flex justify-between font-mono text-[11px] text-suave">
                        <span>13 · {pct(item.lula, nominalTotal)}</span>
                        <span>22 · {pct(item.flavio, nominalTotal)}</span>
                      </div>
                    </div>
                  )}

                  <dl className="num grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[15px]">
                    <dt className="text-suave">{t('Eleitores aptos', 'Registered voters')}</dt>
                    <dd className="text-right">{num(item.aptos)}</dd>
                    <dt className="text-suave">{t('Compareceram', 'Turnout')}</dt>
                    <dd className="text-right">{num(item.comparecimento)}</dd>
                    <dt className="text-suave">{t('Abstenções', 'Abstentions')}</dt>
                    <dd className="text-right">{num(item.aptos - item.comparecimento)}</dd>

                    <dt className="mt-2 border-t border-linha pt-2.5 font-semibold">Lula (13)</dt>
                    <dd className="mt-2 border-t border-linha pt-2.5 text-right font-semibold">
                      {num(item.lula)}{' '}
                      <span className="font-mono text-xs font-normal text-suave">{pct(item.lula, nominalTotal)}</span>
                    </dd>

                    <dt className="font-semibold">Flávio Bolsonaro (22)</dt>
                    <dd className="text-right font-semibold">
                      {num(item.flavio)}{' '}
                      <span className="font-mono text-xs font-normal text-suave">{pct(item.flavio, nominalTotal)}</span>
                    </dd>

                    {item.turno === 1 && (
                      <>
                        <dt className="text-suave">{t('Demais candidatos', 'Other candidates')}</dt>
                        <dd className="text-right">{num(item.outros)}</dd>
                      </>
                    )}

                    <dt className="text-suave">{t('Brancos', 'Blank')}</dt>
                    <dd className="text-right">{num(item.brancos)}</dd>
                    <dt className="text-suave">{t('Nulos de urna', 'Null votes')}</dt>
                    <dd className="text-right">{num(item.nulos)}</dd>

                    <dt className="mt-2 border-t border-linha pt-2 font-mono text-xs text-suave">
                      {t('Soma registrada', 'Recorded sum')}
                    </dt>
                    <dd className="mt-2 border-t border-linha pt-2 text-right font-mono text-xs text-tinta">
                      {num(somaUrna)} {contaFecha ? '✓' : '≠'}
                    </dd>
                  </dl>
                </div>
              )
            })}
          </div>

          <p className="max-w-[68ch] text-sm leading-relaxed text-suave">
            {t(
              'Compare cada linha com o boletim de urna impresso afixado na porta da seção ou confira o QR Code pelo app ',
              'Compare every line with the printed ballot-box report posted on the polling station door, or scan its QR code with the official ',
            )}
            <strong className="text-tinta">Boletim na Mão</strong>
            {t(
              '. Os votos devem ser idênticos. (No 1º turno, a linha “Demais candidatos” soma todos os votos nominais registrados pela urna, inclusive eventuais candidatos sub judice/anulados depois pelo TSE.)',
              ' app. Every vote count must match. (In the 1st round, “Other candidates” sums all nominal votes recorded by the machine, including any candidate whose registration was later annulled by the TSE.)',
            )}
          </p>
        </>
      )}
    </div>
  )
}
