// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateDefinitionSchema, type JsonObject } from '../template-core/schema'
import { createTemplateCreator } from '../template-core/editing'
import { exportBindingDocument } from './bindings'
import { materializeFamilyDocument } from './catalog'
import { TemplateWorkspace } from './workspace'
import { GroupVariantWorkspace } from './variant-workspace'
import type { GroupVariantDocument } from './types'

let root: Root, container: HTMLDivElement
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const visible = <T extends Element>(selector: string) => [...container.querySelectorAll<T>(selector)].filter(node => !node.closest('[hidden]'))
const button = (label: string) => visible<HTMLButtonElement>('button').find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)!
const input = (label: string) => visible<HTMLInputElement | HTMLTextAreaElement>('input,textarea').find(node => [label, `${label} *`].includes(node.getAttribute('aria-label') ?? ''))!
const html = () => visible<HTMLIFrameElement>('iframe')[0].srcdoc
const change = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}
function fixture() {
  return exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Sample appearance'), id: 'sample-appearance', roots: ['message'],
    nodes: { message: { id: 'message', kind: 'element', tag: 'p', name: 'Message', children: ['copy'] }, copy: { id: 'copy', kind: 'text', name: 'Copy', parts: [{ value: { source: 'field', fieldId: 'messageText' } }] } },
    fields: [{ id: 'messageText', path: 'inputs.message', label: 'Message text', schema: { type: 'string' }, editable: true, defaultValue: 'Enjoy!' }],
  }), { target: 'document', settings: [
    { id: 'font', label: 'Message size', control: 'number', schema: { type: 'number', minimum: 12, maximum: 30 }, defaultValue: 16, exposed: true, unit: 'px', targets: [{ nodeId: 'message', property: 'font-size' }] },
    { id: 'alignment', label: 'Message alignment', control: 'alignment', schema: { type: 'string', enum: ['left', 'center', 'right'] }, defaultValue: 'left', exposed: true, targets: [{ nodeId: 'message', property: 'text-align' }] },
    { id: 'protected', label: 'Protected padding', control: 'number', schema: { type: 'number' }, defaultValue: 10, exposed: false, unit: 'px', targets: [{ nodeId: 'message', property: 'padding' }] },
  ] })
}

it.each(['standalone', 'variant', 'structural'] as const)('updates %s sample settings without resetting local values or saving sample defaults', async kind => {
  const family = fixture(), onDraftChange = vi.fn(), onPersonalizationChange = vi.fn(), onExport = vi.fn()
  if (kind === 'structural') family.variationPoints = [{ id: 'sections', label: 'Sections', kind: 'children', target: { kind: 'roots' }, minItems: 0, maxItems: 4, allowedKinds: ['element'] }]
  const variant: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } }
  const render = (font?: number) => kind === 'standalone'
    ? <TemplateWorkspace initialDocument={family} previewSettings={{ ...(font === undefined ? {} : { font }), alignment: 'center' }} onDraftChange={onDraftChange} onPersonalizationChange={onPersonalizationChange} onExport={onExport} />
    : <GroupVariantWorkspace initialDocument={variant} familyDocument={family} effectiveDocument={materializeFamilyDocument(family, {})} previewSettings={{ ...(font === undefined ? {} : { font }), alignment: 'center' }} onDraftChange={onDraftChange} onPersonalizationChange={onPersonalizationChange} onExport={onExport} />
  await act(async () => root.render(render(20)))
  expect(html()).toContain('font-size:20px')
  const draft = structuredClone(onDraftChange.mock.lastCall![0]), calls = onDraftChange.mock.calls.length
  await act(async () => button(kind === 'standalone' ? 'Personalize' : 'Customer preview').click())
  expect(input('Message size').value).toBe('20')
  await change(input('Message text'), 'My personal message')
  expect(onPersonalizationChange.mock.lastCall![0].settings).toEqual({})
  const personalizations = onPersonalizationChange.mock.calls.length
  await act(async () => root.render(render(22)))
  expect(onPersonalizationChange.mock.calls.length).toBe(personalizations)
  expect(html()).toContain('font-size:22px')
  expect(input('Message size').value).toBe('22')
  expect(input('Message text').value).toBe('My personal message')
  expect(button('Undo personalization').disabled).toBe(false)
  expect(html()).toContain('text-align:center')
  expect(onDraftChange.mock.calls.length).toBe(calls)
  expect(onDraftChange.mock.lastCall![0]).toEqual(draft)
  await act(async () => button(kind === 'standalone' ? 'Design' : 'Variant').click())
  await act(async () => button(kind === 'standalone' ? 'Export template' : 'Export variant').click())
  if (kind === 'standalone') expect(onExport.mock.lastCall![0].settingsDefaults.font).toBe(16)
  else expect(onExport.mock.lastCall![0].source.overrides).toEqual({})
})

it.each(['standalone', 'variant', 'structural'] as const)('resets %s local overrides to the latest baseline, then authored defaults', async kind => {
  const family = fixture(), onPersonalizationChange = vi.fn()
  if (kind === 'structural') family.variationPoints = [{ id: 'sections', label: 'Sections', kind: 'children', target: { kind: 'roots' }, minItems: 0, maxItems: 4, allowedKinds: ['element'] }]
  const variant: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } }
  const render = (font?: number) => kind === 'standalone'
    ? <TemplateWorkspace initialDocument={family} mode="personalize" initialSettings={{ font: 24 }} previewSettings={font === undefined ? {} : { font }} onPersonalizationChange={onPersonalizationChange} />
    : <GroupVariantWorkspace initialDocument={variant} familyDocument={family} effectiveDocument={family} mode="customer" initialSettings={{ font: 24 }} previewSettings={font === undefined ? {} : { font }} onPersonalizationChange={onPersonalizationChange} />
  await act(async () => root.render(render(20)))
  expect(html()).toContain('font-size:24px')
  await act(async () => root.render(render(26)))
  expect(input('Message size').value).toBe('24')
  await act(async () => button('Reset Message size').click())
  expect(input('Message size').value).toBe('26')
  expect(html()).toContain('font-size:26px')
  expect(onPersonalizationChange.mock.lastCall![0].settings).toEqual({})
  await act(async () => root.render(render()))
  expect(input('Message size').value).toBe('16')
  expect(html()).toContain('font-size:16px')
})

it('preserves author Undo and initial personalization overrides when preview props change', async () => {
  const initialDocument = fixture(), creator = createTemplateCreator({ initialTemplate: initialDocument.source.definition })
  const render = (font: number) => <TemplateWorkspace creator={creator} initialDocument={initialDocument} initialSettings={{ font: 28 }} previewSettings={{ font }} />
  await act(async () => root.render(render(20)))
  await act(async () => creator.actions.edit(template => { template.name = 'Changed by author' }))
  await act(async () => root.render(render(22)))
  expect(creator.getTemplate().name).toBe('Changed by author')
  expect(button('Undo').disabled).toBe(false)
  await act(async () => button('Personalize').click())
  expect(input('Message size').value).toBe('28')
  expect(html()).toContain('font-size:28px')
  creator.destroy()
})

it.each([{ font: 100 }, { protected: 20 }, { missing: 1 }] as JsonObject[])('reports invalid/unexposed sample settings without applying them: %j', async previewSettings => {
  await act(async () => root.render(<TemplateWorkspace initialDocument={fixture()} previewSettings={previewSettings} />))
  expect(visible('[role="alert"]').some(node => node.textContent?.includes('Preview settings:'))).toBe(true)
  expect(html()).toContain('font-size:16px')
})

it.each([false, true])('recovers from an invalid baseline without dropping customer history (variant=%s)', async variant => {
  const family = fixture()
  const initialDocument: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } }
  const render = (font: number) => variant
    ? <GroupVariantWorkspace initialDocument={initialDocument} familyDocument={family} effectiveDocument={family} mode="customer" previewSettings={{ font }} />
    : <TemplateWorkspace initialDocument={family} mode="personalize" previewSettings={{ font }} />
  await act(async () => root.render(render(20)))
  await change(input('Message text'), 'Keep this draft')
  await act(async () => root.render(render(100)))
  expect(visible('[role="alert"]').some(node => node.textContent?.includes('Preview settings:'))).toBe(true)
  expect(input('Message text').value).toBe('Keep this draft')
  await act(async () => root.render(render(22)))
  expect(visible('[role="alert"]')).toHaveLength(0)
  expect(input('Message text').value).toBe('Keep this draft')
  expect(html()).toContain('font-size:22px')
  expect(button('Undo personalization').disabled).toBe(false)
})
