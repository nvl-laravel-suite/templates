// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from './use-keyboard-shortcuts'
import { createVoucherBuilder, type VoucherBuilderInstance } from '../instance'
import { VoucherBuilderProvider } from '../provider'
import { VoucherPortalContext } from '../context'

type Callbacks = Parameters<typeof useKeyboardShortcuts>[0]
function Probe({ callbacks }: { callbacks: Callbacks }) {
  useKeyboardShortcuts(callbacks)
  return null
}
function Surface({
  instance,
  name,
  callbacks,
  children,
}: {
  instance: VoucherBuilderInstance
  name: string
  callbacks?: Callbacks
  children?: ReactNode
}) {
  const [scope, setScope] = useState<HTMLDivElement | null>(null)
  return (
    <VoucherBuilderProvider instance={instance}>
      <VoucherPortalContext.Provider value={scope}>
        <div className="nc-workspace" data-editor={name} ref={setScope}>
          <Probe callbacks={callbacks} />
          <div data-key-target tabIndex={0} />
          {children}
        </div>
      </VoucherPortalContext.Provider>
    </VoucherBuilderProvider>
  )
}

describe('workspace keyboard ownership', () => {
  let root: Root
  let container: HTMLDivElement
  let first: VoucherBuilderInstance, second: VoucherBuilderInstance
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    first = createVoucherBuilder()
    second = createVoucherBuilder()
    for (const instance of [first, second]) {
      instance.actions.addBlock(instance.actions.getProject().sections[0].id, 'text')
      instance.actions.setActiveBlock(Object.keys(instance.actions.getProject().blocks)[0])
    }
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    first.destroy()
    second.destroy()
    container.remove()
    vi.unstubAllGlobals()
  })
  const target = (name: string) =>
    container.querySelector<HTMLElement>(`[data-editor="${name}"] > [data-key-target]`)!
  const key = async (element: Element, key: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
    await act(async () => element.dispatchEvent(event))
    return event
  }
  it.each([false, true])('isolates shortcuts for sibling/nested workspaces (nested=%s)', async (nested) => {
    const firstPalette = vi.fn(),
      secondPalette = vi.fn()
    const secondSurface = <Surface instance={second} name="second" callbacks={{ onOpenPalette: secondPalette }} />
    await act(async () =>
      root.render(
        <>
          <Surface instance={first} name="first" callbacks={{ onOpenPalette: firstPalette }}>
            {nested ? secondSurface : null}
          </Surface>
          {!nested && secondSurface}
          <button data-outside>Host action</button>
        </>,
      ),
    )
    await key(target('second'), 'D', { ctrlKey: true })
    expect(Object.keys(second.actions.getProject().blocks)).toHaveLength(2)
    expect(Object.keys(first.actions.getProject().blocks)).toHaveLength(1)
    await key(target('second'), 'K', { ctrlKey: true })
    expect(secondPalette).toHaveBeenCalledOnce()
    expect(firstPalette).not.toHaveBeenCalled()
    const outside = await key(container.querySelector('[data-outside]')!, 'd', { ctrlKey: true })
    expect(outside.defaultPrevented).toBe(false)
    expect(Object.keys(first.actions.getProject().blocks)).toHaveLength(1)
    expect(Object.keys(second.actions.getProject().blocks)).toHaveLength(2)
  })
  it('accepts the browser key values for Shift+Z and Shift+?', async () => {
    const help = vi.fn()
    await act(async () =>
      root.render(<Surface instance={first} name="first" callbacks={{ onOpenShortcuts: help }} />),
    )
    await key(target('first'), 'z', { ctrlKey: true })
    expect(Object.keys(first.actions.getProject().blocks)).toHaveLength(0)
    await key(target('first'), 'Z', { ctrlKey: true, shiftKey: true })
    expect(Object.keys(first.actions.getProject().blocks)).toHaveLength(1)
    await key(target('first'), '?', { shiftKey: true })
    expect(help).toHaveBeenCalledOnce()
  })
  it('keeps modal/menu shortcuts and native typing out of document commands', async () => {
    const palette = vi.fn(),
      remove = vi.fn()
    await act(async () =>
      root.render(
        <Surface
          instance={first}
          name="first"
          callbacks={{ onOpenPalette: palette, onDelete: remove }}
        >
          <div role="dialog">
            <input aria-label="Modal draft" />
          </div>
          <div role="menu">
            <button>Menu action</button>
          </div>
          <input aria-label="Inspector draft" />
          <div contentEditable suppressContentEditableWarning>
            <strong>Inline draft</strong>
          </div>
        </Surface>,
      ),
    )
    const before = first.actions.getProject()
    await key(container.querySelector('[role="dialog"] input')!, 's', { ctrlKey: true })
    await key(container.querySelector('[role="menu"] button')!, 'k', { ctrlKey: true })
    await key(container.querySelector('[aria-label="Inspector draft"]')!, 'z', { ctrlKey: true })
    await key(container.querySelector('strong')!, 'Delete')
    expect(palette).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(first.actions.getProject()).toEqual(before)
  })
  it('respects composing input and local React prevention before handling shortcuts', async () => {
    const palette = vi.fn(),
      remove = vi.fn()
    await act(async () =>
      root.render(
        <Surface instance={first} name="first" callbacks={{ onOpenPalette: palette, onDelete: remove }}>
          <button onKeyDown={(event) => event.preventDefault()}>Local editor action</button>
        </Surface>,
      ),
    )
    await key(target('first'), 'Delete', { isComposing: true })
    await key(target('first'), 'k', { ctrlKey: true, altKey: true })
    await key(container.querySelector('button')!, 'k', { ctrlKey: true })
    expect(remove).not.toHaveBeenCalled()
    expect(palette).not.toHaveBeenCalled()
  })
})
