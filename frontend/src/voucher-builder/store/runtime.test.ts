import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './document'
import { createInitialEditorState, useEditorStore } from './editor'
import { useDocumentStore } from './document'
import {
  applyDocumentResult,
  getEditorState,
  pushDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory,
  updateProjectState,
} from './runtime'

describe('store runtime helpers', () => {
  it('updates document state and records undo/redo history', () => {
    const project = createEmptyProject()
    useDocumentStore.setState(project)
    useEditorStore.setState(createInitialEditorState())

    const originalHeight = project.sections[0].height

    pushDocumentHistory()
    updateProjectState((state) => ({
      sections: state.sections.map((s, i) => i === 0 ? { ...s, height: 200 } : s) as typeof state.sections,
    }))

    expect(useDocumentStore.getState().sections[0]?.height).toBe(200)

    undoDocumentHistory()
    expect(useDocumentStore.getState().sections[0]?.height).toBe(originalHeight)

    redoDocumentHistory()
    expect(useDocumentStore.getState().sections[0]?.height).toBe(200)
  })

  it('applies document results into document and editor stores together', () => {
    const project = createEmptyProject()
    useDocumentStore.setState(project)
    useEditorStore.setState(createInitialEditorState())

    applyDocumentResult(
      {
        project: {
          ...project,
          sections: project.sections.map((s, i) => i === 0 ? { ...s, height: 150 } : s) as typeof project.sections,
        },
        activeBlockId: 'block-1',
        activeBlockIds: ['block-1'],
      },
      { updateSelection: true },
    )

    expect(useDocumentStore.getState().sections[0]?.height).toBe(150)
    expect(getEditorState().activeBlockId).toBe('block-1')
    expect(getEditorState().activeBlockIds).toEqual(['block-1'])
  })
})
