import { expect, it } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateBlockSchema, TemplateDefinitionSchema, TemplateNodeSchema, type TemplateDefinition, type TemplateValue } from '../template-core/schema'
import { renderTemplate } from '../template-core/render'
import { exportBindingDocument } from './bindings'
import { requiresSharedCompiler } from './compilation'
import { exportSharedTemplateDocument } from './document'
import { renderSharedTemplateDocument } from './shared'

const token = '{{b_message}}'
function fixture() {
  return TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Message'), id: 'message', roots: ['paragraph'],
    fields: [{ id: 'message', path: 'inputs.message', label: 'Message', schema: { type: 'string' }, required: true, editable: true, defaultValue: 'Default' }],
    nodes: {
      paragraph: { id: 'paragraph', name: 'Paragraph', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'message' } }] },
    },
  })
}
function block(template: TemplateDefinition, defaulted = false) {
  const value = { lines: [token] }
  template.blocks.push(TemplateBlockSchema.parse({
    id: 'card', version: 1, name: 'Card', props: { details: { type: 'object', properties: { lines: { type: 'array', items: { type: 'string' } } }, additionalProperties: false } },
    ...(defaulted ? { propertyMetadata: { details: { label: 'Details', defaultValue: value } } } : {}),
    roots: ['details'], nodes: { details: { id: 'details', name: 'Details', kind: 'text', parts: [{ value: { source: 'prop', name: 'details' } }] } },
  }))
  template.nodes.card = { id: 'card', name: 'Card', kind: 'block', blockId: 'card', version: 1, props: defaulted ? {} : { details: { source: 'literal', value } }, slots: {}, permissions: { content: false, style: false } }
  template.roots.push('card')
}
function fragmentBlock(template: TemplateDefinition, location: 'roots' | 'children' | 'parts', property?: 'assigned' | 'default') {
  const prefix: TemplateValue = property ? { source: 'prop', name: 'prefix' } : { source: 'literal', value: '{{b_' }
  const suffix = { value: { source: 'literal' as const, value: 'message}}' } }
  const nodes = {
    first: { id: 'first', name: 'First', kind: 'text', parts: [{ value: prefix }, ...(location === 'parts' ? [suffix] : [])] },
    ...(location === 'parts' ? {} : { second: { id: 'second', name: 'Second', kind: 'text', parts: [suffix] } }),
    ...(location === 'children' ? { paragraph: { id: 'paragraph', name: 'Paragraph', kind: 'element', tag: 'p', children: ['first', 'second'] } } : {}),
  }
  template.blocks.push(TemplateBlockSchema.parse({ id: 'fragments', version: 1, name: 'Fragments',
    props: property ? { prefix: { type: 'string' } } : {},
    ...(property === 'default' ? { propertyMetadata: { prefix: { label: 'Prefix', defaultValue: '{{b_' } } } : {}),
    roots: location === 'children' ? ['paragraph'] : location === 'parts' ? ['first'] : ['first', 'second'], nodes,
  }))
  template.nodes.fragments = TemplateNodeSchema.parse({ id: 'fragments', name: 'Fragments', kind: 'block', blockId: 'fragments', version: 1,
    props: property === 'assigned' ? { prefix: { source: 'literal', value: '{{b_' } } : {},
  })
  template.roots.push('fragments')
}

const cases: [string, (template: TemplateDefinition) => void][] = [
  ['template title', template => { template.name = `Message ${token}` }],
  ['theme stylesheet', template => { template.styles.theme = `/* ${token} */ p{color:red}` }],
  ['template stylesheet', template => { template.styles.css = `/* ${token} */ p{color:red}` }],
  ['text literal', template => { if (template.nodes.copy.kind === 'text') template.nodes.copy.parts.unshift({ value: { source: 'literal', value: token }, format: 'text', currency: 'EUR' }) }],
  ['adjacent literal text parts', template => { if (template.nodes.copy.kind === 'text') template.nodes.copy.parts.unshift(...['{{b_', 'message}}'].map(value => ({ value: { source: 'literal' as const, value }, format: 'text' as const, currency: 'EUR' }))) }],
  ['literal text parts separated by null', template => { if (template.nodes.copy.kind === 'text') template.nodes.copy.parts.unshift(...['{{b_', null, 'message}}'].map(value => ({ value: { source: 'literal' as const, value }, format: 'text' as const, currency: 'EUR' }))) }],
  ['nested text literal', template => { if (template.nodes.copy.kind === 'text') template.nodes.copy.parts.unshift({ value: { source: 'literal', value: { lines: [token] } }, format: 'text', currency: 'EUR' }) }],
  ['static attribute', template => { if (template.nodes.paragraph.kind === 'element') template.nodes.paragraph.attributes.title = token }],
  ['literal attribute binding', template => { if (template.nodes.paragraph.kind === 'element') template.nodes.paragraph.attributeBindings.title = { source: 'literal', value: token } }],
  ['nested block property', template => { block(template) }],
  ['nested block default', template => { block(template, true) }],
  ['adjacent block root text nodes', template => { fragmentBlock(template, 'roots') }],
  ['adjacent block child text nodes', template => { fragmentBlock(template, 'children') }],
  ['literal block property text parts', template => { fragmentBlock(template, 'parts', 'assigned') }],
  ['default block property text parts', template => { fragmentBlock(template, 'parts', 'default') }],
  ['text literal object key', template => { if (template.nodes.copy.kind === 'text') template.nodes.copy.parts.unshift({ value: { source: 'literal', value: { [token]: 'Plain' } }, format: 'text', currency: 'EUR' }) }],
  ['block stylesheet', template => { block(template); if (template.nodes.card.kind === 'block') template.nodes.card.props.details = { source: 'literal', value: { lines: ['Plain'] } }; template.blocks[0].css = `/* ${token} */ p{color:red}` }],
]

it.each(cases)('uses shared compilation for reserved binding syntax in %s', (_name, mutate) => {
  const template = fixture()
  mutate(template)
  expect(requiresSharedCompiler(template)).toBe(true)
  expect(() => exportBindingDocument(template, { target: 'document' })).toThrow(/literal.*shared compiler/i)
  const document = exportSharedTemplateDocument(template, { target: 'document' })
  const output = renderSharedTemplateDocument(document, { facts: {}, context: {}, content: {}, inputs: { message: 'Actual' }, settings: {} })
  expect(output.html).toContain(token)
  expect(output.html).toContain('Actual')
})

it('keeps top-level sibling text fragments in separate fixed annotation spans', () => {
  const template = fixture()
  template.nodes.first = TemplateNodeSchema.parse({ id: 'first', name: 'First', kind: 'text', parts: [{ value: { source: 'literal', value: '{{b_' } }] })
  template.nodes.second = TemplateNodeSchema.parse({ id: 'second', name: 'Second', kind: 'text', parts: [{ value: { source: 'literal', value: 'message}}' } }] })
  template.roots.push('first', 'second')
  expect(requiresSharedCompiler(template)).toBe(false)
  const document = exportBindingDocument(template, { target: 'document' })
  expect(document.artifacts.html).toContain('{{b_</span><span>message}}')
})

it('recognizes numeric text parts that complete a reserved binding identifier', () => {
  const template = fixture()
  template.fields[0].id = '123'
  if (template.nodes.copy.kind === 'text') template.nodes.copy.parts = ['{{b_', 123, '}}'].map(value => ({ value: { source: 'literal', value }, format: 'text', currency: 'EUR' }))
  expect(requiresSharedCompiler(template)).toBe(true)
  expect(() => exportBindingDocument(template, { target: 'document' })).toThrow(/literal.*shared compiler/i)
  const document = exportSharedTemplateDocument(template, { target: 'document' })
  expect(renderSharedTemplateDocument(document, { facts: {}, context: {}, content: {}, inputs: { message: 'Actual' }, settings: {} }).html).toContain('{{b_123}}')
})

it.each(['literal', 'literal prop', 'default prop'] as const)('recognizes a formatted %s number that completes an allocated binding identifier', source => {
  const template = fixture()
  template.fields[0].id = '123'
  if (template.nodes.copy.kind === 'text') template.nodes.copy.parts[0].value = { source: 'field', fieldId: '123' }
  expect(exportBindingDocument(template, { target: 'document' }).artifacts.bindings).toContainEqual({ id: 'b_123', kind: 'text', path: 'inputs.message' })
  const formatted = TemplateNodeSchema.parse({ id: 'formatted', name: 'Formatted', kind: 'text', parts: [
    { value: { source: 'literal', value: '{{b_' }, format: 'text' },
    { value: source === 'literal' ? { source: 'literal', value: 123 } : { source: 'prop', name: 'count' }, format: 'number' },
    { value: { source: 'literal', value: '}}' }, format: 'text' },
  ] })
  if (source === 'literal') {
    template.nodes.formatted = formatted
    if (template.nodes.paragraph.kind === 'element') template.nodes.paragraph.children.push('formatted')
  } else {
    template.blocks.push(TemplateBlockSchema.parse({ id: 'formatted', version: 1, name: 'Formatted', props: { count: { type: 'number' } },
      ...(source === 'default prop' ? { propertyMetadata: { count: { label: 'Count', defaultValue: 123 } } } : {}),
      roots: ['formatted'], nodes: { formatted },
    }))
    template.nodes.formatted = TemplateNodeSchema.parse({ id: 'formatted', name: 'Formatted', kind: 'block', blockId: 'formatted', version: 1,
      props: source === 'literal prop' ? { count: { source: 'literal', value: 123 } } : {},
    })
    template.roots.push('formatted')
  }
  const data = { facts: {}, context: {}, content: {}, inputs: { message: 'Actual' }, settings: {} }
  const raw = renderTemplate(template, { data: { inputs: { message: 'Actual' } }, annotate: true })
  expect(raw.issues).toEqual([])
  expect(raw.html).toContain('{{b_123}}')
  const document = exportSharedTemplateDocument(template, { target: 'document' })
  expect(renderSharedTemplateDocument(document, data).html).toContain('{{b_123}}')
  expect(requiresSharedCompiler(template)).toBe(true)
  expect(() => exportBindingDocument(template, { target: 'document' })).toThrow(/literal.*shared compiler/i)
})

it('keeps field substitutions as boundaries because fixed replacement runs once', () => {
  const template = fixture()
  if (template.nodes.copy.kind === 'text') template.nodes.copy.parts = [
    { value: { source: 'literal', value: '{{b_' }, format: 'text', currency: 'EUR' },
    { value: { source: 'field', fieldId: 'message' }, format: 'text', currency: 'EUR' },
    { value: { source: 'literal', value: 'message}}' }, format: 'text', currency: 'EUR' },
  ]
  expect(requiresSharedCompiler(template)).toBe(false)
  expect(() => exportBindingDocument(template, { target: 'document' })).not.toThrow()
})

it('does not recurse indefinitely while a draft has a cyclic block slot', () => {
  const template = fixture()
  template.blocks.push(TemplateBlockSchema.parse({ id: 'cycle', version: 1, name: 'Cycle', roots: ['loop'],
    nodes: { loop: { id: 'loop', name: 'Loop', kind: 'slot', slot: 'loop', children: ['loop'] } },
  }))
  expect(requiresSharedCompiler(template)).toBe(false)
})

it('recognizes reserved syntax assembled through a nested supplied block slot', () => {
  const template = fixture()
  expect(exportBindingDocument(template, { target: 'document' }).artifacts.bindings).toContainEqual({ id: 'b_message', kind: 'text', path: 'inputs.message' })
  template.blocks.push(TemplateBlockSchema.parse({ id: 'inner', version: 1, name: 'Inner', roots: ['prefix', 'body', 'suffix'], nodes: {
    prefix: { id: 'prefix', name: 'Prefix', kind: 'text', parts: [{ value: { source: 'literal', value: '{{b_' } }] },
    body: { id: 'body', name: 'Body', kind: 'slot', slot: 'body', children: ['fallback'] },
    fallback: { id: 'fallback', name: 'Fallback', kind: 'element', tag: 'span', children: ['fallbackText'] },
    fallbackText: { id: 'fallbackText', name: 'Fallback text', kind: 'text', parts: [{ value: { source: 'literal', value: 'Fallback' } }] },
    suffix: { id: 'suffix', name: 'Suffix', kind: 'text', parts: [{ value: { source: 'literal', value: '}}' } }] },
  } }), TemplateBlockSchema.parse({ id: 'outer', version: 1, name: 'Outer', roots: ['innerInstance'], nodes: {
    innerInstance: { id: 'innerInstance', name: 'Inner', kind: 'block', blockId: 'inner', version: 1, slots: { body: ['supplied'] } },
    supplied: { id: 'supplied', name: 'Supplied', kind: 'text', parts: [{ value: { source: 'literal', value: 'message' } }] },
  } }))
  template.nodes.outer = TemplateNodeSchema.parse({ id: 'outer', name: 'Outer', kind: 'block', blockId: 'outer', version: 1 })
  template.roots.push('outer')
  const raw = renderTemplate(template, { data: { inputs: { message: 'Actual' } }, annotate: true })
  expect(raw.issues).toEqual([])
  expect(raw.html).toContain('{{b_message}}')
  const document = exportSharedTemplateDocument(template, { target: 'document' })
  expect(renderSharedTemplateDocument(document, { facts: {}, context: {}, content: {}, inputs: { message: 'Actual' }, settings: {} }).html).toContain('{{b_message}}')
  expect(requiresSharedCompiler(template)).toBe(true)
  expect(() => exportBindingDocument(template, { target: 'document' })).toThrow(/literal.*shared compiler/i)
})

it('recognizes reserved inline-style syntax without relaxing existing style validation', () => {
  const template = fixture()
  if (template.nodes.paragraph.kind === 'element') template.nodes.paragraph.style['--label'] = token
  expect(requiresSharedCompiler(template)).toBe(true)
  expect(() => exportBindingDocument(template, { target: 'document' })).toThrow()
  expect(() => exportSharedTemplateDocument(template, { target: 'document' })).toThrow(/plain CSS/i)
})

it('does not promote unused metadata or runtime field defaults to source literals', () => {
  const template = fixture()
  template.description = token
  template.fields[0].label = token
  template.fields[0].description = token
  template.fields[0].defaultValue = token
  template.nodes.copy.name = token
  block(template, true)
  template.blocks[0].name = token
  template.blocks[0].propertyMetadata!.details = { label: token, description: token, defaultValue: { lines: ['Plain'] } }
  expect(requiresSharedCompiler(template)).toBe(false)
  expect(() => exportBindingDocument(template, { target: 'document' })).not.toThrow()
})

it('keeps declared subject and plain-text token bindings intentional', () => {
  const template = fixture()
  expect(requiresSharedCompiler(template)).toBe(false)
  const document = exportBindingDocument(template, { target: 'document', subject: `Hello ${token}`, text: `Message: ${token}` })
  expect(document.artifacts).toMatchObject({ subject: `Hello ${token}`, text: `Message: ${token}` })
  expect(document.artifacts.bindings).toContainEqual({ id: 'b_message', kind: 'text', path: 'inputs.message' })
})
