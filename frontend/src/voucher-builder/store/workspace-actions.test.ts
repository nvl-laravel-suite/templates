import { beforeEach, describe, expect, it } from 'vitest'
import { composerActions as actions } from './actions'
import { useEditorStore } from './editor'
import { createEmptyProject } from '../lib/empty-project'
import '../blocks/definitions'

describe('workspace selection and document replacement', () => {
  beforeEach(() => actions.resetProject())
  it('keeps the selected section in sync with root and nested blocks', () => {
    const sectionId = actions.getProject().sections[1].id
    actions.addBlock(sectionId, 'row')
    const row = Object.values(actions.getProject().blocks).find((b) => b.type === 'row')!
    const columnId = (row.content as { columnIds: string[] }).columnIds[0]
    actions.addBlockToColumn(columnId, 'text')
    const childId = actions.getProject().columnBlocks[columnId][0]
    actions.setActiveSectionId(actions.getProject().sections[0].id)
    actions.setActiveBlock(childId)
    expect(useEditorStore.getState().activeSectionId).toBe(sectionId)
    actions.setActiveSectionId(actions.getProject().sections[2].id)
    actions.setActiveBlocks([row.id])
    expect(useEditorStore.getState().activeSectionId).toBe(sectionId)
  })
  it('can undo and redo an imported document or template replacement', () => {
    const sectionId = actions.getProject().sections[0].id
    actions.addBlock(sectionId, 'heading')
    const original = actions.getProject()
    actions.pushHistory()
    actions.loadProject(createEmptyProject(), { preserveHistory: true })
    expect(Object.keys(actions.getProject().blocks)).toHaveLength(0)
    actions.undo()
    expect(actions.getProject()).toEqual(original)
    actions.redo()
    expect(Object.keys(actions.getProject().blocks)).toHaveLength(0)
  })
  it('selects the first imported section and resets history for normal host loads', () => {
    actions.addBlock(actions.getProject().sections[0].id, 'heading')
    const project = createEmptyProject()
    project.sections[0].id = 'imported-section'
    actions.loadProject(project)
    expect(useEditorStore.getState().activeSectionId).toBe('imported-section')
    expect(useEditorStore.getState().undoStack).toEqual([])
    expect(useEditorStore.getState().activeBlockIds).toEqual([])
  })
  it('clears a selection removed by undo', () => {
    actions.addBlock(actions.getProject().sections[0].id, 'heading')
    expect(useEditorStore.getState().activeBlockId).not.toBeNull()
    actions.undo()
    expect(useEditorStore.getState().activeBlockId).toBeNull()
    expect(useEditorStore.getState().activeBlockIds).toEqual([])
  })
})
