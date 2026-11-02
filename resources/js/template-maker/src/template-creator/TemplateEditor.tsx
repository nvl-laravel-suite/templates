import { MetadataList } from 'themelia-react-ui/base/metadata-list'
import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { memo, useState, type ReactNode } from 'react'
import { Check, LockKeyhole, Redo2, Undo2, X } from 'lucide-react'
import { getEditorRuntime, type TemplateDocumentExport } from '../template-core/editing'
import type { TemplateDefinition } from '../template-core/schema'
import { templateNodeLabel } from '../template-core/labels'
import {
  TemplateEditorProvider,
  useTemplateEditorInstance,
  useTemplatePersonalization,
  useTemplateDataField,
  type TemplateEditorProviderProps,
} from './hooks'
import { CommitInput, DataInput, Field, STYLE_LABELS } from './controls'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { TemplateCanvas } from './canvas'
import { Button as Action } from 'themelia-react-ui/base/buttons'
import { Page, type PageHeaderProps } from 'themelia-react-ui/layout/page'
import { Stack } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'
import { ThemeScope } from 'themelia-react-ui/ui-provider'
import { revealDraftField, useInvalidDrafts } from '../shared/draft-validation'
import { downloadText } from './downloads'
import { VoucherPortalContext } from '../voucher-builder/context'
import '../voucher-builder/styles.css'
import { WorkspaceGrid, WorkspacePanel } from './workspace-panel'
import { assertEmailTemplate, emailStyleProblem } from '../template-email/profile'
import { finalizeTemplateOutput } from '../template-platform/output'
import './workspace.css'

type WithoutChildren<T> = T extends unknown ? Omit<T, 'children'> : never
export type TemplateEditorProps = WithoutChildren<TemplateEditorProviderProps> & {
  layout?: 'default' | 'compact'
  canvasControls?: ReactNode
  inspectorContent?: ReactNode
  header?: Partial<PageHeaderProps>
  previewTransform?: (template: TemplateDefinition) => TemplateDefinition
  previewTarget?: 'document' | 'email'
  className?: string
  theme?: 'light' | 'dark'
  /** Optional explicit field surface. Backend policy must enforce the same restrictions. */
  fieldIds?: readonly string[]
  /** Disable broad legacy node overrides when a host uses typed presentation controls. */
  allowNodeOverrides?: boolean
  /** Receive composition output; the host decides how to store or send it. */
  onExport?: (result: TemplateDocumentExport) => void
}
export function TemplateEditor({ className = '', theme = 'light', layout, canvasControls, onExport, fieldIds, allowNodeOverrides = true, inspectorContent, header, previewTransform, previewTarget, ...options }: TemplateEditorProps) {
  return (
    <div className="tc-shell">
      <TemplateEditorProvider
        key={options.template ? options.template.format === 'gct-template' ? options.template.id : `${options.template.templateId}:${options.template.revision}` : undefined}
        {...options}
      >
        <EditorWorkspace
          className={`${className} ${theme === 'dark' ? 'dark' : 'light'}`}
          onExport={onExport}
          layout={layout} canvasControls={canvasControls}
          inspectorContent={inspectorContent} header={header} previewTransform={previewTransform} previewTarget={previewTarget}
          fieldIds={fieldIds}
          allowNodeOverrides={allowNodeOverrides}
        />
      </TemplateEditorProvider>
    </div>
  )
}
function EditorWorkspace({
  className, layout, canvasControls,
  onExport,
  fieldIds,
  allowNodeOverrides, inspectorContent, header, previewTransform, previewTarget,
}: {
  className: string
  layout?: 'default' | 'compact'
  canvasControls?: ReactNode
  onExport?: (result: TemplateDocumentExport) => void
  fieldIds?: readonly string[]
  allowNodeOverrides: boolean
  inspectorContent?: ReactNode
  header?: Partial<PageHeaderProps>
  previewTransform?: (template: TemplateDefinition) => TemplateDefinition
  previewTarget?: 'document' | 'email'
}) {
  const state = useTemplatePersonalization()
  const instance = useTemplateEditorInstance()
  const template = state.template
  const visibleFields = fieldIds === undefined ? template.fields : template.fields.filter(field => fieldIds.includes(field.id))
  const node = state.selectedId ? template.nodes[state.selectedId] : undefined
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)
  const drafts = useInvalidDrafts(portal)
  const [message, setMessage] = useState('')
  const run = (task: () => unknown) => {
    try {
      setMessage('')
      const result = task()
      if (result && typeof (result as PromiseLike<unknown>).then === 'function')
        void Promise.resolve(result).catch((error) =>
          setMessage(error instanceof Error ? error.message : String(error)),
        )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }
  const exportFile = (format: 'html' | 'json') =>
    submit(() => {
      const result = instance.exportDocument(format)
      if (format === 'html' && previewTarget === 'email') {
        assertEmailTemplate(template)
        result.data = finalizeTemplateOutput(result.data, 'email')
      }
      if (onExport) return onExport(result)
      downloadText(result.data, result.filename, result.mimeType)
    })
  const submit = (task: () => unknown) =>
    run(() => {
      if (portal?.querySelector('[aria-invalid="true"]'))
        throw new Error('Fix the highlighted fields before exporting.')
      return task()
    })
  return (
    <VoucherPortalContext.Provider value={portal}>
      <ThemeScope ref={setPortal} className={`tc-workspace tc-personalizer ${className}`}>
        <Page
          className="tc-page"
          maxWidth="full"
          gutter="md"
          padding="md"
          slotProps={{ body: { className: 'tc-page-body' } }}
          header={{
            title: template.name,
            description: 'Document editor · Personalize a protected template',
            primaryAction: {
              label: 'Export HTML',
              disabled: state.issues.length > 0,
              onClick: () => exportFile('html'),
            },
            secondaryActions: [
              { label: 'Export JSON', onClick: () => exportFile('json') },
            ],
            ...header,
          }}
        >
          <WorkspaceGrid layout={layout}>
            <WorkspacePanel area="sidebar"><aside className="tc-sidebar" aria-label="Document values">
              <Stack
                direction="horizontal"
                align="center"
                justify="between"
                gap="lg"
                className="tc-panel-heading"
              >
                <Heading tag="h2" size="sm">
                  Document values
                </Heading>
                <Text tag="span" type="secondary">
                  {visibleFields.length} fields
                </Text>
              </Stack>
              <Text type="secondary" className="tc-panel-intro">
                Update the fields below. The layout stays protected.
              </Text>
              <Stack gap="lg" className="tc-panel-content">
                {visibleFields.map((field) => <EditorDataField key={field.id} id={field.id} />)}
                {state.issues.length > 0 && (
                  <Alert tone="warning" role="status" className="tc-checks">
                    <Stack gap="sm">
                      <Text weight="semibold">Complete the required values</Text>
                      {state.issues.slice(0, 8).map((issue, index) => {
                        const path = issue.path.replace(/^\//, '').replace(/\//g, '.')
                        const field = template.fields.find(
                          (field) => path === field.path || path.startsWith(`${field.path}.`),
                        )
                        return (
                          <Text key={index}>
                            <Text tag="span" weight="medium">
                              {field?.label ?? 'Document value'}:
                            </Text>{' '}
                            {issue.code === 'required' || issue.code === 'minLength'
                              ? 'Enter a value.'
                              : issue.message}
                          </Text>
                        )
                      })}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </aside></WorkspacePanel>
            <WorkspacePanel area="design"><div className="tc-design">
              <Stack direction="horizontal" align="center" justify="between" gap="sm" className="tc-toolbar">
                <Stack direction="horizontal" align="center" gap="sm" wrap>
                  {canvasControls}
                  <Action
                    size="sm"
                    iconOnly
                    buttonStyle="ghost" aria-label="Undo personalization"
                    disabled={!state.canUndo}
                    onClick={state.actions.undo}
                  >
                    <Undo2 />
                  </Action>
                  <Action
                    size="sm"
                    iconOnly
                    buttonStyle="ghost" aria-label="Redo personalization"
                    disabled={!state.canRedo}
                    onClick={state.actions.redo}
                  >
                    <Redo2 />
                  </Action>
                  <Text type="secondary">{state.canUndo ? 'Editing values' : 'Ready to personalize'}</Text>
                </Stack>
                <Stack direction="horizontal" align="center" gap="xs">
                  <LockKeyhole size={12} />
                  <Text tag="span" type="secondary">
                    Layout protected
                  </Text>
                </Stack>
              </Stack>
              <TemplateCanvas
                template={state.revision}
                previewTransform={previewTransform} target={previewTarget}
                personalization={state.personalization}
                selectedId={state.selectedId}
                onSelect={state.actions.select}
              />
              <Stack
                render={<footer />}
                direction="horizontal"
                align="center"
                justify="between"
                gap="sm"
                className="tc-footer"
              >
                <Text type="secondary" size="sm">
                  {previewTarget === 'email' ? 'Email · 600 px' : `${template.page.widthMm} × ${template.page.heightMm} mm`}
                </Text>
                {drafts.count ? <Action buttonStyle="ghost" tone="destructive" onClick={() => { const field = drafts.firstInvalid(); if (field) revealDraftField(field) }}>
                  {drafts.count} {drafts.count === 1 ? 'field needs' : 'fields need'} attention
                </Action> : <Stack direction="horizontal" align="center" gap="xs">
                  {!state.issues.length && <Check size={13} aria-hidden />}
                  <Text type="secondary" size="sm">{state.issues.length ? `${state.issues.length} values to check` : 'Ready to export'}</Text>
                </Stack>}
              </Stack>
            </div></WorkspacePanel>
            <WorkspacePanel area="inspector"><aside className="tc-inspector" aria-label="Allowed customizations">
              <Stack
                direction="horizontal"
                align="center"
                justify="between"
                gap="lg"
                className="tc-panel-heading"
              >
                <Heading tag="h2" size="sm">
                  {inspectorContent ? 'Appearance' : node?.name ?? 'Allowed customizations'}
                </Heading>
              </Stack>
              <Stack gap="lg" className="tc-inspector-scroll">
                {inspectorContent}
                {allowNodeOverrides ? <>
                <Field label="Customization target" hint="Choose an editable element, or select it in the preview.">
                  <Select aria-label="Customization target" placeholder="Choose an editable element…" value={state.selectedId ?? ''}
                    onValueChange={value => state.actions.select(value || null)}
                    options={[
                      { value: '', label: 'Choose an element…' },
                      ...Object.values(template.nodes).filter(item => item.id === state.selectedId ||
                        (item.kind === 'element' && item.permissions.style) ||
                        (item.kind === 'text' && item.permissions.content && item.parts.every(part => part.value.source === 'literal')))
                        .map((item, index) => ({ value: item.id, label: `${templateNodeLabel(item)} · ${index + 1}` })),
                    ]} />
                </Field>
                {!node ? (
                  <EmptyState
                    padding="sm"
                    title="Select an element"
                    description="Choose a customization target or click the preview to inspect the author’s editing rules."
                  />
                ) : (
                  <>
                    <Text type="secondary">Editing rules are defined by this template.</Text>
                    {node.kind === 'text' &&
                      node.permissions.content &&
                      node.parts.every((part) => part.value.source === 'literal') && (
                        <CommitInput
                          key={node.id}
                          label="Custom text"
                          multiline
                          value={
                            state.personalization.overrides[node.id]?.text ??
                            node.parts
                              .map((part) =>
                                part.value.source === 'literal' ? String(part.value.value) : '',
                              )
                              .join('')
                          }
                          onCommit={(text) => state.actions.override(node.id, { text })}
                        />
                      )}
                    {node.kind === 'element' && node.permissions.style && (
                      <>
                        {['color', 'background-color', 'font-size', 'text-align'].map((property) => (
                          <CommitInput
                            key={`${node.id}:${property}`}
                            label={STYLE_LABELS[property] ?? property}
                            value={
                              state.personalization.overrides[node.id]?.style?.[property] ??
                              node.style[property] ??
                              ''
                            }
                            onCommit={(value) => {
                              if (previewTarget === 'email' && value) { const problem = emailStyleProblem(property, value); if (problem) throw new Error(`Email: ${problem}`) }
                              const style = { ...state.personalization.overrides[node.id]?.style }
                              if (value.trim()) style[property] = value
                              else delete style[property]
                              state.actions.override(node.id, { style })
                            }}
                          />
                        ))}
                      </>
                    )}
                    {!(
                      node.kind === 'text' &&
                      node.permissions.content &&
                      node.parts.every((part) => part.value.source === 'literal')
                    ) &&
                      !(node.kind === 'element' && node.permissions.style) && (
                        <Text type="secondary" className="tc-hint">
                          This element is controlled by the template. Update its bound values in Document
                          values.
                        </Text>
                      )}
                    {state.personalization.overrides[node.id] && (
                      <Action onClick={() => run(() => state.actions.clearOverride(node.id))}>
                        Reset to template
                      </Action>
                    )}
                  </>
                )}
                </> : !inspectorContent && <Text type="secondary">Appearance is controlled by the template’s selected settings.</Text>}
              </Stack>
            </aside></WorkspacePanel>
          </WorkspaceGrid>
        </Page>
        {(message || state.error) && (
          <Alert role="alert" tone="destructive" className="tc-toast">
            <Stack direction="horizontal" align="center" justify="between" gap="lg">
              <AlertDescription>{message || state.error?.message}</AlertDescription>
              <Action
                buttonStyle="ghost"
                aria-label="Dismiss message"
                onClick={() => {
                  setMessage('')
                  getEditorRuntime(instance).store.setState({ error: null })
                }}
              >
                <X />
              </Action>
            </Stack>
          </Alert>
        )}
      </ThemeScope>
    </VoucherPortalContext.Provider>
  )
}
const EditorDataField = memo(function EditorDataField({ id }: { id: string }) {
  const { field, value, editable, setValue } = useTemplateDataField(id)
  if (!field) return null
  return <Stack gap="lg" className="tc-data-field" data-field-type={field.schema.type}>
    {editable ? <DataInput field={field} value={value} onChange={setValue} /> :
      <MetadataList items={[{ id: field.id, label: field.label,
        value: <Text className="whitespace-pre-wrap [overflow-wrap:anywhere]">{formatProvidedValue(value)}</Text> }]} />}
  </Stack>
})
function formatProvidedValue(value: unknown) {
  if (value === undefined || value === null) return 'Provided by your application'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
