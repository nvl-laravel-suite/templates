// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateEditor } from './TemplateEditor'
import { TemplateCreator } from './TemplateCreator'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateBlockSchema, TemplateFieldSchema, TemplateNodeSchema } from '../template-core/schema'
import { createTemplateCreator, createTemplateEditor } from '../template-core/editing'
import { createTemplateRevision } from '../template-core/render'
import { getTemplateIssues } from '../template-core/validation'
import { VoucherBuilder } from '../voucher-builder/VoucherBuilder'
import type { VoucherBuilderProps } from '../voucher-builder/types'
import { TemplateEditorProvider, useTemplateEditorDocument, useTemplateEditorSelection,
  useTemplateEditorActions, useTemplateEditorExport } from './hooks'

const fixture = () => {
  const template = createTemplateDefinition()
  template.nodes.note = TemplateNodeSchema.parse({ id: 'note', kind: 'text', name: 'Editable note',
    permissions: { content: true }, parts: [{ value: { source: 'literal', value: 'Note' } }] })
  template.roots = ['note']
  return template
}

describe('contract-driven template workflows', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    localStorage.clear()
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); vi.unstubAllGlobals() })
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label)!
  const change = (label: string, value: string) => {
    const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  }
  it('preloads an unfinished definition and exposes its JSON without requiring valid HTML', async () => {
    const template = fixture()
    template.nodes.image = TemplateNodeSchema.parse({ id: 'image', kind: 'element', name: 'Unfinished image', tag: 'img' })
    template.roots.push('image')
    const onExport = vi.fn()
    await act(async () => root.render(<TemplateCreator initialTemplate={template} onExport={onExport} />))
    expect(container.querySelector('h1')?.textContent).toBe(template.name)
    expect(container.textContent).toContain('Unfinished image')
    expect(container.textContent).toContain('2 elements')
    expect(button('Export HTML').disabled).toBe(true)
    await act(async () => button('Export JSON').click())
    expect(JSON.parse(onExport.mock.calls[0][0].data)).toEqual(template)
  })
  it('clears optional arrays and objects to absence, validates, and restores them through Undo', async () => {
    const template = fixture()
    template.fields.push(TemplateFieldSchema.parse({ id: 'list', path: 'list', label: 'List', required: false,
      schema: { type: 'array', minItems: 1, items: { type: 'string' } } }),
    TemplateFieldSchema.parse({ id: 'address', path: 'address', label: 'Address', required: false,
      schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false } }))
    const instance = createTemplateEditor({ template: createTemplateRevision(template), initialData: { list: ['one'], address: { city: 'Sofia' } } })
    await act(async () => root.render(<TemplateEditor instance={instance} />))
    await act(async () => button('Remove List item 1').click())
    expect(instance.render().issues.length).toBeGreaterThan(0)
    await act(async () => button('Clear List').click())
    await act(async () => button('Clear Address').click())
    expect(instance.getPersonalization().data).toEqual({})
    expect(instance.render().issues).toEqual([])
    await act(async () => button('Undo personalization').click())
    expect(instance.getPersonalization().data.address).toEqual({ city: 'Sofia' })
    instance.destroy()
  })
  it('exports the currently loaded document through a host-owned output handler', async () => {
    const onExport = vi.fn()
    const instance = createTemplateCreator({ initialTemplate: fixture(), onError: vi.fn() })
    await act(async () => root.render(<TemplateCreator instance={instance} onExport={onExport} />))
    const loaded = fixture()
    loaded.name = 'Loaded document'
    await act(async () => instance.actions.load(loaded))
    expect(container.querySelector('h1')?.textContent).toBe('Loaded document')
    await act(async () => button('Export JSON').click())
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(JSON.parse(onExport.mock.calls[0][0].data)).toEqual(loaded)
    instance.destroy()
  })
  it('selects permitted static content with the accessible native control and edits it', async () => {
    const instance = createTemplateEditor({ template: createTemplateRevision(fixture()) })
    await act(async () => root.render(<TemplateEditor instance={instance} />))
    const target = container.querySelector<HTMLButtonElement>('[aria-label="Customization target"]')!
    await act(async () => target.click())
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent?.includes('Editable note'))!
    expect(option).toBeDefined()
    await act(async () => option.click())
    const field = container.querySelector<HTMLTextAreaElement>('[aria-label="Custom text"]')!
    expect(field).not.toBeNull()
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Personal note')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(instance.render().html).toContain('Personal note')
    instance.destroy()
  })
  it('rejects conflicting voucher and personalization props in both typed and untyped integrations', () => {
    const personalization = { template: createTemplateRevision(fixture()) }
    // @ts-expect-error Voucher mode cannot silently configure a template editor.
    const incompatible: VoucherBuilderProps = { mode: 'viewer', personalization }
    expect(() => VoucherBuilder(incompatible)).toThrow('does not accept voucher options')
    expect(() => VoucherBuilder({ personalization, onChange: vi.fn() } as unknown as VoucherBuilderProps)).toThrow('onChange')
  })
  it('keeps focused command/document/export subscribers independent of selection', () => {
    const instance = createTemplateEditor({ template: createTemplateRevision(fixture()) })
    const documentRender = vi.fn(), actionsRender = vi.fn(), exportRender = vi.fn(), selectionRender = vi.fn()
    function DocumentProbe() { documentRender(useTemplateEditorDocument()); return null }
    function ActionProbe() { actionsRender(useTemplateEditorActions()); return null }
    function ExportProbe() { exportRender(useTemplateEditorExport()); return null }
    function SelectionProbe() { selectionRender(useTemplateEditorSelection()); return null }
    act(() => root.render(<TemplateEditorProvider instance={instance}><DocumentProbe /><ActionProbe /><ExportProbe /><SelectionProbe /></TemplateEditorProvider>))
    act(() => instance.actions.select('note'))
    expect(documentRender).toHaveBeenCalledTimes(1)
    expect(actionsRender).toHaveBeenCalledTimes(1)
    expect(exportRender).toHaveBeenCalledTimes(1)
    expect(selectionRender).toHaveBeenCalledTimes(2)
    instance.destroy()
  })
  it('edits block property metadata and creates a slot in a new immutable revision', async () => {
    const template = fixture()
    template.blocks.push(TemplateBlockSchema.parse({ id: 'note', version: 1, name: 'Reusable note',
      props: { caption: { type: 'string' } }, roots: ['text'], nodes: {
        text: { id: 'text', name: 'Caption', kind: 'text', parts: [{ value: { source: 'prop', name: 'caption' } }] },
      } }))
    const instance = createTemplateCreator({ initialTemplate: template })
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await act(async () => button('Library').click())
      await act(async () => button('Reusable blocks').click())
    await act(async () => button('Actions for block Reusable note').click())
    const edit = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.trim() === 'Edit definition')!
    await act(async () => edit.click())
    change('Label for caption', 'Caption label')
    change('New slot name', 'body')
    await act(async () => button('Fallback element').click())
    const fallback = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.includes('Caption'))!
    await act(async () => fallback.click())
    await act(async () => button('Add slot').click())
    await act(async () => button('Save new revision').click())
    const blocks = instance.getTemplate().blocks
    expect(blocks.map(block => block.version)).toEqual([1, 2])
    expect(blocks[0].propertyMetadata).toBeUndefined()
    expect(blocks[1].propertyMetadata?.caption.label).toBe('Caption label')
    expect(Object.values(blocks[1].nodes).some(node => node.kind === 'slot' && node.slot === 'body')).toBe(true)
    expect(getTemplateIssues(instance.getTemplate())).toEqual([])
    instance.destroy()
  })
})
