import { ErrorState } from 'themelia-react-ui/base/feedback'
import { useEffect, useState } from 'react'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { Stack } from 'themelia-react-ui/base/structure'
import { Button } from 'themelia-react-ui/base/buttons'
import { SettingInput } from '#/voucher-builder/builder/settings'
import { type VoucherTemplate } from '#/voucher-builder/templates'
import { useVoucherTemplates } from '../hooks/use-voucher-builder'
import { useToast } from '#/voucher-builder/hooks/use-toast'

export interface EditTemplateDialogProps {
  template: VoucherTemplate | null
  onClose: () => void
  onUpdated?: (template: VoucherTemplate) => void
}

export function EditTemplateDialog({ template, onClose, onUpdated }: EditTemplateDialogProps) {
  const toast = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const { update } = useVoucherTemplates()

  useEffect(() => {
    setError('')
    if (template) {
      setName(template.name)
      setDescription(template.description || '')
      setCategory(template.category || 'User')
    }
  }, [template])

  const handleSave = () => {
    if (!template) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast('Give your template a name.', 'warning')
      return
    }
    setError('')
    try {
      const updated = update(template.id, {
        name: trimmedName,
        description: description.trim(),
        category: category.trim() || 'User',
      })
      if (updated) {
        toast(`Template "${updated.name}" updated.`, 'success')
        onUpdated?.(updated)
      }
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Template operation failed')
    }
  }

  return (
    <ActionDialog
      title="Edit template"
      size="md"
      showConfirm={false}
      showCancel={false}
      footer={
        <Stack direction="horizontal" gap="md" justify="end" wrap={false}>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" onClick={handleSave} disabled={!name.trim()}>
            Apply changes
          </Button>
        </Stack>
      }
      open={!!template}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Stack gap="lg">
        {error && <ErrorState title="Template operation failed" description={error} variant="inline" />}
        <SettingInput type="input" label="Name" value={name} onChange={setName} />
        <SettingInput
          type="textarea"
          label="Description"
          value={description}
          onChange={setDescription}
          rows={3}
        />
        <SettingInput type="input" label="Category" value={category} onChange={setCategory} />
      </Stack>
    </ActionDialog>
  )
}
