import { describe, expect, it } from 'vitest'
import { createComposerStore } from './adapter'
import { SECTION_IDS } from '#/voucher-builder/lib/voucher'

describe('composer adapter', () => {
  it('bridges document and editor state through getState and setState', () => {
    const store = createComposerStore()

    store.getState().resetProject()
    const initialSectionId = store.getState().activeSectionId

    store.setState({
      activeBlockId: 'block-1',
      activeBlockIds: ['block-1'],
    })

    const afterEditorUpdate = store.getState()
    expect(afterEditorUpdate.activeSectionId).toBe(initialSectionId)
    expect(afterEditorUpdate.activeBlockId).toBe('block-1')

    store.setState((state) => ({
      sections: state.sections.map((s, i) => i === 0 ? { ...s, height: 150 } : s) as typeof state.sections,
    }))

    expect(store.getState().sections[0]?.height).toBe(150)
  })

  it('keeps reset/load behavior synchronized across document and editor stores', () => {
    const store = createComposerStore()

    store.getState().resetProject()
    const resetState = store.getState()

    expect(resetState.activeSectionId).toBe(SECTION_IDS[0])
    expect(resetState.activeBlockId).toBeNull()

    const loadedProject = {
      ...resetState.getProject(),
      sections: [
        { id: 'custom-s1', height: 100, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
        { id: 'custom-s2', height: 80, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
        { id: 'custom-s3', height: 60, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
      ] as [typeof resetState.sections[0], typeof resetState.sections[0], typeof resetState.sections[0]],
    }

    store.getState().loadProject(loadedProject)

    const loadedState = store.getState()
    expect(loadedState.sections[0]?.id).toBe('custom-s1')
    expect(loadedState.activeBlockIds).toEqual([])
  })
})
