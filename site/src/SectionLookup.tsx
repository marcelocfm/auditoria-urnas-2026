import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collatorPtBr, num, pct, signedNum, UFS } from './format'
import { useLang, useT } from './i18n'
import { compararQrComBase, type DadosQrBu } from './qrBu'
import type { SecoesUF } from './types'

const QrScannerModal = lazy(() => import('./QrScannerModal').then((m) => ({ default: m.QrScannerModal })))

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

type PacoteEstadoIndexado = {
  index: IndiceMunicipios
  porZonaSecao: Map<string, string>
  colPos: Record<string, number>
}

type ItemCidade = {
  uf: string
  municipio: string
  chaveBusca: string
}

type ResumoTurnoCidade = {
  secoes: number
  aptos: number
  comparecimento: number
  lula: number
  flavio: number
  outros: number
  brancos: number
  nulos: number
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

function buildSectionIndex(payload: SecoesUF): PacoteEstadoIndexado {
  const colPos: Record<string, number> = {}
  payload.colunas.forEach((colName, idx) => {
    colPos[colName] = idx
  })
  const munIdx = colPos.municipio
  const zonaIdx = colPos.zona
  const secaoIdx = colPos.secao

  const index: IndiceMunicipios = new Map()
  const porZonaSecao = new Map<string, string>()

  for (const row of payload.linhas) {
    const munName = String(row[munIdx])
    const zonaNum = Number(row[zonaIdx])
    const secaoNum = Number(row[secaoIdx])

    porZonaSecao.set(`${zonaNum}:${secaoNum}`, munName)

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
  return { index, porZonaSecao, colPos }
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

function criarResumoVazio(): ResumoTurnoCidade {
  return { secoes: 0, aptos: 0, comparecimento: 0, lula: 0, flavio: 0, outros: 0, brancos: 0, nulos: 0 }
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
  const lang = useLang()
  const initial = useMemo(() => readInitialParams(), [])
  const [uf, setUf] = useState(initial.uf)
  const [reloadToken, setReloadToken] = useState(0)
  const [loadedState, setLoadedState] = useState<{
    key: string
    parsed: PacoteEstadoIndexado | null
    error: boolean
  }>({ key: '', parsed: null, error: false })
  const [municipio, setMunicipio] = useState(initial.municipio)
  const [zona, setZona] = useState(initial.zona)
  const [secao, setSecao] = useState(initial.secao)
  const [copied, setCopied] = useState(false)
  const [gerandoPng, setGerandoPng] = useState(false)

  // QR Scanner & verification state
  const [scannerAberto, setScannerAberto] = useState(false)
  const [qrLido, setQrLido] = useState<DadosQrBu | null>(null)
  const [publicacao, setPublicacao] = useState<'livre' | 'enviando' | 'ok' | 'repetido' | 'erro'>('livre')
  useEffect(() => setPublicacao('livre'), [qrLido])
  const publicarConferencia = async () => {
    if (!qrLido) return
    setPublicacao('enviando')
    try {
      const r = await fetch('/api/conferencias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qr: qrLido.bruto }),
      })
      const j = (await r.json()) as { registrado?: boolean }
      setPublicacao(!r.ok ? 'erro' : j.registrado ? 'ok' : 'repetido')
    } catch {
      setPublicacao('erro')
    }
  }

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
        // Dropdowns remain 100% functional
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
    setQrLido(null)
    setBuscaCidade(`${item.municipio} (${item.uf === 'ZZ' ? 'Exterior' : item.uf})`)
    setMenuAberto(false)
    window.setTimeout(() => zonaSelectRef.current?.focus(), 60)
  }, [])

  const aoLerQrBu = useCallback((dados: DadosQrBu) => {
    setScannerAberto(false)
    setQrLido(dados)
    if (dados.uf in UFS) {
      setUf(dados.uf)
      setZona(String(dados.zona))
      setSecao(String(dados.secao))
    }
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
        const built = buildSectionIndex(payload)
        setLoadedState({ key: currentKey, parsed: built, error: false })
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

  // Auto-resolve municipality name when a QR code was scanned
  const municipioEfetivo = useMemo(() => {
    if (qrLido && indexedData && qrLido.uf === uf) {
      const achado = indexedData.porZonaSecao.get(`${qrLido.zona}:${qrLido.secao}`)
      if (achado) return achado
    }
    return municipio
  }, [qrLido, indexedData, uf, municipio])

  const municipios = useMemo(() => {
    if (!indexedData) return []
    return [...indexedData.index.keys()].sort(collatorPtBr.compare)
  }, [indexedData])

  const zonas = useMemo(() => {
    const zonasMap = indexedData?.index.get(municipioEfetivo)
    if (!zonasMap) return []
    return [...zonasMap.keys()].sort((a, b) => a - b)
  }, [indexedData, municipioEfetivo])

  const secoes = useMemo(() => {
    const secoesMap = indexedData?.index.get(municipioEfetivo)?.get(Number(zona))
    if (!secoesMap) return []
    return [...secoesMap.keys()].sort((a, b) => a - b)
  }, [indexedData, municipioEfetivo, zona])

  // #2: Instant City-Wide Consolidated Summary (1st & 2nd round across all stations in the selected city)
  const resumoCidade = useMemo(() => {
    if (!indexedData || !municipioEfetivo) return null
    const zonasMap = indexedData.index.get(municipioEfetivo)
    if (!zonasMap) return null

    const pos = indexedData.colPos
    const r1 = criarResumoVazio()
    const r2 = criarResumoVazio()

    for (const secoesMap of zonasMap.values()) {
      for (const rows of secoesMap.values()) {
        for (const row of rows) {
          const alvo = Number(row[pos.turno]) === 1 ? r1 : r2
          alvo.secoes += 1
          alvo.aptos += Number(row[pos.aptos])
          alvo.comparecimento += Number(row[pos.comparecimento])
          alvo.lula += Number(row[pos.lula])
          alvo.flavio += Number(row[pos.flavio])
          alvo.outros += Number(row[pos.outros])
          alvo.brancos += Number(row[pos.brancos])
          alvo.nulos += Number(row[pos.nulos])
        }
      }
    }

    if (r1.secoes === 0 && r2.secoes === 0) return null
    return { t1: r1, t2: r2, zonasTotal: zonasMap.size }
  }, [indexedData, municipioEfetivo])

  const secaoEncontrada = useMemo(() => {
    if (!indexedData || !municipioEfetivo || !zona || !secao) return []
    const rawRows = indexedData.index.get(municipioEfetivo)?.get(Number(zona))?.get(Number(secao))
    if (!rawRows) return []
    return rawRows
      .map((row) => tupleToSecao(row, indexedData.colPos))
      .sort((a, b) => a.turno - b.turno)
  }, [indexedData, municipioEfetivo, zona, secao])

  // Compare scanned QR Code against TSE database row
  const comparacaoQr = useMemo(() => {
    if (!qrLido || secaoEncontrada.length === 0) return null
    if (qrLido.uf !== uf || String(qrLido.zona) !== zona || String(qrLido.secao) !== secao) return null
    const turnoAlvo = qrLido.turno ?? 2
    const base = secaoEncontrada.find((s) => s.turno === turnoAlvo) ?? secaoEncontrada[secaoEncontrada.length - 1]
    if (!base) return null
    return { base, resultado: compararQrComBase(qrLido, base) }
  }, [qrLido, secaoEncontrada, uf, zona, secao])

  // Keep browser URL synced whenever a complete station is selected
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (secaoEncontrada.length > 0 && uf && municipioEfetivo && zona && secao) {
      const shareUrl = buildShareUrl(uf, municipioEfetivo, zona, secao)
      window.history.replaceState(null, '', shareUrl)
      if (initial.hasDeepLink && !jaRolouDeepLink.current) {
        jaRolouDeepLink.current = true
        requestAnimationFrame(() => {
          document.getElementById('secao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [secaoEncontrada.length, uf, municipioEfetivo, zona, secao, initial.hasDeepLink])

  const copyShareLink = useCallback(() => {
    if (typeof window === 'undefined' || !uf || !municipioEfetivo || !zona || !secao) return
    const shareUrl = buildShareUrl(uf, municipioEfetivo, zona, secao)
    window.history.replaceState(null, '', shareUrl)
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    })
  }, [uf, municipioEfetivo, zona, secao])

  const baixarReciboPng = useCallback(async () => {
    if (!uf || secaoEncontrada.length === 0) return
    setGerandoPng(true)
    try {
      const { baixarImagemBoletimSecao } = await import('./reciboPng')
      await baixarImagemBoletimSecao({ uf, secoes: secaoEncontrada, lang })
    } finally {
      setGerandoPng(false)
    }
  }, [uf, secaoEncontrada, lang])

  const t1 = secaoEncontrada.find((s) => s.turno === 1)
  const t2 = secaoEncontrada.find((s) => s.turno === 2)

  const whatsappHref = useMemo(() => {
    if (typeof window === 'undefined' || !uf || !municipioEfetivo || !zona || !secao || secaoEncontrada.length === 0) {
      return ''
    }
    const shareUrl = buildShareUrl(uf, municipioEfetivo, zona, secao)
    const placar2t = t2 ? ` (2ºT: Lula ${num(t2.lula)} × Flávio ${num(t2.flavio)})` : ''
    const msg = t(
      `Confira o boletim de urna da Seção ${secao}, Zona ${zona} — ${municipioEfetivo}/${uf}${placar2t}: ${shareUrl}`,
      `Check the ballot-box report for Section ${secao}, Zone ${zona} — ${municipioEfetivo}/${uf}${placar2t}: ${shareUrl}`,
    )
    return `https://wa.me/?text=${encodeURIComponent(msg)}`
  }, [uf, municipioEfetivo, zona, secao, secaoEncontrada.length, t2, t])

  return (
    <div className="space-y-5">
      {/* Top Row: Quick City Search + QR Code Scanner Trigger */}
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
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
                          ativo ? 'bg-tinta font-semibold text-fundo' : 'text-tinta hover:bg-papel'
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

        <button
          type="button"
          onClick={() => setScannerAberto((aberto) => !aberto)}
          aria-expanded={scannerAberto}
          className={`min-h-12 cursor-pointer border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
            scannerAberto
              ? 'border-tinta bg-tinta text-fundo'
              : 'border-tinta bg-papel text-tinta hover:bg-tinta hover:text-fundo'
          }`}
        >
          {t('Ler QR Code / Foto do Boletim', 'Scan QR Code / Report Photo')}
        </button>
      </div>

      {scannerAberto && (
        <Suspense
          fallback={
            <div className="border border-linha bg-papel p-5 text-sm text-suave">
              {t('Carregando leitor de QR Code…', 'Loading QR code reader…')}
            </div>
          }
        >
          <QrScannerModal onDetectado={aoLerQrBu} onFechar={() => setScannerAberto(false)} />
        </Suspense>
      )}

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
              setQrLido(null)
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
            value={municipioEfetivo}
            disabled={status !== 'ready'}
            onChange={(event) => {
              setMunicipio(event.target.value)
              setZona('')
              setSecao('')
              setQrLido(null)
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
            disabled={!municipioEfetivo || zonas.length === 0}
            onChange={(event) => {
              setMunicipio(municipioEfetivo)
              setZona(event.target.value)
              setSecao('')
              setQrLido(null)
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
            onChange={(event) => {
              setMunicipio(municipioEfetivo)
              setSecao(event.target.value)
              setQrLido(null)
            }}
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

      {/* #2: Instant Consolidated Municipality Card */}
      {resumoCidade && resumoCidade.t2.secoes > 0 && (
        <div className="border border-linha bg-papel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linha pb-3">
            <div>
              <p className="font-mono text-[11px] tracking-wider text-suave uppercase">
                {t('Consolidado do município (soma de todas as urnas)', 'Municipality total (sum of all machines)')}
              </p>
              <h4 className="mt-0.5 text-lg font-bold">
                {municipioEfetivo} ({uf})
              </h4>
            </div>
            <span className="num font-mono text-xs text-suave">
              {num(resumoCidade.t2.secoes)} {t('seções', 'sections')} · {num(resumoCidade.zonasTotal)}{' '}
              {resumoCidade.zonasTotal === 1 ? t('zona', 'zone') : t('zonas', 'zones')}
            </span>
          </div>

          {(() => {
            const validos2 = resumoCidade.t2.lula + resumoCidade.t2.flavio
            const pctL2 = validos2 > 0 ? (100 * resumoCidade.t2.lula) / validos2 : 50
            const saldo2 = resumoCidade.t2.lula - resumoCidade.t2.flavio
            return (
              <div className="num mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-suave">Lula (13) · 2ºT</p>
                    <p className="font-mono text-lg font-bold text-tinta">
                      {num(resumoCidade.t2.lula)}{' '}
                      <span className="text-xs font-normal text-suave">({pct(resumoCidade.t2.lula, validos2)})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-suave">Flávio Bolsonaro (22) · 2ºT</p>
                    <p className="font-mono text-lg font-bold text-tinta">
                      {num(resumoCidade.t2.flavio)}{' '}
                      <span className="text-xs font-normal text-suave">({pct(resumoCidade.t2.flavio, validos2)})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-suave">{t('Saldo na cidade (2ºT)', 'City margin (2nd R.)')}</p>
                    <p className="font-mono text-lg font-bold text-tinta">
                      {saldo2 >= 0 ? `Lula +${num(saldo2)}` : `Flávio +${num(Math.abs(saldo2))}`}
                    </p>
                  </div>
                </div>

                <div className="flex h-2.5 w-full overflow-hidden bg-linha" aria-hidden>
                  <div className="bg-tinta" style={{ width: `${pctL2.toFixed(1)}%` }} />
                </div>

                <div className="flex flex-wrap justify-between gap-2 font-mono text-xs text-suave">
                  <span>
                    {t('Comparecimento 2ºT', '2nd R. turnout')}: {num(resumoCidade.t2.comparecimento)} / {num(resumoCidade.t2.aptos)} (
                    {pct(resumoCidade.t2.comparecimento, resumoCidade.t2.aptos)})
                  </span>
                  {resumoCidade.t1.secoes > 0 && (
                    <span>
                      {t('1ºT na cidade', '1st R. in city')}: Lula {num(resumoCidade.t1.lula)} × Flávio {num(resumoCidade.t1.flavio)}
                    </span>
                  )}
                </div>

                {secaoEncontrada.length === 0 && (
                  <p className="border-t border-linha pt-2.5 text-xs text-suave">
                    {t(
                      '↑ Escolha a Zona e a Seção acima (ou escaneie o QR Code do boletim) para abrir a sua urna individual.',
                      '↑ Select Zone and Section above (or scan the report QR code) to inspect your individual voting machine.',
                    )}
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* #1: Printed QR Code vs Official TSE Database Comparison Report */}
      {comparacaoQr && (
        <div className="space-y-4 border-2 border-tinta bg-papel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3">
            <div>
              <p className="font-mono text-xs tracking-wider text-suave uppercase">
                {t('Confronto direto: Boletim Impresso (QR Code) × Arquivo TSE', 'Direct comparison: Printed Report (QR Code) × TSE File')}
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {comparacaoQr.base.municipio} ({uf}) · {t('Zona', 'Zone')} {comparacaoQr.base.zona} · {t('Seção', 'Section')}{' '}
                {comparacaoQr.base.secao} · {comparacaoQr.base.turno}º {t('turno', 'round')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`border px-3 py-1 font-mono text-xs font-bold uppercase ${
                  comparacaoQr.resultado.confereTudo
                    ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                    : 'border-red-500 bg-red-950 text-red-300'
                }`}
              >
                {comparacaoQr.resultado.confereTudo
                  ? t('✓ Papel 100% igual ao TSE', '✓ Paper 100% matches TSE')
                  : t('≠ Divergência detectada', '≠ Mismatch detected')}
              </span>
              <button
                type="button"
                onClick={() => setQrLido(null)}
                className="cursor-pointer border border-linha px-2 py-1 font-mono text-xs text-suave hover:border-tinta hover:text-tinta"
              >
                ✕
              </button>
            </div>
          </div>

          {!comparacaoQr.resultado.temVotosPresidente ? (
            <p className="text-sm text-suave">
              {t(
                `Este é o QR Code parte ${qrLido?.parte}/${qrLido?.totalPartes} da seção (identificação da urna conferida). Para comparar os votos de Presidente, escaneie o QR Code que contém o bloco CARG:1.`,
                `This is QR code part ${qrLido?.parte}/${qrLido?.totalPartes} of the station (machine ID verified). To compare presidential votes, scan the QR code containing CARG:1.`,
              )}
            </p>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="num w-full min-w-[420px] text-sm">
                <thead className="border-b border-linha font-mono text-xs text-suave">
                  <tr>
                    <th className="py-2 text-left font-medium">{t('Campo', 'Field')}</th>
                    <th className="py-2 pl-4 text-right font-medium">{t('No papel (QR Code)', 'On paper (QR Code)')}</th>
                    <th className="py-2 pl-4 text-right font-medium">{t('Publicado pelo TSE', 'Published by TSE')}</th>
                    <th className="py-2 pl-4 text-right font-medium">{t('Status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linha font-mono">
                  {comparacaoQr.resultado.itens.map((item) => (
                    <tr key={item.campoPt}>
                      <td className="py-2 font-sans text-tinta">{lang === 'en' ? item.campoEn : item.campoPt}</td>
                      <td className="py-2 pl-4 text-right">{num(item.papel)}</td>
                      <td className="py-2 pl-4 text-right">{num(item.tse)}</td>
                      <td className={`py-2 pl-4 text-right font-bold ${item.igual ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.igual ? '✓ OK' : `≠ (${signedNum(item.papel - item.tse)})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {comparacaoQr.resultado.temVotosPresidente && (
            <div className="flex flex-wrap items-center gap-3 border-t border-linha pt-4 text-sm">
              <button
                type="button"
                onClick={() => void publicarConferencia()}
                disabled={publicacao !== 'livre' && publicacao !== 'erro'}
                className="min-h-10 cursor-pointer border border-tinta bg-tinta px-4 font-semibold text-fundo hover:opacity-85 disabled:cursor-default disabled:opacity-50"
              >
                {publicacao === 'enviando'
                  ? t('Publicando…', 'Publishing…')
                  : t('Publicar esta conferência', 'Publish this check')}
              </button>
              <span className="text-suave">
                {publicacao === 'ok'
                  ? t('✓ Publicada no painel de conferências.', '✓ Published on the checks panel.')
                  : publicacao === 'repetido'
                    ? t('Este boletim já tinha sido conferido por alguém.', 'This report had already been checked by someone.')
                    : publicacao === 'erro'
                      ? t('Não foi possível publicar. Tente de novo.', 'Could not publish. Try again.')
                      : t('Vai para o painel público só o conteúdo do QR Code e o resultado. Nenhum dado seu.', 'Only the QR content and the result go to the public panel. None of your data.')}
              </span>
            </div>
          )}
        </div>
      )}

      {secaoEncontrada.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3 text-sm">
            <p className="text-sm font-medium text-tinta">
              {municipioEfetivo} ({uf}) · {t('Zona', 'Zone')} {zona} · {t('Seção', 'Section')} {secao}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void baixarReciboPng()}
                disabled={gerandoPng}
                className="min-h-9 cursor-pointer border border-tinta bg-tinta px-3 py-1.5 font-mono text-xs font-semibold text-fundo transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {gerandoPng
                  ? t('Gerando imagem…', 'Rendering image…')
                  : t('Baixar imagem do boletim (PNG)', 'Download report image (PNG)')}
              </button>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center border border-tinta bg-papel px-3 py-1.5 font-mono text-xs font-semibold text-tinta transition-colors hover:bg-tinta hover:text-fundo"
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
              'Compare cada linha com o boletim de urna impresso afixado na porta da seção, envie uma foto do QR Code no leitor acima ou use o app oficial ',
              'Compare every line with the printed ballot-box report posted on the polling station door, upload a photo of its QR code in the scanner above, or use the official ',
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
