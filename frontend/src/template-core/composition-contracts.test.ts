import { describe, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from './defaults'
import { TemplateBlockSchema, TemplateFieldSchema, TemplateNodeSchema, type TemplateDefinition } from './schema'
import { createTemplateCreator, createTemplateEditor, getCreatorRuntime } from './editing'
import { getTemplateDataSchema, validateJSONData } from './contracts'
import { getTemplateIssues, parseTemplateDefinition, parseTemplateDraft } from './validation'
import { createTemplateRevision, renderTemplate } from './render'
import { exportTemplateBlock, parseTemplateBlockLibrary } from './blocks'

const text = (id: string, value = 'Note') => TemplateNodeSchema.parse({ id, kind: 'text', name: 'Note',
  parts: [{ value: { source: 'literal', value } }] })
const plain = () => {
  const template = createTemplateDefinition()
  template.nodes.note = text('note')
  template.roots = ['note']
  return template
}
const optionalNumberBlock = (definition: TemplateDefinition) => {
  definition.blocks.push(TemplateBlockSchema.parse({ id: 'card', version: 1, name: 'Card',
    props: { amount: { type: 'number' } }, roots: ['amount'], nodes: {
      amount: { id: 'amount', kind: 'text', name: 'Amount', parts: [{ value: { source: 'prop', name: 'amount' }, format: 'number' }] },
    } }))
  definition.nodes.card = TemplateNodeSchema.parse({ id: 'card', kind: 'block', name: 'Card', blockId: 'card', version: 1 })
  definition.roots.push('card')
  return definition
}

describe('draft composition and reusable contract guarantees', () => {
  it('round trips unfinished draft JSON while complete HTML validation remains strict', () => {
    const creator = createTemplateCreator({ initialTemplate: plain(), onError: vi.fn() })
    creator.actions.insert('img')
    const persisted = JSON.parse(creator.exportDocument('json').data)
    expect(parseTemplateDraft(persisted)).toEqual(creator.getTemplate())
    expect(() => creator.actions.load(persisted)).not.toThrow()
    expect(getTemplateIssues(creator.getTemplate())).toContainEqual(expect.objectContaining({ code: 'reference' }))
    expect(() => creator.exportDocument('html')).toThrow('Resolve')
    expect(() => parseTemplateDraft({ ...persisted, unknown: true })).toThrow()
    creator.destroy()
  })
  it('renders omitted optional repeaters as empty while rejecting null and missing required data', () => {
    const template = plain()
    template.fields.push(TemplateFieldSchema.parse({ id: 'items', path: 'items', label: 'Items', required: false,
      schema: { type: 'array', items: { type: 'string' } } }))
    template.nodes.repeat = TemplateNodeSchema.parse({ id: 'repeat', name: 'Repeat', kind: 'repeat',
      binding: { source: 'field', fieldId: 'items' }, children: [] })
    template.roots.push('repeat')
    const revision = createTemplateRevision(template)
    expect(validateJSONData(revision.dataContract, {})).toEqual([])
    expect(renderTemplate(revision, { data: {} }).issues).toEqual([])
    expect(renderTemplate(revision, { data: { items: null } }).issues.length).toBeGreaterThan(0)
    template.fields[0].required = true
    expect(renderTemplate(createTemplateRevision(template), { data: {} }).issues.length).toBeGreaterThan(0)
  })
  it('rejects detaching an unrepresentable omitted property without editing the document or history', () => {
    const definition = optionalNumberBlock(plain())
    expect(renderTemplate(definition).issues).toEqual([])
    const creator = createTemplateCreator({ initialTemplate: definition, onError: vi.fn() })
    expect(() => creator.actions.detachBlock('card')).toThrow('Set property amount')
    expect(creator.getTemplate()).toEqual(definition)
    expect(getCreatorRuntime(creator).store.getState().undo).toEqual([])
    creator.actions.setBlockProperty('card', 'amount', { source: 'literal', value: 42 })
    creator.actions.detachBlock('card')
    expect(renderTemplate(creator.getTemplate()).issues).toEqual([])
    creator.destroy()
  })
  it('uses validated property defaults consistently in rendering, insertion and detachment', () => {
    const template = optionalNumberBlock(plain())
    template.blocks[0].requiredProps = ['amount']
    template.blocks[0].propertyMetadata = { amount: { label: 'Amount', description: '', defaultValue: 42 } }
    const creator = createTemplateCreator({ initialTemplate: template })
    expect(renderTemplate(template).html).toContain('42')
    creator.actions.detachBlock('card')
    expect(renderTemplate(creator.getTemplate()).html).toContain('42')
    template.blocks[0].propertyMetadata.amount.defaultValue = 'wrong'
    expect(() => parseTemplateDefinition(template)).toThrow()
    creator.destroy()
  })
  it('does not erase a block fallback when detaching a dynamic optional field binding', () => {
    const template = optionalNumberBlock(plain())
    template.fields.push(TemplateFieldSchema.parse({ id: 'amount', path: 'amount', label: 'Amount', required: false, schema: { type: 'number' } }))
    template.blocks[0].propertyMetadata = { amount: { label: 'Amount', description: '', defaultValue: 42 } }
    const instance = template.nodes.card
    if (instance.kind === 'block') instance.props.amount = { source: 'field', fieldId: 'amount' }
    expect(renderTemplate(template).html).toContain('42')
    const creator = createTemplateCreator({ initialTemplate: template, onError: vi.fn() })
    expect(() => creator.actions.detachBlock('card')).toThrow('can use a block default')
    expect(creator.getTemplate()).toEqual(template)
    creator.destroy()
  })
  it('captures maximal field IDs and property-name collisions without truncating identity', () => {
    const template = plain(), shortId = 'f'.repeat(78), longId = `p_${shortId}`
    template.fields.push(...[shortId, longId].map((id, index) => TemplateFieldSchema.parse({ id, path: `value${index}`,
      label: `Value ${index}`, schema: { type: 'string' } })))
    template.nodes.note = TemplateNodeSchema.parse({ ...text('note'), parts: template.fields.map(field => ({ value: { source: 'field', fieldId: field.id } })) })
    const creator = createTemplateCreator({ initialTemplate: template })
    const id = creator.actions.saveBlock('note', 'Long fields')
    const instance = creator.actions.insertBlock(id, 1)
    const node = creator.getTemplate().nodes[instance]
    expect(node.kind === 'block' && Object.values(node.props).map(value => value.source === 'field' && value.fieldId)).toEqual([shortId, longId])
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    creator.destroy()
  })
  it('treats inherited property names as ordinary own data keys and ignores missing node names', () => {
    const template = plain()
    template.fields.push(TemplateFieldSchema.parse({ id: 'nested', path: 'toString.name', label: 'Name', schema: { type: 'string' } }))
    expect(() => getTemplateDataSchema(template)).not.toThrow()
    expect(validateJSONData(getTemplateDataSchema(template), { toString: { name: 'Valid' } })).toEqual([])
    template.fields[0].required = false
    expect(validateJSONData(getTemplateDataSchema(template), {})).toEqual([])
    const creator = createTemplateCreator({ initialTemplate: template })
    creator.actions.select('toString')
    creator.actions.updateNode('toString', { name: 'Missing' })
    creator.actions.move('toString', null, 0)
    expect(creator.getTemplate()).toEqual(template)
    expect(getCreatorRuntime(creator).store.getState().selectedId).toBe('note')
    const editor = createTemplateEditor({ template: createTemplateRevision(template), onError: vi.fn() })
    expect(() => editor.actions.override('toString', {})).toThrow('Unknown node')
    creator.destroy()
    editor.destroy()
  })
  it('keeps inherited slot/property names absent unless explicitly supplied', () => {
    const template = plain()
    template.blocks.push(TemplateBlockSchema.parse({ id: 'card', version: 1, name: 'Card', props: { toString: { type: 'string' } },
      roots: ['text', 'slot'], nodes: {
        text: { id: 'text', name: 'Value', kind: 'text', parts: [{ value: { source: 'prop', name: 'toString' } }] },
        slot: { id: 'slot', name: 'Slot', kind: 'slot', slot: 'toString', children: ['fallback'] },
        fallback: text('fallback', 'Fallback content'),
      } }))
    template.nodes.card = TemplateNodeSchema.parse({ id: 'card', name: 'Card', kind: 'block', blockId: 'card', version: 1 })
    template.roots.push('card')
    const result = renderTemplate(template)
    expect(result.issues).toEqual([])
    expect(result.html).toContain('Fallback content')
    expect(result.html).not.toContain('function toString')
  })
  it('exports/imports nested pinned block and asset dependencies atomically with conflict protection', () => {
    const source = plain()
    source.assets.push({ id: 'logo', name: 'Logo', kind: 'image', mimeType: 'image/png', url: '/logo.png' })
    source.blocks.push(TemplateBlockSchema.parse({ id: 'image', version: 1, name: 'Image', roots: ['image'], nodes: {
      image: { id: 'image', kind: 'element', name: 'Image', tag: 'img', attributeBindings: { src: { source: 'asset', assetId: 'logo' } } },
    } }), TemplateBlockSchema.parse({ id: 'card', version: 1, name: 'Card', roots: ['image'], nodes: {
      image: { id: 'image', kind: 'block', name: 'Image', blockId: 'image', version: 1 },
    } }))
    const library = exportTemplateBlock(source, 'card', 1)
    expect(library.blocks.map(block => block.id)).toEqual(['card', 'image'])
    expect(library.assets.map(asset => asset.id)).toEqual(['logo'])
    const creator = createTemplateCreator({ initialTemplate: plain(), onError: vi.fn() })
    creator.actions.importBlockLibrary(library)
    creator.actions.importBlockLibrary(library)
    creator.actions.insertBlock('card', 1)
    expect(renderTemplate(creator.getTemplate()).html).toContain('/logo.png')
    const before = creator.getTemplate()
    const conflict = structuredClone(library)
    conflict.assets[0].url = '/different.png'
    expect(() => creator.actions.importBlockLibrary(conflict)).toThrow('different asset')
    expect(creator.getTemplate()).toEqual(before)
    expect(() => parseTemplateBlockLibrary({ ...library, blocks: library.blocks.slice(0, 1) })).toThrow('Unknown reusable block')
    creator.destroy()
  })
  it('revises definitions immutably and restores displaced slot content without orphaning it', () => {
    const template = plain()
    template.blocks.push(TemplateBlockSchema.parse({ id: 'card', version: 1, name: 'Card', roots: ['body'], nodes: {
      body: { id: 'body', kind: 'slot', name: 'Body', slot: 'body', children: [] },
    } }))
    const creator = createTemplateCreator({ initialTemplate: template })
    const id = creator.actions.insertBlock('card', 1)
    creator.actions.setBlockSlot(id, 'body', ['note'])
    expect(creator.getTemplate().roots).not.toContain('note')
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    creator.actions.setBlockSlot(id, 'body', undefined)
    expect(creator.getTemplate().roots).toContain('note')
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    const version = creator.actions.reviseBlock('card', 1, { name: 'Updated card' })
    expect(version).toBe(2)
    expect(creator.getTemplate().nodes[id]).toMatchObject({ version: 1 })
    expect(creator.getTemplate().blocks[0].name).toBe('Card')
    creator.destroy()
  })
})
