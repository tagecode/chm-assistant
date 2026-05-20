import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import type { AppMetadata } from '@/shared/electron'

interface AboutViewProps {
  metadata: AppMetadata
  onBack: () => void
}

export function AboutView({ metadata, onBack }: AboutViewProps) {
  const { t } = useI18n()

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Button variant="ghost" className="mb-6 -ml-2" onClick={onBack}>
        ← {t('common.back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('about.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('about.subtitle')}</p>
      <p className="mt-6 text-sm">
        {t('about.version')}: {metadata.version}
      </p>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">{t('about.body')}</p>
      <div className="mt-8 rounded-xl border border-border/60 bg-card/50 p-4 text-sm">
        <p className="font-medium">{t('about.chmlib')}</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          <a
            href="https://github.com/jedwing/CHMLib"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            jedwing/CHMLib
          </a>{' '}
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
                window.alert(res.message ?? t('about.openNoticesFailed'))
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
