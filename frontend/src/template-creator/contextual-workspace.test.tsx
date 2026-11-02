// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateCreator } from './TemplateCreator'
import { TemplateEditor } from './TemplateEditor'
import { CommitInput } from './controls'
import { createInvoiceTemplate } from '../template-core/defaults'
import { createTemplateCreator } from '../template-core/editing'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { createEmailTemplate } from '../template-email/presets'

describe('contextual editor priorities', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => !item.closest('[hidden]') && (item.getAttribute('aria-label') === label || item.textContent?.trim() === label))
  const click = async (label: string) => { expect(button(label), label).toBeDefined(); await act(async () => button(label)!.click()) }

  it('opens an available host-selected tool without changing document or session state', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() }), changed = vi.fn()
    const render = (initialPanel: string) => <TemplateCreator instance={creator} onChange={changed} layout="compact" initialPanel={initialPanel} workspacePanels={[{ id: 'changes', label: 'Allowed changes', content: <span>Choose an allowed change</span>, inspector: <input aria-label="Change value" defaultValue="Original" />, inspectorTitle: 'Message weight' }]} />
    await act(async () => root.render(render('changes')))
    const input = container.querySelector<HTMLInputElement>('[aria-label="Change value"]')!
    expect(input).not.toBeNull()
    expect(input.closest('[hidden]')).toBeNull()
    expect(container.querySelector('.tc-inspector h2')?.textContent).toBe('Message weight')
    input.value = 'Buffered'
    await act(async () => root.render(render('structure')))
    expect(container.querySelector('[aria-label="Change value"]')).toBe(input)
    expect(input.value).toBe('Buffered')
    expect(changed).not.toHaveBeenCalled()
    creator.destroy()
  })

  it('ignores an unavailable initial tool instead of bypassing host panel restrictions', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} initialPanel="styles" builtInPanels={['fields']} layout="compact" />))
    expect(container.querySelector('[aria-label="Stylesheet"]')).toBeNull()
    expect(container.querySelector('[aria-label="Template fields"]')?.closest('[hidden]')).toBeNull()
  })

  it('reports and reveals invalid buffered CSS after the user leaves its tool', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} layout="compact" builtInPanels={['styles', 'structure']} />))
    const field = container.querySelector<HTMLTextAreaElement>('[aria-label="Stylesheet"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '.unfinished {')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    await click('Properties')
    await vi.waitFor(() => expect(button('1 field needs attention')).toBeDefined())
    expect(button('Template contract valid')).toBeUndefined()
    await click('1 field needs attention')
    await vi.waitFor(() => expect(document.activeElement).toBe(field))
    expect(field.closest('[hidden]')).toBeNull()
    expect(field.value).toBe('.unfinished {')
  })

  it('reveals generic inspector drafts in a restricted default layout without opening Structure', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} builtInPanels={['styles']} workspacePanels={[{ id: 'audit', label: 'Audit', content: <span>Checks</span>, inspector: <span>Audit detail</span> }]} inspectorFooter={<CommitInput label="Family rule" value="Original" onCommit={() => { throw new Error('Finish this rule.') }} />} />))
    await click('Customer and family access')
    const field = container.querySelector<HTMLInputElement>('[aria-label="Family rule"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'Unfinished')
      field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    await click('Audit')
    await click('1 field needs attention')
    await vi.waitFor(() => expect(document.activeElement).toBe(field))
    expect(field.closest('[hidden]')).toBeNull()
    expect(button('Structure')).toBeUndefined()
    expect(field.value).toBe('Unfinished')
  })

  it('reveals a retained invalid personalization setting without losing its draft', async () => {
    await act(async () => root.render(<TemplateEditor template={createInvoiceTemplate()} layout="compact" inspectorContent={<CommitInput label="Presentation value" value="18" onCommit={() => { throw new Error('Choose an allowed value.') }} />} />))
    await click('Appearance')
    const field = container.querySelector<HTMLInputElement>('[aria-label="Presentation value"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'Unfinished')
      field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    await click('Values')
    await vi.waitFor(() => expect(button('1 field needs attention')).toBeDefined())
    expect(container.querySelector('.tc-footer')?.textContent).not.toContain('Ready to export')
    await click('1 field needs attention')
    await vi.waitFor(() => expect(document.activeElement).toBe(field))
    expect(field.value).toBe('Unfinished')
    expect(field.closest('[hidden]')).toBeNull()
  })

  it('keeps email asset entry inside the baseline image profile', async () => {
    const creator = createTemplateCreator({ initialTemplate: createEmailTemplate() })
    await act(async () => root.render(<TemplateCreator instance={creator} layout="compact" builtInPanels={['assets']} previewTarget="email" />))
    const input = async (label: string, value: string) => {
      const field = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
    }
    await input('Image name', 'Unsupported image')
    await input('Image URL', 'https://example.test/photo.webp')
    await click('Add image asset')
    expect(creator.getTemplate().assets).toHaveLength(0)
    expect(container.textContent).toContain('Use PNG, JPEG or GIF for email.')
    creator.destroy()
  })

  it('puts editable content before metadata and keeps structural commands in their contextual menu', async () => {
    const template = TemplateDefinitionSchema.parse({ ...createInvoiceTemplate(), fields: [], roots: ['message'], nodes: {
      message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', name: 'Message text', kind: 'text', parts: [{ value: { source: 'literal', value: 'Enjoy the experience.' } }] },
    } })
    const creator = createTemplateCreator({ initialTemplate: template })
    await act(async () => root.render(<TemplateCreator instance={creator} layout="compact" />))
    const content = container.querySelector('[aria-label="Static text"]')!
    const name = container.querySelector('[aria-label="Element name"]')!
    expect(Boolean(content.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(container.querySelector('.tc-selection-tools')).toBeNull()
    await click('Element actions')
    const duplicate = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('Duplicate element'))!
    expect(duplicate).toBeDefined()
    await act(async () => duplicate.click())
    expect(creator.getTemplate().roots).toHaveLength(2)
    await click('Undo')
    expect(creator.getTemplate().roots).toHaveLength(1)
    creator.destroy()
  })
})
