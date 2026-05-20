import { useEffect, useState } from 'react'

import { AppRoot } from '@/app/app-root'
import type { LocaleMode } from '@/shared/electron'

export default function App() {
  const [ready, setReady] = useState(false)
  const [initialLocale, setInitialLocale] = useState<LocaleMode>('system')

  useEffect(() => {
    void (async () => {
      if (window.electronAPI) {
        const s = await window.electronAPI.getSettings()
        setInitialLocale(s.locale)
      }
      setReady(true)
    })()
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        加载中…
      </div>
    )
  }

  return <AppRoot initialLocale={initialLocale} />
}
