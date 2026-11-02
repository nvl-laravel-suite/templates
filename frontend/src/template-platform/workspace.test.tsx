// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { createTemplateDefinition } from '../template-core/defaults'
import { createTemplateCreator } from '../template-core/editing'
import { exportBindingDocument } from './bindings'
import { getTemplatePresets } from '../template-core/presets'
import * as workspace from './workspace'

function fixture() {
  return exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Experience voucher'), id: 'experience', roots: ['message'],
    nodes: { message: { id: 'message', name: 'Personal message', kind: 'element', tag: 'p', children: ['copy'] }, copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'messageText' } }] } },
    fields: [{ id: 'messageText', path: 'inputs.message', label: 'Personal message', schema: { type: 'string' }, editable: true, defaultValue: 'Enjoy!' }, { id: 'code', path: 'facts.code', label: 'Protected voucher code', schema: { type: 'string' }, editable: false, sample: 'ABC' }],
  }), { target: 'document' })
}

describe('existing editor integration', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...container.querySelectorAll('button')].find(b => !b.closest('[hidden]') && (b.textContent?.trim() === label || b.getAttribute('aria-label') === label))!

  it('promotes dynamic authoring drafts and exports to the shared compiler automatically', async () => {
    const document = fixture()
    const instance = createTemplateCreator({ initialTemplate: document.source.definition })
    const onDraftChange = vi.fn(), onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={document} creator={instance} onDraftChange={onDraftChange} onExport={onExport} />))
    expect(onDraftChange.mock.lastCall?.[0].rendering.engine).toBe('bindings')
    await act(async () => instance.actions.insertFragment(getTemplatePresets().find(preset => preset.id === 'repeat')!.fragment))
    expect(onDraftChange.mock.lastCall?.[0].rendering.engine).toBe('shared')
    await act(async () => button('Export template').click())
    expect(onExport.mock.lastCall?.[0].rendering.engine).toBe('shared')
    expect(onExport.mock.lastCall?.[0].artifacts.engine).toBe('shared')
    expect(onExport.mock.lastCall?.[0].source.definition.roots).toHaveLength(2)
    instance.destroy()
  })

  it('reserves shared compilation for future structural family variants', async () => {
    const document = fixture()
    document.variationPoints = [{ id: 'sections', label: 'Sections', kind: 'children', target: { kind: 'roots' }, minItems: 0, maxItems: 10, allowedKinds: ['element', 'repeat', 'condition'] }]
    const onDraftChange = vi.fn(), onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace familyAuthoring initialDocument={document} onDraftChange={onDraftChange} onExport={onExport} />))
    expect(onDraftChange.mock.lastCall?.[0].rendering.engine).toBe('shared')
    await act(async () => button('Export template').click())
    expect(onExport.mock.lastCall?.[0].artifacts.engine).toBe('shared')
    expect(onExport.mock.lastCall?.[0].variationPoints).toEqual(document.variationPoints)
  })

  it('uses the full existing creator and exports its actual authored state', async () => {
    expect(workspace).toHaveProperty('TemplateWorkspace')
    const document = fixture()
    const instance = createTemplateCreator({ initialTemplate: document.source.definition })
    const onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={document} creator={instance} onExport={onExport} />))
    expect(button('Structure')).toBeDefined()
    await act(async () => button('Library').click())
    expect(button('Reusable blocks')).toBeDefined()
    await act(async () => button('Build').click())
    expect(button('Undo')).toBeDefined()
    expect(container.querySelector('iframe[title="Template document"]')).not.toBeNull()
    act(() => instance.actions.edit(draft => { draft.name = 'Authored experience' }))
    await act(async () => button('Export template').click())
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ source: expect.objectContaining({ definition: expect.objectContaining({ name: 'Authored experience' }) }) }))
    expect(onExport.mock.calls[0][0].artifacts.html).toContain('{{b_messageText}}')
    instance.destroy()
  })

  it('exposes selected-node appearance controls inside the existing customer editor', async () => {
    expect(workspace).toHaveProperty('TemplateWorkspace')
    const document = fixture()
    const instance = createTemplateCreator({ initialTemplate: document.source.definition })
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={document} creator={instance} previewData={{ facts: { code: 'ABC' }, inputs: { message: 'My own message' } }} />))
    act(() => instance.actions.select('message'))
    await act(async () => container.querySelector<HTMLElement>('[aria-label="Allow Font size"]')!.click())
    await act(async () => button('Personalize').click())
    expect(container.querySelector('[aria-label="Customization target"]')).toBeNull()
    expect(container.querySelector('[aria-label="Font size"]')).not.toBeNull()
    expect(container.querySelector('[data-template-workspace-mode="personalize"]')?.textContent).not.toContain('Protected voucher code')
    const frame = container.querySelector<HTMLIFrameElement>('[data-template-workspace-mode="personalize"] iframe[title="Template document"]')!
    expect(frame.srcdoc).toContain('My own message')
    expect(frame.srcdoc).toContain('font-size:')
    expect(container.querySelector('[aria-label="Document values"]')).not.toBeNull()
    instance.destroy()
  })

  const change = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  }

  it('includes newly authored fields in the customer patch', async () => {
    const document = fixture(); const instance = createTemplateCreator({ initialTemplate: document.source.definition }); const onPersonalizationChange = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={document} creator={instance} onPersonalizationChange={onPersonalizationChange} />))
    act(() => instance.actions.edit(draft => { draft.fields.push({ id: 'newInput', path: 'inputs.newInput', label: 'New input', description: '', schema: { type: 'string' }, defaultValue: 'Initial', editable: true, required: false }) }))
    await act(async () => button('Personalize').click())
    await change(container.querySelector<HTMLInputElement>('input[aria-label="New input"]')!, 'Changed')
    expect(onPersonalizationChange.mock.lastCall?.[0].inputs.newInput).toBe('Changed')
    instance.destroy()
  })

  it('updates explicitly edited field defaults and removes defaults for removed fields', async () => {
    const document = fixture()
    const source = structuredClone(document.source.definition)
    source.fields.push({ id: 'brand', path: 'content.brand', label: 'Brand', description: '', schema: { type: 'string' }, defaultValue: 'Original brand', editable: false, required: false })
    const initial = exportBindingDocument(source, { target: 'document' }); const instance = createTemplateCreator({ initialTemplate: initial.source.definition }); const onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={initial} creator={instance} onExport={onExport} />))
    act(() => instance.actions.edit(draft => { draft.fields[0].defaultValue = 'New default'; draft.fields = draft.fields.filter(field => field.id !== 'brand') }))
    await act(async () => button('Export template').click())
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport.mock.lastCall?.[0].inputDefaults.message).toBe('New default')
    expect(onExport.mock.lastCall?.[0].content).toEqual({})
    instance.destroy()
  })

  it('preserves narrowed setting exposure and authored default overrides on unrelated edits', async () => {
    const document = exportBindingDocument(fixture().source.definition, { target: 'document', settings: [{ id: 'font', label: 'Original font', schema: { type: 'number', minimum: 10, maximum: 48 }, defaultValue: 16, unit: 'px', exposed: true, targets: [{ nodeId: 'message', property: 'font-size' }] }] })
    document.settingsDefaults.font = 20; document.exposedSettings = []
    const instance = createTemplateCreator({ initialTemplate: document.source.definition }); const onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={document} creator={instance} onExport={onExport} />))
    act(() => instance.actions.select('message'))
    await act(async () => container.querySelector<HTMLElement>('[aria-label="Allow Padding"]')!.click())
    await act(async () => button('Export template').click())
    expect(onExport.mock.lastCall?.[0].exposedSettings).not.toContain('font')
    expect(onExport.mock.lastCall?.[0].settingsDefaults.font).toBe(20)
    instance.destroy()
  })

  it('keeps the existing creator history when moving between design and personalization', async () => {
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={fixture()} />))
    await act(async () => button('Add section').click())
    expect(button('Undo').disabled).toBe(false)
    await act(async () => button('Personalize').click())
    await act(async () => button('Design').click())
    expect(button('Undo').disabled).toBe(false)
  })

  it('does not echo a draft just because the host replaces its observer', async () => {
    const initial = fixture(); const first = vi.fn(); const second = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={initial} onDraftChange={first} />))
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={initial} onDraftChange={second} />))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('blocks module export while the existing inspector has an invalid pending draft', async () => {
    const onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={fixture()} onExport={onExport} />))
    await change(container.querySelector<HTMLInputElement>('input[aria-label="CSS classes"]')!, '@invalid')
    expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull()
    await act(async () => button('Export template').click())
    expect(onExport).not.toHaveBeenCalled()
  })

  it('keeps customer values out of the author canvas and exported defaults', async () => {
    const onExport = vi.fn()
    await act(async () => root.render(<workspace.TemplateWorkspace initialDocument={fixture()} onExport={onExport} />))
    await act(async () => button('Personalize').click())
    await change(container.querySelector<HTMLInputElement>('[data-template-workspace-mode="personalize"] [aria-label^="Personal message"]')!, 'Customer-only message')
    await act(async () => button('Design').click())
    const frame = container.querySelector<HTMLIFrameElement>('[data-template-workspace-mode="design"] iframe')!
    expect(frame.srcdoc).toContain('Enjoy!')
    expect(frame.srcdoc).not.toContain('Customer-only message')
    await act(async () => button('Export template').click())
    expect(onExport.mock.lastCall?.[0].inputDefaults.message).toBe('Enjoy!')
    await act(async () => button('Personalize').click())
    expect(container.querySelector<HTMLInputElement>('[data-template-workspace-mode="personalize"] [aria-label^="Personal message"]')!.value).toBe('Customer-only message')
    expect(button('Undo personalization').disabled).toBe(false)
  })
})
