import { z } from 'zod'
import { DataSchemaSchema, IdentifierSchema, TemplateDefinitionSchema, TemplateNodeSchema, TemplateValueSchema, type TemplateDefinition, type TemplateNode } from '../template-core/schema'
import { childIds, getTemplateIssues } from '../template-core/validation'
import { stableJSONStringify, validateJSONData } from '../template-core/contracts'
import { styleIssues } from '../template-core/styles'
import type { BindingDocument, FamilyOverrides, FamilyVariationOverride, FamilyVariationPoint } from './types'

const kinds = z.enum(['element', 'text', 'repeat', 'condition', 'block', 'slot'])
const common = { id: IdentifierSchema, label: z.string().min(1).max(120) }
const targetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('roots') }).strict(),
  z.object({ kind: z.literal('children'), nodeId: IdentifierSchema }).strict(),
  z.object({ kind: z.literal('block-slot'), nodeId: IdentifierSchema, slot: IdentifierSchema }).strict(),
])
/** Portable declaration schema; families and backend adapters use the same closed shapes. */
export const FamilyVariationPointSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('node-property'), nodeId: IdentifierSchema, property: z.enum(['name', 'tag', 'classes', 'parts']), schema: DataSchemaSchema }).strict(),
  z.object({ ...common, kind: z.literal('node-style'), nodeId: IdentifierSchema, property: z.string().min(1), schema: DataSchemaSchema }).strict(),
  z.object({ ...common, kind: z.literal('block-property'), nodeId: IdentifierSchema, property: IdentifierSchema, allowedSources: z.array(z.enum(['literal', 'field', 'item', 'prop', 'asset'])).min(1) }).strict(),
  z.object({ ...common, kind: z.literal('placement'), nodeId: IdentifierSchema, allowedKinds: z.array(kinds).min(1), allowedBlocks: z.array(z.object({ id: IdentifierSchema, version: z.number().int().positive() }).strict()).optional() }).strict(),
  z.object({ ...common, kind: z.literal('children'), target: targetSchema, minItems: z.number().int().nonnegative(), maxItems: z.number().int().nonnegative(), allowedKinds: z.array(kinds).min(1), requiredIds: z.array(IdentifierSchema).optional() }).strict(),
])
export const FamilyVariationOverrideSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('node-property'), value: z.unknown().refine(value => value !== undefined, 'A value is required.') }).strict(),
  z.object({ kind: z.literal('node-style'), value: z.string().nullable() }).strict(),
  z.object({ kind: z.literal('block-property'), value: TemplateValueSchema }).strict(),
  z.object({ kind: z.literal('placement'), node: TemplateNodeSchema, nodes: z.record(IdentifierSchema, TemplateNodeSchema).optional() }).strict(),
  z.object({ kind: z.literal('children'), order: z.array(IdentifierSchema), nodes: z.record(IdentifierSchema, TemplateNodeSchema).optional() }).strict(),
])
const same = (a: unknown, b: unknown) => stableJSONStringify(a) === stableJSONStringify(b)
function fail(message: string): never { throw new Error(`Family variation: ${message}`) }
function closure(definition: TemplateDefinition, ids: string[]): Set<string> {
  const found = new Set<string>()
  const visit = (id: string) => { if (found.has(id)) return; found.add(id); const node = definition.nodes[id]; if (!node) fail(`Unknown node ${id}.`); childIds(node).forEach(visit) }
  ids.forEach(visit)
  return found
}
function sequence(definition: TemplateDefinition, point: Extract<FamilyVariationPoint, { kind: 'children' }>): string[] {
  const target = point.target
  if (target.kind === 'roots') return definition.roots
  const node = definition.nodes[target.nodeId]
  if (!node) return fail(`Unknown children target ${target.nodeId}.`)
  if (target.kind === 'children') {
    if (!('children' in node) || (node.kind === 'element' && ['img', 'hr', 'br'].includes(node.tag))) return fail('Children need a container target.')
    return node.children
  }
  if (node.kind !== 'block') return fail('A block slot needs a block instance.')
  const block = definition.blocks.find(block => block.id === node.blockId && block.version === node.version)
  if (!block || !Object.values(block.nodes).some(item => item.kind === 'slot' && item.slot === target.slot)) return fail(`Unknown block slot ${target.slot}.`)
  return node.slots[target.slot] ?? []
}
function setSequence(definition: TemplateDefinition, point: Extract<FamilyVariationPoint, { kind: 'children' }>, ids: string[]) {
  const target = point.target
  if (target.kind === 'roots') definition.roots = [...ids]
  else { const node = definition.nodes[target.nodeId]; if (target.kind === 'children' && 'children' in node) node.children = [...ids]; else if (target.kind === 'block-slot' && node.kind === 'block') node.slots[target.slot] = [...ids] }
}
function region(definition: TemplateDefinition, point: FamilyVariationPoint): Set<string> {
  if (point.kind === 'placement') return closure(definition, [point.nodeId])
  if (point.kind === 'children') return closure(definition, sequence(definition, point))
  return new Set()
}
function fieldKey(point: FamilyVariationPoint): string {
  if (point.kind === 'children') { const t = point.target; return t.kind === 'roots' ? 'roots' : `${t.nodeId}:${t.kind}:${t.kind === 'block-slot' ? t.slot : ''}` }
  return `${point.nodeId}:${point.kind}:${'property' in point ? point.property : ''}`
}
function graphCheck(definition: TemplateDefinition) { const issues = getTemplateIssues(definition); if (issues.length) fail(issues[0].message) }
export function validateFamilyVariationPoints(base: BindingDocument): FamilyVariationPoint[] {
  const points = z.array(FamilyVariationPointSchema).parse(base.variationPoints === undefined ? [] : base.variationPoints) as FamilyVariationPoint[]
  const definition = TemplateDefinitionSchema.parse(base.source.definition)
  graphCheck(definition)
  const ids = new Set<string>(), keys = new Set<string>()
  const regions = points.map(point => region(definition, point))
  points.forEach((point, index) => {
    if (ids.has(point.id) || keys.has(fieldKey(point))) fail(`Duplicate or overlapping declaration ${point.id}.`)
    ids.add(point.id); keys.add(fieldKey(point))
    const node = point.kind === 'children' ? undefined : definition.nodes[point.nodeId]
    if (point.kind !== 'children' && !node) fail(`Unknown node ${point.nodeId}.`)
    if (point.kind === 'node-property') {
      if (!Object.hasOwn(node!, point.property)) fail(`Property ${point.property} does not exist on this node kind.`)
      if (validateJSONData(point.schema, (node as unknown as Record<string, unknown>)[point.property]).length) fail(`Inherited property does not satisfy declaration ${point.id}.`)
    }
    if (point.kind === 'node-style') {
      if (!node || node.kind !== 'element' || point.schema.type !== 'string' || styleIssues({ [point.property]: 'inherit' }, 'variation').length) fail('Styles need a supported element style property and string schema.')
      if (Object.hasOwn(node.style, point.property) && validateJSONData(point.schema, node.style[point.property]).length) fail('Inherited style does not match its declaration.')
    }
    if (point.kind === 'block-property') {
      if (!node || node.kind !== 'block') fail('Block properties need a block target.')
      const block = definition.blocks.find(block => block.id === node.blockId && block.version === node.version)
      if (!block || !Object.hasOwn(block.props, point.property) || new Set(point.allowedSources).size !== point.allowedSources.length) fail('Declare an existing block property and distinct source kinds.')
    }
    if (point.kind === 'placement') {
      if (new Set(point.allowedKinds).size !== point.allowedKinds.length) fail('Placement kinds must be distinct.')
      if (!point.allowedKinds.includes(node!.kind) || point.allowedKinds.includes('slot')) fail('Placement kinds must include the inherited kind and exclude block-definition slots.')
      for (const block of point.allowedBlocks ?? []) if (!definition.blocks.some(item => item.id === block.id && item.version === block.version)) fail('Replacement blocks must use registered pinned versions.')
    }
    if (point.kind === 'children') {
      if (new Set(point.allowedKinds).size !== point.allowedKinds.length) fail('Child kinds must be distinct.')
      const order = sequence(definition, point)
      if (point.minItems > point.maxItems || order.length < point.minItems || order.length > point.maxItems || point.allowedKinds.includes('slot')) fail('Invalid region cardinality or child kinds.')
      if (new Set(point.requiredIds).size !== (point.requiredIds ?? []).length || point.requiredIds?.some(id => !order.includes(id))) fail('Required placements must belong to the declared sequence.')
      if (order.some(id => !point.allowedKinds.includes(definition.nodes[id].kind))) fail('Inherited child kinds must remain allowed.')
    }
    points.forEach((other, otherIndex) => {
      if (otherIndex <= index) return
      const a = regions[index], b = regions[otherIndex]
      if ([...a].some(id => b.has(id)) || (other.kind !== 'children' && a.has(other.nodeId)) || (point.kind !== 'children' && b.has(point.nodeId)) || (other.kind === 'children' && other.target.kind !== 'roots' && a.has(other.target.nodeId)) || (point.kind === 'children' && point.target.kind !== 'roots' && b.has(point.target.nodeId))) fail(`Overlapping declarations ${point.id} and ${other.id}.`)
    })
  })
  return points
}

/** Lower explicit declared deltas into the canonical graph. Derived artifacts are invalidated. */
export function applyFamilyVariations(base: BindingDocument, variations: FamilyOverrides['variations'] = {}): BindingDocument {
  const points = validateFamilyVariationPoints(base)
  const byId = new Map(points.map(point => [point.id, point]))
  if (!variations || typeof variations !== 'object' || Array.isArray(variations)) fail('Variations must be a point-keyed object.')
  const result = structuredClone(base), definition = result.source.definition
  const displaced = new Set<string>(), supplied = new Set<string>()
  for (const [id, raw] of Object.entries(variations)) {
    const point = byId.get(id)
    if (!point) fail(`Unknown variation point ${id}.`)
    const patch = FamilyVariationOverrideSchema.parse(raw) as FamilyVariationOverride
    if (patch.kind !== point.kind) fail(`Changed kind for ${id}.`)
    if (patch.kind === 'node-property' && point.kind === 'node-property') {
      if (validateJSONData(point.schema, patch.value).length) fail(`Value violates ${id} schema.`)
      Object.assign(definition.nodes[point.nodeId], { [point.property]: structuredClone(patch.value) })
    } else if (patch.kind === 'node-style' && point.kind === 'node-style') {
      const node = definition.nodes[point.nodeId]
      if (node.kind !== 'element') fail('Style needs an element.')
      if (patch.value === null) delete node.style[point.property]
      else { if (validateJSONData(point.schema, patch.value).length) fail(`Value violates ${id} schema.`); node.style[point.property] = patch.value }
    } else if (patch.kind === 'block-property' && point.kind === 'block-property') {
      const node = definition.nodes[point.nodeId]
      if (node.kind !== 'block' || !point.allowedSources.includes(patch.value.source)) fail(`Unsupported property source for ${id}.`)
      node.props[point.property] = structuredClone(patch.value)
    } else if ((patch.kind === 'placement' && point.kind === 'placement') || (patch.kind === 'children' && point.kind === 'children')) {
      const owned = region(base.source.definition, point)
      owned.forEach(id => displaced.add(id))
      for (const [localId, node] of Object.entries(patch.nodes ?? {})) {
        if (localId !== node.id || supplied.has(localId) || (Object.hasOwn(base.source.definition.nodes, localId) && !owned.has(localId)) || (point.kind === 'placement' && localId === point.nodeId)) fail(`Fragment ID collision ${localId}.`)
        supplied.add(localId); definition.nodes[localId] = structuredClone(node)
      }
      let roots: string[]
      if (patch.kind === 'placement' && point.kind === 'placement') {
        if (patch.node.id !== point.nodeId || !point.allowedKinds.includes(patch.node.kind)) fail('Replacement must retain placement identity and an approved kind.')
        if (patch.node.kind === 'block' && point.allowedBlocks && !point.allowedBlocks.some(block => patch.node.kind === 'block' && block.id === patch.node.blockId && block.version === patch.node.version)) fail('Replacement block is not approved.')
        definition.nodes[point.nodeId] = structuredClone(patch.node); roots = [point.nodeId]
      } else if (patch.kind === 'children' && point.kind === 'children') {
        if (new Set(patch.order).size !== patch.order.length || patch.order.length < point.minItems || patch.order.length > point.maxItems || point.requiredIds?.some(id => !patch.order.includes(id))) fail('Invalid order, required placement or cardinality.')
        roots = patch.order; setSequence(definition, point, roots)
        if (roots.some(id => !definition.nodes[id] || !point.allowedKinds.includes(definition.nodes[id].kind))) fail('Unsupported child kind.')
      } else return fail('Mismatched structural variation.')
      const reachable = closure(definition, roots)
      for (const ref of reachable) if (!owned.has(ref) && !Object.hasOwn(patch.nodes ?? {}, ref)) fail(`Reference outside declared region: ${ref}.`)
      for (const ref of Object.keys(patch.nodes ?? {})) if (!reachable.has(ref)) fail(`Orphan fragment ${ref}.`)
    }
  }
  const reachable = closure(definition, definition.roots)
  for (const id of displaced) if (!reachable.has(id)) delete definition.nodes[id]
  result.source.definition = TemplateDefinitionSchema.parse(definition)
  graphCheck(result.source.definition)
  if (!same(base.source.definition, result.source.definition)) {
    const sidecars = [base.rendering?.subject ?? base.artifacts.subject, base.rendering?.text ?? base.artifacts.text].join('\n')
    result.artifacts = { ...result.artifacts, html: '', css: '', bindings: result.artifacts.bindings.filter(binding => binding.kind === 'text' && sidecars.includes(`{{${binding.id}}}`)) }
  }
  return result
}

function extracted(definition: TemplateDefinition, base: TemplateDefinition, point: FamilyVariationPoint): FamilyVariationOverride | undefined {
  if (point.kind === 'node-property') { const node = definition.nodes[point.nodeId]; if (!node || !Object.hasOwn(node, point.property)) return fail('An inherited property target was removed.'); return { kind: point.kind, value: structuredClone((node as unknown as Record<string, never>)[point.property]) } }
  if (point.kind === 'node-style') { const node = definition.nodes[point.nodeId]; if (node?.kind !== 'element') return fail('An inherited style target changed kind.'); return { kind: point.kind, value: node.style[point.property] ?? null } }
  if (point.kind === 'block-property') { const node = definition.nodes[point.nodeId]; if (node?.kind !== 'block') return fail('An inherited block property target changed kind.'); return Object.hasOwn(node.props, point.property) ? { kind: point.kind, value: structuredClone(node.props[point.property]) } : undefined }
  if (point.kind === 'children' && point.target.kind === 'block-slot') {
    const node = definition.nodes[point.target.nodeId]
    if (node?.kind !== 'block') return fail('An inherited block slot target changed kind.')
    if (!Object.hasOwn(node.slots, point.target.slot)) return undefined
  }
  const owned = region(definition, point), nodes: Record<string, TemplateNode> = {}
  for (const id of owned) if (!(point.kind === 'placement' && id === point.nodeId) && !same(base.nodes[id], definition.nodes[id])) nodes[id] = structuredClone(definition.nodes[id])
  return point.kind === 'placement' ? { kind: point.kind, node: structuredClone(definition.nodes[point.nodeId]), ...(Object.keys(nodes).length ? { nodes } : {}) } : { kind: point.kind, order: [...sequence(definition, point)], ...(Object.keys(nodes).length ? { nodes } : {}) }
}
/** Derive complete raw authority, retaining deliberate inherited-equivalent overrides. */
export function deriveFamilyOverrides(base: BindingDocument, edited: BindingDocument, existing: FamilyOverrides = {}): FamilyOverrides {
  const points = validateFamilyVariationPoints(base)
  const overrides: FamilyOverrides = {}
  for (const key of ['content', 'settingsDefaults'] as const) {
    const values = { ...existing[key] }
    for (const [id, value] of Object.entries(edited[key])) if (!same(value, base[key][id]) || Object.hasOwn(values, id)) values[id] = structuredClone(value)
    if (Object.keys(values).length || Object.hasOwn(existing, key)) overrides[key] = values
  }
  for (const key of ['exposedInputs', 'exposedSettings'] as const) if (!same(base[key], edited[key]) || Object.hasOwn(existing, key)) overrides[key] = [...edited[key]]
  const variations: NonNullable<FamilyOverrides['variations']> = {}
  for (const point of points) {
    const patch = extracted(edited.source.definition, base.source.definition, point)
    const inherited = extracted(base.source.definition, base.source.definition, point)
    if (patch !== undefined && (!same(patch, inherited) || Object.hasOwn(existing.variations ?? {}, point.id))) variations[point.id] = patch
  }
  if (Object.keys(variations).length || Object.hasOwn(existing, 'variations')) overrides.variations = variations
  for (const id of Object.keys(existing.variations ?? {})) if (!points.some(point => point.id === id)) fail(`Unknown existing variation ${id}.`)
  const materialized = applyFamilyVariations(base, overrides.variations)
  for (const key of ['content', 'settingsDefaults'] as const) materialized[key] = { ...base[key], ...overrides[key] }
  for (const key of ['exposedInputs', 'exposedSettings'] as const) {
    if (overrides[key]?.some(id => !base[key].includes(id))) fail('A variant cannot widen family capabilities.')
    if (overrides[key]) materialized[key] = [...overrides[key]!]
  }
  const { artifacts: _baseArtifacts, ...expected } = materialized
  const { artifacts: _editedArtifacts, ...actual } = edited
  if (!same(expected, actual)) fail('Edited document contains undeclared changes that cannot be represented as family overrides.')
  return overrides
}
