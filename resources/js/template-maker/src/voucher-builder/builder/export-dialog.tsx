import { ErrorState } from 'themelia-react-ui/base/feedback'
import { useState, useEffect } from 'react'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { Button } from 'themelia-react-ui/base/buttons'
import { FormField } from 'themelia-react-ui/base/forms'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { ListRadioGroup, ToggleField } from 'themelia-react-ui/base/choice-inputs'
import { Stack } from 'themelia-react-ui/base/structure'
import { Alert, AlertTitle, AlertDescription } from 'themelia-react-ui/base/feedback'
import { downloadFile } from '../export/index'
import { useGlobalSettingsState } from '../store/hooks'
import { useToast } from '../hooks/use-toast'
import { Download } from 'lucide-react'
import { useVoucherProject, useVoucherExport } from '../hooks/use-voucher-builder'
import { validateLayout } from '../lib/voucher'

type ExportFormat = 'html' | 'json'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReviewLayout?: () => void
}

export function ExportDialog({ open, onOpenChange, onReviewLayout }: ExportDialogProps) {
  const toast = useToast()

  const { exportProject } = useVoucherExport()
  const globalSettings = useGlobalSettingsState()
  const title = globalSettings.metadata.title || 'voucher'

  const [fileName, setFileName] = useState(title)
  const [format, setFormat] = useState<ExportFormat>('html')
  const [error, setError] = useState('')
  const [allowOverflow, setAllowOverflow] = useState(false)
  const project = useVoucherProject()
  const layout = validateLayout(
    project.sections.map((s) => s.height) as [number, number, number],
    project.global.layout.margin,
  )

  useEffect(() => {
    if (!open) return
    setFileName(title)
    setFormat('html')
    setError('')
    setAllowOverflow(false)
  }, [open, title])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleExport = () => {
    if (!layout.valid && format !== 'json' && !allowOverflow) return
    setError('')
    try {
      const result = exportProject({
        format,
        filename: fileName.trim() || 'voucher',
      })
      downloadFile(result.data, result.filename, result.mimeType)
      toast(`Exported as ${result.format.toUpperCase()}`, 'success')
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  const formats: { id: ExportFormat; label: string; subtitle: string }[] = [
    { id: 'html', label: 'HTML', subtitle: 'Standalone page' },
    { id: 'json', label: 'JSON', subtitle: 'Project data' },
  ]

  return (
    <ActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Export voucher"
      size="md"
      showConfirm={false}
      showCancel={false}
      footer={
        <Stack direction="horizontal" justify="end" gap="sm">
          <Button onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            tone="primary"
            icon={Download}
            disabled={!fileName.trim() || (!layout.valid && format !== 'json' && !allowOverflow)}
            onClick={handleExport}
          >
            {`Export ${format.toUpperCase()}`}
          </Button>
        </Stack>
      }
    >
      <Stack gap="xl">
        {error && <ErrorState title="Export failed" description={error} variant="inline" />}
        {!layout.valid && (
          <Alert tone="warning">
            <AlertTitle>{`Sections exceed the page by ${Number(layout.overflow.toFixed(2))} mm`}</AlertTitle>
            <AlertDescription>
              HTML output may clip content. JSON preserves the complete editable project.
            </AlertDescription>
            <Stack gap="md">
              {onReviewLayout && <Button onClick={onReviewLayout}>Review document layout</Button>}
              {format !== 'json' && (
                <ToggleField
                  kind="checkbox"
                  label="Export with overflow anyway"
                  value={allowOverflow}
                  onValueChange={setAllowOverflow}
                />
              )}
            </Stack>
          </Alert>
        )}
        <FormField label="File name">
          <Input
            aria-label="File name"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            placeholder="voucher"
          />
        </FormField>
        <FormField label="Format">
          <ListRadioGroup
            name="export-format"
            value={format}
            onValueChange={(value) => setFormat(value as ExportFormat)}
            options={formats.map((format) => ({
              value: format.id,
              label: format.label,
              description: format.subtitle,
            }))}
          />
        </FormField>
      </Stack>
    </ActionDialog>
  )
}
