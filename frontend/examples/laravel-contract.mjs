import { writeFileSync, readFileSync } from 'node:fs'
import { TemplateDefinitionSchema } from '../dist/template-schema.js'
import { exportBindingDocument, exportSharedTemplateDocument } from '../dist/template-renderer.js'
import { createTemplateColumns } from '../dist/template-renderer.js'
const definition = TemplateDefinitionSchema.parse({
  format: 'gct-template', schemaVersion: 1, id: 'experience', name: 'Experience voucher',
  page: {}, roots: ['message'], nodes: {
    message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: ['copy'] },
    copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [
      { value: { source: 'field', fieldId: 'code' } },
      { value: { source: 'literal', value: ' — ' } },
      { value: { source: 'field', fieldId: 'message' } },
    ] },
  }, fields: [
    { id: 'code', path: 'facts.code', label: 'Code', schema: { type: 'string', minLength: 1 }, required: true, editable: false },
    { id: 'message', path: 'inputs.message', label: 'Message', schema: { type: 'string', maxLength: 200 }, required: true, editable: true, defaultValue: 'Enjoy your experience!' },
  ],
})
const settings = [{ id: 'textSize', label: 'Text size', schema: { type: 'number', minimum: 12, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px', targets: [{ nodeId: 'message', property: 'font-size' }] }]
const fixtures = { bindings: exportBindingDocument(definition, { target: 'document', settings, subject: 'Experience voucher', text: 'Your voucher is ready.' }) }
const structural = structuredClone(definition)
structural.roots = ['condition']
structural.nodes.condition = { id: 'condition', name: 'Conditional message', kind: 'condition', binding: { source: 'field', fieldId: 'message' }, operator: 'truthy', children: ['message'], permissions: { content: false, style: false } }
fixtures.shared = exportSharedTemplateDocument(structural, { target: 'document', settings, subject: 'Experience voucher', text: 'Your voucher is ready.' })

// Editable column presets remain ordinary, deterministic graph nodes on the wire.
const columns = TemplateDefinitionSchema.parse({ ...definition, id: 'building_blocks', name: 'Column template',
  ...createTemplateColumns([30, 70]), fields: [
    { id: 'message', path: 'inputs.message', label: 'Message', schema: { type: 'string' }, defaultValue: 'Enjoy!' },
    { id: 'actionValue', path: 'inputs.action.value', label: 'Action label', schema: { type: 'string' }, defaultValue: 'Redeem' },
    { id: 'actionLink', path: 'inputs.action.link', label: 'Action destination', schema: { type: 'string', format: 'uri' }, defaultValue: 'https://example.com' },
  ],
})
columns.nodes.copy_0.parts = [{ value: { source: 'field', fieldId: 'message' }, format: 'text', currency: 'EUR' }]
columns.nodes.copy_1.parts = [{ value: { source: 'field', fieldId: 'actionValue' }, format: 'text', currency: 'EUR' }]
columns.nodes.action = { id: 'action', name: 'Action', kind: 'element', tag: 'a', classes: ['action'], style: {}, attributes: {}, attributeBindings: { href: { source: 'field', fieldId: 'actionLink' } }, children: ['copy_1'], permissions: { content: false, style: false } }
columns.nodes.column_1.children = ['action']
fixtures['building-columns'] = exportBindingDocument(columns, { target: 'email' })

const repeating = structuredClone(columns)
repeating.fields.push({ id: 'items', path: 'facts.items', label: 'Items', schema: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['name', 'tags'], additionalProperties: false } }, sample: [{ name: 'Preview', tags: ['Sample'] }], required: true, editable: false, description: '' })
repeating.nodes.column_1.children = ['items']
delete repeating.nodes.action; delete repeating.nodes.copy_1
const repeatNode = (id, binding, children) => ({ id, name: id, kind: 'repeat', binding, children, permissions: { content: false, style: false } })
const textNode = (id, path) => ({ id, name: id, kind: 'text', parts: [{ value: { source: 'item', path }, format: 'text', currency: 'EUR' }], permissions: { content: false, style: false } })
repeating.nodes.items = repeatNode('items', { source: 'field', fieldId: 'items' }, ['item_name', 'tags'])
repeating.nodes.item_name = textNode('item_name', 'name')
repeating.nodes.tags = repeatNode('tags', { source: 'item', path: 'tags' }, ['tag'])
repeating.nodes.tag = textNode('tag', '')
fixtures['building-repeats'] = exportSharedTemplateDocument(repeating, { target: 'email' })
for (const [engine, document] of Object.entries(fixtures)) {
  const path = new URL(`../scripts/fixtures/${engine}.json`, import.meta.url)
  const json = JSON.stringify(document, null, 2) + '\n'
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== json) throw new Error(`Laravel fixture is stale: ${engine}`)
  } else writeFileSync(path, json)
}
console.log('Laravel contract fixtures match the built React compiler.')
