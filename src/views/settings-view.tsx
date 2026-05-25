import { useCallback, useEffect, useState } from 'react'
import { MonitorCog, MoonStar, SunMedium, Trees } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import type { MessageKey } from '@/i18n/zh-Hans'
import { compilerStatusMessageKey } from '@/lib/compiler-ui'
import { cn } from '@/lib/utils'
import {
  RECENT_MAX_COUNT_DEFAULT,
  RECENT_MAX_COUNT_MAX,
  RECENT_MAX_COUNT_MIN,
} from '@/shared/recent'
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
  compileTempDir: string
  onCompileTempDirChange: (v: string) => void
  recentMaxCount: number
  onRecentMaxCountChange: (v: number) => void
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
  compileTempDir,
  onCompileTempDirChange,
  recentMaxCount,
  onRecentMaxCountChange,
  onBack,
}: SettingsViewProps) {
  const { t } = useI18n()
  const [compilerStatus, setCompilerStatus] = useState<CompilerStatus | null>(null)
  const [compileTempError, setCompileTempError] = useState<MessageKey | null>(null)
  const [recentMaxDraft, setRecentMaxDraft] = useState(String(recentMaxCount))

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

  useEffect(() => {
    setRecentMaxDraft(String(recentMaxCount))
  }, [recentMaxCount])

  function handleTheme(next: ThemeMode) {
    void onThemeChange(next)
  }

  async function persistCompilerPath(next: string) {
    onChmCompilerPathChange(next)
    await window.electronAPI?.setChmCompilerPath(next)
    await refreshCompilerStatus()
  }

  async function persistRecentMaxCount(raw: string) {
    const parsed = Number.parseInt(raw, 10)
    const persisted =
      (await window.electronAPI?.setRecentMaxCount(parsed)) ??
      (Number.isFinite(parsed) ? parsed : RECENT_MAX_COUNT_DEFAULT)
    onRecentMaxCountChange(persisted)
    setRecentMaxDraft(String(persisted))
  }

  async function persistCompileTempDir(next: string) {
    const api = window.electronAPI
    if (!api) return
    const result = await api.setCompileTempDir(next)
    if (!result.ok) {
      setCompileTempError(
        result.code === 'non_ascii'
          ? 'settings.compileTemp.errorNonAscii'
          : 'settings.compileTemp.errorInvalid',
      )
      return
    }
    setCompileTempError(null)
    onCompileTempDirChange(result.path)
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

      <section className="mb-10 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('settings.recentMax')}</h2>
        <p className="text-xs text-muted-foreground">{t('settings.recentMaxHint')}</p>
        <label className="grid max-w-xs gap-1 text-sm">
          {t('settings.recentMaxLabel')}
          <Input
            type="number"
            min={RECENT_MAX_COUNT_MIN}
            max={RECENT_MAX_COUNT_MAX}
            value={recentMaxDraft}
            onChange={(e) => setRecentMaxDraft(e.target.value)}
            onBlur={() => void persistRecentMaxCount(recentMaxDraft)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {t('settings.recentMaxRange')}
        </p>
      </section>

      <section className="mb-10 space-y-3">
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
          {compilerStatus?.installGuideUrls?.map((url, index) => (
            <Button
              key={url}
              variant="outline"
              size="sm"
              onClick={() => void window.electronAPI?.openExternalUrl(url)}
            >
              {t(
                index === 0
                  ? 'settings.compiler.openGuide'
                  : 'settings.compiler.openGuideBackup',
              )}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t('settings.compileTemp')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('settings.compileTemp.hint')}</p>
        <label className="grid gap-1 text-sm">
          {t('settings.compileTemp.pathLabel')}
          <Input
            value={compileTempDir}
            onChange={(e) => {
              setCompileTempError(null)
              onCompileTempDirChange(e.target.value)
            }}
            onBlur={() => void persistCompileTempDir(compileTempDir)}
            placeholder={t('settings.compileTemp.pathPlaceholder')}
          />
        </label>
        {compileTempError ? (
          <p className="text-xs text-destructive">{t(compileTempError)}</p>
        ) : null}
        {!compileTempDir.trim() ? (
          <p className="text-xs text-muted-foreground">{t('settings.compileTemp.defaultHint')}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void (async () => {
                const picked = await window.electronAPI?.pickCompileTempDirDialog()
                if (picked) {
                  await persistCompileTempDir(picked)
                }
              })()
            }}
          >
            {t('settings.compileTemp.browse')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void persistCompileTempDir('')}
          >
            {t('settings.compileTemp.clear')}
          </Button>
        </div>
      </section>
    </div>
  )
}
