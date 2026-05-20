import type { ThemeMode } from '@/shared/electron'

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  root.classList.remove('sepia')

  if (theme === 'sepia') {
    root.classList.remove('dark')
    root.classList.add('sepia')
    return
  }

  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', shouldUseDark)
}
