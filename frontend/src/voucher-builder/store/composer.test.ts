import { describe, expect, it } from 'vitest'
import { useComposerStore } from './composer'

describe('composer compatibility export', () => {
  it('exposes the adapter store contract for backwards compatibility', () => {
    const state = useComposerStore.getState()

    expect(typeof useComposerStore).toBe('function')
    expect(typeof useComposerStore.getState).toBe('function')
    expect(typeof useComposerStore.setState).toBe('function')
    expect(typeof useComposerStore.subscribe).toBe('function')
    expect(typeof state.resetProject).toBe('function')
    expect(typeof state.loadProject).toBe('function')
  })
})
