import { useCallback, useEffect, useState } from 'react'

export type JsonResource<T> = {
  data: T | null
  status: 'loading' | 'ready' | 'missing' | 'error'
  reload: () => void
}

export function useJsonResource<T>(url: string, enabled = true): JsonResource<T> {
  const [state, setState] = useState<{
    key: string
    data: T | null
    status: 'loading' | 'ready' | 'missing' | 'error'
  }>({ key: '', data: null, status: 'loading' })
  const [token, setToken] = useState(0)
  const requestKey = `${url}#${token}`
  const alreadyLoaded = state.key === requestKey && state.status === 'ready'

  useEffect(() => {
    if (!enabled || alreadyLoaded) return
    let cancelled = false

    fetch(url)
      .then(async (response) => {
        if (response.status === 404) {
          if (!cancelled) setState({ key: requestKey, data: null, status: 'missing' })
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('text/html')) {
          if (!cancelled) setState({ key: requestKey, data: null, status: 'missing' })
          return
        }
        const parsed = (await response.json()) as T
        if (!cancelled) setState({ key: requestKey, data: parsed, status: 'ready' })
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, data: null, status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [url, requestKey, enabled, alreadyLoaded])

  const reload = useCallback(() => setToken((prev) => prev + 1), [])
  const isCurrent = state.key === requestKey
  return {
    data: isCurrent ? state.data : null,
    status: isCurrent ? state.status : 'loading',
    reload,
  }
}

export function useJson<T>(url: string): T | null {
  return useJsonResource<T>(url).data
}
