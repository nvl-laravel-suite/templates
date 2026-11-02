import { describe, it, expect } from 'vitest'
import fixture from '../../scripts/fixtures/family-structure.v1.json'
import { materializeFamilyDocument } from './catalog'
import * as structure from './family-structure'
import type { BindingDocument, FamilyOverrides } from './types'
import { createTemplateCreator } from '../template-core/editing'
const base = () => structuredClone(fixture.base) as BindingDocument
const overrides = () => structuredClone(fixture.overrides) as FamilyOverrides

describe('family structural variation contract', () => {
  it('materializes every declared kind without stale output or mutation and derives the raw deltas', () => {
    const before = base(), patch = overrides()
    const result = materializeFamilyDocument(before, patch), nodes = result.source.definition.nodes
    expect(nodes.title).toMatchObject({ parts: [{ value: { value: 'Local' } }] })
    expect(nodes.heading).toMatchObject({ style: {} })
    expect(nodes.region).toMatchObject({ children: ['first', 'local'] })
    expect(nodes).not.toHaveProperty('second'); expect(nodes).not.toHaveProperty('footcopy')
    expect(nodes.footer).toMatchObject({ kind: 'text', id: 'footer' })
    expect(nodes.card).toMatchObject({ props: { caption: { value: 'Variant card' } }, slots: { body: ['bodycopy'] } })
    expect(result.artifacts).toMatchObject({ html: '', css: '', bindings: [] })
    expect(result.source.definition).toEqual(fixture.expectedDefinition)
    expect(before).toEqual(base()); expect(result.source.definition.id).toBe('family')
    expect(structure.deriveFamilyOverrides(before, result)).toEqual(patch)
  })
  it('retains explicit inherited-equivalent values and sidecar authority', () => {
    const explicit: FamilyOverrides = { content: {}, exposedInputs: [], variations: { accent: { kind: 'node-style', value: '#111' } } }
    expect(structure.deriveFamilyOverrides(base(), materializeFamilyDocument(base(), explicit), explicit)).toEqual(explicit)
  })
  it('rejects undeclared edits', () => {
    const edited = base(); edited.source.definition.name = 'Sneaked name'
    expect(() => structure.deriveFamilyOverrides(base(), edited)).toThrow(/undeclared|represent/i)
  })
  it.each(['unknown', 'kind', 'required', 'collision', 'outside', 'orphan', 'duplicate', 'schema', 'source'])('rejects invalid %s patches', scenario => {
    const patch = overrides()
    if (scenario === 'unknown') patch.variations!.unknown = { kind: 'node-style', value: 'red' }
    if (scenario === 'kind') patch.variations!.accent = { kind: 'node-property', value: 'red' }
    if (scenario === 'required') patch.variations!.region = { kind: 'children', order: [] }
    if (scenario === 'collision') patch.variations!.region = { kind: 'children', order: ['first'], nodes: { heading: base().source.definition.nodes.heading } }
    if (scenario === 'outside') patch.variations!.region = { kind: 'children', order: ['first', 'heading'] }
    if (scenario === 'orphan') patch.variations!.region = { kind: 'children', order: ['first'], nodes: { orphan: { ...base().source.definition.nodes.first, id: 'orphan' } } }
    if (scenario === 'duplicate') patch.variations!.region = { kind: 'children', order: ['first', 'first'] }
    if (scenario === 'schema') patch.variations!.title = { kind: 'node-property', value: [] }
    if (scenario === 'source') patch.variations!.caption = { kind: 'block-property', value: { source: 'asset', assetId: 'asset' } }
    expect(() => materializeFamilyDocument(base(), patch)).toThrow()
  })
  it.each(['duplicate', 'missing', 'overlap', 'invalid-slot', 'schema'])('validates %s declarations without overrides', scenario => {
    const doc = base()
    if (scenario === 'duplicate') doc.variationPoints!.push(doc.variationPoints![0])
    if (scenario === 'missing') doc.variationPoints!.push({ id: 'bad', label: 'Bad', kind: 'node-style', nodeId: 'missing', property: 'color', schema: { type: 'string' } })
    if (scenario === 'overlap') doc.variationPoints!.push({ id: 'bad', label: 'Bad', kind: 'node-property', nodeId: 'first', property: 'name', schema: { type: 'string' } })
    if (scenario === 'invalid-slot') doc.variationPoints!.push({ id: 'bad', label: 'Bad', kind: 'children', target: { kind: 'block-slot', nodeId: 'card', slot: 'missing' }, minItems: 0, maxItems: 3, allowedKinds: ['text'] })
    if (scenario === 'schema') (doc.variationPoints![0] as { schema: unknown }).schema = { type: 'wat' }
    expect(() => materializeFamilyDocument(doc, {})).toThrow()
  })
})

describe('region authority and ordering', () => {
  it('edits inherited region nodes while retaining their IDs when reordered', () => {
    const edited = base(), first = edited.source.definition.nodes.first, node = edited.source.definition.nodes.region
    if (first.kind === 'text') first.parts[0].value = { source: 'literal', value: 'Edited first' }
    if ('children' in node) node.children.reverse()
    const patch = structure.deriveFamilyOverrides(base(), edited)
    expect(patch.variations?.region).toMatchObject({ order: ['second', 'first'], nodes: { first: { id: 'first' } } })
    expect(materializeFamilyDocument(base(), patch).source.definition).toEqual(edited.source.definition)
  })
  it('supports complete root ordering when explicitly declared', () => {
    const doc = base(); doc.variationPoints = [{ id: 'rootOrder', label: 'Root order', kind: 'children', target: { kind: 'roots' }, minItems: 1, maxItems: 4, allowedKinds: ['element', 'block'], requiredIds: ['heading'] }]
    expect(materializeFamilyDocument(doc, { variations: { rootOrder: { kind: 'children', order: ['card', 'footer', 'region', 'heading'] } } }).source.definition.roots).toEqual(['card', 'footer', 'region', 'heading'])
  })
  it('rejects cycles within declared fragments', () => {
    const doc = base(), node = structuredClone(doc.source.definition.nodes.region)
    node.id = 'cycle'; if ('children' in node) node.children = ['cycle']
    expect(() => materializeFamilyDocument(doc, { variations: { region: { kind: 'children', order: ['first', 'cycle'], nodes: { cycle: node } } } })).toThrow(/cyclic/i)
    expect(doc).toEqual(base())
  })
  it('rejects undeclared permissions and unsafe styles', () => {
    const edited = base(); edited.source.definition.nodes.heading.permissions.style = true
    expect(() => structure.deriveFamilyOverrides(base(), edited)).toThrow(/undeclared/i)
    expect(() => materializeFamilyDocument(base(), { variations: { accent: { kind: 'node-style', value: 'url(https://example.com/a)' } } })).toThrow()
  })
})

describe('omitted block property authority', () => {
  const inheritedDefault = () => {
    const doc = base(), card = doc.source.definition.nodes.card
    doc.source.definition.blocks[0].propertyMetadata = { caption: { label: 'Caption', description: '', defaultValue: 'Fallback' } }
    if (card.kind === 'block') delete card.props.caption
    return doc
  }
  it('keeps inherited default bindings omitted during no-op derivation', () => {
    const doc = inheritedDefault(), effective = materializeFamilyDocument(doc, {})
    expect(structure.deriveFamilyOverrides(doc, effective)).toEqual({})
    expect(effective.source.definition.nodes.card).toMatchObject({ props: {} })
  })
  it('derives an explicit binding and resets it back to the inherited omission', () => {
    const doc = inheritedDefault(), patch: FamilyOverrides = { variations: { caption: { kind: 'block-property', value: { source: 'literal', value: 'Changed' } } } }
    const edited = materializeFamilyDocument(doc, patch)
    expect(structure.deriveFamilyOverrides(doc, edited)).toEqual(patch)
    const reset = structure.deriveFamilyOverrides(doc, materializeFamilyDocument(doc, {}), patch)
    expect(reset).toEqual({ variations: {} })
    expect(materializeFamilyDocument(doc, reset).source.definition.nodes.card).toMatchObject({ props: {} })
  })
  it('allows declared creator transactions while unrelated default bindings stay omitted', () => {
    const doc = inheritedDefault()
    const creator = createTemplateCreator({ initialTemplate: doc.source.definition, validateChange: (_before, next) => {
      structure.deriveFamilyOverrides(doc, { ...doc, source: { mode: 'standalone', definition: next } })
    } })
    creator.actions.edit(draft => { const node = draft.nodes.heading; if (node.kind === 'element') node.style.color = 'red' })
    expect(creator.getTemplate().nodes.heading).toMatchObject({ style: { color: 'red' } })
    expect(creator.getTemplate().nodes.card).toMatchObject({ props: {} })
  })
  it('still rejects removing a binding explicitly supplied by the family', () => {
    const edited = base(), card = edited.source.definition.nodes.card
    edited.source.definition.blocks[0].propertyMetadata = { caption: { label: 'Caption', description: '', defaultValue: 'Fallback' } }
    const inherited = structuredClone(edited)
    if (card.kind === 'block') delete card.props.caption
    expect(() => structure.deriveFamilyOverrides(inherited, edited)).toThrow(/undeclared|represent/i)
  })
})

describe('closed family container contracts', () => {
  it('retains canonical numeric point and local fragment identifiers', () => {
    const doc = base(); doc.variationPoints![1].id = '0'
    const patch: FamilyOverrides = { variations: {
      '0': { kind: 'node-style', value: 'red' },
      region: { kind: 'children', order: ['first', '0', '123'], nodes: {
        '0': { ...structuredClone(doc.source.definition.nodes.first), id: '0' },
        '123': { ...structuredClone(doc.source.definition.nodes.first), id: '123' },
      } },
    } }
    expect(structure.deriveFamilyOverrides(doc, materializeFamilyDocument(doc, patch))).toEqual(patch)
  })
  it.each(['placement', 'children'] as const)('rejects repeated %s allowed kinds', kind => {
    const doc = base(), point = doc.variationPoints!.find(point => point.kind === kind)!
    if (point.kind === 'placement' || point.kind === 'children') point.allowedKinds.push(point.allowedKinds[0])
    expect(() => materializeFamilyDocument(doc, {})).toThrow()
  })
  it('rejects explicitly null declaration lists', () => {
    const doc = { ...base(), variationPoints: null } as unknown as BindingDocument
    expect(() => materializeFamilyDocument(doc, {})).toThrow()
  })
  it.each(['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings', 'variations'])('rejects a null %s override container', key => {
    expect(() => materializeFamilyDocument(base(), { [key]: null } as FamilyOverrides)).toThrow()
  })
  it.each(['content', 'settingsDefaults'])('rejects array-shaped %s override maps', key => {
    expect(() => materializeFamilyDocument(base(), { [key]: [] } as unknown as FamilyOverrides)).toThrow()
  })
  it.each(['exposedInputs', 'exposedSettings'] as const)('rejects repeated %s permissions', key => {
    const doc = base(); doc[key] = ['allowed']
    expect(() => materializeFamilyDocument(doc, { [key]: ['allowed', 'allowed'] })).toThrow()
  })
})

describe('block slot assignment authority', () => {
  it('distinguishes omitted fallback slots from explicitly empty assignments and resets to omission', () => {
    const doc = base(), patch: FamilyOverrides = { variations: { body: { kind: 'children', order: [] } } }
    const edited = materializeFamilyDocument(doc, patch)
    expect(edited.source.definition.nodes.card).toMatchObject({ slots: { body: [] } })
    expect(structure.deriveFamilyOverrides(doc, edited)).toEqual(patch)
    expect(structure.deriveFamilyOverrides(doc, doc)).toEqual({})
    const reset = structure.deriveFamilyOverrides(doc, doc, patch)
    expect(reset).toEqual({ variations: {} })
    expect(materializeFamilyDocument(doc, reset).source.definition.nodes.card).toMatchObject({ slots: {} })
  })
})
