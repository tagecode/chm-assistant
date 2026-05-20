import { useCallback, useEffect, useState } from 'react'
import { MonitorCog, MoonStar, SunMedium, Trees } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import { compilerStatusMessageKey } from '@/lib/compiler-ui'
import { cn } from '@/lib/utils'
import type { CompilerStatus, LocaleMode, ThemeMode } from '@/shared/electron'

interface SettingsViewProps {
  theme: ThemeMode
  onThemeChange: (t: ThemeMode) => void
  localeMode: LocaleMode
  onLocaleChange: (l: LocaleMode) => void
  readerEncoding: string
  onReaderEncodingChange: (v: string) => void
  chmCompilerPath: string
  onChmCompilerPathChange: (v: string) => void
  onBack: () => void
}

const themeOptions: Array<{
  value: ThemeMode
  icon: typeof MonitorCog
}> = [
  { value: 'system', icon: MonitorCog },
  { value: 'light', icon: SunMedium },
  { value: 'dark', icon: MoonStar },
  { value: 'sepia', icon: Trees },
]

export function SettingsView({
  theme,
  onThemeChange,
  localeMode,
  onLocaleChange,
  readerEncoding,
  onReaderEncodingChange,
  chmCompilerPath,
  onChmCompilerPathChange,
  onBack,
}: SettingsViewProps) {
  const { t } = useI18n()
  const [compilerStatus, setCompilerStatus] = useState<CompilerStatus | null>(null)

  const refreshCompilerStatus = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    setCompilerStatus(await api.getCompilerStatus())
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    let cancelled = false
    void api.getCompilerStatus().then((status) => {
      if (!cancelled) setCompilerStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [chmCompilerPath])

  function handleTheme(next: ThemeMode) {
    void onThemeChange(next)
  }

  async function persistCompilerPath(next: string) {
    onChmCompilerPathChange(next)
    await window.electronAPI?.setChmCompilerPath(next)
    await refreshCompilerStatus()
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Button variant="ghost" className="mb-6 -ml-2" onClick={onBack}>
        ← {t('common.back')}
      </Button>
      <h1 className="mb-8 text-2xl font-semibold">{t('settings.title')}</h1>

      <section className="mb-10 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('settings.theme')}</h2>
        <div className="flex flex-wrap gap-2">
          {themeOptions.map(({ value, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTheme(value)}
            >
              <Icon className="size-4" />
              {value === 'system'
                ? t('settings.theme.system')
                : value === 'light'
                  ? t('settings.theme.light')
                  : value === 'dark'
                    ? t('settings.theme.dark')
                    : t('settings.theme.sepia')}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('settings.locale')}</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['system', t('settings.locale.system')],
              ['zh-Hans', t('settings.locale.zhHans')],
              ['zh-Hant', t('settings.locale.zhHant')],
              ['en', t('settings.locale.en')],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={localeMode === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onLocaleChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t('settings.readerEncoding')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('settings.readerEncodingHint')}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['auto', t('settings.encoding.auto')],
              ['utf-8', t('settings.encoding.utf8')],
              ['gb18030', t('settings.encoding.gbk')],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={readerEncoding === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onReaderEncodingChange(value)
                void window.electronAPI?.setReaderEncoding(value)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('settings.compiler')}</h2>
        <p className="text-xs text-muted-foreground">{t('settings.compiler.hint')}</p>
        {compilerStatus ? (
          <p
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              compilerStatus.available
                ? 'border-primary/30 bg-primary/5 text-foreground'
                : 'border-destructive/40 bg-destructive/5 text-destructive',
            )}
          >
            {t(compilerStatusMessageKey(compilerStatus))}
            {compilerStatus.path ? (
              <span className="mt-1 block break-all text-xs opacity-80">
                {compilerStatus.path}
              </span>
            ) : null}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          {t('settings.compiler.pathLabel')}
          <Input
            value={chmCompilerPath}
            onChange={(e) => onChmCompilerPathChange(e.target.value)}
            onBlur={() => void persistCompilerPath(chmCompilerPath)}
            placeholder={t('settings.compiler.pathPlaceholder')}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void (async () => {
                const picked = await window.electronAPI?.pickCompilerDialog()
                if (picked) {
                  await persistCompilerPath(picked)
                }
              })()
            }}
          >
            {t('settings.compiler.browse')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void persistCompilerPath('')}
          >
            {t('settings.compiler.clear')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refreshCompilerStatus()}>
            {t('settings.compiler.refresh')}
          </Button>
          {compilerStatus?.installGuideUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void window.electronAPI?.openExternalUrl(compilerStatus.installGuideUrl!)
              }
            >
              {t('settings.compiler.openGuide')}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
