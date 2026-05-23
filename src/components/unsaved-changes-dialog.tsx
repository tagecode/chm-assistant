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

interface UnsavedChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey?: MessageKey
  descriptionKey: MessageKey
  saveLabelKey: MessageKey
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  titleKey = 'composer.unsavedLeaveTitle',
  descriptionKey,
  saveLabelKey,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('project.cancel')}
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            {t('composer.leaveWithoutSaving')}
          </Button>
          <Button onClick={onSave}>{t(saveLabelKey)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
