import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  AppDialogContext,
  type AlertDialogOptions,
  type ConfirmDialogOptions,
} from '@/components/app-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { MessageAlertDialog } from '@/components/message-alert-dialog'
import type { MessageKey } from '@/i18n/zh-Hans'

type PendingDialog =
  | { kind: 'alert'; options: AlertDialogOptions; resolve: () => void }
  | { kind: 'confirm'; options: ConfirmDialogOptions; resolve: (value: boolean) => void }

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null)
  const pendingRef = useRef<PendingDialog | null>(null)

  const closePending = useCallback((result?: boolean) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    if (!current) return
    if (current.kind === 'alert') {
      current.resolve()
      return
    }
    current.resolve(result === true)
  }, [])

  const showAlert = useCallback((options: AlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      const item: PendingDialog = { kind: 'alert', options, resolve }
      pendingRef.current = item
      setPending(item)
    })
  }, [])

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      const item: PendingDialog = { kind: 'confirm', options, resolve }
      pendingRef.current = item
      setPending(item)
    })
  }, [])

  const showError = useCallback(
    (detail: string, titleKey: MessageKey = 'dialog.errorTitle') =>
      showAlert({ titleKey, detail }),
    [showAlert],
  )

  const value = useMemo(
    () => ({ showAlert, showConfirm, showError }),
    [showAlert, showConfirm, showError],
  )

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {pending?.kind === 'alert' ? (
        <MessageAlertDialog
          open
          onOpenChange={(open) => {
            if (!open) closePending()
          }}
          titleKey={pending.options.titleKey}
          descriptionKey={pending.options.descriptionKey}
          detail={pending.options.detail ?? null}
          onClose={() => closePending()}
        />
      ) : null}
      {pending?.kind === 'confirm' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) closePending(false)
          }}
          titleKey={pending.options.titleKey}
          descriptionKey={pending.options.descriptionKey}
          confirmLabelKey={pending.options.confirmLabelKey}
          cancelLabelKey={pending.options.cancelLabelKey}
          detail={pending.options.detail ?? null}
          destructive={pending.options.destructive}
          onCancel={() => closePending(false)}
          onConfirm={() => closePending(true)}
        />
      ) : null}
    </AppDialogContext.Provider>
  )
}
