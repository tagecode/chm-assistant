import { createContext, useContext } from 'react'

import type { MessageKey } from '@/i18n/zh-Hans'

export interface AlertDialogOptions {
  titleKey: MessageKey
  descriptionKey?: MessageKey
  detail?: string
}

export interface ConfirmDialogOptions extends AlertDialogOptions {
  descriptionKey: MessageKey
  confirmLabelKey: MessageKey
  cancelLabelKey?: MessageKey
  destructive?: boolean
}

export interface AppDialogApi {
  showAlert: (options: AlertDialogOptions) => Promise<void>
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>
  showError: (detail: string, titleKey?: MessageKey) => Promise<void>
}

export const AppDialogContext = createContext<AppDialogApi | null>(null)

export function useAppDialog(): AppDialogApi {
  const ctx = useContext(AppDialogContext)
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider')
  }
  return ctx
}
