// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoucherBuilder } from '../VoucherBuilder'
import { createVoucherBuilder, type VoucherBuilderInstance } from '../instance'

describe('retained voucher docks', () => {
  let root: Root, container: HTMLDivElement, instance: VoucherBuilderInstance
  let width: number, observers: Array<() => void>
  beforeEach(() => {
    width = 1440; observers = []
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(() => callback([{ contentRect: { width, height: 900 } } as ResizeObserverEntry], this as unknown as ResizeObserver))
      }
      observe() { observers.at(-1)?.() }
      unobserve() {}
      disconnect() {}
    })
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    instance = createVoucherBuilder()
  })
  afterEach(async () => { await act(async () => root.unmount()); instance.destroy(); container.remove(); vi.unstubAllGlobals() })
  const visible = (element: Element) => !element.closest('[hidden], [inert]')
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => visible(item) && (item.getAttribute('aria-label') === label || item.textContent?.trim() === label))
  const click = async (label: string) => { expect(button(label), label).toBeDefined(); await act(async () => button(label)!.click()) }
  const resize = async (next: number) => { await act(async () => { width = next; [...observers].forEach(notify => notify()) }) }
  const change = async (field: HTMLInputElement, value: string) => { await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }) }

  it('retains library search and the same field through drawer dismissal and desktop docking', async () => {
    await act(async () => root.render(<VoucherBuilder instance={instance} features={{ security: false }} />))
    await click('Blocks')
    const search = container.querySelector<HTMLInputElement>('[aria-label="Search blocks"]')!
    await change(search, 'Heading')
    search.focus()
    await resize(390)
    expect(container.querySelector('[aria-label="Search blocks"]')).toBe(search)
    await vi.waitFor(() => expect(document.activeElement).toBe(button('Open library')))
    await click('Open library')
    expect(container.querySelector('[role="dialog"]')?.contains(search)).toBe(true)
    expect(search.value).toBe('Heading')
    await click('Close')
    await vi.waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull())
    expect(container.querySelector('[aria-label="Search blocks"]')).toBe(search)
    expect(search.closest('[hidden]')).not.toBeNull()
    await click('Open library')
    expect(search.value).toBe('Heading')
    search.focus()
    await resize(1440)
    await vi.waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull())
    expect(container.querySelector('[aria-label="Search blocks"]')).toBe(search)
    await vi.waitFor(() => expect(document.activeElement).toBe(search))
  })

  it('retains an inspector control through drawer close and restores the launcher on dismissal', async () => {
    await act(async () => root.render(<VoucherBuilder instance={instance} features={{ security: false }} />))
    const field = container.querySelector<HTMLInputElement>('[aria-label="Background Color"]')!
    expect(field).not.toBeNull()
    await resize(390)
    expect(container.querySelector('[aria-label="Background Color"]')).toBe(field)
    const launcher = button('Open inspector')!
    launcher.focus()
    await click('Open inspector')
    expect(container.querySelector('[role="dialog"]')?.contains(field)).toBe(true)
    await click('Close')
    await vi.waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(launcher))
    expect(container.querySelector('[aria-label="Background Color"]')).toBe(field)
    await click('Open inspector')
    field.focus()
    await resize(1440)
    await vi.waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull())
    expect(container.querySelector('[aria-label="Background Color"]')).toBe(field)
    await vi.waitFor(() => expect(document.activeElement).toBe(field))
  })
})
