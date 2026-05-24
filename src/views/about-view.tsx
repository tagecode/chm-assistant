import { Github, Mail, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppDialog } from '@/components/app-dialog'
import { useI18n } from '@/i18n/i18n-context'
import { formatAppVersion } from '@/lib/app-version'
import type { AppMetadata } from '@/shared/electron'

const GITHUB_URL = 'https://github.com/tagecode/chm-assistant'
const AUTHOR_EMAIL = 'tagecode@hotmail.com'

interface AboutViewProps {
  metadata: AppMetadata
  onBack: () => void
}

function openExternalLink(url: string) {
  const api = window.electronAPI
  if (api) {
    void api.openExternalUrl(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

interface AboutMetaRowProps {
  icon: typeof Github
  label: string
  children: React.ReactNode
}

function AboutMetaRow({ icon: Icon, label, children }: AboutMetaRowProps) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-1 text-sm leading-6">{children}</div>
      </div>
    </div>
  )
}

export function AboutView({ metadata, onBack }: AboutViewProps) {
  const { t } = useI18n()
  const dialog = useAppDialog()

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Button variant="ghost" className="mb-6 -ml-2" onClick={onBack}>
        ← {t('common.back')}
      </Button>

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('about.title')}</h1>
        <p className="text-muted-foreground">{t('about.subtitle')}</p>
        <p className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          {t('about.version')} {formatAppVersion(metadata.version)}
        </p>
      </header>

      <section
        aria-label={t('about.contactSection')}
        className="mt-8 rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5"
      >
        <div className="divide-y divide-border/60">
          <AboutMetaRow icon={Github} label={t('about.github')}>
            <button
              type="button"
              onClick={() => openExternalLink(GITHUB_URL)}
              className="text-left text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              tagecode/chm-assistant
            </button>
          </AboutMetaRow>
          <AboutMetaRow icon={User} label={t('about.author')}>
            <span>{t('about.authorValue')}</span>
          </AboutMetaRow>
          <AboutMetaRow icon={Mail} label={t('about.email')}>
            <button
              type="button"
              onClick={() => openExternalLink(`mailto:${AUTHOR_EMAIL}`)}
              className="text-left text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              {AUTHOR_EMAIL}
            </button>
          </AboutMetaRow>
        </div>
      </section>

      <p className="mt-6 text-sm leading-7 text-muted-foreground">{t('about.body')}</p>

      <div className="mt-8 rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5 text-sm">
        <p className="font-medium">{t('about.chmlib')}</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          <button
            type="button"
            onClick={() => openExternalLink('https://github.com/jedwing/CHMLib')}
            className="text-primary underline-offset-4 hover:underline"
          >
            jedwing/CHMLib
          </button>{' '}
          — GNU Lesser General Public License v2.1.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            void (async () => {
              const res = await window.electronAPI?.openNoticesFile()
              if (res && !res.ok) {
                await dialog.showError(res.message ?? t('about.openNoticesFailed'))
              }
            })()
          }}
        >
          {t('about.openNotices')}
        </Button>
      </div>
    </div>
  )
}
