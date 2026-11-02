import { useRef, useState } from 'react'
import { Button } from 'themelia-react-ui/base/buttons'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { DataSchemaSchema, HTML_TAGS, type DataSchema, type JsonValue, type TemplateNode, type TemplateValue } from '../template-core/schema'
import { useTemplateDocument, useTemplateSelection } from '../template-creator/hooks'
import { templateNodeLabel } from '../template-core/labels'
import { CommitInput, JsonInput } from '../template-creator/controls'
import { SettingInput } from '../voucher-builder/builder/settings/primitives/setting-input'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'
import { materializeFamilyDocument } from './catalog'
import type { BindingDocument, FamilyVariationPoint } from './types'

export interface FamilyAuthoringProps {
  document: BindingDocument
  onChange: (points: FamilyVariationPoint[]) => void
}
const kinds: TemplateNode['kind'][] = ['element', 'text', 'repeat', 'condition', 'block']
const sources: TemplateValue['source'][] = ['literal', 'field', 'item', 'prop', 'asset']
type NewPoint = FamilyVariationPoint extends infer P ? P extends FamilyVariationPoint ? Omit<P, 'id'> : never : never

function schemaFor(value: JsonValue): DataSchema {
  if (Array.isArray(value)) return { type: 'array', items: value.length ? schemaFor(value[0]) : { type: 'string' } }
  if (value && typeof value === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, schemaFor(item)])), required: Object.keys(value), additionalProperties: false }
  if (typeof value === 'boolean') return { type: 'boolean' }
  if (typeof value === 'number') return { type: 'number' }
  return { type: 'string' }
}
function regionIds(point: Extract<FamilyVariationPoint, { kind: 'children' }>, document: BindingDocument): string[] {
  if (point.target.kind === 'roots') return document.source.definition.roots
  const node = document.source.definition.nodes[point.target.nodeId]
  if (point.target.kind === 'block-slot') return node?.kind === 'block' ? node.slots[point.target.slot] ?? [] : []
  return node && 'children' in node ? node.children : []
}
function useDeclarations({ document, onChange }: FamilyAuthoringProps) {
  const definition = useTemplateDocument()
  const [error, setError] = useState('')
  const points = document.variationPoints ?? []
  const commit = (next: FamilyVariationPoint[]) => {
    materializeFamilyDocument({ ...document, source: { mode: 'standalone', definition }, variationPoints: next }, {})
    onChange(next)
    setError('')
  }
  const attempt = (action: () => void) => { try { action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'This declaration conflicts with another variation region.') } }
  const add = (point: NewPoint) => attempt(() => {
    const target = 'nodeId' in point ? point.nodeId : point.target.kind === 'roots' ? 'roots' : point.target.nodeId
    const base = `v_${target}_${point.kind}_${'property' in point ? point.property : 'target'}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 65)
    let id = base; let index = 2
    while (points.some(existing => existing.id === id)) id = `${base}_${index++}`
    commit([...points, { ...point, id } as FamilyVariationPoint])
  })
  return { definition, points, commit, attempt, add, feedback: error ? <Alert tone="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null }
}

/** Selection-aware declarations use the complete creator's current canonical graph. */
export function FamilyVariationControls(props: FamilyAuthoringProps) {
  const { node } = useTemplateSelection()
  const { definition, points, add, feedback } = useDeclarations(props)
  if (!node) return null
  const declared = (kind: FamilyVariationPoint['kind'], property?: string) => points.some(point => point.kind === kind && 'nodeId' in point && point.nodeId === node.id && (!property || 'property' in point && point.property === property))
  const property = (name: 'name' | 'tag' | 'classes' | 'parts', schema: DataSchema) => <Button key={name} disabled={declared('node-property', name)} onClick={() => add({ kind: 'node-property', nodeId: node.id, property: name, label: `${node.name}: ${name}`, schema })}>Allow {name} changes</Button>
  const block = node.kind === 'block' ? definition.blocks.find(item => item.id === node.blockId && item.version === node.version) : undefined
  return <SettingBlock label="Family variations" description="Declare the changes variants may make. Each structural region has one owner.">
    {feedback}
    {property('name', { type: 'string' })}
    {node.kind === 'element' && <>{property('tag', { type: 'string', enum: [...HTML_TAGS] })}{property('classes', { type: 'array', items: { type: 'string' } })}
      {Object.keys(node.style).map(name => <Button key={name} disabled={declared('node-style', name)} onClick={() => add({ kind: 'node-style', nodeId: node.id, property: name, label: `${node.name}: ${name}`, schema: { type: 'string' } })}>Allow {name} style changes</Button>)}
      <StyleDeclaration onAdd={name => add({ kind: 'node-style', nodeId: node.id, property: name, label: `${node.name}: ${name}`, schema: { type: 'string' } })} />
    </>}
    {node.kind === 'text' && property('parts', schemaFor(node.parts as unknown as JsonValue))}
    {node.kind === 'block' && Object.keys(block?.props ?? {}).map(name => <Button key={name} disabled={declared('block-property', name)} onClick={() => add({ kind: 'block-property', nodeId: node.id, property: name, label: `${node.name}: ${name}`, allowedSources: [node.props[name]?.source ?? 'literal'] })}>Allow {name} property changes</Button>)}
    <Button disabled={declared('placement')} onClick={() => add({ kind: 'placement', nodeId: node.id, label: `${node.name}: replacement`, allowedKinds: [node.kind], allowedBlocks: node.kind === 'block' ? [{ id: node.blockId, version: node.version }] : [] })}>Allow placement replacement</Button>
    {'children' in node && <Button onClick={() => add({ kind: 'children', label: `${node.name}: children`, target: { kind: 'children', nodeId: node.id }, minItems: 0, maxItems: Math.max(20, node.children.length), allowedKinds: kinds })}>Allow child changes</Button>}
    {node.kind === 'block' && [...new Set([...Object.keys(node.slots), ...Object.values(block?.nodes ?? {}).filter(item => item.kind === 'slot').map(item => item.kind === 'slot' ? item.slot : '')])].map(slot => <Button key={slot} onClick={() => add({ kind: 'children', label: `${node.name}: ${slot}`, target: { kind: 'block-slot', nodeId: node.id, slot }, minItems: 0, maxItems: Math.max(20, node.slots[slot]?.length ?? 0), allowedKinds: kinds })}>Allow {slot} slot changes</Button>)}
  </SettingBlock>
}
function StyleDeclaration({ onAdd }: { onAdd: (property: string) => void }) {
  const [property, setProperty] = useState('color')
  return <Stack gap="sm"><SettingInput label="Style property to allow" type="input" value={property} onChange={setProperty} /><Button disabled={!property.trim()} onClick={() => onAdd(property.trim())}>Allow style property</Button></Stack>
}

/** Policy editing lives in a regular creator workspace panel, alongside theme and settings. */
export function FamilyVariationLibrary(props: FamilyAuthoringProps) {
  const { points, definition, commit, attempt, add, feedback } = useDeclarations(props)
  const originals = useRef(new Map(points.map(point => [point.id, structuredClone(point)])))
  const initialIds = useRef(new Set(points.map(point => point.id)))
  for (const point of points) if (!originals.current.has(point.id)) originals.current.set(point.id, structuredClone(point))
  const update = (point: FamilyVariationPoint) => commit(points.map(item => item.id === point.id ? point : item))
  const description = (point: FamilyVariationPoint) => {
    const kind = { 'node-property': 'Element property', 'node-style': 'Appearance', 'block-property': 'Block property', placement: 'Replacement', children: 'Section order' }[point.kind]
    const id = 'nodeId' in point ? point.nodeId : point.target.kind === 'roots' ? null : point.target.nodeId
    const node = id ? definition.nodes[id] : null
    const target = node ? templateNodeLabel(node) : id ?? 'Document sections'
    return `${kind} · ${target}${point.kind === 'children' && point.target.kind === 'block-slot' ? ` · ${point.target.slot} slot` : ''}`
  }
  return <Stack gap="xl">
    <Text size="sm" type="secondary">Choose which parts variants may customize. Select an element in Structure to allow a property, replacement or editable section. Removing a rule makes that part inherited.</Text>
    {feedback}
    <Button onClick={() => add({ kind: 'children', label: 'Root placements', target: { kind: 'roots' }, minItems: 1, maxItems: Math.max(20, definition.roots.length), allowedKinds: kinds })}>Allow root changes</Button>
    {!points.length && <Text size="sm" type="secondary">All structure is inherited. Allow root changes above, or select an element to define a smaller editable area.</Text>}
    {points.map(point => <SettingBlock key={point.id} label={point.label} defaultOpen={!initialIds.current.has(point.id)} description={description(point)} action={<Button buttonStyle="ghost" size="sm" aria-label={`Remove variation ${point.id}`} onClick={() => attempt(() => commit(points.filter(item => item.id !== point.id)))}>Remove</Button>}>
      <CommitInput label={`Variation label ${point.id}`} value={point.label} onCommit={label => { if (!label.trim()) throw new Error('Enter a variation label.'); update({ ...point, label }) }} />
      {'schema' in point && <JsonInput label={`Value schema ${point.id}`} value={point.schema} hint="Portable data schema for permitted values." onCommit={value => update({ ...point, schema: DataSchemaSchema.parse(value) })} />}
      {point.kind === 'children' && <>
        <CommitInput label={`Minimum items ${point.id}`} type="number" value={String(point.minItems)} onCommit={value => update({ ...point, minItems: Number(value) })} />
        <CommitInput label={`Maximum items ${point.id}`} type="number" value={String(point.maxItems)} onCommit={value => update({ ...point, maxItems: Number(value) })} />
        {regionIds(point, { ...props.document, source: { mode: 'standalone', definition } }).map(id => <SettingInput key={id} type="checkbox" label={`Require ${definition.nodes[id]?.name ?? id}`} value={Boolean(point.requiredIds?.includes(id))} onChange={required => attempt(() => update({ ...point, requiredIds: required ? [...(point.requiredIds ?? []), id] : (point.requiredIds ?? []).filter(item => item !== id) }))} />)}
      </>}
      {(point.kind === 'children' || point.kind === 'placement') && kinds.map(kind => <SettingInput key={kind} type="checkbox" label={`Allow ${kind} nodes`} value={point.allowedKinds.includes(kind)} onChange={allowed => attempt(() => update({ ...point, allowedKinds: allowed ? [...point.allowedKinds, kind] : point.allowedKinds.filter(item => item !== kind) }))} />)}
      {point.kind === 'placement' && point.allowedKinds.includes('block') && definition.blocks.map(block => <SettingInput key={`${block.id}@${block.version}`} type="checkbox" label={`Allow block ${block.name} v${block.version}`} value={point.allowedBlocks === undefined || point.allowedBlocks.some(item => item.id === block.id && item.version === block.version)} onChange={allowed => attempt(() => update({ ...point, allowedBlocks: allowed ? [...(point.allowedBlocks ?? definition.blocks.map(item => ({ id: item.id, version: item.version }))), { id: block.id, version: block.version }] : (point.allowedBlocks ?? definition.blocks.map(item => ({ id: item.id, version: item.version }))).filter(item => item.id !== block.id || item.version !== block.version) }))} />)}
      {point.kind === 'block-property' && sources.map(source => <SettingInput key={source} type="checkbox" label={`Allow ${source} values`} value={point.allowedSources.includes(source)} onChange={allowed => attempt(() => update({ ...point, allowedSources: allowed ? [...point.allowedSources, source] : point.allowedSources.filter(item => item !== source) }))} />)}
      <Button onClick={() => attempt(() => {
        const original = originals.current.get(point.id)
        if (original) update(structuredClone(original))
      })}>Reset declaration</Button>
    </SettingBlock>)}
  </Stack>
}
