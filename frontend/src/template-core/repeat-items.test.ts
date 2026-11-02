import { describe, expect, it } from 'vitest'
import { createTemplateDefinition } from './defaults'
import { TemplateDefinitionSchema, type DataSchema, type JsonValue } from './schema'
import { renderTemplate } from './render'

function repeated(items: DataSchema, path = '', format = 'text') {
  return TemplateDefinitionSchema.parse({ ...createTemplateDefinition(), roots: ['repeat'],
    fields: [{ id: 'items', path: 'inputs.items', label: 'Items', schema: { type: 'array', items } }],
    nodes: {
      repeat: { id: 'repeat', name: 'Items', kind: 'repeat', binding: { source: 'field', fieldId: 'items' }, children: ['row'] },
      row: { id: 'row', name: 'Row', kind: 'element', tag: 'p', children: ['value'] },
      value: { id: 'value', name: 'Value', kind: 'text', parts: [{ value: { source: 'item', path }, format }] },
    },
  })
}

describe('repeater item contracts', () => {
  it.each<{ schema: DataSchema; values: JsonValue[]; rendered: string[] }>([
    { schema: { type: 'string' }, values: ['Alex', '<Sam>'], rendered: ['<p>Alex</p>', '<p>&lt;Sam&gt;</p>'] },
    { schema: { type: 'number' }, values: [0, 42], rendered: ['<p>0</p>', '<p>42</p>'] },
    { schema: { type: 'boolean' }, values: [false, true], rendered: ['<p>false</p>', '<p>true</p>'] },
  ])('renders the current primitive item without inventing an object wrapper: $schema.type', ({ schema, values, rendered }) => {
    const output = renderTemplate(repeated(schema), { data: { inputs: { items: values } } })
    expect(output.issues).toEqual([])
    for (const row of rendered) expect(output.html).toContain(row)
  })

  it('resolves nested primitive repeats against the nearest item and handles empty arrays', () => {
    const template = repeated({ type: 'object', properties: { names: { type: 'array', items: { type: 'string' } } }, required: ['names'], additionalProperties: false })
    template.nodes.repeat.kind === 'repeat' && (template.nodes.repeat.children = ['nested'])
    template.nodes.nested = { id: 'nested', name: 'Names', kind: 'repeat', binding: { source: 'item', path: 'names' }, children: ['row'], permissions: { content: false, style: false } }
    const output = renderTemplate(template, { data: { inputs: { items: [{ names: ['One', 'Two'] }, { names: [] }, { names: ['Three'] }] } } })
    expect(output.issues).toEqual([])
    expect(output.html).toContain('<p>One</p><p>Two</p><p>Three</p>')
  })

  it('renders item properties in literal arrays without a declared field schema', () => {
    const template = repeated({ type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false }, 'name')
    template.fields = []
    if (template.nodes.repeat.kind === 'repeat') template.nodes.repeat.binding = { source: 'literal', value: [{ name: 'One' }, { name: 'Two' }] }
    expect(renderTemplate(template).issues).toEqual([])
    expect(renderTemplate(template).html).toContain('<p>One</p><p>Two</p>')
  })

  it('resolves nested item arrays from literal items and validates their runtime values', () => {
    const template = repeated({ type: 'string' })
    template.fields = []
    if (template.nodes.repeat.kind === 'repeat') {
      template.nodes.repeat.binding = { source: 'literal', value: [{ children: ['A', 'B'] }] }
      template.nodes.repeat.children = ['nested']
    }
    template.nodes.nested = { id: 'nested', name: 'Children', kind: 'repeat', binding: { source: 'item', path: 'children' }, children: ['row'], permissions: { content: false, style: false } }
    const output = renderTemplate(template)
    expect(output.issues).toEqual([])
    expect(output.html).toContain('<p>A</p><p>B</p>')
    if (template.nodes.repeat.kind === 'repeat') template.nodes.repeat.binding = { source: 'literal', value: [{ children: 'Wrong' }] }
    expect(renderTemplate(template).issues.some(issue => issue.message === 'Repeater binding must resolve to an array.')).toBe(true)
  })

  it('keeps declared item paths, formatting types and repeater context enforced', () => {
    expect(renderTemplate(repeated({ type: 'string' }, 'unknown')).issues.some(issue => issue.code === 'binding-type')).toBe(true)
    expect(renderTemplate(repeated({ type: 'string' }, '', 'currency')).issues.some(issue => issue.code === 'binding-type')).toBe(true)
    const template = repeated({ type: 'string' })
    template.roots = ['row']; delete template.nodes.repeat
    expect(renderTemplate(template).issues.some(issue => issue.message.includes('repeater context'))).toBe(true)
  })
})
