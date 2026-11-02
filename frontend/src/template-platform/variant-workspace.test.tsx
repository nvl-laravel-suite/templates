// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { exportBindingDocument } from './bindings'
import { materializeFamilyDocument } from './catalog'
import type { GroupVariantDocument } from './types'
import { GroupVariantWorkspace } from './variant-workspace'

function fixture() {
  const familyDocument = exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Family voucher'), id: 'family-voucher', roots: ['message'],
    nodes: { message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: ['copy'] }, copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'heading' } }, { value: { source: 'field', fieldId: 'messageText' } }, { value: { source: 'field', fieldId: 'code' } }] } },
    fields: [
      { id: 'heading', path: 'content.heading', label: 'Heading', schema: { type: 'string', minLength: 1 }, defaultValue: 'Family heading', editable: false },
      { id: 'messageText', path: 'inputs.message', label: 'Personal message', schema: { type: 'string' }, defaultValue: 'Enjoy!', editable: true },
      { id: 'recipient', path: 'inputs.recipient', label: 'Recipient', schema: { type: 'string' }, defaultValue: 'Alex', editable: true },
      { id: 'code', path: 'facts.code', label: 'Protected code', schema: { type: 'string' }, sample: 'SAMPLE', editable: false },
    ],
  }), { target: 'document', settings: [
    { id: 'font', label: 'Message size', control: 'slider', schema: { type: 'number', minimum: 12, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px', targets: [{ nodeId: 'message', property: 'font-size' }] },
    { id: 'alignment', label: 'Protected alignment', control: 'alignment', schema: { type: 'string', enum: ['left', 'center', 'right'] }, defaultValue: 'left', exposed: false, targets: [{ nodeId: 'message', property: 'text-align' }] },
  ] })
  const initialDocument: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family-id', revision: 7 }, overrides: { content: { heading: 'Variant heading' }, settingsDefaults: { font: 20 }, exposedInputs: ['message'], exposedSettings: ['font'] } } }
  return { familyDocument, initialDocument, effectiveDocument: materializeFamilyDocument(familyDocument, initialDocument.source.overrides) }
}

describe('group variant workspace', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...container.querySelectorAll('button')].find(node => !node.closest('[hidden]') && (node.textContent?.trim() === label || node.getAttribute('aria-label') === label))!
  const input = (label: string) => [...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].find(node => !node.closest('[hidden]') && [label, `${label} *`].includes(node.getAttribute('aria-label') ?? ''))!
  const change = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  }

  it('exports only the pinned raw group document and permitted authored differences', async () => {
    const props = fixture(); const onDraftChange = vi.fn(); const onExport = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} onDraftChange={onDraftChange} onExport={onExport} />))
    expect(container.querySelector('iframe[title="Template document"]')).not.toBeNull()
    expect(button('Structure')).toBeUndefined()
    expect(container.textContent).toContain('Layout is inherited')
    await change(input('Heading'), 'Authored variant')
    await act(async () => button('Export variant').click())
    const saved = onExport.mock.lastCall?.[0]
    expect(saved).toEqual({ format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family-id', revision: 7 }, overrides: { content: { heading: 'Authored variant' }, settingsDefaults: { font: 20 }, exposedInputs: ['message'], exposedSettings: ['font'] } } })
    expect(onDraftChange.mock.lastCall?.[0]).toEqual(saved)
    expect(props.familyDocument.content.heading).toBe('Family heading')
    expect(props.initialDocument.source.overrides.content?.heading).toBe('Variant heading')
  })

  it('resets inherited content, settings and permission overrides by removing local values', async () => {
    const props = fixture(); const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} onDraftChange={onDraftChange} />))
    await act(async () => button('Customer access').click())
    for (const label of ['Reset content Heading', 'Reset Message size', 'Reset input permissions', 'Reset appearance permissions']) await act(async () => button(label).click())
    expect(onDraftChange.mock.lastCall?.[0].source.overrides).toEqual({})
    expect(input('Heading').value).toBe('Family heading')
    const frame = container.querySelector<HTMLIFrameElement>('[data-variant-mode="staff"] iframe')!
    expect(frame.srcdoc).toContain('Family heading')
    expect(frame.srcdoc).toContain('font-size:16px')
  })

  it('keeps customer values separate and shows only the variant’s exposed controls', async () => {
    const props = fixture(); const onDraftChange = vi.fn(); const onPersonalizationChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} mode="customer" initialSettings={{ font: 22 }} previewData={{ facts: { code: 'APP-CODE' } }} onDraftChange={onDraftChange} onPersonalizationChange={onPersonalizationChange} />))
    expect(input('Personal message')).toBeDefined()
    expect(input('Recipient')).toBeUndefined()
    expect(input('Protected code')).toBeUndefined()
    expect(container.querySelector('[data-variant-mode="customer"] [aria-label="Customization target"]')).toBeNull()
    expect(container.querySelector('[data-variant-mode="customer"]')?.textContent).not.toContain('Protected alignment')
    expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="customer"] iframe')!.srcdoc).toContain('font-size:22px')
    await change(input('Personal message'), 'Customer gift')
    expect(onPersonalizationChange.mock.lastCall?.[0]).toEqual({ inputs: { message: 'Customer gift' }, settings: { font: 22 } })
    expect(onDraftChange.mock.lastCall?.[0]).toEqual(props.initialDocument)
  })

  it('bounds staff exposure controls by the family capability allowlists', async () => {
    const props = fixture(); props.familyDocument.exposedInputs = ['message']; const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} onDraftChange={onDraftChange} />))
    await act(async () => button('Customer access').click())
    expect(container.querySelector('[aria-label="Customer may edit Recipient"]')).toBeNull()
    expect(container.querySelector('[aria-label="Customer may change Protected alignment"]')).toBeNull()
    await act(async () => container.querySelector<HTMLElement>('[aria-label="Customer may change Message size"]')!.click())
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.exposedSettings).toEqual([])
  })

  it('refreshes protected values without losing customer input and resets a keyed session', async () => {
    const props = fixture(); const render = (sessionKey: string, code: string) => <GroupVariantWorkspace {...props} sessionKey={sessionKey} mode="customer" previewData={{ facts: { code } }} initialSettings={{ font: 22 }} />
    await act(async () => root.render(render('variant-a', 'FIRST')))
    await change(input('Personal message'), 'Keep this gift')
    await act(async () => root.render(render('variant-a', 'SECOND')))
    expect(input('Personal message').value).toBe('Keep this gift')
    expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="customer"] iframe')!.srcdoc).toContain('SECOND')
    expect(button('Undo personalization').disabled).toBe(false)
    await act(async () => root.render(render('variant-b', 'THIRD')))
    expect(input('Personal message').value).toBe('Enjoy!')
    expect(button('Undo personalization').disabled).toBe(true)
    expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="customer"] iframe')!.srcdoc).toContain('THIRD')
  })

  it('starts a fresh session when the pinned family revision changes under the same host key', async () => {
    const props = fixture(); const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} sessionKey="same-record" mode="customer" onDraftChange={onDraftChange} />))
    await change(input('Personal message'), 'Old revision gift')
    const next = structuredClone(props.initialDocument); next.source.group.revision = 8
    await act(async () => root.render(<GroupVariantWorkspace {...props} initialDocument={next} sessionKey="same-record" mode="customer" onDraftChange={onDraftChange} />))
    expect(input('Personal message').value).toBe('Enjoy!')
    expect(onDraftChange.mock.lastCall?.[0].source.group).toEqual({ id: 'family-id', revision: 8 })
  })

  it('blocks widened incoming permissions with a visible error and emits no draft', async () => {
    const props = fixture(); props.initialDocument.source.overrides.exposedInputs = ['not-a-family-input']; const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} onDraftChange={onDraftChange} />))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('cannot widen')
    expect(container.querySelector('iframe')).toBeNull()
    expect(onDraftChange).not.toHaveBeenCalled()
  })

  it('keeps an invalid content draft visible and prevents exporting an older valid value', async () => {
    const props = fixture(); const onExport = vi.fn(); const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} onExport={onExport} onDraftChange={onDraftChange} />))
    await change(input('Heading'), '')
    expect(input('Heading').getAttribute('aria-invalid')).toBe('true')
    await act(async () => button('Export variant').click())
    expect(onExport).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('highlighted values')
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.content.heading).toBe('Variant heading')
  })

  it('retains invalid variant appearance across disclosure and preview changes until repaired', async () => {
    const props = fixture(); const onExport = vi.fn(); const onDraftChange = vi.fn()
    props.familyDocument.settingsSpec[0].control = 'number'
    await act(async () => root.render(<GroupVariantWorkspace {...props} onExport={onExport} onDraftChange={onDraftChange} />))
    const defaults = button('Default appearance')
    expect(defaults).toBeDefined()
    const field = input('Message size')
    await change(field, '99')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    await act(async () => defaults.click())
    expect(defaults.getAttribute('aria-expanded')).toBe('false')
    await act(async () => button('Export variant').click())
    expect(onExport).not.toHaveBeenCalled()
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.settingsDefaults).toEqual({ font: 20 })
    await act(async () => button('Customer preview').click())
    await act(async () => button('Variant').click())
    expect(defaults.getAttribute('aria-expanded')).toBe('false')
    await act(async () => defaults.click())
    expect(input('Message size')).toBe(field)
    expect(field.value).toBe('99')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    await change(field, '21')
    await act(async () => button('Export variant').click())
    expect(onExport.mock.lastCall?.[0].source.overrides.settingsDefaults).toEqual({ font: 21 })
  })

  it('preserves a raw content reference while previewing its resolved value and makes edits literal', async () => {
    const props = fixture(); const reference = { kind: 'content', id: 'copy-resource', revision: 3, path: 'heading' }
    props.initialDocument.source.overrides.content = { heading: reference }
    const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} previewData={{ content: { heading: 'Resolved linked heading' } }} onDraftChange={onDraftChange} />))
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.content.heading).toEqual(reference)
    expect(input('Heading').value).toBe('Resolved linked heading')
    expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="staff"] iframe')!.srcdoc).toContain('Resolved linked heading')
    await change(input('Heading'), 'Local literal heading')
    await act(async () => root.render(<GroupVariantWorkspace {...props} previewData={{ content: { heading: 'Changed linked heading' } }} onDraftChange={onDraftChange} />))
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.content.heading).toBe('Local literal heading')
    expect(input('Heading').value).toBe('Local literal heading')
    await act(async () => button('Reset content Heading').click())
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.content).toBeUndefined()
    expect(input('Heading').value).toBe('Family heading')
  })

  it('resolves a referenced content ancestor without storing the resolved object in the variant', async () => {
    const props = fixture(); const definition = structuredClone(props.familyDocument.source.definition)
    definition.fields[0].path = 'content.copy.heading'
    const familyDocument = exportBindingDocument(definition, { target: 'document', settings: props.familyDocument.settingsSpec })
    const initialDocument = structuredClone(props.initialDocument)
    initialDocument.source.overrides.content = { copy: { kind: 'content', id: 'copy-resource', revision: 3 } }
    const effectiveDocument = materializeFamilyDocument(familyDocument, initialDocument.source.overrides)
    const onDraftChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace initialDocument={initialDocument} effectiveDocument={effectiveDocument} familyDocument={familyDocument} previewData={{ content: { copy: { heading: 'Resolved nested heading' } } }} onDraftChange={onDraftChange} />))
    expect(container.querySelector<HTMLIFrameElement>('[data-variant-mode="staff"] iframe')!.srcdoc).toContain('Resolved nested heading')
    expect(onDraftChange.mock.lastCall?.[0].source.overrides.content).toEqual({ copy: { kind: 'content', id: 'copy-resource', revision: 3 } })
  })

  it('retains customer history across modes while the host echoes raw drafts', async () => {
    const props = fixture(); const drafts = vi.fn()
    function Host() {
      const [raw, setRaw] = useState(props.initialDocument)
      return <GroupVariantWorkspace {...props} initialDocument={raw} initialSettings={{ font: 22 }} sessionKey="echoing-host" onDraftChange={next => { drafts(next); setRaw(structuredClone(next)) }} />
    }
    await act(async () => root.render(<Host />))
    await change(input('Heading'), 'Local heading')
    await act(async () => button('Customer access').click())
    await act(async () => container.querySelector<HTMLElement>('[aria-label="Customer may change Message size"]')!.click())
    expect(drafts).toHaveBeenCalledTimes(3)
    await act(async () => button('Customer preview').click())
    await change(input('Personal message'), 'Customer draft')
    expect(button('Undo personalization').disabled).toBe(false)
    await act(async () => button('Variant').click())
    expect(input('Heading').value).toBe('Local heading')
    await act(async () => button('Customer preview').click())
    expect(input('Personal message').value).toBe('Customer draft')
    expect(button('Undo personalization').disabled).toBe(false)
    expect(drafts.mock.lastCall?.[0].source.overrides.settingsDefaults).toEqual({ font: 20 })
  })
})
