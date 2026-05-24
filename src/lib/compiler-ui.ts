import type { CompilerStatus } from '@/shared/electron'
import type { MessageKey } from '@/i18n/zh-Hans'
import type { AppDialogApi } from '@/components/app-dialog'

const STATUS_KEYS: Record<CompilerStatus['messageKey'], MessageKey> = {
  'ok.bundled': 'settings.compiler.status.okBundled',
  'ok.system': 'settings.compiler.status.okSystem',
  'ok.settings': 'settings.compiler.status.okSettings',
  'missing.win': 'settings.compiler.status.missingWin',
  'missing.unix': 'settings.compiler.status.missingUnix',
  'missing.custom': 'settings.compiler.status.missingCustom',
}

export function compilerStatusMessageKey(status: CompilerStatus): MessageKey {
  return STATUS_KEYS[status.messageKey]
}

export async function promptWindowsViewerCompatRequiresHhc(
  dialog: AppDialogApi,
): Promise<void> {
  await dialog.showAlert({
    titleKey: 'composer.meta.windowsViewerCompatBlockedTitle',
    descriptionKey: 'composer.meta.windowsViewerCompatBlocked',
  })
}

export async function promptCompilerMissing(
  status: CompilerStatus,
  t: (key: MessageKey) => string,
  dialog: AppDialogApi,
): Promise<void> {
  const api = window.electronAPI
  const msg = t(compilerStatusMessageKey(status))
  if (status.installGuideUrls?.length && api) {
    const open = await dialog.showConfirm({
      titleKey: 'settings.compiler.missingTitle',
      descriptionKey: 'settings.compiler.openGuideConfirm',
      detail: msg,
      confirmLabelKey: 'settings.compiler.openGuide',
    })
    if (open) {
      await api.openExternalUrl(status.installGuideUrls[0]!)
    }
    return
  }
  await dialog.showAlert({
    titleKey: 'settings.compiler.missingTitle',
    detail: msg,
  })
}
