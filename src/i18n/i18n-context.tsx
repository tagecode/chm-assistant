import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { en } from '@/i18n/en'
import type { MessageKey } from '@/i18n/zh-Hans'
import { zhHans } from '@/i18n/zh-Hans'
import { zhHant } from '@/i18n/zh-Hant'
import type { LocaleMode } from '@/shared/electron'

const bundles = {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  en,
} as const

export function resolveNavigatorLocale(): keyof typeof bundles {
  const tag = navigator.language.toLowerCase()
  if (tag.startsWith('zh-tw') || tag.startsWith('zh-hk') || tag.startsWith('zh-mo')) {
    return 'zh-Hant'
  }
  if (tag.startsWith('zh')) {
    return 'zh-Hans'
  }
  return 'en'
}

function effectiveBundleKey(mode: LocaleMode): keyof typeof bundles {
  if (mode === 'system') {
    return resolveNavigatorLocale()
  }
  return mode
}

interface I18nContextValue {
  localeMode: LocaleMode
  setLocaleMode: (mode: LocaleMode) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLocaleMode,
}: {
  children: ReactNode
  initialLocaleMode: LocaleMode
}) {
  const [localeMode, setLocaleModeState] = useState<LocaleMode>(initialLocaleMode)

  const setLocaleMode = useCallback((mode: LocaleMode) => {
    setLocaleModeState(mode)
    void window.electronAPI?.setLocale(mode)
  }, [])

  useEffect(() => {
    const handler = () => {
      if (localeMode === 'system') {
        setLocaleModeState((x) => x)
      }
    }
    window.addEventListener('languagechange', handler)
    return () => window.removeEventListener('languagechange', handler)
  }, [localeMode])

  const t = useCallback(
    (key: MessageKey) => {
      const bundleKey = effectiveBundleKey(localeMode)
      const table = bundles[bundleKey] as Record<string, string>
      return table[key] ?? key
    },
    [localeMode],
  )

  const value = useMemo(
    () => ({ localeMode, setLocaleMode, t }),
    [localeMode, setLocaleMode, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
