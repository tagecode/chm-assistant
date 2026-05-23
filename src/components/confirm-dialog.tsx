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

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey: MessageKey
  descriptionKey: MessageKey
  confirmLabelKey: MessageKey
  cancelLabelKey?: MessageKey
  detail?: string | null
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  confirmLabelKey,
  cancelLabelKey = 'project.cancel',
  detail,
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        {detail ? (
          <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
            {detail}
          </p>
        ) : null}
        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t(cancelLabelKey)}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {t(confirmLabelKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
