// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { exportBindingDocument } from './bindings'
import { materializeFamilyDocument } from './catalog'
import { createExperienceDocument } from './demo-documents'
import type { GroupVariantDocument } from './types'
import { GroupVariantWorkspace } from './variant-workspace'

function fixture() {
  const familyDocument = exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Compact family'), roots: ['message'],
    nodes: {
      message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'heading' } }, { value: { source: 'field', fieldId: 'gift' } }] },
    },
    fields: [
      { id: 'heading', path: 'content.heading', label: 'Heading', schema: { type: 'string', minLength: 1 }, defaultValue: 'Family heading', editable: false },
      { id: 'gift', path: 'inputs.gift', label: 'Gift message', schema: { type: 'string' }, defaultValue: 'Enjoy!', editable: true },
    ],
  }), { target: 'document' })
  const initialDocument: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } }
  return { familyDocument, initialDocument, effectiveDocument: materializeFamilyDocument(familyDocument, {}) }
}

describe('compact family workspaces', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => !node.closest('[hidden]') && (node.textContent?.trim() === label || node.getAttribute('aria-label') === label))!
  const click = async (label: string) => { expect(button(label), label).toBeDefined(); await act(async () => button(label).click()) }
  const input = (label: string) => [...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].find(node => !node.closest('[hidden]') && [label, `${label} *`].includes(node.getAttribute('aria-label') ?? ''))!
  const change = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  }

  it('keeps inherited variant drafts while switching dock tools and customer preview', async () => {
    const props = fixture(), onDraftChange = vi.fn(), onExport = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} layout="compact" onDraftChange={onDraftChange} onExport={onExport} />))
    expect(button('Customer preview').closest('.tc-toolbar')).not.toBeNull()
    const heading = input('Heading')
    await change(heading, '')
    expect(heading.getAttribute('aria-invalid')).toBe('true')
    await click('Settings')
    await click('Content')
    expect(input('Heading')).toBe(heading)
    expect(heading.value).toBe('')
    await click('Customer preview')
    expect(button('Variant').closest('.tc-toolbar')).not.toBeNull()
    await click('Variant')
    expect(input('Heading')).toBe(heading)
    expect(heading.getAttribute('aria-invalid')).toBe('true')
    await click('Export variant')
    expect(onExport).not.toHaveBeenCalled()
    expect(onDraftChange.mock.lastCall?.[0]).toEqual(props.initialDocument)
  })

  it('keeps customer input history and host commands when returning from compact staff mode', async () => {
    const props = fixture(), drafts = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} layout="compact" onDraftChange={drafts} header={{ title: 'Host template', primaryAction: { label: 'Save changes', onClick: vi.fn() } }} />))
    await click('Customer preview')
    expect(button('Variant').closest('.tc-toolbar')).not.toBeNull()
    const gift = input('Gift message')
    await change(gift, 'Keep this customer draft')
    await click('Variant')
    await click('Customer preview')
    expect(input('Gift message')).toBe(gift)
    expect(gift.value).toBe('Keep this customer draft')
    expect(button('Undo personalization').disabled).toBe(false)
    await click('Undo personalization')
    expect(gift.value).toBe('Enjoy!')
    expect(button('Save changes')).toBeDefined()
    expect([...container.querySelectorAll('h1')].filter(node => !node.closest('[hidden]')).map(node => node.textContent)).toEqual(['Host template'])
    expect(drafts.mock.lastCall?.[0]).toEqual(props.initialDocument)
  })

  it('forwards compact layout to structural variants without changing raw authority or undo', async () => {
    const familyDocument = createExperienceDocument()
    familyDocument.variationPoints = [{ id: 'sections', label: 'Additional sections', kind: 'children', target: { kind: 'roots' }, minItems: 1, maxItems: 4, requiredIds: ['voucher'], allowedKinds: ['element', 'text'] }]
    const initialDocument = fixture().initialDocument, drafts = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace familyDocument={familyDocument} effectiveDocument={familyDocument} initialDocument={initialDocument} layout="compact" onDraftChange={drafts} />))
    expect(button('Customer preview').closest('.tc-toolbar')).not.toBeNull()
    await click('Structure')
    await click('Add section')
    expect(drafts.mock.lastCall?.[0].source.overrides.variations.sections).toMatchObject({ kind: 'children', order: ['voucher', expect.any(String)] })
    await click('Properties')
    await click('Customer preview')
    await click('Variant')
    await click('Undo')
    expect(drafts.mock.lastCall?.[0].source.overrides.variations).toBeUndefined()
    expect(drafts.mock.lastCall?.[0]).not.toHaveProperty('source.definition')
    expect(familyDocument.source.definition.roots).toEqual(['voucher'])
  })

  it('opens the first permitted change with its own context without creating an override', async () => {
    const familyDocument = createExperienceDocument()
    familyDocument.variationPoints = [{ id: 'weight', label: 'Message weight', kind: 'node-style', nodeId: 'personal_message', property: 'font-weight', schema: { type: 'string' } }]
    const initialDocument = fixture().initialDocument, drafts = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace familyDocument={familyDocument} effectiveDocument={familyDocument} initialDocument={initialDocument} layout="compact" onDraftChange={drafts} />))
    expect(button('Edit variation Message weight')).toBeDefined()
    const inspector = container.querySelector('[aria-label="Template inspector"]')!
    expect([...inspector.querySelectorAll('h2,h3')].map(node => node.textContent)).toContain('Message weight')
    expect(input('Message weight')).toBeDefined()
    expect(button('Reset variation Message weight').disabled).toBe(true)
    expect(drafts.mock.lastCall?.[0]).toEqual(initialDocument)
  })
})
