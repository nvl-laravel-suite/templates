// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateCreator } from './TemplateCreator'
import { TemplateWorkspace } from '../template-platform/workspace'
import { createTemplateCreator } from '../template-core/editing'
import { createInvoiceTemplate } from '../template-core/defaults'
import { exportBindingDocument } from '../template-platform/bindings'
import { TemplateDefinitionSchema } from '../template-core/schema'

describe('compact editor interactions', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const visible = (element: Element) => !element.closest('[hidden], [inert]')
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => visible(item) && (item.textContent?.trim() === label || item.getAttribute('aria-label') === label))
  const click = async (label: string) => { expect(button(label), label).toBeDefined(); await act(async () => button(label)!.click()) }
  const tool = async (label: string) => {
    await click('Editor tool')
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.trim() === label)
    expect(option, label).toBeDefined(); await act(async () => option!.click())
  }
  const input = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('keeps tree navigation in Structure and preserves inspector draft and undo across dock tabs', async () => {
    const template = createInvoiceTemplate(), instance = createTemplateCreator({ initialTemplate: template })
    await act(async () => root.render(<TemplateCreator instance={instance} layout="compact" />))
    expect(button('Build')).toBeUndefined()
    const name = container.querySelector<HTMLInputElement>('[aria-label="Element name"]')!
    await input(name, 'Uncommitted name')
    await click('Structure')
    const tree = container.querySelector('[aria-label="Document structure"]')!
    expect(visible(tree)).toBe(true)
    const selected = tree.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]')!
    await act(async () => selected.click())
    expect(button('Structure')?.getAttribute('aria-selected')).toBe('true')
    button('Edit properties')!.focus()
    await click('Edit properties')
    await vi.waitFor(() => expect(document.activeElement).toBe(name))
    expect(container.querySelector('[aria-label="Element name"]')).toBe(name)
    expect(name.value).toBe('Uncommitted name')
    await act(async () => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    await click('Structure'); await click('Properties'); await click('Undo')
    expect(name.value).not.toBe('Uncommitted name')
    instance.destroy()
  })

  it('retains invalid tool input under the workspace wrapper and blocks stale export', async () => {
    const onExport = vi.fn()
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} layout="compact" onExport={onExport} />))
    await tool('Styles')
    const field = container.querySelector<HTMLTextAreaElement>('[aria-label="Stylesheet"]')!
    await input(field, '.broken {')
    await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    await click('Structure'); await click('Properties'); await tool('Styles')
    expect(container.querySelector('[aria-label="Stylesheet"]')).toBe(field)
    expect(field.getAttribute('aria-invalid')).toBe('true')
    await click('Properties'); await click('Export HTML')
    expect(onExport).not.toHaveBeenCalled()
  })

  it('respects a host that omits the Structure tool when opening Properties', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} layout="compact" builtInPanels={['fields']} />))
    expect(button('Structure')).toBeUndefined()
    await click('Properties')
    expect(button('Add section')).toBeUndefined()
    expect(container.querySelector('[aria-label="Document structure"]')).toBeNull()
    expect(container.querySelector('[aria-label="Element name"]')).not.toBeNull()
  })

  it('opens Properties from a canvas selection while retaining the Structure expansion state', async () => {
    const template = createInvoiceTemplate()
    await act(async () => root.render(<TemplateCreator initialTemplate={template} layout="compact" />))
    await click('Structure')
    const tree = container.querySelector('[aria-label="Document structure"]')!
    const branch = tree.querySelector<HTMLElement>('[role="treeitem"][aria-expanded="true"]')!
    const collapse = branch.querySelector<HTMLButtonElement>('button')!
    await act(async () => collapse.click())
    expect(branch.getAttribute('aria-expanded')).toBe('false')
    const iframe = container.querySelector<HTMLIFrameElement>('iframe')!
    const doc = iframe.contentDocument!
    doc.body.innerHTML = `<div data-template-node-id="${template.roots[0]}">Canvas block</div>`
    await act(async () => iframe.dispatchEvent(new Event('load')))
    await act(async () => doc.querySelector<HTMLElement>('[data-template-node-id]')!.click())
    expect(button('Properties')?.getAttribute('aria-selected')).toBe('true')
    await click('Structure')
    expect(container.querySelector('[aria-label="Document structure"]')).toBe(tree)
    expect(branch.getAttribute('aria-expanded')).toBe('false')
  })

  it('moves mode controls into the canvas without resetting session or emitting document edits', async () => {
    const definition = TemplateDefinitionSchema.parse({ ...createInvoiceTemplate(), fields: [], roots: ['message'], nodes: { message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: [] } } })
    const creator = createTemplateCreator({ initialTemplate: definition }), onDraftChange = vi.fn()
    await act(async () => root.render(<TemplateWorkspace layout="compact" initialDocument={exportBindingDocument(definition, { target: 'document' })} creator={creator} onDraftChange={onDraftChange} header={{ title: 'Host template', primaryAction: { label: 'Save', onClick() {} } }} />))
    expect(button('Personalize')?.closest('.tc-toolbar')).not.toBeNull()
    const name = container.querySelector<HTMLInputElement>('[aria-label="Element name"]')!
    await input(name, 'Buffered')
    onDraftChange.mockClear()
    await click('Personalize'); await click('Design')
    expect(container.querySelector('[aria-label="Element name"]')).toBe(name)
    expect(name.value).toBe('Buffered')
    expect(onDraftChange).not.toHaveBeenCalled()
    expect([...container.querySelectorAll('h1')].filter(visible)).toHaveLength(1)
    expect(button('Save')).toBeDefined()
    creator.destroy()
  })
})
