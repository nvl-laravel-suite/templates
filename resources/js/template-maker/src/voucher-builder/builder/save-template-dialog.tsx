import { ErrorState } from 'themelia-react-ui/base/feedback'
import { useEffect, useState } from 'react'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { Stack } from 'themelia-react-ui/base/structure'
import { Button } from 'themelia-react-ui/base/buttons'
import { SettingInput } from './settings'
import { useVoucherTemplates } from '../hooks/use-voucher-builder'
import { useProjectActions } from '../store/hooks'
import { useToast } from '../hooks/use-toast'

export interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Observe the template added to the local library. */
  onAdded?: () => void
}

export function SaveTemplateDialog({ open, onOpenChange, onAdded }: SaveTemplateDialogProps) {
  const toast = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('User')
  const [error, setError] = useState('')
  const { getProject } = useProjectActions()
  const { add } = useVoucherTemplates()

  useEffect(() => {
    if (open) setError('')
  }, [open])

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast('Give your template a name.', 'warning')
      return
    }
    setError('')
    try {
      const project = getProject()
      const template = add({
        name: trimmedName,
        description: description.trim(),
        category: category.trim() || 'User',
        project,
      })
      toast(`Template "${template.name}" added to the local library.`, 'success')
      setName('')
      setDescription('')
      setCategory('User')
      onOpenChange(false)
      onAdded?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Template operation failed')
    }
  }

  return (
    <ActionDialog
      title="Add reusable template"
      size="md"
      showConfirm={false}
      showCancel={false}
      footer={
        <Stack direction="horizontal" gap="md" justify="end" wrap={false}>
          <Button onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button tone="primary" onClick={handleSave} disabled={!name.trim()}>
            Add template
          </Button>
        </Stack>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <Stack gap="lg">
        {error && <ErrorState title="Template operation failed" description={error} variant="inline" />}
        <SettingInput
          type="input"
          label="Name"
          value={name}
          onChange={setName}
          placeholder="My voucher template"
        />
        <SettingInput
          type="textarea"
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Short description shown in the picker"
          rows={3}
        />
        <SettingInput
          type="input"
          label="Category"
          value={category}
          onChange={setCategory}
          placeholder="User"
        />
      </Stack>
    </ActionDialog>
  )
}
