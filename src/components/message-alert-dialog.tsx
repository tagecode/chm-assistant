import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/i18n-context'
import type { MessageKey } from '@/i18n/zh-Hans'

interface MessageAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey: MessageKey
  descriptionKey?: MessageKey
  detail?: string | null
  okLabelKey?: MessageKey
  onClose: () => void
}

export function MessageAlertDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  detail,
  okLabelKey = 'dialog.ok',
  onClose,
}: MessageAlertDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          {descriptionKey ? (
            <DialogDescription>{t(descriptionKey)}</DialogDescription>
          ) : null}
        </DialogHeader>
        {detail ? (
          <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {detail}
          </p>
        ) : null}
        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:gap-2">
          <Button onClick={onClose}>{t(okLabelKey)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
