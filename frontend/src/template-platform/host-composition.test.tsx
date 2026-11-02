// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmailTemplate } from '../template-email/presets'
import { exportBindingDocument } from './bindings'
import { materializeFamilyDocument } from './catalog'
import { TemplateWorkspace } from './workspace'
import { GroupVariantWorkspace } from './variant-workspace'
import type { GroupVariantDocument } from './types'

describe('host workspace composition', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const visible = <T extends Element>(selector: string) => [...container.querySelectorAll<T>(selector)].filter(node => !node.closest('[hidden]'))
  const choice = (label: string) => visible<HTMLButtonElement>('[role="radio"]').find(node => node.textContent?.trim() === label)!
  const header = { title: 'Host template', headingTag: 'h2' as const, slots: { afterDescription: <span role="status">Saved draft</span> } }

  it('lets email-only hosts hide the target selector without changing exported target', async () => {
    const initialDocument = exportBindingDocument(createEmailTemplate(), { target: 'email' }), onExport = vi.fn()
    await act(async () => root.render(<TemplateWorkspace initialDocument={initialDocument} allowTargetChange={false} header={header} onExport={onExport} />))
    expect(visible('[aria-label="Output target"]')).toHaveLength(0)
    expect(visible('h2').map(node => node.textContent)).toContain('Host template')
    expect(visible('[role="status"]').map(node => node.textContent)).toContain('Saved draft')
    await act(async () => visible<HTMLButtonElement>('button').find(node => node.textContent?.trim() === 'Export template')!.click())
    expect(onExport.mock.lastCall?.[0].target).toBe('email')
  })

  it('uses a native exclusive mode choice and preserves header status in either mode', async () => {
    const initialDocument = exportBindingDocument(createEmailTemplate(), { target: 'email' }), onModeChange = vi.fn()
    await act(async () => root.render(<TemplateWorkspace initialDocument={initialDocument} header={header} onModeChange={onModeChange} />))
    expect(visible('[aria-label="Output target"]')).toHaveLength(1)
    expect(choice('Design').getAttribute('aria-checked')).toBe('true')
    choice('Design').focus()
    await act(async () => choice('Design').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(onModeChange).toHaveBeenLastCalledWith('personalize')
    expect(choice('Personalize').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(choice('Personalize'))
    expect(visible('h2').map(node => node.textContent)).toContain('Host template')
    expect(visible('[role="status"]').map(node => node.textContent)).toContain('Saved draft')
    await act(async () => root.render(<TemplateWorkspace initialDocument={initialDocument} mode="design" header={header} />))
    expect(visible('[role="radiogroup"]')).toHaveLength(0)
  })

  it.each([false, true])('keeps variant modes and host header slots consistent (structural=%s)', async structural => {
    const familyDocument = exportBindingDocument(createEmailTemplate(), { target: 'email' })
    if (structural) familyDocument.variationPoints = [{ id: 'sections', label: 'Sections', kind: 'children', target: { kind: 'roots' }, minItems: 0, maxItems: 20, allowedKinds: ['element'] }]
    const initialDocument: GroupVariantDocument = { format: 'template-document', schemaVersion: 1, target: 'email', source: { mode: 'group-variant', group: { id: 'email-family', revision: 1 }, overrides: {} } }
    const props = { familyDocument, initialDocument, effectiveDocument: materializeFamilyDocument(familyDocument, {}) }, onModeChange = vi.fn()
    await act(async () => root.render(<GroupVariantWorkspace {...props} header={header} onModeChange={onModeChange} />))
    expect(choice('Variant').getAttribute('aria-checked')).toBe('true')
    expect(visible('h2').map(node => node.textContent)).toContain('Host template')
    choice('Variant').focus()
    await act(async () => choice('Variant').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(choice('Customer preview').getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(choice('Customer preview'))
    expect(onModeChange).toHaveBeenLastCalledWith('customer')
    expect(visible('[role="status"]').map(node => node.textContent)).toContain('Saved draft')
    await act(async () => choice('Variant').click())
    expect(onModeChange).toHaveBeenLastCalledWith('staff')
  })
})
