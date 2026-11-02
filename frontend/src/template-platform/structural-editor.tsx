import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from 'themelia-react-ui/base/buttons'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Badge } from 'themelia-react-ui/base/badge'
import { Item } from 'themelia-react-ui/base/item'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import type { PageHeaderProps } from 'themelia-react-ui/layout/page'
import { createTemplateCreator, getCreatorRuntime } from '../template-core/editing'
import { createTemplateNode } from '../template-core/defaults'
import { getTemplateBlockField } from '../template-core/blocks'
import { childIds } from '../template-core/validation'
import { templateNodeLabel } from '../template-core/labels'
import { stableJSONStringify } from '../template-core/contracts'
import { useDraftReveal } from '../shared/draft-validation'
import type { JsonObject, JsonValue, TemplateBlock, TemplateDefinition, TemplateNode, TemplateValue } from '../template-core/schema'
import { TemplateCreator } from '../template-creator/TemplateCreator'
import { EmailChecksPanel } from '../template-email/checks-panel'
import { getEmailTemplateIssues } from '../template-email/profile'
import { getEmailSettingIssues } from '../template-email/settings'
import { DataInput, JsonInput, ValueInput } from '../template-creator/controls'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'
import { deriveFamilyOverrides } from './family-structure'
import { materializeFamilyDocument } from './catalog'
import type { BindingDocument, FamilyOverrides, FamilyVariationOverride, FamilyVariationPoint } from './types'

type ChildrenPoint = Extract<FamilyVariationPoint, { kind: 'children' }>
type PlacementPoint = Extract<FamilyVariationPoint, { kind: 'placement' }>
type CreatableKind = 'element' | 'text' | 'repeat' | 'condition'
type VariationAuthority = NonNullable<FamilyOverrides['variations']>
const creatableKinds: CreatableKind[] = ['element', 'text', 'repeat', 'condition']
const pointKinds: Record<FamilyVariationPoint['kind'], string> = { 'node-property': 'Element property', 'node-style': 'Appearance', 'block-property': 'Block property', placement: 'Replacement', children: 'Section order' }
function pointTarget(point: FamilyVariationPoint, definition: TemplateDefinition): string {
 const id = 'nodeId' in point ? point.nodeId : point.target.kind === 'roots' ? null : point.target.nodeId
 const node = id ? definition.nodes[id] : null
 const label = node ? templateNodeLabel(node) : 'Document sections'
 return point.kind === 'children' && point.target.kind === 'block-slot' ? `${label} · ${point.target.slot} slot` : label
}
function sequence(definition: TemplateDefinition, point: ChildrenPoint): string[] {
 const target = point.target
 if (target.kind === 'roots') return definition.roots
 const node = definition.nodes[target.nodeId]
 if (target.kind === 'block-slot') return node?.kind === 'block' ? node.slots[target.slot] ?? [] : []
 return node && 'children' in node ? node.children : []
}
function setSequence(definition: TemplateDefinition, point: ChildrenPoint, order: string[]) {
 const target = point.target
 if (target.kind === 'roots') definition.roots = order
 else {
  const node = definition.nodes[target.nodeId]
  if (target.kind === 'block-slot' && node?.kind === 'block') node.slots[target.slot] = order
  else if (node && 'children' in node) node.children = order
 }
}
function closure(definition: TemplateDefinition, roots: string[]): Set<string> {
 const result = new Set<string>()
 const visit = (id: string) => { if (result.has(id)) return; result.add(id); const node = definition.nodes[id]; if (node) childIds(node).forEach(visit) }
 roots.forEach(visit)
 return result
}
function owned(definition: TemplateDefinition, point: FamilyVariationPoint): Set<string> {
 return closure(definition, point.kind === 'placement' ? [point.nodeId] : point.kind === 'children' ? sequence(definition, point) : [])
}
/** Delete only displaced owned nodes which the new canonical graph no longer references. */
function prune(definition: TemplateDefinition, displaced: Set<string>) {
 const reachable = closure(definition, definition.roots)
 for (const id of displaced) if (!reachable.has(id)) delete definition.nodes[id]
}

/** Required block inputs are prepared before the single guarded insertion/replacement. */
function BlockVariationAction({ block, definition, label, disabled, onCreate }: {
 block: TemplateBlock; definition: TemplateDefinition; label: string; disabled: boolean
 onCreate: (props: Record<string, TemplateValue>) => void
}) {
 const fields = useRef<HTMLDivElement>(null)
 const [error, setError] = useState('')
 const [props, setProps] = useState<Record<string, TemplateValue>>(() => {
  const existing = Object.values(definition.nodes).find(node => node.kind === 'block' && node.blockId === block.id && node.version === block.version)
  if (existing?.kind === 'block') return structuredClone(existing.props)
  return Object.fromEntries(Object.keys(block.props).flatMap(name => { const field = getTemplateBlockField(definition, block, name); return field ? [[name, { source: 'field' as const, fieldId: field.id }]] : [] }))
 })
 const create = () => {
  if (fields.current?.querySelector('[aria-invalid="true"]')) { setError('Fix the highlighted block properties before adding or replacing a block.'); return }
  setError(''); onCreate(props)
 }
 return <div ref={fields}><SettingBlock label={`${block.name} v${block.version}`}>
  {error && <Alert tone="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
  {Object.keys(block.props).map(name => <SettingBlock key={name} label={block.propertyMetadata?.[name]?.label ?? name}>
   <ValueInput fields={definition.fields} assets={definition.assets} literalSchema={block.props[name]} value={props[name] ?? { source: 'literal', value: block.propertyMetadata?.[name]?.defaultValue ?? '' }} onChange={value => setProps(previous => ({ ...previous, [name]: value }))} />
  </SettingBlock>)}
  <Button size="sm" aria-label={label} disabled={disabled} onClick={create}>{label}</Button>
 </SettingBlock></div>
}

export interface StructuralVariantEditorProps {
 layout?: 'default' | 'compact'
 family: BindingDocument; document: BindingDocument; overrides: FamilyOverrides; onChange: (overrides: FamilyOverrides) => void
 panels: { content: ReactNode; settings: ReactNode; permissions: ReactNode }; theme: 'light' | 'dark'; previewData: JsonObject
 previewTransform: (definition: TemplateDefinition) => TemplateDefinition
 previewSettings?: JsonObject
 header: Partial<PageHeaderProps>; modeControls: ReactNode
}
/** The canonical creator edits a projection. Its transaction guard keeps only declared deltas. */
export function StructuralVariantEditor({ family, document, overrides, onChange, panels, theme, previewData, previewTransform, previewSettings, header, modeControls, layout = 'default' }: StructuralVariantEditorProps) {
 const base = { ...family, source: { mode: 'standalone' as const, definition: { ...family.source.definition, id: document.source.definition.id, name: document.source.definition.name, locale: document.source.definition.locale } } }
 const current = useRef({ base, document, overrides, onChange }); current.current = { base, document, overrides, onChange }
 const deliberate = useRef<VariationAuthority>(structuredClone(overrides.variations ?? {}))
 // Native history stores distinct snapshot identities even when a manual edit
 // returns to an inherited-equivalent graph. Keep raw authority beside those snapshots.
 const authority = useRef(new WeakMap<TemplateDefinition, VariationAuthority>())
 const pendingAuthority = useRef<VariationAuthority | undefined>(undefined)
 const [controlError, setControlError] = useState('')
 const points = family.variationPoints ?? []
 const [pointId, setPointId] = useState(points[0]?.id)
 const selectedPoint = points.find(point => point.id === pointId) ?? points[0]
 const [variationFields, setVariationFields] = useState<HTMLDivElement | null>(null)
 const [invalidPoints, setInvalidPoints] = useState<string[]>([])
 useEffect(() => {
  if (!variationFields) return
  const update = () => {
   const invalid = [...variationFields.querySelectorAll<HTMLElement>('[data-variation-point]')]
    .filter(node => node.querySelector('[aria-invalid="true"]'))
    .map(node => node.dataset.variationPoint!)
   setInvalidPoints(previous => previous.length === invalid.length && previous.every((id, index) => id === invalid[index]) ? previous : invalid)
  }
  update()
  // Inputs own validation. Mirror their existing marker only for navigation feedback.
  const observer = new MutationObserver(update)
  observer.observe(variationFields, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] })
  return () => observer.disconnect()
 }, [variationFields])
 const [creator] = useState(() => {
  const instance = createTemplateCreator({ initialTemplate: document.source.definition, validateChange: (_before, next, operation) => {
   const value = current.current, history = getCreatorRuntime(instance).store.getState()
   const target = operation === 'undo' ? history.undo.at(-1) : operation === 'redo' ? history.redo.at(-1) : undefined
   const explicit = target ? authority.current.get(target) ?? {} : deliberate.current
   deriveFamilyOverrides(value.base, { ...value.document, source: { mode: 'standalone', definition: next } }, { ...value.overrides, variations: explicit })
   pendingAuthority.current = explicit
  } })
  authority.current.set(getCreatorRuntime(instance).store.getState().template, structuredClone(deliberate.current))
  const first = points[0]
  if (first) instance.actions.select('nodeId' in first ? first.nodeId : first.target.kind === 'roots' ? null : first.target.nodeId)
  return instance
 })
 const selectPoint = (point: FamilyVariationPoint) => {
  setPointId(point.id)
  creator.actions.select('nodeId' in point ? point.nodeId : point.target.kind === 'roots' ? null : point.target.nodeId)
 }
 useDraftReveal(variationFields, event => {
  if (!(event.target instanceof Element)) return
  const id = event.target.closest<HTMLElement>('[data-variation-point]')?.dataset.variationPoint
  const point = points.find(point => point.id === id)
  if (point) selectPoint(point)
 })
 const changed = (definition: TemplateDefinition) => {
  const value = current.current
  const explicit = pendingAuthority.current ?? deliberate.current
  const next = deriveFamilyOverrides(value.base, { ...value.document, source: { mode: 'standalone', definition } }, { ...value.overrides, variations: explicit })
  deliberate.current = explicit
  pendingAuthority.current = undefined
  authority.current.set(getCreatorRuntime(creator).store.getState().template, structuredClone(explicit))
  if (!Object.keys(next.variations ?? {}).length) delete next.variations
  value.onChange(next)
 }
 const commitVariation = (point: FamilyVariationPoint, patch: FamilyVariationOverride | undefined) => {
  const value = current.current
  const variations = { ...value.overrides.variations }
  if (patch) variations[point.id] = patch
  else delete variations[point.id]
  const next = { ...value.overrides, ...(Object.keys(variations).length ? { variations } : { variations: undefined }) }
  if (!next.variations) delete next.variations
  const projection = materializeFamilyDocument(value.base, next)
  const before = deliberate.current
  const explicit = { ...before }
  if (patch) explicit[point.id] = patch
  else delete explicit[point.id]
  deliberate.current = explicit
  try {
   if (stableJSONStringify(creator.getTemplate()) === stableJSONStringify(projection.source.definition)) {
    authority.current.set(getCreatorRuntime(creator).store.getState().template, structuredClone(explicit))
    value.onChange(next)
   }
   else creator.actions.edit(draft => Object.assign(draft, projection.source.definition))
   setControlError('')
  } catch (cause) { deliberate.current = before; pendingAuthority.current = undefined; throw cause }
 }
 const report = (cause: unknown) => setControlError(cause instanceof Error ? cause.message : 'This change is not allowed by the family.')
 const attempt = (action: () => void) => { try { action(); setControlError('') } catch (cause) { report(cause) } }
 const setVariation = (point: FamilyVariationPoint, patch: FamilyVariationOverride | undefined) => attempt(() => commitVariation(point, patch))
 const newNode = (kind: CreatableKind | TemplateBlock, props?: Record<string, TemplateValue>): TemplateNode => {
  if (typeof kind === 'string') return createTemplateNode(kind, 'div')
  // Use the existing registered-block constructor, including its field bindings.
  const scratch = createTemplateCreator({ initialTemplate: creator.getTemplate() })
  try { const id = scratch.actions.insertBlock(kind.id, kind.version); const node = structuredClone(scratch.getTemplate().nodes[id]); if (node.kind === 'block' && props) node.props = structuredClone(props); return node }
  finally { scratch.destroy() }
 }
 const insertChild = (point: ChildrenPoint, kind: CreatableKind | TemplateBlock, props?: Record<string, TemplateValue>) => attempt(() => {
  const node = newNode(kind, props)
  creator.actions.edit(draft => { draft.nodes[node.id] = node; setSequence(draft, point, [...sequence(draft, point), node.id]) })
  creator.actions.select(node.id)
 })
 const editOrder = (point: ChildrenPoint, order: string[]) => attempt(() => creator.actions.edit(draft => {
  const displaced = owned(draft, point)
  setSequence(draft, point, order)
  prune(draft, displaced)
 }))
 const replace = (point: PlacementPoint, kind: CreatableKind | TemplateBlock, props?: Record<string, TemplateValue>) => attempt(() => {
  const node = { ...newNode(kind, props), id: point.nodeId }
  creator.actions.edit(draft => { const displaced = owned(draft, point); draft.nodes[point.nodeId] = node; prune(draft, displaced) })
  creator.actions.select(point.nodeId)
 })
 const structures = (point: ChildrenPoint | PlacementPoint) => {
  const order = point.kind === 'children' ? sequence(document.source.definition, point) : []
  const blocks = document.source.definition.blocks.filter(block => point.allowedKinds.includes('block') && (point.kind !== 'placement' || !point.allowedBlocks || point.allowedBlocks.some(pin => pin.id === block.id && pin.version === block.version)))
  return <Stack gap="sm">
   <Text size="sm" type="secondary">{point.kind === 'children' ? `${order.length} sections · ${point.minItems}–${point.maxItems} allowed` : 'Replace this element and its contents. You can undo the change or use the family version again.'}</Text>
   {point.kind === 'children' && order.map((id, index) => <Item key={id} density="compact" className="flex-nowrap" title={document.source.definition.nodes[id] ? templateNodeLabel(document.source.definition.nodes[id]) : id} description={point.requiredIds?.includes(id) ? 'Required by family' : undefined} actions={<Stack direction="horizontal" gap="xs">
    <Button size="sm" iconOnly withTooltip="Move up" aria-label={`Move ${point.label} item ${index + 1} up`} disabled={index === 0} onClick={() => { const next = [...order]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; editOrder(point, next) }}><ArrowUp /></Button>
    <Button size="sm" iconOnly withTooltip="Move down" aria-label={`Move ${point.label} item ${index + 1} down`} disabled={index === order.length - 1} onClick={() => { const next = [...order]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; editOrder(point, next) }}><ArrowDown /></Button>
    <Button size="sm" iconOnly withTooltip="Remove section" aria-label={`Remove ${point.label} item ${index + 1}`} disabled={order.length <= point.minItems || point.requiredIds?.includes(id)} onClick={() => editOrder(point, order.filter(item => item !== id))}><Trash2 /></Button>
   </Stack>} />)}
   {point.kind === 'children' && !order.length && <Text size="sm" type="secondary">{point.target.kind === 'block-slot' && !Object.hasOwn((document.source.definition.nodes[point.target.nodeId] as Extract<TemplateNode, { kind: 'block' }>).slots, point.target.slot) ? 'Using the block’s default content. Add a section to customize this slot.' : 'No sections. Add one below, or use the family version.'}</Text>}
   <Text size="sm" weight="medium">{point.kind === 'children' ? 'Add a section' : 'Replace with'}</Text>
   <Stack direction="horizontal" gap="sm" wrap>{creatableKinds.filter(kind => point.allowedKinds.includes(kind)).map(kind => <Button key={kind} size="sm" aria-label={point.kind === 'children' ? `Add ${kind} to ${point.label}` : `Replace ${point.label} with ${kind}`} disabled={point.kind === 'children' && order.length >= point.maxItems} onClick={() => point.kind === 'children' ? insertChild(point, kind) : replace(point, kind)}>{kind === 'element' ? 'Element' : kind === 'text' ? 'Text' : kind === 'repeat' ? 'Repeat' : 'Condition'}</Button>)}</Stack>
   {blocks.map(block => <BlockVariationAction key={`${block.id}@${block.version}`} block={block} definition={document.source.definition} label={point.kind === 'children' ? `Add ${block.name} v${block.version} to ${point.label}` : `Replace ${point.label} with ${block.name} v${block.version}`} disabled={point.kind === 'children' && order.length >= point.maxItems} onCreate={props => point.kind === 'children' ? insertChild(point, block, props) : replace(point, block, props)} />)}
  </Stack>
 }
 const controls = (selection: TemplateNode | null, all = false, selectedId?: string) => <Stack gap="lg">
  {!selectedId && <Text type="secondary">Select an allowed change to customize this variant. Everything else follows the family.</Text>}
  {controlError && <Alert tone="destructive" role="alert"><AlertDescription>{controlError}</AlertDescription></Alert>}
  {points.filter(point => (!selectedId || point.id === selectedId) && (all || ('nodeId' in point && point.nodeId === selection?.id) || (point.kind === 'children' && point.target.kind !== 'roots' && point.target.nodeId === selection?.id))).map(point => {
   const local = Object.hasOwn(overrides.variations ?? {}, point.id)
   const node = 'nodeId' in point ? document.source.definition.nodes[point.nodeId] : null
   const value = point.kind === 'node-style' && node?.kind === 'element' ? node.style[point.property] : point.kind === 'node-property' && node ? (node as unknown as Record<string, JsonValue>)[point.property] : undefined
   const block = node?.kind === 'block' ? document.source.definition.blocks.find(block => block.id === node.blockId && block.version === node.version) : undefined
   const defaultValue = point.kind === 'block-property' ? block?.propertyMetadata?.[point.property]?.defaultValue : undefined
   const reset = <Button buttonStyle="ghost" size="sm" disabled={!local} aria-label={`Reset variation ${point.label}`} onClick={() => setVariation(point, undefined)}>Use family</Button>
   const fields = <>
    {point.kind === 'node-property' && (point.schema.type === 'array' || point.schema.type === 'object') ? <JsonInput label={point.label} value={value} onCommit={next => { if (next === undefined) throw new Error('Use Reset to inherit the family value.'); commitVariation(point, { kind: point.kind, value: next as JsonValue }) }} /> : (point.kind === 'node-property' || point.kind === 'node-style') && <DataInput field={{ id: point.id, path: point.id, label: point.label, description: '', required: false, editable: true, schema: point.schema }} value={value} onChange={next => {
     const commit = () => { if (next === undefined) throw new Error('Use Reset to inherit the family value.'); commitVariation(point, point.kind === 'node-style' ? { kind: point.kind, value: String(next) } : { kind: point.kind, value: next }) }
     // Buffered inputs must receive the exception so their visible buffer stays invalid.
     if (point.schema.type === 'boolean' || point.schema.type === 'string' && point.schema.enum) attempt(commit)
     else commit()
    }} />}
    {point.kind === 'node-style' && <Button size="sm" onClick={() => setVariation(point, { kind: point.kind, value: null })}>Remove inherited style</Button>}
    {point.kind === 'block-property' && node?.kind === 'block' && <ValueInput fields={document.source.definition.fields} assets={document.source.definition.assets} allowedSources={point.allowedSources} literalSchema={block?.props[point.property]} value={node.props[point.property] ?? { source: 'literal', value: defaultValue ?? '' }} onChange={(value: TemplateValue) => commitVariation(point, { kind: point.kind, value })} onError={report} />}
    {(point.kind === 'children' || point.kind === 'placement') && structures(point)}
   </>
   return selectedId ? <Stack key={point.id} gap="lg">
    <Text size="sm" type="secondary">{pointKinds[point.kind]} · {pointTarget(point, document.source.definition)}</Text>
    {fields}
    <Stack direction="horizontal" justify="between" align="center" gap="sm"><Badge size="sm">{local ? 'Customized' : 'Inherited'}</Badge>{reset}</Stack>
   </Stack> : <SettingBlock key={point.id} display="inline" label={point.label} description={`${pointKinds[point.kind]} · ${pointTarget(point, document.source.definition)}`} hint={<Badge size="sm">{local ? 'Customized' : 'Inherited'}</Badge>} action={reset}>{fields}</SettingBlock>
  })}
 </Stack>
 const nodeInspector = (node: TemplateNode | null): ReactNode | undefined => {
  if (node && (family.variationPoints ?? []).some(point => (point.kind === 'placement' || point.kind === 'children') && owned(document.source.definition, point).has(node.id))) return undefined
  return controls(node)
 }
 const canInsert = (parentId: string | null) => (family.variationPoints ?? []).some(point => point.kind === 'children' && ((point.target.kind === 'roots' && parentId === null) || (point.target.kind === 'children' && point.target.nodeId === parentId))) || Boolean(parentId && (family.variationPoints ?? []).some(point => (point.kind === 'placement' || point.kind === 'children') && owned(document.source.definition, point).has(parentId)))
 const variationList = <Stack gap="lg" className="tc-variation-list">
  <Stack gap="sm">{points.map(point => <Item
   key={point.id}
   variant={point.id === selectedPoint?.id ? 'muted' : 'default'}
   padding="default"
   title={point.label}
   description={`${pointKinds[point.kind]} · ${pointTarget(point, document.source.definition)}`}
   trailing={<Stack gap="xs" align="end"><Badge size="sm">{Object.hasOwn(overrides.variations ?? {}, point.id) ? 'Customized' : 'Inherited'}</Badge>{invalidPoints.includes(point.id) && <Badge size="sm" tone="destructive">Needs attention</Badge>}</Stack>}
   render={<button type="button" aria-label={`Edit variation ${point.label}`} aria-description={invalidPoints.includes(point.id) ? 'This variation has an invalid value. Open it to fix the field.' : undefined} aria-pressed={point.id === selectedPoint?.id} onClick={() => selectPoint(point)} />}
  />)}</Stack>
 </Stack>
 // Keep point forms mounted: changing selection must not discard unfinished input.
 const variationInspector = <Stack ref={setVariationFields} gap="lg">{points.map(point => <div key={point.id} data-variation-point={point.id} hidden={point.id !== selectedPoint?.id}>
  {controls(null, true, point.id)}
 </div>)}</Stack>
 return <TemplateCreator instance={creator} theme={theme} layout={layout} initialPanel="variant-points" canvasControls={layout === 'compact' ? modeControls : undefined} onChange={changed} builtInPanels={['structure']} allowTemplateImport={false} canInsert={canInsert} nodeInspector={nodeInspector}
  previewData={previewData} previewTransform={previewTransform} previewTarget={document.target}
  workspacePanels={[
   ...(document.target === 'email' ? [{ id: 'email-checks', label: 'Email checks', content: <EmailChecksPanel issues={[...getEmailTemplateIssues(document.source.definition), ...getEmailSettingIssues(document.settingsSpec, previewSettings ?? document.settingsDefaults)]} /> }] : []),
   { id: 'variant-content', label: 'Content', content: panels.content },
   { id: 'variant-appearance', label: 'Appearance', content: panels.settings },
   { id: 'variant-access', label: 'Customer access', content: <Stack gap="2xl">{panels.permissions}</Stack> },
   { id: 'variant-points', label: 'Variation points', content: variationList, inspector: variationInspector, inspectorTitle: selectedPoint?.label ?? 'Allowed changes' },
  ]}
  header={{ description: 'Family variant · Only declared structure can change', actions: layout === 'compact' ? undefined : modeControls, ...header }} />
}
