import { useId, type PropsWithChildren } from 'react'
import { UIProvider } from 'themelia-react-ui/ui-provider'
import { Button } from 'themelia-react-ui/base/buttons'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { FormField } from 'themelia-react-ui/base/forms'
import { Stack } from 'themelia-react-ui/base/structure'
import type {
  TemplateDefinition,
  TemplateRevision,
  TemplatePersonalization,
  JsonObject,
} from '@nicolasvlachos/voucher-builder/template-schema'
import {
  TemplateCreator,
  TemplateEditor,
  TemplateEditorProvider,
  useTemplateDataField,
  useTemplateEditorExport,
  useTemplateEditorValidation,
} from '@nicolasvlachos/voucher-builder/template-creator'
import { VoucherBuilderProvider, VoucherBuilderEditor } from '@nicolasvlachos/voucher-builder/editor'
import { useVoucherExport } from '@nicolasvlachos/voucher-builder/hooks'
import type { Project } from '@nicolasvlachos/voucher-builder/schema'

// Import @nicolasvlachos/voucher-builder/styles.css once in the application entry.
// Reuse the application's existing UIProvider when it already has one.
export function DocumentUIRoot({ children }: PropsWithChildren) {
  return <UIProvider config={{ typography: { defaultTextSize: 'sm' } }}>{children}</UIProvider>
}

export function AuthoringPage({
  definition,
  receiveChange,
}: {
  definition: TemplateDefinition
  receiveChange: (definition: TemplateDefinition) => void
}) {
  return <TemplateCreator initialTemplate={definition} onChange={receiveChange} />
}

export function PersonalizationPage({
  template,
  applicationData,
  previousValues,
  receiveChange,
}: {
  template: TemplateDefinition | TemplateRevision
  applicationData: JsonObject
  previousValues?: TemplatePersonalization
  receiveChange: (values: TemplatePersonalization) => void
}) {
  return <TemplateEditor
    template={template}
    initialData={applicationData}
    initialPersonalization={previousValues}
    onChange={receiveChange}
  />
}

export function CustomPersonalization({
  template,
  data,
  receiveHTML,
}: {
  template: TemplateDefinition | TemplateRevision
  data: JsonObject
  receiveHTML: (html: string) => void
}) {
  return <TemplateEditorProvider template={template} initialData={data}>
    <Stack gap="lg">
      <CustomerName />
      <UsePersonalizationHTML receiveHTML={receiveHTML} />
    </Stack>
  </TemplateEditorProvider>
}

function CustomerName() {
  const id = useId()
  const { field, value, editable, issues, setValue } = useTemplateDataField('customerName')
  if (!field) return null
  return <FormField
    label={field.label}
    htmlFor={id}
    error={issues.length ? issues.map(issue => issue.message).join('; ') : undefined}
    supportingTextId={`${id}-issues`}
  >
    <Input id={id} value={typeof value === 'string' ? value : ''}
      readOnly={!editable} aria-invalid={issues.length > 0}
      aria-describedby={issues.length ? `${id}-issues` : undefined}
      onChange={event => setValue(event.target.value)} />
  </FormField>
}

function UsePersonalizationHTML({ receiveHTML }: { receiveHTML: (html: string) => void }) {
  const { exportDocument } = useTemplateEditorExport()
  const { issues } = useTemplateEditorValidation()
  return <Button tone="primary" disabled={issues.length > 0}
    onClick={() => receiveHTML(exportDocument('html').data)}>
    Use HTML
  </Button>
}

export function VoucherPage({
  project,
  receiveHTML,
}: {
  project: Project
  receiveHTML: (html: string) => void
}) {
  return <VoucherBuilderProvider initialProject={project}>
    <UseVoucherHTML receiveHTML={receiveHTML} />
    <VoucherBuilderEditor />
  </VoucherBuilderProvider>
}

function UseVoucherHTML({ receiveHTML }: { receiveHTML: (html: string) => void }) {
  const { exportHTML } = useVoucherExport()
  return <Button onClick={() => receiveHTML(exportHTML())}>Use voucher HTML</Button>
}
