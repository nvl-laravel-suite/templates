import { ConfirmDialog as ThemeliaConfirmDialog } from 'themelia-react-ui/features/overlays'
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
}) {
  return (
    <ThemeliaConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      title={title}
      description={message}
      destructive={variant === 'danger'}
      tone={variant === 'warning' ? 'warning' : undefined}
      strings={{ confirm: confirmLabel }}
      onConfirm={onConfirm}
    />
  )
}
