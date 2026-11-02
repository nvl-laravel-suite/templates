import { describe, expect, it } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateDefinitionSchema } from '../template-core/schema'
import * as platform from './platform'
import { requiresSharedCompiler } from './compilation'

function fixture() {
  return TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Experience'), id: 'experience', roots: ['message'],
    nodes: { message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'messageText' } }] } },
    fields: [{ id: 'messageText', path: 'inputs.message', label: 'Message', schema: { type: 'string', maxLength: 200 }, required: true, editable: true, defaultValue: 'Enjoy!' }],
  })
}

describe('portable template platform', () => {
  it('exports editable source and fixed binding artifacts without resolving customer values early', () => {
    expect(platform).toHaveProperty('exportBindingDocument')
    const result = platform.exportBindingDocument(fixture(), { target: 'document' })
    expect(result.format).toBe('template-document')
    expect(result.source.definition.fields[0].path).toBe('inputs.message')
    expect(result.artifacts.engine).toBe('bindings')
    expect(result.artifacts.html).toContain('{{b_messageText}}')
    expect(result.artifacts.bindings).toContainEqual({ id: 'b_messageText', path: 'inputs.message', kind: 'text' })
    expect(result.exposedInputs).toEqual(['message'])
    expect(result.dataSchema.properties).toHaveProperty('facts')
    expect(result.inputDefaults).toEqual({ message: 'Enjoy!' })
  })

  it('rejects runtime structural behavior rather than freezing sample-expanded output', () => {
    expect(platform).toHaveProperty('exportBindingDocument')
    const t = fixture()
    t.nodes.message = { id: 'message', name: 'Optional', kind: 'condition', binding: { source: 'literal', value: true }, operator: 'truthy', children: ['copy'], permissions: { content: false, style: false } }
    expect(() => platform.exportBindingDocument(t, { target: 'document' })).toThrow(/shared compiler/i)
  })

  it('applies semantic theme values to complete exported CSS', () => {
    expect(platform).toHaveProperty('createTemplateTheme')
    const theme = platform.createTemplateTheme({ colors: { primary: '#123456' } })
    const result = platform.exportBindingDocument(fixture(), { target: 'document', theme })
    expect(result.artifacts.html).toContain('#123456')
    expect(result.artifacts.html).toContain('font-size:14px')
    expect(result.theme.colors.primary).toBe('#123456')
  })

  it('exports only selected typed settings and validates values without mutating source', () => {
    expect(platform).toHaveProperty('resolvePresentationSettings')
    const t = fixture()
    const spec = [{ id: 'fontSize', label: 'Font size', schema: { type: 'number' as const, minimum: 12, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px' as const, targets: [{ nodeId: 'message', property: 'font-size' }] }]
    const result = platform.exportBindingDocument(t, { target: 'document', settings: spec })
    expect(result.artifacts.html).toContain('font-size:{{s_fontSize}}')
    expect(result.exposedSettings).toEqual(['fontSize'])
    expect(platform.resolvePresentationSettings(spec, { fontSize: 20 })).toEqual({ fontSize: 20 })
    expect(() => platform.resolvePresentationSettings(spec, { fontSize: 100 })).toThrow()
    expect(t.nodes.message.kind === 'element' && t.nodes.message.style).toEqual({})
  })

  it('materializes explicit family differences and never widens exposed controls', () => {
    expect(platform).toHaveProperty('materializeFamilyDocument')
    const base = platform.exportBindingDocument(fixture(), { target: 'document' })
    base.content = { heading: 'Default' }
    const variant = platform.materializeFamilyDocument(base, { content: { heading: 'Celebration' } })
    expect(variant.content.heading).toBe('Celebration')
    expect(base.content.heading).toBe('Default')
    expect(() => platform.materializeFamilyDocument(base, { exposedInputs: ['code'] })).toThrow()
  })

  it('filters explicit partial scopes without name-based shadowing', () => {
    expect(platform).toHaveProperty('visibleTemplateResources')
    const resources = [
      { id: 'library', key: 'footer', scope: 'tenant' as const },
      { id: 'family', key: 'footer', scope: 'group' as const, groupId: 'g1' },
      { id: 'local', key: 'footer', scope: 'template' as const, templateId: 't1' },
      { id: 'private', key: 'footer', scope: 'template' as const, templateId: 't2' },
    ]
    expect(platform.visibleTemplateResources(resources, { templateId: 't1', groupId: 'g1' }).map(r => r.id)).toEqual(['library', 'family', 'local'])
    expect(platform.visibleTemplateResources(resources, { templateId: 't2' }).map(r => r.id)).toEqual(['library', 'private'])
  })
  it('exports email geometry independently from the printable page', () => {
    const result = platform.exportBindingDocument(fixture(), { target: 'email' })
    expect(result.artifacts.html).not.toContain('@page')
    expect(result.artifacts.html).not.toContain('<main')
    expect(result.artifacts.html).toContain('width="600"')
    expect(result.artifacts.html).toContain('max-width:100%')
  })

  it('renders a shared definition with real data and selected styles without using samples', () => {
    expect(platform).toHaveProperty('renderSharedTemplateDocument')
    const t = fixture()
    const settings = [{ id: 'fontSize', label: 'Font size', schema: { type: 'number' as const, minimum: 12, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px' as const, targets: [{ nodeId: 'message', property: 'font-size' }] }]
    const doc = platform.exportBindingDocument(t, { target: 'document', settings })
    doc.artifacts.engine = 'shared'
    const output = platform.renderSharedTemplateDocument(doc, { inputs: { message: '<Actual>' }, settings: { fontSize: 20 }, facts: {}, content: {}, context: {} })
    expect(output.html).toContain('&lt;Actual&gt;')
    expect(output.html).toContain('font-size:20px')
    expect(output.html).not.toContain('{{b_messageText}}')
  })

  it('exports image assets as retained managed bindings rather than mutable source URLs', () => {
    const t = fixture()
    t.assets = [{ id: 'logo', name: 'Logo', kind: 'image', url: 'https://example.com/logo.png', mimeType: 'image/png' }]
    t.nodes.logo = { id: 'logo', name: 'Logo', kind: 'element', tag: 'img', attributes: { alt: 'Logo' }, attributeBindings: { src: { source: 'asset', assetId: 'logo' } }, style: {}, classes: [], children: [], permissions: { content: false, style: false } }
    t.roots.push('logo')
    expect(() => platform.exportBindingDocument(t, { target: 'document' })).toThrow(/managed asset/i)
    const doc = platform.exportBindingDocument(t, { target: 'document', managedAssets: { logo: 'managed-logo-id' } })
    expect(doc.content.asset_logo).toBe('managed-logo-id')
    expect(doc.artifacts.bindings).toContainEqual({ id: 'i_logo', path: 'content.asset_logo', kind: 'image' })
    expect(doc.artifacts.html).not.toContain('https://example.com/logo.png')
  })

  it.each([true, false])('preserves authored content keys when allocating managed image references (default: %s)', withDefault => {
    const t = fixture()
    t.fields[0] = { ...t.fields[0], path: 'content.asset_logo', editable: false, required: withDefault, ...(withDefault ? { defaultValue: 'Authored caption' } : {}) }
    if (!withDefault) delete t.fields[0].defaultValue
    t.assets = [{ id: 'logo', name: 'Logo', kind: 'image', url: 'https://example.com/logo.png', mimeType: 'image/png' }]
    t.nodes.logo = { id: 'logo', name: 'Logo', kind: 'element', tag: 'img', attributes: { alt: 'Logo' }, attributeBindings: { src: { source: 'asset', assetId: 'logo' } }, style: {}, classes: [], children: [], permissions: { content: false, style: false } }
    t.roots.push('logo')
    const doc = platform.exportBindingDocument(t, { target: 'document', managedAssets: { logo: 'managed-logo-id' } })
    expect(doc.content.asset_logo).toBe(withDefault ? 'Authored caption' : undefined)
    expect(doc.dataSchema.properties.content).toMatchObject({ properties: { asset_logo: { type: 'string', maxLength: 200 } } })
    const image = doc.artifacts.bindings.find(binding => binding.kind === 'image')!
    expect(image.path).not.toBe('content.asset_logo')
    expect(doc.content[image.path.slice('content.'.length)]).toBe('managed-logo-id')
  })

})

describe('module contract boundaries', () => {
  it('routes optional bound attributes through the shared compiler to preserve absent-value fallbacks', () => {
    const t = fixture()
    t.fields[0] = { ...t.fields[0], path: 'inputs.destination', required: false }
    delete t.fields[0].defaultValue
    if (t.nodes.message.kind === 'element') {
      t.nodes.message.tag = 'a'
      t.nodes.message.attributes.href = 'https://example.com/fallback'
      t.nodes.message.attributeBindings.href = { source: 'field', fieldId: 'messageText' }
    }
    expect(requiresSharedCompiler(t)).toBe(true)
    const document = platform.exportSharedTemplateDocument(t, { target: 'document' })
    const data = { facts: {}, context: {}, content: {}, inputs: {}, settings: {} }
    expect(platform.renderSharedTemplateDocument(document, data).html).toContain('href="https://example.com/fallback"')
    expect(platform.renderSharedTemplateDocument(document, { ...data, inputs: { destination: 'https://example.com/actual' } }).html).toContain('href="https://example.com/actual"')
  })

  it('rejects optional attribute bindings in fixed export while retaining required attributes and optional text', () => {
    const t = fixture()
    t.fields[0].required = false
    delete t.fields[0].defaultValue
    expect(requiresSharedCompiler(t)).toBe(false)
    expect(() => platform.exportBindingDocument(t, { target: 'document' })).not.toThrow()
    if (t.nodes.message.kind === 'element') t.nodes.message.attributeBindings.title = { source: 'field', fieldId: 'messageText' }
    expect(() => platform.exportBindingDocument(t, { target: 'document' })).toThrow(/optional.*attribute.*shared compiler/i)
    t.fields[0].required = true
    expect(requiresSharedCompiler(t)).toBe(false)
    expect(() => platform.exportBindingDocument(t, { target: 'document' })).not.toThrow()
  })

  it('retains the fixed managed-ID image adapter for optional image fields', () => {
    const t = fixture()
    t.fields[0].required = false
    delete t.fields[0].defaultValue
    t.nodes.logo = { id: 'logo', name: 'Logo', kind: 'element', tag: 'img', attributes: { alt: 'Logo' }, attributeBindings: { src: { source: 'field', fieldId: 'messageText' } }, style: {}, classes: [], children: [], permissions: { content: false, style: false } }
    t.roots.push('logo')
    expect(requiresSharedCompiler(t)).toBe(false)
    expect(platform.exportBindingDocument(t, { target: 'document' }).artifacts.bindings).toContainEqual({ id: 'i_messageText', path: 'inputs.message', kind: 'image' })
  })

  it('exports structural source for the shared compiler and nested link defaults with leaf exposure', () => {
    expect(platform).toHaveProperty('exportSharedTemplateDocument')
    const t = fixture()
    t.fields[0].path = 'inputs.action.value'
    t.fields[0].id = 'message-text'
    if (t.nodes.copy.kind === 'text') t.nodes.copy.parts[0].value = { source: 'field', fieldId: 'message-text' }
    t.nodes.message = { id: 'message', name: 'Optional', kind: 'condition', binding: { source: 'literal', value: true }, operator: 'truthy', children: ['copy'], permissions: { content: false, style: false } }
    const doc = platform.exportSharedTemplateDocument(t, { target: 'document' })
    expect(doc.artifacts.engine).toBe('shared')
    expect(doc.inputDefaults).toEqual({ action: { value: 'Enjoy!' } })
    expect(doc.exposedInputs).toEqual(['action.value'])
    const output = platform.renderSharedTemplateDocument(doc, { inputs: { action: { value: 'Actual' } }, settings: {}, facts: {}, content: {}, context: {} })
    expect(output.html).toContain('Actual')
  })

  it('allocates collision-free binding IDs for valid field IDs and per-property settings', () => {
    const t = fixture()
    t.fields[0].id = 'message-text'
    if (t.nodes.copy.kind === 'text') t.nodes.copy.parts[0].value = { source: 'field', fieldId: 'message-text' }
    const settings = [{ id: 'gap', label: 'Gap', schema: { type: 'number' as const }, defaultValue: 12, exposed: true, unit: 'px' as const, targets: [{ nodeId: 'message', property: 'padding-top' }, { nodeId: 'message', property: 'padding-bottom' }] }]
    const doc = platform.exportBindingDocument(t, { target: 'document', settings })
    expect(doc.artifacts.bindings.every(binding => /^[A-Za-z][A-Za-z0-9_]*$/.test(binding.id))).toBe(true)
    expect(doc.artifacts.bindings.filter(binding => binding.kind === 'style')).toHaveLength(2)
  })
})

describe('review regression cases', () => {
  it('rejects static remote images in both exports', () => {
    const t = fixture()
    t.nodes.logo = { id: 'logo', name: 'Logo', kind: 'element', tag: 'img', attributes: { src: 'https://example.com/mutable.png' }, attributeBindings: {}, style: {}, classes: [], children: [], permissions: { content: false, style: false } }
    t.roots.push('logo')
    expect(() => platform.exportBindingDocument(t, { target: 'document' })).toThrow(/managed/i)
    expect(() => platform.exportSharedTemplateDocument(t, { target: 'document' })).toThrow(/managed/i)
  })

  it('retains subject and plain text in shared compilation and rejects unknown or multiline subject bindings', () => {
    const doc = platform.exportBindingDocument(fixture(), { target: 'email', subject: 'Hello {{b_messageText}}', text: 'Message: {{b_messageText}}' })
    doc.artifacts.engine = 'shared'
    const data = { inputs: { message: '<Actual>' }, facts: {}, context: {}, content: {}, settings: {} }
    expect(platform.renderSharedTemplateDocument(doc, data)).toMatchObject({ subject: 'Hello <Actual>', text: 'Message: <Actual>' })
    doc.artifacts.subject = '{{unknown}}'
    expect(() => platform.renderSharedTemplateDocument(doc, data)).toThrow(/binding/i)
    doc.artifacts.subject = 'Hello\nInjected'
    expect(() => platform.renderSharedTemplateDocument(doc, data)).toThrow(/subject/i)
  })

  it('recompiles a host draft without discarding sidecars, exposure narrowing or its engine', () => {
    expect(platform).toHaveProperty('recompileTemplateDocument')
    const original = platform.exportBindingDocument(fixture(), { target: 'email', subject: 'Subject', text: 'Plain' })
    original.artifacts.engine = 'shared'
    original.rendering = { engine: 'shared', subject: 'Subject', text: 'Plain' }
    original.inputDefaults = { message: 'Stored default' }
    original.exposedInputs = []
    original.dependencies = [{ resourceId: 'partial-id', revision: 3 }]
    const source = structuredClone(original.source.definition)
    source.name = 'Edited'
    const result = platform.recompileTemplateDocument(original, source)
    expect(result.source.definition.name).toBe('Edited')
    expect(result.inputDefaults).toEqual(original.inputDefaults)
    expect(result.exposedInputs).toEqual([])
    expect(result.dependencies).toEqual(original.dependencies)
    expect(result.artifacts).toMatchObject({ engine: 'shared', subject: 'Subject', text: 'Plain' })
    expect(original.source.definition.name).toBe('Experience')
  })
})
