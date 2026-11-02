import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Stack } from 'themelia-react-ui/base/structure'
import type { PageHeaderProps } from 'themelia-react-ui/layout/page'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import type { JsonObject, TemplateDefinition } from '../template-core/schema'
import { createTemplateCreator, createTemplateEditor, type TemplateCreatorInstance, type TemplateEditorInstance } from '../template-core/editing'
import { getValue, setValue, stableJSONStringify } from '../template-core/contracts'
import { TemplateCreator } from '../template-creator/TemplateCreator'
import { TemplateEditor } from '../template-creator/TemplateEditor'
import { downloadJSON } from '../template-creator/downloads'
import { getTemplateIssues } from '../template-core/validation'
import { resolvePresentationSettings } from './settings'
import { reconcileSource, reconcileSettings } from './authoring-state'
import { recompileTemplateDocument } from './recompile'
import { hydrateTemplateDraft } from './hydration'
import { applyPresentationSettings } from './settings'
import { applyTemplateTheme } from './theme'
import { TemplateThemePanel, SelectedAppearanceControls, AppearanceSettingsLibrary } from './authoring'
import { TemplateSettingsPanel } from './settings-panel'
import { FamilyVariationControls, FamilyVariationLibrary } from './family-authoring'
import { materializeFamilyDocument } from './catalog'
import type { BindingDocument, PresentationSetting } from './types'
import type { TemplateInsertPreset } from '../template-core/presets'
import { requiresSharedCompiler } from './compilation'
import { getEmailPresets } from '../template-email/presets'
import { getEmailTemplateIssues } from '../template-email/profile'
import { getEmailSettingIssues } from '../template-email/settings'
import { EmailChecksPanel } from '../template-email/checks-panel'
import { WorkspaceModeControl } from './workspace-mode-control'
import { EMPTY_PREVIEW_SETTINGS, resolvePreviewSettings } from './preview-settings'
import { DocumentPaletteProvider } from '../voucher-builder/ui/color-picker'

export type TemplateWorkspaceDraft = Omit<BindingDocument, 'artifacts'>
export interface TemplateWorkspaceProps {
  /** Use a persistent right tools dock; the default retains the three-pane editor. */
  layout?: 'default' | 'compact'
  insertPresets?: TemplateInsertPreset[]
  /** Enables staff declarations in the complete creator inspector and panels. */
  familyAuthoring?: boolean
  sessionKey?: string
  initialSettings?: JsonObject
  previewAssets?: Record<string, string>
  initialDocument: BindingDocument
  creator?: TemplateCreatorInstance
  theme?: 'light' | 'dark'
  previewData?: JsonObject
  /** Reactive sample baseline; local personalization overrides take precedence. Never persisted. */
  previewSettings?: JsonObject
  mode?: 'design' | 'personalize'
  /** Hide the output selector for a host restricted to the loaded document target. Defaults to true. */
  allowTargetChange?: boolean
  onModeChange?: (mode: 'design' | 'personalize') => void
  onDraftChange?: (draft: TemplateWorkspaceDraft) => void
  onExport?: (document: BindingDocument) => void
  onPersonalizationChange?: (patch: { inputs: JsonObject; settings: JsonObject }) => void
  header?: Partial<Pick<PageHeaderProps, 'title' | 'description' | 'titleBadges' | 'primaryAction' | 'secondaryActions' | 'headingTag' | 'slots'>>
  headerControls?: ReactNode
}

/** Composes the existing complete workspaces; source and customer values remain separate. */
function TemplateWorkspaceSession({ layout = 'default', familyAuthoring = false, initialDocument, creator, theme = 'light', previewData = {}, previewSettings = EMPTY_PREVIEW_SETTINGS, mode: controlledMode, allowTargetChange = true, onModeChange, onDraftChange, onExport, onPersonalizationChange, header, headerControls, initialSettings = {}, previewAssets = {}, insertPresets }: TemplateWorkspaceProps) {
  const [definition, setDefinition] = useState(() => creator?.getTemplate() ?? initialDocument.source.definition)
  const [author] = useState(() => creator ?? createTemplateCreator({ initialTemplate: initialDocument.source.definition }))
  const definitionRef = useRef(definition)
  const workspaceRoot = useRef<HTMLDivElement>(null)
  const observer = useRef(onDraftChange)
  observer.current = onDraftChange
  const [metadata, setMetadata] = useState<BindingDocument>(() => hydrateTemplateDraft(initialDocument))
  const [ownMode, setOwnMode] = useState<'design' | 'personalize'>('design')
  const [settings, setSettings] = useState<JsonObject>(() => { resolvePresentationSettings(initialDocument.settingsSpec.map(field => ({ ...field, exposed: initialDocument.exposedSettings.includes(field.id), defaultValue: initialDocument.settingsDefaults[field.id] ?? field.defaultValue })), initialSettings); return structuredClone(initialSettings) })
  const [customerData, setCustomerData] = useState<JsonObject | null>(null)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const mode = controlledMode ?? ownMode
  const preview = useMemo(() => resolvePreviewSettings(metadata.settingsSpec.map(field => ({ ...field, exposed: metadata.exposedSettings.includes(field.id) })), metadata.settingsDefaults, previewSettings), [metadata.settingsSpec, metadata.exposedSettings, metadata.settingsDefaults, previewSettings])
  const emailIssues = useMemo(() => metadata.target === 'email' ? [...getEmailTemplateIssues(definition), ...getEmailSettingIssues(metadata.settingsSpec, { ...preview.defaults, ...(mode === 'personalize' ? settings : {}) })] : [], [metadata.target, definition, metadata.settingsSpec, preview.defaults, mode, settings])
  const selectMode = (next: 'design' | 'personalize') => { setOwnMode(next); onModeChange?.(next) }
  const editablePaths = useMemo(() => definition.fields.filter(field => field.editable && field.path.startsWith('inputs.') && (metadata.exposedInputs.includes(field.path.slice(7)) || !initialDocument.source.definition.fields.some(original => original.id === field.id))).map(field => field.path.slice(7)), [definition.fields, metadata.exposedInputs, initialDocument.source.definition.fields])
  const rendering = useMemo(() => ({ ...metadata.rendering!, engine: requiresSharedCompiler(definition, metadata.variationPoints) ? 'shared' as const : metadata.rendering!.engine }), [definition, metadata.rendering, metadata.variationPoints])
  const draft = useMemo(() => {
    const { artifacts: _, ...authored } = metadata
    return { ...authored, rendering, exposedInputs: editablePaths, source: { mode: 'standalone' as const, definition } }
  }, [definition, metadata, editablePaths, rendering])
  useEffect(() => { observer.current?.(draft) }, [draft])
  const transform = useCallback((source: TemplateDefinition) => {
    const prepared = applyPresentationSettings(applyTemplateTheme(source, metadata.theme, metadata.target), metadata.settingsSpec, mode === 'personalize' ? { ...preview.defaults, ...settings } : preview.defaults)
    for (const asset of prepared.assets) if (previewAssets[asset.id]) asset.url = previewAssets[asset.id]
    return prepared
  }, [metadata.target, metadata.theme, metadata.settingsSpec, preview.defaults, settings, mode, previewAssets])
  const authorData = useMemo(() => {
    const defaults = { content: metadata.content, inputs: metadata.inputDefaults }
    const data: JsonObject = {}
    for (const field of definition.fields) {
      const supplied = getValue(previewData, field.path)
      const value = supplied === undefined ? getValue(defaults, field.path) : supplied
      if (value !== undefined) setValue(data, field.path, value)
    }
    return data
  }, [definition.fields, previewData, metadata.content, metadata.inputDefaults])
  const initialData = useMemo(() => {
    const data = structuredClone(authorData)
    if (customerData) for (const field of definition.fields) {
      const value = field.editable ? getValue(customerData, field.path) : undefined
      if (value !== undefined) setValue(data, field.path, value)
    }
    return data
  }, [authorData, definition.fields, customerData])
  const patch = (data: JsonObject, appearance: JsonObject) => {
    const inputs: JsonObject = {}
    for (const path of editablePaths) { const value = getValue(data, `inputs.${path}`); if (value !== undefined) setValue(inputs, path, value) }
    return { inputs, settings: appearance }
  }
  const [customer, setCustomer] = useState<TemplateEditorInstance | null>(() => getTemplateIssues(definition).length ? null : createTemplateEditor({ template: definition, initialData }))
  useEffect(() => {
    if (getTemplateIssues(definition).length) return
    try {
      if (!customer) setCustomer(createTemplateEditor({ template: definition, initialData }))
      else if (stableJSONStringify(customer.getTemplate()) !== stableJSONStringify(definition)) customer.actions.load(definition, { data: initialData })
      else customer.actions.refreshTrustedData(authorData)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Repair the template before personalization.') }
  }, [definition, customer, authorData])
  const updateDefinition = (next: TemplateDefinition) => {
    const before = definitionRef.current
    definitionRef.current = next
    setDefinition(next)
    setMetadata(previous => reconcileSource(before, next, previous))
  }
  const setSpec = (spec: PresentationSetting[]) => {
    setMetadata(previous => reconcileSettings(previous, spec))
    setSettings(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => spec.some(field => field.id === id && field.exposed))))
  }
  const effectiveSpec = metadata.settingsSpec.map(field => ({ ...field, exposed: metadata.exposedSettings.includes(field.id) }))
  const exportTemplate = () => {
    try {
      if (workspaceRoot.current?.querySelector('[data-template-workspace-mode="design"] [aria-invalid="true"]')) throw new Error('Fix the highlighted fields before exporting.')
      if (familyAuthoring) materializeFamilyDocument({ ...metadata, source: { mode: 'standalone', definition } }, {})
      const output = recompileTemplateDocument({ ...metadata, rendering, exposedInputs: editablePaths }, definition); setExportError(''); if (onExport) onExport(output); else downloadJSON(output, `${definition.id}.template`) }
    catch (cause) { setExportError(cause instanceof Error ? cause.message : 'Unable to export the current template.') }
  }
  const modeControl = controlledMode === undefined ? <WorkspaceModeControl label="Workspace mode" value={mode} options={[{ value: 'design', label: 'Design' }, { value: 'personalize', label: 'Personalize' }]} onChange={selectMode} /> : undefined
  const actions = <Stack direction="horizontal" gap="sm" align="center" wrap>
    {headerControls}
    {allowTargetChange && <Select className="tc-target-select" aria-label="Output target" value={metadata.target} options={[{ value: 'document', label: 'Printable document' }, { value: 'email', label: 'Email' }]} onValueChange={value => { if (value === 'email' || value === 'document') setMetadata(previous => ({ ...previous, target: value })) }} />}
    {layout !== 'compact' && modeControl}
  </Stack>
  return <DocumentPaletteProvider colors={Object.values(metadata.theme.colors)}><Stack ref={workspaceRoot} gap="sm" data-template-workspace="">
    {preview.error && <Alert tone="destructive" role="alert"><AlertDescription>{preview.error}</AlertDescription></Alert>}
    {emailIssues.some(issue => issue.severity === 'error') && <Alert tone="warning"><AlertDescription>Email compatibility needs attention. Open Email checks to repair the template before export.</AlertDescription></Alert>}
    {(error || exportError) && <Alert tone="destructive" role="alert"><AlertDescription>{exportError || error}</AlertDescription></Alert>}
    <div hidden={mode !== 'design'} data-template-workspace-mode="design"><TemplateCreator instance={author} initialTemplate={definition} onChange={updateDefinition} fieldPathPrefix="inputs." theme={theme}
      layout={layout} canvasControls={layout === 'compact' ? modeControl : undefined}
      insertPresets={insertPresets ?? (metadata.target === 'email' ? getEmailPresets() : undefined)}
      previewTransform={transform} previewTarget={metadata.target} previewData={authorData}
      header={{ description: familyAuthoring ? 'Shared family template · Define the layout and allowed variant changes.' : metadata.target === 'email' ? 'Email template · Compose supported sections, content and personalization.' : 'Document template · Compose the layout and choose what customers can personalize.', primaryAction: { label: 'Export template', onClick: exportTemplate }, actions, ...header }}
      workspacePanels={[
        ...(metadata.target === 'email' ? [{ id: 'email-checks', label: 'Email checks', content: <EmailChecksPanel issues={emailIssues} /> }] : []),
        { id: 'document-theme', label: 'Theme', content: <TemplateThemePanel value={metadata.theme} onChange={value => setMetadata(previous => ({ ...previous, theme: value }))} /> },
        { id: 'appearance-settings', label: 'Customer settings', content: <AppearanceSettingsLibrary spec={effectiveSpec} onChange={setSpec} /> },
        ...(familyAuthoring ? [{ id: 'family-variations', label: 'Family variations', content: <FamilyVariationLibrary document={metadata} onChange={variationPoints => setMetadata(previous => ({ ...previous, variationPoints }))} /> }] : []),
      ]}
      inspectorFooter={<Stack gap="2xl"><SelectedAppearanceControls spec={effectiveSpec} onChange={setSpec} />{familyAuthoring && <FamilyVariationControls document={metadata} onChange={variationPoints => setMetadata(previous => ({ ...previous, variationPoints }))} />}</Stack>}
    /></div>
    <div hidden={mode !== 'personalize'} data-template-workspace-mode="personalize">{customer ? <TemplateEditor instance={customer} initialData={initialData} theme={theme} allowNodeOverrides={false}
      layout={layout} canvasControls={layout === 'compact' ? modeControl : undefined}
      fieldIds={definition.fields.filter(field => field.editable && editablePaths.includes(field.path.slice(7)) && field.path.startsWith('inputs.')).map(field => field.id)}
      previewTransform={transform} previewTarget={metadata.target}
      onChange={personalization => { setCustomerData(personalization.data); if (mode === 'personalize') onPersonalizationChange?.(patch(personalization.data, settings)) }}
      inspectorContent={<TemplateSettingsPanel defaults={preview.defaults} spec={metadata.settingsSpec.map(field => ({ ...field, exposed: metadata.exposedSettings.includes(field.id) }))} values={settings} onChange={value => { setSettings(value); onPersonalizationChange?.(patch(customerData ?? initialData, value)) }} />}
      header={{ actions, primaryAction: { label: 'Export personalization', onClick: () => downloadJSON(patch(customerData ?? initialData, settings), `${definition.id}.personalization`) }, secondaryActions: [], ...header }}
    /> : <Alert tone="warning"><AlertDescription>Repair the authoring contract before opening personalization.</AlertDescription></Alert>}</div>
  </Stack></DocumentPaletteProvider>
}

/** A backend identity/load epoch can reset a session atomically; local draft rerenders do not. */
export function TemplateWorkspace(props: TemplateWorkspaceProps) {
  return <TemplateWorkspaceSession key={props.sessionKey ?? props.initialDocument.source.definition.id} {...props} />
}
