import { describe, expect, it } from 'vitest'
import { parse } from 'parse5'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { exportBindingDocument } from './bindings'
import { exportSharedTemplateDocument } from './document'
import { renderSharedTemplateDocument } from './shared'
import { createTemplateCreator } from '../template-core/editing'
import { finalizeTemplateOutput } from './output'
const template = () => TemplateDefinitionSchema.parse({ ...createTemplateDefinition('Email'), roots: ['copy'], nodes: {
  copy: { id: 'copy', kind: 'element', name: 'Message', tag: 'p', classes: ['brand'], children: ['text'] },
  text: { id: 'text', kind: 'text', name: 'Text', parts: [{ value: { source: 'literal', value: 'Hello' } }] },
}, styles: { theme: '', css: '.brand{color:#123456;padding:12px}' } })
const elements = (html: string, tag: string): any[] => {
  const result: any[] = []; const walk = (node: any) => { if (node.tagName === tag) result.push(node); node.childNodes?.forEach(walk) }; walk(parse(html)); return result
}
describe('email compilation profile', () => {
  it('retains responsive shell rules when already finalized HTML is finalized again', () => {
    const html = exportBindingDocument(template(), { target: 'email' }).artifacts.html
    expect(finalizeTemplateOutput(html, 'email')).toBe(html)
  })
  it('inlines essential CSS and uses a presentation-table email shell', () => {
    const output = exportBindingDocument(template(), { target: 'email' }).artifacts.html
    expect(elements(output, 'p')[0].attrs.find((a: any) => a.name === 'style')?.value).toContain('color:#123456')
    expect(elements(output, 'table').some(node => node.attrs.some((a: any) => a.name === 'role' && a.value === 'presentation'))).toBe(true)
    expect(output).not.toContain('@page'); expect(output).not.toMatch(/\dmm/)
  })
  it.each(['display:grid', 'display:flex', 'position:absolute', 'color:var(--brand)', 'width:calc(100% - 20px)', 'width:min(100%,500px)', 'background:linear-gradient(red,blue)'])(
    'rejects unsupported authored CSS (%s) in both engines while document output stays available', declaration => {
      const source = template(); source.styles.css = `.brand{${declaration}}`
      expect(() => exportBindingDocument(source, { target: 'email' })).toThrow(/email/i)
      expect(() => exportSharedTemplateDocument(source, { target: 'email' })).toThrow(/email/i)
      expect(() => exportBindingDocument(source, { target: 'document' })).not.toThrow()
    })
  it('checks pinned block CSS and elements as well as main graph content', () => {
    const creator = createTemplateCreator({ initialTemplate: template() }); creator.actions.saveBlock('copy', 'Bad'); const source = creator.getTemplate(); creator.destroy(); source.blocks[0].css = '.bad{display:flex}'
    expect(() => exportBindingDocument(source, { target: 'email' })).toThrow(/email/i)
  })
  it('requires email sections and explicit responsive priority rather than silently dropping styles', () => {
    const source = template()
    if (source.nodes.copy.kind === 'element') source.nodes.copy.tag = 'section'
    source.styles.css = 'section{color:#123456}'
    expect(() => exportBindingDocument(source, { target: 'email' })).toThrow(/email/i)
    const responsive = template(); responsive.styles.css = '@media screen and (max-width:620px){p{font-size:20px}}'
    expect(() => exportBindingDocument(responsive, { target: 'email' })).toThrow(/important/i)
  })
  it('rejects selector flags and matches HTML attribute names without case sensitivity', () => {
    const source = template(); source.styles.css = '[data-test="X" i]{color:#abcdef}'
    expect(() => exportBindingDocument(source, { target: 'email' })).toThrow(/selector/i)
    source.styles.css = '[DATA-TEST="X"]{color:#abcdef}'
    if (source.nodes.copy.kind === 'element') source.nodes.copy.attributes['data-test'] = 'X'
    const html = exportBindingDocument(source, { target: 'email' }).artifacts.html
    expect(elements(html, 'p')[0].attrs.find((a: any) => a.name === 'style')?.value).toContain('color:#abcdef')
  })
  it('keeps runtime tokens in typed inline declarations and preserves responsive rules', () => {
    const source = template(); source.styles.css += '@media screen and (max-width:620px){.brand{font-size:20px!important}}'
    source.fields = [{ id: 'message', path: 'inputs.message', label: 'Message', schema: { type: 'string' }, required: true, editable: true, description: '', defaultValue: 'Hi' }]
    if (source.nodes.text.kind === 'text') source.nodes.text.parts[0].value = { source: 'field', fieldId: 'message' }
    const output = exportBindingDocument(source, { target: 'email', settings: [{ id: 'size', label: 'Size', control: 'number', schema: { type: 'number', minimum: 10, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px', targets: [{ nodeId: 'copy', property: 'font-size' }] }] })
    expect(output.artifacts.html).toContain('font-size:{{s_size}}')
    expect(output.artifacts.html).toContain('{{b_message}}')
    expect(output.artifacts.html).toContain('@media screen and (max-width:620px)')
  })
  it('uses the same finalized output for shared runtime rendering', () => {
    const document = exportSharedTemplateDocument(template(), { target: 'email' })
    const result = renderSharedTemplateDocument(document, { facts: {}, context: {}, content: {}, inputs: {}, settings: {} })
    expect(elements(result.html, 'p')[0].attrs.find((a: any) => a.name === 'style')?.value).toContain('color:#123456')
    expect(result.css).toBe('')
  })
  it('accepts retained CID images from the trusted resolver and rejects relative runtime links', () => {
    const source = template()
    if (source.nodes.copy.kind !== 'element') throw new Error('Expected paragraph.')
    source.assets = [{ id: 'logo', name: 'Logo', kind: 'image', mimeType: 'image/png', url: 'https://example.com/logo.png' }]
    source.nodes.logo = { ...source.nodes.copy, id: 'logo', kind: 'element', tag: 'img', children: [], attributes: { alt: 'Company logo' }, attributeBindings: { src: { source: 'asset', assetId: 'logo' } } }
    source.roots.push('logo')
    const document = exportSharedTemplateDocument(source, { target: 'email', managedAssets: { logo: 'retained-logo' } })
    const result = renderSharedTemplateDocument(document, { facts: {}, context: {}, content: {}, inputs: {}, settings: {} }, { logo: 'cid:logo@example.test' })
    expect(result.html).toContain('src="cid:logo@example.test"')
    source.fields.push({ id: 'url', path: 'facts.url', label: 'Destination', schema: { type: 'string' }, required: true, editable: false, description: '' })
    source.nodes.copy = { ...source.nodes.copy, kind: 'element', tag: 'a', attributeBindings: { href: { source: 'field', fieldId: 'url' } } }
    const bad = exportSharedTemplateDocument(source, { target: 'email', managedAssets: { logo: 'retained-logo' } })
    expect(() => renderSharedTemplateDocument(bad, { facts: { url: '/relative' }, context: {}, content: {}, inputs: {}, settings: {} }, { logo: 'cid:logo@example.test' })).toThrow(/absolute|destination/i)
  })
})
