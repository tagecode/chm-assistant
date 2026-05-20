import type { CompilerStatus } from '@/shared/electron'
import type { MessageKey } from '@/i18n/zh-Hans'

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

export async function promptCompilerMissing(
  status: CompilerStatus,
  t: (key: MessageKey) => string,
): Promise<void> {
  const api = window.electronAPI
  const msg = t(compilerStatusMessageKey(status))
  if (status.installGuideUrl && api) {
    const open = window.confirm(`${msg}\n\n${t('settings.compiler.openGuideConfirm')}`)
    if (open) {
      await api.openExternalUrl(status.installGuideUrl)
    }
    return
  }
  window.alert(msg)
}
