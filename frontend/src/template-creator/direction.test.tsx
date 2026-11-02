// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateCreator } from './TemplateCreator'
import { createTemplateCreator } from '../template-core/editing'
import { createInvoiceTemplate } from '../template-core/defaults'
import { TemplateNodeSchema } from '../template-core/schema'

describe('editor work areas', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => !item.closest('[hidden]') && (item.textContent?.trim() === label || item.getAttribute('aria-label') === label))
  const click = async (label: string) => { expect(button(label), label).toBeDefined(); await act(async () => button(label)!.click()) }

  it('remembers the selected tool when moving between grouped work areas', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} />))
    await click('Library')
    await click('Reusable blocks')
    await click('Build')
    await click('Fields')
    await click('Library')
    expect(button('Reusable blocks')?.getAttribute('aria-selected')).toBe('true')
    await click('Build')
    expect(button('Fields')?.getAttribute('aria-selected')).toBe('true')
  })

  it('remembers the host-selected initial tool after leaving its work area', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} builtInPanels={['fields', 'structure', 'blocks']} />))
    expect(button('Fields')?.getAttribute('aria-selected')).toBe('true')
    await click('Library')
    await click('Build')
    expect(button('Fields')?.getAttribute('aria-selected')).toBe('true')
  })

  it('focuses the visible inspector after locating a contract issue with other inspectors retained', async () => {
    const template = createInvoiceTemplate()
    template.nodes.image = TemplateNodeSchema.parse({ id: 'image', name: 'Unfinished image', kind: 'element', tag: 'img' })
    template.roots.push('image')
    await act(async () => root.render(<TemplateCreator initialTemplate={template} />))
    await click('Fields')
    await click('Structure')
    await click('Data contract')
    await click('Review')
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Image asset'))
    expect(document.activeElement?.closest('[hidden]')).toBeNull()
  })

  it('opens extension tools lazily and retains their state after first use', async () => {
    const mounted = vi.fn(), unmounted = vi.fn()
    function Extension() {
      useEffect(() => { mounted(); return unmounted }, [])
      return <input aria-label="Extension draft" defaultValue="Original" />
    }
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} workspacePanels={[{ id: 'document-theme', label: 'Theme', content: <Extension /> }]} />))
    expect(mounted).not.toHaveBeenCalled()
    await click('Setup')
    const field = container.querySelector<HTMLInputElement>('[aria-label="Extension draft"]')!
    field.value = 'Unfinished'
    await click('Build')
    await click('Setup')
    expect(container.querySelector('[aria-label="Extension draft"]')).toBe(field)
    expect(field.value).toBe('Unfinished')
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(unmounted).not.toHaveBeenCalled()
  })

  it('keeps selected content editable and its history intact while using a configuration tool', async () => {
    const instance = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    await act(async () => root.render(<TemplateCreator instance={instance} workspacePanels={[{ id: 'document-theme', label: 'Theme', content: <span>Theme controls</span> }]} />))
    const name = container.querySelector<HTMLInputElement>('[aria-label="Element name"]')!
    if (button('Setup')) await click('Setup')
    await click('Theme')
    expect(container.querySelector('[aria-label="Element name"]')).toBe(name)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Renamed from theme')
      name.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(instance.getTemplate().nodes[instance.getTemplate().roots[0]].name).toBe('Renamed from theme')
    await act(async () => instance.actions.undo())
    expect(name.value).not.toBe('Renamed from theme')
    instance.destroy()
  })

  it('retains invalid stylesheet drafts across work areas and blocks exporting stale output', async () => {
    const onExport = vi.fn()
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} onExport={onExport} />))
    if (button('Setup')) await click('Setup')
    await click('Styles')
    const field = container.querySelector<HTMLTextAreaElement>('[aria-label="Stylesheet"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '.broken {')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    if (button('Build')) await click('Build')
    else await click('Structure')
    if (button('Setup')) await click('Setup')
    await click('Styles')
    expect(container.querySelector('[aria-label="Stylesheet"]')).toBe(field)
    expect(field.value).toBe('.broken {')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    await click('Export HTML')
    expect(onExport).not.toHaveBeenCalled()
  })
})
