// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { CanvasElementFrame } from './canvas-element-frame'
import { TemplateCreator } from './TemplateCreator'
import { createInvoiceTemplate, createTemplateDefinition, createTemplateNode } from '../template-core/defaults'
import { createTemplateCreator } from '../template-core/editing'
import { childIds } from '../template-core/validation'
import { TemplateCanvas } from './canvas'

describe('canvas element frame', () => {
  it('keeps keyboard focus in the toolbar when parent navigation reaches a root', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const render = (nested: boolean) => <CanvasElementFrame id={nested ? 'child' : 'root'} name={nested ? 'Child' : 'Root'} kind="div"
      bounds={[{ left: 0, top: 50, width: 200, height: 30 }]} stageWidth={240}
      parent={nested ? { name: 'Root', select: () => root.render(render(false)) } : undefined}
      actions={<button>Duplicate element</button>} />
    act(() => root.render(render(true)))
    const parent = container.querySelector<HTMLButtonElement>('[aria-label="Select parent: Root"]')!
    act(() => parent.focus())
    act(() => parent.click())
    await act(async () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    expect(container.querySelector('[aria-label="Select parent: Root"]')).toBeNull()
    expect(document.activeElement?.textContent).toBe('Duplicate element')
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  it('keeps repeated instance boundaries separate from one accessible action bar', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const parent = vi.fn(), duplicate = vi.fn()
    act(() => root.render(<CanvasElementFrame id="item" name="Item title" kind="text" stageWidth={240} viewport={{ top: 130, bottom: 260 }}
      bounds={[{ left: 180, top: 80, width: 40, height: 20 }, { left: 180, top: 160, width: 40, height: 20 }]}
      parent={{ name: 'Items', select: parent }} actions={<button onClick={duplicate}>Duplicate element</button>} />))
    expect(container.querySelectorAll('[data-template-selection="item"]')).toHaveLength(2)
    expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1)
    const tools = container.querySelector<HTMLElement>('[role="toolbar"]')!
    expect(tools.style.top).toBe('134px')
    expect(tools.style.left).toBe('172px')
    expect(tools.closest('[aria-hidden="true"]')).toBeNull()
    const buttons = [...tools.querySelectorAll('button')]
    act(() => buttons.find(button => button.getAttribute('aria-label') === 'Select parent: Items')!.click())
    act(() => buttons.find(button => button.textContent === 'Duplicate element')!.click())
    expect(parent).toHaveBeenCalledOnce()
    expect(duplicate).toHaveBeenCalledOnce()
    act(() => buttons[0].focus())
    act(() => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(buttons.at(-1))
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  it.each([false, true])('uses canonical commands and hides structural commands for protected content (protected=%s)', async protectedContent => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const template = createInvoiceTemplate()
    const parent = template.nodes[template.roots[0]]
    const id = childIds(parent)[0]
    const creator = createTemplateCreator({ initialTemplate: template })
    creator.actions.select(id)
    await act(async () => root.render(<TemplateCreator instance={creator} nodeInspector={protectedContent ? () => null : undefined} />))
    const frame = container.querySelector('iframe')!
    frame.contentDocument!.body.innerHTML = `<main class="template-document"><div data-template-node-id="${id}">Example</div></main>`
    frame.contentDocument!.querySelector<HTMLElement>('[data-template-node-id]')!.getBoundingClientRect = () => ({ left: 20, top: 50, width: 200, height: 30 }) as DOMRect
    act(() => frame.dispatchEvent(new Event('load')))
    const tools = container.querySelector('[role="toolbar"]')!
    expect(tools).not.toBeNull()
    expect(frame.srcdoc).not.toContain('tc-element-toolbar')
    const duplicate = tools.querySelector<HTMLButtonElement>('[aria-label="Duplicate element"]')
    if (protectedContent) {
      expect(duplicate).toBeNull()
      expect(tools.textContent).toContain('Managed structure')
    } else {
      expect(tools.querySelector<HTMLButtonElement>('[aria-label="Move element up"]')!.disabled).toBe(true)
      act(() => tools.querySelector<HTMLButtonElement>('[aria-label="Move element down"]')!.click())
      expect(childIds(creator.getTemplate().nodes[parent.id])[1]).toBe(id)
      act(() => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === 'Undo')!.click())
      act(() => creator.actions.select(id))
      const command = container.querySelector<HTMLButtonElement>('[role="toolbar"] [aria-label="Duplicate element"]')!
      act(() => command.focus())
      act(() => command.click())
      expect(Object.keys(creator.getTemplate().nodes).length).toBeGreaterThan(Object.keys(template.nodes).length)
      expect(document.activeElement).toBe(command)
      act(() => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === 'Undo')!.click())
      expect(creator.getTemplate()).toEqual(template)
      expect(creator.exportDocument('html').data).not.toContain('tc-element-')
      act(() => creator.actions.select(id))
      const remove = container.querySelector<HTMLButtonElement>('[role="toolbar"] [aria-label="Remove element"]')!
      act(() => remove.focus())
      act(() => remove.click())
      let dialog = document.querySelector('[role="alertdialog"]')!
      expect(dialog).not.toBeNull()
      act(() => [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Keep element')!.click())
      await act(async () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      expect(creator.getTemplate().nodes[id]).toBeDefined()
      expect(document.activeElement).toBe(remove)
      act(() => remove.click())
      dialog = document.querySelector('[role="alertdialog"]')!
      act(() => [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Remove element')!.click())
      await act(async () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      expect(creator.getTemplate().nodes[id]).toBeUndefined()
      expect(document.activeElement).toBe(container.querySelector('.tc-canvas'))
      act(() => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === 'Undo')!.click())
      expect(creator.getTemplate()).toEqual(template)
    }
    act(() => root.unmount())
    creator.destroy()
    container.remove()
    vi.unstubAllGlobals()
  })
  it('measures logical containers through visible descendants without wrapping their HTML', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const template = createTemplateDefinition()
    const condition = createTemplateNode('condition')
    const text = createTemplateNode('text')
    if (condition.kind !== 'condition') throw new Error('Expected condition')
    condition.children = [text.id]
    template.roots = [condition.id]
    template.nodes = { [condition.id]: condition, [text.id]: text }
    act(() => root.render(<TemplateCanvas template={template} selectedId={condition.id} onSelect={() => {}} />))
    const frame = container.querySelector('iframe')!
    frame.contentDocument!.body.innerHTML = `<main class="template-document"><span data-template-node-id="${text.id}">Visible</span></main>`
    frame.contentDocument!.querySelector('span')!.getBoundingClientRect = () => ({ left: 20, top: 50, width: 200, height: 30 }) as DOMRect
    act(() => frame.dispatchEvent(new Event('load')))
    const boundary = container.querySelector<HTMLElement>(`[data-template-selection="${condition.id}"]`)!
    expect(parseFloat(boundary.style.width)).toBeGreaterThan(0)
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toContain('Conditional content')
    expect(frame.srcdoc).not.toContain('tc-element-frame')
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  it('keeps contextual actions visible after a height-only canvas resize', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const observers = new Map<Element, (entries: { contentRect: { width: number } }[]) => void>()
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: (entries: { contentRect: { width: number } }[]) => void) {}
      observe(element: Element) { observers.set(element, this.callback) }
      disconnect() {}
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const template = createTemplateDefinition(), node = createTemplateNode('text')
    template.roots = [node.id]; template.nodes = { [node.id]: node }
    act(() => root.render(<TemplateCanvas template={template} selectedId={node.id} onSelect={() => {}} />))
    const canvas = container.querySelector<HTMLElement>('.tc-canvas')!, frame = container.querySelector('iframe')!
    let height = 500
    Object.defineProperty(canvas, 'clientHeight', { get: () => height })
    frame.contentDocument!.body.innerHTML = `<main class="template-document"><span data-template-node-id="${node.id}">Example</span></main>`
    frame.contentDocument!.querySelector('span')!.getBoundingClientRect = () => ({ left: 20, top: 400, width: 200, height: 30 }) as DOMRect
    act(() => { frame.dispatchEvent(new Event('load')); observers.get(canvas)!([{ contentRect: { width: 800 } }]) })
    expect(container.querySelector<HTMLElement>('[role="toolbar"]')!.style.top).toBe('356px')
    height = 200
    act(() => observers.get(canvas)!([{ contentRect: { width: 800 } }]))
    expect(container.querySelector<HTMLElement>('[role="toolbar"]')!.style.top).toBe('164px')
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
})
