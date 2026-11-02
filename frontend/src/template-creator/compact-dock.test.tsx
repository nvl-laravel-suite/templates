// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { WorkspaceGrid, WorkspacePanel } from './workspace-panel'

describe('compact workspace dock', () => {
  let root: Root
  let container: HTMLDivElement
  let width: number
  let observers: Map<Element, Set<() => void>>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    width = 1280
    observers = new Map()
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: () => void) {}
      observe(element: Element) {
        const callbacks = observers.get(element) ?? new Set()
        callbacks.add(this.callback)
        observers.set(element, callbacks)
      }
      unobserve() {}
      disconnect() {}
    })
    const bounds = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('tc-shell') ? { width } as DOMRect : bounds.call(this)
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find(element => element.getAttribute('aria-label') === label || element.textContent?.trim() === label)
  const click = async (label: string) => {
    expect(button(label), label).toBeDefined()
    await act(async () => button(label)!.click())
  }
  const resize = async (nextWidth: number) => {
    width = nextWidth
    await act(async () => {
      for (const callback of observers.get(container.querySelector('.tc-shell')!) ?? []) callback()
    })
  }
  const render = async () => {
    await act(async () => root.render(<div className="tc-shell" data-template-workspace-mode="design">
      <WorkspaceGrid layout="compact">
        <WorkspacePanel area="sidebar">
          <input aria-label="Values draft" defaultValue="Original value" />
          <Select aria-label="Nested choice" defaultValue="first" options={[{ value: 'first', label: 'First choice' }, { value: 'second', label: 'Second choice' }]} />
        </WorkspacePanel>
        <WorkspacePanel area="design"><button>Canvas action</button></WorkspacePanel>
        <WorkspacePanel area="inspector"><input aria-label="Appearance draft" defaultValue="Original appearance" /></WorkspacePanel>
      </WorkspaceGrid>
    </div>))
  }

  it('retains the same form nodes and unfinished values when switching local dock tabs', async () => {
    await render()
    const values = container.querySelector<HTMLInputElement>('[aria-label="Values draft"]')!
    const appearance = container.querySelector<HTMLInputElement>('[aria-label="Appearance draft"]')!
    values.value = 'Uncommitted value'
    appearance.value = 'Uncommitted appearance'

    expect(values.closest('[hidden], [inert]')).toBeNull()
    expect(appearance.closest('[hidden], [inert]')).not.toBeNull()
    await click('Appearance')
    expect(values.closest('[hidden], [inert]')).not.toBeNull()
    expect(appearance.closest('[hidden], [inert]')).toBeNull()
    await click('Values')

    expect(container.querySelector('[aria-label="Values draft"]')).toBe(values)
    expect(container.querySelector('[aria-label="Appearance draft"]')).toBe(appearance)
    expect(values.value).toBe('Uncommitted value')
    expect(appearance.value).toBe('Uncommitted appearance')
    expect(button('Values')?.getAttribute('aria-selected')).toBe('true')
  })

  it('parks the mounted dock through mobile drawer dismissal and restores trigger focus', async () => {
    await render()
    const values = container.querySelector<HTMLInputElement>('[aria-label="Values draft"]')!
    values.value = 'Not yet committed'
    values.setAttribute('aria-invalid', 'true')

    await resize(390)
    const trigger = button('Editing tools')!
    expect(trigger).toBeDefined()
    trigger.focus()
    await click('Editing tools')
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Editing tools')
    expect(document.querySelector('[role="dialog"]')?.contains(values)).toBe(true)
    expect(values.closest('[data-template-workspace-mode="design"]')).not.toBeNull()

    await act(async () => {
      values.focus()
      values.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(container.querySelector('[aria-label="Values draft"]')).toBe(values)
    expect(values.value).toBe('Not yet committed')
    expect(values.closest('[hidden], [inert]')).not.toBeNull()
    expect(container.querySelector('[data-template-workspace-mode="design"] [aria-invalid="true"]')).toBe(values)

    await click('Editing tools')
    expect(document.querySelector('[role="dialog"]')?.contains(values)).toBe(true)
    await resize(1280)
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(container.querySelector('[aria-label="Values draft"]')).toBe(values)
    expect(values.value).toBe('Not yet committed')
    expect(values.closest('[hidden], [inert]')).toBeNull()
  })

  it('keeps a nested choice popup usable inside the drawer and retains its selected value', async () => {
    await render()
    const choice = container.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Nested choice"]')!
    expect(choice).not.toBeNull()
    await resize(390)
    await click('Editing tools')
    await act(async () => choice.click())
    await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.includes('Second choice'))!
    expect(option).toBeDefined()
    expect(option.closest('[role="dialog"]')).not.toBeNull()
    await act(async () => option.click())
    await vi.waitFor(() => expect(choice.textContent).toContain('Second choice'))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await act(async () => {
      choice.focus()
      choice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await click('Editing tools')
    expect(container.querySelector('[role="combobox"][aria-label="Nested choice"]')).toBe(choice)
    expect(choice.textContent).toContain('Second choice')
  })

  it('preserves focus on the edited control when its open drawer docks on desktop', async () => {
    await render()
    const values = container.querySelector<HTMLInputElement>('[aria-label="Values draft"]')!
    await resize(390)
    await click('Editing tools')
    values.focus()
    expect(document.activeElement).toBe(values)

    await resize(1280)

    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(values))
    expect(values.closest('[hidden], [inert]')).toBeNull()
  })

  it('moves focus to the tools launcher when a focused desktop dock is parked on mobile', async () => {
    await render()
    const values = container.querySelector<HTMLInputElement>('[aria-label="Values draft"]')!
    values.focus()
    expect(document.activeElement).toBe(values)

    await resize(390)

    expect(values.closest('[hidden], [inert]')).not.toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(button('Editing tools')))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('moves launcher focus into the visible dock when a closed mobile drawer becomes desktop', async () => {
    await render()
    await resize(390)
    await click('Editing tools')
    const values = container.querySelector<HTMLInputElement>('[aria-label="Values draft"]')!
    await act(async () => {
      values.focus()
      values.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(button('Editing tools')))

    await resize(1280)

    await vi.waitFor(() => expect(document.activeElement).toBe(button('Values')))
    expect(document.activeElement?.closest('[hidden], [inert]')).toBeNull()
  })

  it('closes an inactive mode drawer and retains invalid drafts without focusing its hidden launcher', async () => {
    await render()
    const values = container.querySelector<HTMLInputElement>('[aria-label="Values draft"]')!
    values.setAttribute('aria-invalid', 'true')
    values.value = 'Invalid draft in previous mode'
    await resize(390)
    await click('Editing tools')
    values.focus()
    const nextMode = document.createElement('button')
    nextMode.textContent = 'Next mode action'
    container.append(nextMode)

    await act(async () => {
      container.querySelector<HTMLElement>('[data-template-workspace-mode="design"]')!.hidden = true
      nextMode.focus()
    })

    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(container.querySelector('[data-template-workspace-mode="design"] [aria-invalid="true"]')).toBe(values)
    expect(values.value).toBe('Invalid draft in previous mode')
    await vi.waitFor(() => expect(document.activeElement).toBe(nextMode))
    expect(document.activeElement?.closest('[hidden], [inert]')).toBeNull()
  })
})
