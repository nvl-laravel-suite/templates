// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSecurityGuard } from './use-security-guard'

function Guard({ enabled }: { enabled: boolean }) {
  useSecurityGuard(enabled ? {} : undefined)
  return null
}

describe('useSecurityGuard', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('leaves printing and context menus available when disabled', () => {
    act(() => root.render(<Guard enabled={false} />))
    const print = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true })
    document.dispatchEvent(print)
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    container.dispatchEvent(menu)
    window.dispatchEvent(new Event('beforeprint'))

    expect(print.defaultPrevented).toBe(false)
    expect(menu.defaultPrevented).toBe(false)
    expect(document.body.classList.contains('nc-print-blocked')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('blocks actions while enabled and removes restrictions when disabled', () => {
    act(() => root.render(<Guard enabled />))
    const print = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true })
    document.dispatchEvent(print)
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    container.dispatchEvent(menu)
    window.dispatchEvent(new Event('beforeprint'))

    expect(print.defaultPrevented).toBe(true)
    expect(menu.defaultPrevented).toBe(true)
    expect(document.body.classList.contains('nc-print-blocked')).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    act(() => root.render(<Guard enabled={false} />))
    const nextPrint = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true })
    document.dispatchEvent(nextPrint)
    const nextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    container.dispatchEvent(nextMenu)

    expect(nextPrint.defaultPrevented).toBe(false)
    expect(nextMenu.defaultPrevented).toBe(false)
    expect(document.body.classList.contains('nc-print-blocked')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears document restrictions on unmount', () => {
    act(() => root.render(<Guard enabled />))
    window.dispatchEvent(new Event('beforeprint'))
    vi.stubGlobal('outerWidth', window.innerWidth + 200)
    act(() => vi.advanceTimersByTime(1000))
    expect(document.body.classList.contains('nc-devtools-detected')).toBe(true)

    act(() => root.render(null))

    expect(document.body.classList.contains('nc-print-blocked')).toBe(false)
    expect(document.body.classList.contains('nc-devtools-detected')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
