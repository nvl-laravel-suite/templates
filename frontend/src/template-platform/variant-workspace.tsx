import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Button } from 'themelia-react-ui/base/buttons'
import { Badge } from 'themelia-react-ui/base/badge'
import { Stack } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'
import { Page, type PageHeaderProps } from 'themelia-react-ui/layout/page'
import { ThemeScope } from 'themelia-react-ui/ui-provider'
import { createTemplateEditor } from '../template-core/editing'
import { getValue, setValue, stableJSONStringify, validateJSONData } from '../template-core/contracts'
import type { JsonObject, JsonValue, TemplateDefinition, TemplateField } from '../template-core/schema'
import { TemplateCanvas } from '../template-creator/canvas'
import { TemplateEditor } from '../template-creator/TemplateEditor'
import { WorkspaceGrid, WorkspacePanel } from '../template-creator/workspace-panel'
import { InspectorSection } from '../template-creator/inspector-section'
import { DataInput } from '../template-creator/controls'
import { downloadJSON } from '../template-creator/downloads'
import { VoucherPortalContext } from '../voucher-builder/context'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'
import { SettingInput } from '../voucher-builder/builder/settings/primitives/setting-input'
import { materializeFamilyDocument } from './catalog'
import { TemplateSettingsPanel } from './settings-panel'
import { DocumentPaletteProvider } from '../voucher-builder/ui/color-picker'
import { applyPresentationSettings, resolvePresentationSettings } from './settings'
import { applyTemplateTheme } from './theme'
import { EmailChecksPanel } from '../template-email/checks-panel'
import { getEmailTemplateIssues } from '../template-email/profile'
import { getEmailSettingIssues } from '../template-email/settings'
import { isContentReference, validateAuthoredContent } from './references'
import { StructuralVariantEditor } from './structural-editor'
import type { BindingDocument, GroupVariantDocument } from './types'
import { WorkspaceModeControl } from './workspace-mode-control'
import { EMPTY_PREVIEW_SETTINGS, resolvePreviewSettings } from './preview-settings'

type VariantOverrides = GroupVariantDocument['source']['overrides']
type PersonalizationPatch = { inputs: JsonObject; settings: JsonObject }

export interface GroupVariantWorkspaceProps {
  /** Opt in to a single right-hand tools dock; the default retains three panels. */
  layout?: 'default' | 'compact'
  /** Change when loading a different variant or replacing its saved revision. */
  sessionKey?: string
  initialDocument: GroupVariantDocument
  effectiveDocument: BindingDocument
  /** The exact family revision identified by initialDocument.source.group. */
  familyDocument: BindingDocument
  mode?: 'staff' | 'customer'
  onModeChange?: (mode: 'staff' | 'customer') => void
  theme?: 'light' | 'dark'
  previewData?: JsonObject
  /** Reactive sample baseline; local customer overrides take precedence. Never persisted. */
  previewSettings?: JsonObject
  previewAssets?: Record<string, string>
  initialSettings?: JsonObject
  onDraftChange?: (draft: GroupVariantDocument) => void
  onExport?: (draft: GroupVariantDocument) => void
  onPersonalizationChange?: (patch: PersonalizationPatch) => void
  header?: Partial<Pick<PageHeaderProps, 'title' | 'description' | 'titleBadges' | 'primaryAction' | 'secondaryActions' | 'headingTag' | 'slots'>>
}

function rawVariant(document: GroupVariantDocument): GroupVariantDocument {
  const overrides: VariantOverrides = {}
  for (const key of ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings', 'variations'] as const) {
    if (document.source.overrides[key] !== undefined) Object.assign(overrides, { [key]: structuredClone(document.source.overrides[key]) })
  }
  return { format: 'template-document', schemaVersion: 1, target: document.target, source: { mode: 'group-variant', group: { id: document.source.group.id, revision: document.source.group.revision }, overrides } }
}

function resolveVariant(family: BindingDocument, overrides: VariantOverrides) {
  const inherited = materializeFamilyDocument(family, overrides)
  const contentSchema = family.dataSchema.properties.content
  if (contentSchema) {
    const issues = validateAuthoredContent(contentSchema, inherited.content)
    if (issues.length) throw new Error(`Content: ${issues[0].message}`)
  }
  resolvePresentationSettings(family.settingsSpec, inherited.settingsDefaults, false)
  return inherited
}

/** Resolved data supplies references; authored literals always remain authoritative. */
function previewContentValue(authored: JsonValue | undefined, supplied: JsonValue | undefined): JsonValue | undefined {
  if (isContentReference(authored)) return supplied
  if (Array.isArray(authored)) return authored.map((item, index) => previewContentValue(item, Array.isArray(supplied) ? supplied[index] : undefined) ?? null)
  if (authored && typeof authored === 'object') return Object.fromEntries(Object.entries(authored).flatMap(([key, value]) => {
    const next = previewContentValue(value, supplied && typeof supplied === 'object' && !Array.isArray(supplied) ? supplied[key] : undefined)
    return next === undefined ? [] : [[key, next]]
  }))
  return authored
}

function GroupVariantSession({ initialDocument, effectiveDocument, familyDocument, mode: controlledMode, onModeChange, theme = 'light', previewData = {}, previewSettings = EMPTY_PREVIEW_SETTINGS, previewAssets = {}, initialSettings = {}, onDraftChange, onExport, onPersonalizationChange, header, layout = 'default' }: GroupVariantWorkspaceProps) {
  const [draft, setDraft] = useState(() => rawVariant(initialDocument))
  const observer = useRef(onDraftChange)
  observer.current = onDraftChange
  useEffect(() => { observer.current?.(structuredClone(draft)) }, [draft])
  const [ownMode, setOwnMode] = useState<'staff' | 'customer'>('staff')
  const mode = controlledMode ?? ownMode
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const inherited = useMemo(() => resolveVariant(familyDocument, draft.source.overrides), [familyDocument, draft])
  const document = useMemo(() => ({ ...inherited, source: { mode: 'standalone' as const, definition: { ...inherited.source.definition, id: effectiveDocument.source.definition.id, name: effectiveDocument.source.definition.name, locale: effectiveDocument.source.definition.locale } } }), [effectiveDocument, inherited])
  const previewContent = useMemo(() => previewContentValue(document.content, previewData.content) as JsonObject, [document.content, previewData.content])
  const visibleSpec = useMemo(() => document.settingsSpec.map(field => ({ ...field, exposed: document.exposedSettings.includes(field.id), defaultValue: document.settingsDefaults[field.id] ?? field.defaultValue })), [document.settingsSpec, document.exposedSettings, document.settingsDefaults])
  const preview = useMemo(() => resolvePreviewSettings(visibleSpec, document.settingsDefaults, previewSettings), [visibleSpec, document.settingsDefaults, previewSettings])
  const [settings, setSettings] = useState<JsonObject>(() => {
    resolvePresentationSettings(visibleSpec, initialSettings)
    return structuredClone(initialSettings)
  })
  const customerSettings = useMemo(() => Object.fromEntries(Object.entries(settings).filter(([id]) => document.exposedSettings.includes(id))), [settings, document.exposedSettings])
  const protectedDefinition = useMemo(() => ({ ...document.source.definition, fields: document.source.definition.fields.map(field => ({ ...field, editable: field.editable && field.path.startsWith('inputs.') && document.exposedInputs.includes(field.path.slice(7)) })) }), [document.source.definition, document.exposedInputs])
  const trustedData = useMemo(() => {
    const data: JsonObject = {}
    for (const field of protectedDefinition.fields) {
      const authored = { content: previewContent, inputs: document.inputDefaults }
      const supplied = getValue(previewData, field.path)
      const value = field.path.startsWith('content.') ? getValue(authored, field.path) : supplied === undefined ? getValue(authored, field.path) : supplied
      if (value !== undefined) setValue(data, field.path, value)
    }
    return data
  }, [protectedDefinition.fields, previewContent, document.inputDefaults, previewData])
  const [customer] = useState(() => createTemplateEditor({ template: protectedDefinition, initialData: trustedData }))
  useEffect(() => {
    try {
      const previous = customer.getTemplate()
      if (stableJSONStringify(previous) !== stableJSONStringify(protectedDefinition)) {
        const data = structuredClone(trustedData)
        const previousData = customer.getPersonalization().data
        for (const field of protectedDefinition.fields) if (field.editable && previous.fields.some(item => item.id === field.id && item.editable)) {
          const value = getValue(previousData, field.path)
          if (value !== undefined) setValue(data, field.path, value)
        }
        customer.actions.load(protectedDefinition, { data })
      } else customer.actions.refreshTrustedData(trustedData)
      setRefreshError('')
    } catch (cause) { setRefreshError(cause instanceof Error ? cause.message : 'Unable to refresh the document values.') }
  }, [customer, protectedDefinition, trustedData])
  const patch = (data: JsonObject, values = customerSettings): PersonalizationPatch => {
    const inputs: JsonObject = {}
    for (const field of protectedDefinition.fields) if (field.editable) {
      const value = getValue(data, field.path)
      if (value !== undefined) setValue(inputs, field.path.slice(7), value)
    }
    return { inputs, settings: structuredClone(values) }
  }
  const updateOverrides = (next: VariantOverrides) => {
    resolveVariant(familyDocument, next)
    setDraft(previous => ({ ...previous, source: { ...previous.source, overrides: next } }))
  }
  const updateValues = (key: 'content' | 'settingsDefaults', values: JsonObject) => {
    const next = { ...draft.source.overrides }
    if (Object.keys(values).length) next[key] = values
    else delete next[key]
    updateOverrides(next)
  }
  const reset = (key: keyof VariantOverrides) => { const next = { ...draft.source.overrides }; delete next[key]; updateOverrides(next) }
  const transform = useCallback((source: TemplateDefinition, values: JsonObject) => {
    const prepared = applyPresentationSettings(applyTemplateTheme(source, document.theme, document.target), document.settingsSpec, { ...preview.defaults, ...values })
    for (const asset of prepared.assets) if (previewAssets[asset.id]) asset.url = previewAssets[asset.id]
    return prepared
  }, [document.target, document.theme, document.settingsSpec, preview.defaults, previewAssets])
  const authorTransform = useCallback((source: TemplateDefinition) => transform(source, {}), [transform])
  const customerTransform = useCallback((source: TemplateDefinition) => transform(source, customerSettings), [transform, customerSettings])
  const exportDraft = () => {
    try {
      if (root.current?.querySelector('[data-variant-mode="staff"] [aria-invalid="true"]')) throw new Error('Fix the highlighted values before exporting.')
      resolveVariant(familyDocument, draft.source.overrides)
      setError('')
      if (onExport) onExport(structuredClone(draft))
      else downloadJSON(draft, `${draft.source.group.id}.variant`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export this variant.') }
  }
  const contentSchema = familyDocument.dataSchema.properties.content
  const contentFields: TemplateField[] = contentSchema?.type === 'object' ? Object.entries(contentSchema.properties).map(([key, schema]) => {
    const declared = effectiveDocument.source.definition.fields.find(field => field.path === `content.${key}`)
    return { id: key, path: `content.${key}`, label: declared?.label ?? key, description: declared?.description ?? '', schema, required: contentSchema.required?.includes(key) ?? false, editable: true }
  }) : []
  const permissions = (key: 'exposedInputs' | 'exposedSettings', label: string) => <SettingBlock label={label} description="Choose which family controls customers may edit." action={<Button size="sm" aria-label={key === 'exposedInputs' ? 'Reset input permissions' : 'Reset appearance permissions'} disabled={draft.source.overrides[key] === undefined} onClick={() => reset(key)}>Reset</Button>}>
    {!familyDocument[key].length && <Text type="secondary">The family exposes no controls in this section.</Text>}
    {familyDocument[key].map(id => {
      const name = key === 'exposedInputs' ? familyDocument.source.definition.fields.find(field => field.path === `inputs.${id}`)?.label ?? id : familyDocument.settingsSpec.find(field => field.id === id)?.label ?? id
      return <SettingInput key={id} type="switch" label={`${key === 'exposedInputs' ? 'Customer may edit' : 'Customer may change'} ${name}`} value={document[key].includes(id)} onChange={allowed => updateOverrides({ ...draft.source.overrides, [key]: familyDocument[key].filter(item => item === id ? allowed : document[key].includes(item)) })} />
    })}
  </SettingBlock>
  const contentControls = <Stack gap="xl">
              {!contentFields.length && <Text type="secondary">The family declares no authored content fields.</Text>}
              {contentFields.map(field => <SettingBlock key={field.id} label={field.label} hint={<Badge size="sm">{Object.hasOwn(draft.source.overrides.content ?? {}, field.id) ? 'Customized' : 'Inherited'}</Badge>} action={<Button buttonStyle="ghost" size="sm" aria-label={`Reset content ${field.label}`} disabled={!Object.hasOwn(draft.source.overrides.content ?? {}, field.id)} onClick={() => { const values = { ...draft.source.overrides.content }; delete values[field.id]; updateValues('content', values) }}>Use family</Button>}>
                <DataInput field={field} value={previewContent[field.id]} onChange={(value: JsonValue | undefined) => {
                  const next = value === undefined && field.schema.type === 'string' ? '' : value
                  const issues = validateJSONData(field.schema, next)
                  if (issues.length) throw new Error(`${field.label}: ${issues[0].message}`)
                  if (next === undefined) throw new Error('Use Reset to inherit the family value.')
                  updateValues('content', { ...draft.source.overrides.content, [field.id]: next })
                }} />
              </SettingBlock>)}
  </Stack>
  const appearanceControls = <Stack gap="lg"><Text size="sm" type="secondary">Use default to inherit the pinned family’s appearance.</Text><TemplateSettingsPanel spec={familyDocument.settingsSpec.map(field => ({ ...field, exposed: true }))} defaults={familyDocument.settingsDefaults} values={draft.source.overrides.settingsDefaults ?? {}} onChange={values => updateValues('settingsDefaults', values)} /></Stack>
  const modeControls = controlledMode === undefined ? <WorkspaceModeControl label="Variant workspace" value={mode} options={[{ value: 'staff', label: 'Variant' }, { value: 'customer', label: 'Customer preview' }]} onChange={value => { setOwnMode(value); onModeChange?.(value) }} /> : undefined
  return <Stack ref={root} gap="sm" data-template-workspace="">
    {preview.error && <Alert tone="destructive" role="alert"><AlertDescription>{preview.error}</AlertDescription></Alert>}
    {document.target === 'email' && [...getEmailTemplateIssues(document.source.definition), ...getEmailSettingIssues(document.settingsSpec, { ...preview.defaults, ...(mode === 'customer' ? customerSettings : {}) })].some(issue => issue.severity === 'error') && <Alert tone="warning"><AlertDescription>Email compatibility needs attention. Repair the family or the allowed variation before export.</AlertDescription></Alert>}
    {(error || refreshError) && <Alert tone="destructive" role="alert"><AlertDescription>{error || refreshError}</AlertDescription></Alert>}
    <div hidden={mode !== 'staff'} data-variant-mode="staff" className="tc-shell">
      {(familyDocument.variationPoints?.length ?? 0) > 0 ? <StructuralVariantEditor family={familyDocument} document={document} overrides={draft.source.overrides} onChange={updateOverrides} theme={theme} layout={layout} previewData={trustedData} previewTransform={authorTransform} previewSettings={preview.defaults} modeControls={modeControls}
        panels={{ content: contentControls, settings: appearanceControls, permissions: <>{permissions('exposedInputs', 'Customer inputs')}{permissions('exposedSettings', 'Customer appearance')}</> }}
        header={{ title: document.source.definition.name, description: `Family revision ${draft.source.group.revision} · Customize the allowed parts of this variant`, primaryAction: { label: 'Export variant', onClick: exportDraft }, secondaryActions: [], ...header }} /> : <VoucherPortalContext.Provider value={portal}><ThemeScope ref={setPortal} className={`tc-workspace ${theme}`}>
        <Page className="tc-page" maxWidth="full" gutter="md" padding="md" slotProps={{ body: { className: 'tc-page-body' } }} header={{ title: effectiveDocument.source.definition.name, description: `Family revision ${draft.source.group.revision} · Customize the allowed parts of this variant`, primaryAction: { label: 'Export variant', onClick: exportDraft }, actions: layout === 'compact' ? undefined : modeControls, ...header }}>
          <WorkspaceGrid prioritizeInspector layout={layout} dockLabels={{ sidebar: 'Content', inspector: 'Settings' }}>
            <WorkspacePanel area="sidebar"><aside className="tc-sidebar" aria-label="Variant content">
              <Stack direction="horizontal" align="center" justify="between" gap="lg" className="tc-panel-heading">
                <Heading tag="h2" size="sm">Content</Heading>
                {contentFields.length > 0 && <Text tag="span" type="secondary">{contentFields.length} {contentFields.length === 1 ? 'field' : 'fields'}</Text>}
              </Stack>
              <Text type="secondary" className="tc-panel-intro">Layout is inherited from the family. Update this variant’s content below.</Text>
              <Stack gap="2xl" className="tc-panel-content">{contentControls}</Stack>
            </aside></WorkspacePanel>
            <WorkspacePanel area="design"><div className="tc-design">
              <Stack direction="horizontal" align="center" justify="between" gap="sm" className="tc-toolbar">
                {layout === 'compact' && modeControls ? modeControls : <Heading tag="h2" size="sm">Preview</Heading>}
                <Text type="secondary" className="tc-toolbar-context">Family layout · Variant content and defaults</Text>
              </Stack>
              <TemplateCanvas template={effectiveDocument.source.definition} previewTransform={authorTransform} target={effectiveDocument.target} data={trustedData} selectedId={null} onSelect={() => {}} />
            </div></WorkspacePanel>
            <WorkspacePanel area="inspector"><aside className="tc-inspector" aria-label="Variant defaults and permissions">
              <Stack direction="horizontal" align="center" justify="between" gap="lg" className="tc-panel-heading">
                <Heading tag="h2" size="sm">Variant settings</Heading>
              </Stack>
              <Stack gap="2xl" className="tc-inspector-scroll">
                <InspectorSection title="Default appearance" defaultOpen>
                  <Text type="secondary">Reset a value to inherit the pinned family default.</Text>
                  <TemplateSettingsPanel spec={familyDocument.settingsSpec.map(field => ({ ...field, exposed: true }))} defaults={familyDocument.settingsDefaults} values={draft.source.overrides.settingsDefaults ?? {}} onChange={values => updateValues('settingsDefaults', values)} />
                </InspectorSection>
                <InspectorSection title="Customer access">
                  {permissions('exposedInputs', 'Customer inputs')}{permissions('exposedSettings', 'Customer appearance')}
                </InspectorSection>
                {document.target === 'email' && <InspectorSection title="Email checks" defaultOpen><EmailChecksPanel issues={[...getEmailTemplateIssues(document.source.definition), ...getEmailSettingIssues(document.settingsSpec, preview.defaults)]} /></InspectorSection>}
              </Stack>
            </aside></WorkspacePanel>
          </WorkspaceGrid>
        </Page>
      </ThemeScope></VoucherPortalContext.Provider>}
    </div>
    <div hidden={mode !== 'customer'} data-variant-mode="customer"><TemplateEditor instance={customer} theme={theme} layout={layout} canvasControls={layout === 'compact' ? modeControls : undefined} allowNodeOverrides={false} fieldIds={protectedDefinition.fields.filter(field => field.editable).map(field => field.id)}
      previewTransform={customerTransform} previewTarget={effectiveDocument.target}
      onChange={personalization => { if (mode === 'customer') onPersonalizationChange?.(patch(personalization.data)) }}
      inspectorContent={<TemplateSettingsPanel defaults={preview.defaults} spec={visibleSpec} values={customerSettings} onChange={values => { setSettings(values); onPersonalizationChange?.(patch(customer.getPersonalization().data, values)) }} />}
      header={{ actions: layout === 'compact' ? undefined : modeControls, primaryAction: { label: 'Export personalization', onClick: () => downloadJSON(patch(customer.getPersonalization().data), `${draft.source.group.id}.personalization`) }, secondaryActions: [], ...header }}
    /></div>
  </Stack>
}

function ValidatedGroupVariantSession(props: GroupVariantWorkspaceProps) {
  const [error] = useState(() => {
    try {
      if (props.initialDocument.target !== props.familyDocument.target || props.effectiveDocument.target !== props.familyDocument.target) throw new Error('A variant must use its pinned family output target.')
      const inherited = resolveVariant(props.familyDocument, props.initialDocument.source.overrides)
      resolvePresentationSettings(props.effectiveDocument.settingsSpec.map(field => ({ ...field, exposed: inherited.exposedSettings.includes(field.id), defaultValue: inherited.settingsDefaults[field.id] ?? field.defaultValue })), props.initialSettings ?? {})
      return ''
    } catch (cause) { return cause instanceof Error ? cause.message : 'Unable to open this family variant.' }
  })
  return error ? <Alert tone="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : <GroupVariantSession {...props} />
}

/** Consumes a pinned family graph while saving only raw variant authority. */
export function GroupVariantWorkspace(props: GroupVariantWorkspaceProps) {
  const group = props.initialDocument.source.group
  return <DocumentPaletteProvider colors={Object.values(props.effectiveDocument.theme.colors)}><ValidatedGroupVariantSession key={`${props.sessionKey ?? props.effectiveDocument.source.definition.id}:${group.id}:${group.revision}`} {...props} /></DocumentPaletteProvider>
}
