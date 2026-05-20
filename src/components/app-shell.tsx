import { useEffect, useMemo, useState } from 'react'
import {
  AppWindow,
  Blocks,
  MonitorCog,
  MoonStar,
  Sparkles,
  SunMedium,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AppMetadata, ThemeMode } from '@/shared/electron'

const themeOptions: Array<{
  label: string
  value: ThemeMode
  icon: typeof MonitorCog
}> = [
  { label: '跟随系统', value: 'system', icon: MonitorCog },
  { label: '浅色模式', value: 'light', icon: SunMedium },
  { label: '深色模式', value: 'dark', icon: MoonStar },
]

const stack = [
  'Electron',
  'Vite',
  'React 19',
  'TypeScript',
  'Tailwind CSS v4',
  'shadcn/ui',
]

const starterTasks = [
  '在 `electron/main.ts` 中扩展应用菜单、托盘、窗口管理和自动更新逻辑。',
  '在 `src/components/ui` 下继续按需添加 shadcn/ui 组件。',
  '在 `src/features` 下按业务拆分模块，并通过 preload 暴露安全的桌面能力。',
]

const browserFallbackMetadata: AppMetadata = {
  name: 'CHM Assistant',
  version: '0.1.0',
  electron: 'browser-preview',
  chromium: 'via-vite',
  node: 'n/a',
  platform: 'darwin',
  arch: 'arm64',
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)

  root.classList.toggle('dark', shouldUseDark)
}

export function AppShell() {
  const [metadata, setMetadata] = useState<AppMetadata>(browserFallbackMetadata)
  const [theme, setTheme] = useState<ThemeMode>('system')
  const runtime = useMemo(
    () => [
      { label: 'Electron', value: metadata.electron },
      { label: 'Chromium', value: metadata.chromium },
      { label: 'Node.js', value: metadata.node },
      { label: '平台', value: `${metadata.platform} / ${metadata.arch}` },
    ],
    [metadata],
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      setTheme((current) => {
        if (current === 'system') {
          applyTheme('system')
        }

        return current
      })
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      if (!window.electronAPI) {
        applyTheme('system')
        return
      }

      const [appMetadata, settings] = await Promise.all([
        window.electronAPI.getAppMetadata(),
        window.electronAPI.getSettings(),
      ])

      if (!mounted) {
        return
      }

      setMetadata(appMetadata)
      setTheme(settings.theme)
      applyTheme(settings.theme)
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  async function handleThemeChange(nextTheme: ThemeMode) {
    setTheme(nextTheme)
    applyTheme(nextTheme)

    if (window.electronAPI) {
      await window.electronAPI.setTheme(nextTheme)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 lg:px-10">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <AppWindow className="size-5" />
              </div>
              <span className="rounded-full border border-border/60 px-3 py-1">
                桌面应用脚手架
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Electron + Vite + React + TypeScript 的跨平台桌面应用基础模板
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                当前项目已经接入 Electron 主进程、preload 通信层、Tailwind
                CSS v4、shadcn/ui 基础能力以及桌面端打包脚本，可直接在此基础上继续开发业务。
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon

                return (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? 'default' : 'outline'}
                    onClick={() => void handleThemeChange(option.value)}
                  >
                    <Icon className="size-4" />
                    {option.label}
                  </Button>
                )
              })}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stack.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">运行时信息</h2>
                <p className="text-sm text-muted-foreground">
                  来自主进程与 preload 的安全暴露接口
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {runtime.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-border/60 bg-card/80 p-8">
            <div className="mb-6 flex items-center gap-3">
              <Blocks className="size-5 text-primary" />
              <h2 className="text-xl font-semibold">接下来可以怎么扩展</h2>
            </div>
            <div className="space-y-4">
              {starterTasks.map((task) => (
                <div
                  key={task}
                  className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {task}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-8">
            <div className="mb-6 flex items-center gap-3">
              <MonitorCog className="size-5 text-primary" />
              <h2 className="text-xl font-semibold">默认开发命令</h2>
            </div>
            <div className="space-y-3 font-mono text-sm">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                npm run dev
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                npm run build
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                npm run dist
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              `npm run dev` 会同时启动 Vite 渲染进程和 Electron 主进程。
              `npm run dist` 会生成可分发安装包。
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
