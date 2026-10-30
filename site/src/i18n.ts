import { createContext, useContext } from 'react'

export type Lang = 'pt' | 'en'

const LangContext = createContext<Lang>('pt')

export const LangProvider = LangContext.Provider

export const useLang = () => useContext(LangContext)

/** t('texto em português', 'English text'): every visible string carries both languages side by side. */
export function useT() {
  const lang = useContext(LangContext)
  return (pt: string, en: string) => (lang === 'en' ? en : pt)
}
