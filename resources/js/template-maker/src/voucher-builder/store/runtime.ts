import type { Block, Project } from '../schema'
import { applyDocumentCommand } from '../engine/commands'
import { useDocumentStore } from './document'
import type { StoreApi } from 'zustand/vanilla'
import { legacyActionBus, type BuilderActionBus } from './events'
import { useEditorStore } from './editor'
import type { DocumentStoreState, EditorStoreState, ProjectSnapshot } from './types'
import { getSectionForBlock } from '../engine/graph'

const MAX_HISTORY = 50

export function createDocumentRuntime(document: StoreApi<DocumentStoreState>, editor: StoreApi<EditorStoreState>, events: BuilderActionBus = legacyActionBus) {
  let historySuspended = 0
  function withoutHistory<T>(edit: () => T): T {
    historySuspended++
    try { return edit() } finally { historySuspended-- }
  }
  function getProjectState(): DocumentStoreState {
    return document.getState()
  }

  function getEditorState(): EditorStoreState {
    return editor.getState()
  }

  function getProjectSnapshot(state: DocumentStoreState = getProjectState()): ProjectSnapshot {
    return {
      global: JSON.parse(JSON.stringify(state.global)),
      blocks: JSON.parse(JSON.stringify(state.blocks)),
      sections: JSON.parse(JSON.stringify(state.sections)),
      columnBlocks: JSON.parse(JSON.stringify(state.columnBlocks)),
      frame: JSON.parse(JSON.stringify(state.frame)),
    }
  }

  function normalizeSelection(blockIds: string[], blocks: Record<string, Block>) {
    return Array.from(new Set(blockIds)).filter((blockId) => Boolean(blocks[blockId]))
  }

  function setProjectState(project: Project) {
    document.setState(project)
  }

  function setEditorSelection(activeBlockId: string | null, activeBlockIds: string[]) {
    editor.setState({ activeBlockId, activeBlockIds })
  }

  function applyDocumentResult(
    result: ReturnType<typeof applyDocumentCommand>,
    options?: { updateSelection?: boolean; updateActivePage?: boolean },
  ) {
    setProjectState(result.project)
    if (options?.updateSelection) {
      setEditorSelection(result.activeBlockId, result.activeBlockIds)
    }
  }

  function updateProjectState(
    mutator: (state: DocumentStoreState) => Partial<DocumentStoreState> | DocumentStoreState | null,
  ) {
    const state = getProjectState()
    const next = mutator(state)
    if (!next) return
    document.setState(next)
  }

  function pushDocumentHistory() {
    if (historySuspended) return
    const snapshot = getProjectSnapshot()
    editor.setState((state) => {
      const undoStack = [...state.undoStack, snapshot]
      if (undoStack.length > MAX_HISTORY) undoStack.shift()
      return { undoStack, redoStack: [] }
    })
  }

  function restoreSelection(project: ProjectSnapshot, editor: EditorStoreState) {
    const activeBlockIds = normalizeSelection(editor.activeBlockIds, project.blocks)
    const activeBlockId = activeBlockIds.includes(editor.activeBlockId ?? '') ? editor.activeBlockId : activeBlockIds[activeBlockIds.length - 1] ?? null
    const activeSectionId = activeBlockId ? getSectionForBlock(project, activeBlockId)?.id : editor.activeSectionId
    return {
      activeBlockIds, activeBlockId,
      activeSectionId: project.sections.some((s) => s.id === activeSectionId) ? activeSectionId : project.sections[0]?.id ?? null,
      focusedBlockIds: normalizeSelection(editor.focusedBlockIds, project.blocks),
    }
  }

  function undoDocumentHistory() {
    const editorState = getEditorState()
    if (editorState.undoStack.length === 0) return
    const current = getProjectSnapshot()
    const snapshot = editorState.undoStack[editorState.undoStack.length - 1]
    setProjectState(snapshot)
    editor.setState({
      ...restoreSelection(snapshot, editorState),
      undoStack: editorState.undoStack.slice(0, -1),
      redoStack: [...editorState.redoStack, current],
    })
  }

  function redoDocumentHistory() {
    const editorState = getEditorState()
    if (editorState.redoStack.length === 0) return
    const current = getProjectSnapshot()
    const snapshot = editorState.redoStack[editorState.redoStack.length - 1]
    setProjectState(snapshot)
    editor.setState({
      ...restoreSelection(snapshot, editorState),
      redoStack: editorState.redoStack.slice(0, -1),
      undoStack: [...editorState.undoStack, current],
    })
  }
  return { document, editor, events, withoutHistory, getProjectState, getEditorState, getProjectSnapshot, normalizeSelection, setProjectState, setEditorSelection, applyDocumentResult, updateProjectState, pushDocumentHistory, undoDocumentHistory, redoDocumentHistory }
}

export type DocumentRuntime = ReturnType<typeof createDocumentRuntime>
export const legacyRuntime = createDocumentRuntime(useDocumentStore, useEditorStore)
export const { getProjectState, getEditorState, getProjectSnapshot, normalizeSelection, setProjectState, setEditorSelection, applyDocumentResult, updateProjectState, pushDocumentHistory, undoDocumentHistory, redoDocumentHistory } = legacyRuntime
