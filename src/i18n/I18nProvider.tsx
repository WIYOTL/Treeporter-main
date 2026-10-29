import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { messages } from './messages'
import type { Locale, MessageKey } from './messages'
import type { LocalizedMessage, MessageValues } from './message'
import { localizedDescription } from './metadata'

export const DEFAULT_LOCALE: Locale = 'fr'
export const LOCALE_STORAGE_KEY = 'treeporter.locale'
const useLocaleEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: MessageValues) => string
  plural: (one: MessageKey, other: MessageKey, count: number, values?: MessageValues) => string
  formatMessage: (message: LocalizedMessage | null | undefined) => string | null
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function isLocale(value: string | null): value is Locale {
  return value === 'fr' || value === 'en'
}

function getInitialLocale(): Locale {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_LOCALE
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  useLocaleEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = locale
      const description = typeof document.querySelector === 'function'
        ? document.querySelector('meta[name="description"]')
        : null
      description?.setAttribute('content', localizedDescription(locale))
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale)
      }
    } catch {
      // The selected language still works for this session when storage is unavailable.
    }
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
  }, [])

  const t = useCallback((key: MessageKey, values?: MessageValues) => {
    const template: string = messages[locale][key]
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
      values && name in values ? String(values[name]) : placeholder
    )
  }, [locale])

  const plural = useCallback((one: MessageKey, other: MessageKey, count: number, values?: MessageValues) => {
    const key = new Intl.PluralRules(locale).select(count) === 'one' ? one : other
    return t(key, { ...values, count: values?.count ?? formatNumberFor(locale, count) })
  }, [locale, t])

  const formatMessage = useCallback((message: LocalizedMessage | null | undefined) => {
    if (message == null) return null
    if (typeof message === 'string') return message
    const localized = t(message.key, message.values)
    const withDetail = message.detail ? `${localized} ${t('errors.technicalDetail', { detail: message.detail })}` : localized
    return message.related ? `${withDetail} ${formatLocalized(message.related, t)}` : withDetail
  }, [t])

  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) =>
    formatNumberFor(locale, value, options), [locale])

  const formatDate = useCallback((value: string | number | Date, options?: Intl.DateTimeFormatOptions) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return messages[locale]['format.invalidDate']
    return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t, plural, formatMessage, formatNumber, formatDate }),
    [locale, setLocale, t, plural, formatMessage, formatNumber, formatDate])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function formatNumberFor(locale: Locale, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value)
}

function formatLocalized(message: import('./message').MessageDescriptor, t: I18nContextValue['t']): string {
  const localized = t(message.key, message.values)
  const withDetail = message.detail ? `${localized} ${t('errors.technicalDetail', { detail: message.detail })}` : localized
  return message.related ? `${withDetail} ${formatLocalized(message.related, t)}` : withDetail
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
