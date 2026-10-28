/**
 * Bilingual UI (Hebrew default, RTL). Strings live next to the components as
 * pairs: `tr('עברית', 'English')` — keeps both languages visible together.
 */
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

i18n.use(initReactI18next).init({
  resources: { he: { translation: {} }, en: { translation: {} } },
  lng: localStorage.getItem('map-lang') || 'he',
  fallbackLng: 'he',
  interpolation: { escapeValue: false },
})

export function setLanguage(lng: 'he' | 'en') {
  localStorage.setItem('map-lang', lng)
  i18n.changeLanguage(lng)
}

export function useHe(): boolean {
  const { i18n: inst } = useTranslation()
  return inst.language === 'he'
}

/** `const tr = useTr(); tr('שמור', 'Save')` */
export function useTr() {
  const he = useHe()
  return (heText: string, enText: string) => (he ? heText : enText)
}

export const isHe = () => i18n.language === 'he'
export const tr = (heText: string, enText: string) => (isHe() ? heText : enText)

export default i18n
