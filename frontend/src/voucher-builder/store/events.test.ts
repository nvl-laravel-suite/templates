import { describe, expect, it, vi } from 'vitest'
import { emitAction, subscribeAction } from './events'

describe('action event bus', () => {
  it('delivers events to subscribers', () => {
    const handler = vi.fn()
    const unsub = subscribeAction(handler)
    emitAction({ type: 'history.push' })
    expect(handler).toHaveBeenCalledWith({ type: 'history.push' })
    unsub()
  })

  it('delivers to multiple subscribers', () => {
    const a = vi.fn(); const b = vi.fn()
    const ua = subscribeAction(a); const ub = subscribeAction(b)
    emitAction({ type: 'project.reset' })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    ua(); ub()
  })

  it('unsubscribe stops delivery to that handler', () => {
    const a = vi.fn(); const b = vi.fn()
    const ua = subscribeAction(a); const ub = subscribeAction(b)
    ua()
    emitAction({ type: 'project.reset' })
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
    ub()
  })

  it('isolates errors thrown by one handler from the rest', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwing = vi.fn(() => { throw new Error('boom') })
    const survivor = vi.fn()
    const u1 = subscribeAction(throwing)
    const u2 = subscribeAction(survivor)
    emitAction({ type: 'history.push' })
    expect(throwing).toHaveBeenCalledTimes(1)
    expect(survivor).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
    u1(); u2()
  })

  it('emit with no subscribers is a no-op', () => {
    expect(() => emitAction({ type: 'history.push' })).not.toThrow()
  })

  it('supports same handler subscribing twice (Set semantics — single delivery)', () => {
    const handler = vi.fn()
    const u1 = subscribeAction(handler)
    const u2 = subscribeAction(handler)
    emitAction({ type: 'history.push' })
    expect(handler).toHaveBeenCalledTimes(1)
    u1(); u2()
  })
})
