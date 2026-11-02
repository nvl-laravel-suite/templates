// @vitest-environment jsdom
import { Profiler, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateCanvas } from './canvas'
import { createTemplateDefinition, createTemplateNode } from '../template-core/defaults'

describe('iframe canvas resize scheduling', () => {
  let root: Root | null
  let container: HTMLDivElement
  let observers: Map<Element, () => void>
  let disconnects: Map<Element, ReturnType<typeof vi.fn>>
  let frames: Map<number, FrameRequestCallback>
  let serial: number
  const commits = vi.fn()
  const cancelFrame = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    observers = new Map()
    disconnects = new Map()
    frames = new Map()
    serial = 0
    commits.mockClear()
    cancelFrame.mockReset().mockImplementation((id: number) => frames.delete(id))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++serial
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: () => void) {}
      observe(element: Element) { observers.set(element, this.callback); disconnects.set(element, this.disconnect) }
      disconnect = vi.fn()
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function canvas() {
    const template = createTemplateDefinition(), node = createTemplateNode('text')
    template.roots = [node.id]
    template.nodes = { [node.id]: node }
    const select = vi.fn()
    const render = (value = template) => root!.render(<Profiler id="canvas" onRender={commits}>
      <TemplateCanvas template={value} selectedId={node.id} onSelect={select} />
    </Profiler>)
    await act(async () => render())
    const frame = container.querySelector('iframe')!
    const doc = frame.contentDocument!
    doc.body.innerHTML = `<main class="template-document"><span data-template-node-id="${node.id}">Text</span></main>`
    const page = doc.querySelector<HTMLElement>('main')!
    const dimensions = { width: 600, height: 100, scrollWidth: 600, scrollHeight: 100, selectedTop: 40 }
    const readHeight = vi.fn(() => dimensions.scrollHeight)
    Object.defineProperties(page, {
      scrollHeight: { get: readHeight },
      scrollWidth: { get: () => dimensions.scrollWidth },
    })
    page.getBoundingClientRect = () => ({ width: dimensions.width, height: dimensions.height, bottom: dimensions.height }) as DOMRect
    doc.querySelector('span')!.getBoundingClientRect = () => ({ left: 20, top: dimensions.selectedTop, width: 100, height: 20 }) as DOMRect
    await act(async () => frame.dispatchEvent(new Event('load')))
    expect(frame.style.height).not.toBe('')
    readHeight.mockClear()
    commits.mockClear()
    return { template, frame, page, dimensions, readHeight, notify: observers.get(page)!, render, select }
  }

  function flushFrames() {
    const pending = [...frames.values()]
    frames.clear()
    act(() => pending.forEach(callback => callback(0)))
  }

  it('coalesces repeated iframe notifications without synchronous geometry reads', async () => {
    const { notify, readHeight } = await canvas()

    act(() => { notify(); notify(); notify() })

    expect(readHeight).not.toHaveBeenCalled()
    expect(frames.size).toBe(1)
    flushFrames()
    expect(readHeight).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
  })

  it('publishes no React commits for unchanged iframe geometry', async () => {
    const { notify } = await canvas()

    act(notify)
    flushFrames()
    act(notify)
    flushFrames()

    expect(commits).not.toHaveBeenCalled()
  })

  it.each(['height', 'width', 'scrollHeight', 'scrollWidth'] as const)('refreshes selection when actual page %s changes below the minimum iframe height', async dimension => {
    const { frame, dimensions, notify } = await canvas()
    const height = frame.style.height
    const selected = () => container.querySelector<HTMLElement>('[data-template-selection]')!
    const top = selected().style.top
    dimensions[dimension] += 30
    dimensions.selectedTop += 20

    act(notify)
    flushFrames()

    expect(frame.style.height).toBe(height)
    expect(selected().style.top).not.toBe(top)
  })

  it('cancels pending old-document measurements on iframe reload and measures the new DOM immediately', async () => {
    const { frame, dimensions, readHeight, notify } = await canvas()
    act(notify)
    expect(frames.size).toBe(1)
    const [id, callback] = [...frames.entries()][0]
    dimensions.scrollHeight = 1800

    act(() => frame.dispatchEvent(new Event('load')))

    expect(frame.style.height).toBe('1800px')
    expect(cancelFrame).toHaveBeenCalledWith(id)
    expect(frames.size).toBe(0)
    readHeight.mockClear()
    act(() => { callback(0); notify() })
    expect(readHeight).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('cancels pending iframe measurements on unmount', async () => {
    const { readHeight, notify } = await canvas()
    act(notify)
    expect(frames.size).toBe(1)
    const [id, callback] = [...frames.entries()][0]

    act(() => root!.unmount())
    root = null

    expect(cancelFrame).toHaveBeenCalledWith(id)
    expect(frames.size).toBe(0)
    act(() => { callback(0); notify() })
    expect(readHeight).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('disposes the discarded iframe document as soon as rendered HTML changes before the next load event', async () => {
    const { template, frame, page, readHeight, notify, render, select } = await canvas()
    act(notify)
    const [id, callback] = [...frames.entries()][0]
    const oldNode = page.querySelector('span')!

    act(() => render({ ...template, name: 'Replacement document' }))

    expect(frame.srcdoc).toContain('<title>Replacement document</title>')
    expect(disconnects.get(page)).toHaveBeenCalledOnce()
    expect(cancelFrame).toHaveBeenCalledWith(id)
    expect(frames.size).toBe(0)
    readHeight.mockClear()
    act(() => {
      callback(0)
      notify()
      oldNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(readHeight).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('keeps the iframe binding and queued measurement when new prop objects produce identical HTML', async () => {
    const { template, frame, page, readHeight, notify, render } = await canvas()
    const html = frame.srcdoc
    act(notify)
    const id = [...frames.keys()][0]

    act(() => render(structuredClone(template)))

    expect(frame.srcdoc).toBe(html)
    expect(disconnects.get(page)).not.toHaveBeenCalled()
    expect(cancelFrame).not.toHaveBeenCalled()
    expect(frames.has(id)).toBe(true)
    flushFrames()
    expect(readHeight).toHaveBeenCalledOnce()
  })
})
