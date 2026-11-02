import { useDocumentStore } from './document'
import { useEditorStore } from './editor'
import { composerActions } from './actions'
import { useStore } from 'zustand'
import { useOptionalVoucherInstance } from '../editor-context'
import { getInstanceInternals } from '../instance'
import type { DocumentStoreState, EditorStoreState } from './types'

export function useDocumentState<T>(selector: (state: DocumentStoreState) => T): T {
  const instance = useOptionalVoucherInstance()
  return useStore(instance ? getInstanceInternals(instance).runtime.document : useDocumentStore, selector)
}

export function useEditorState<T>(selector: (state: EditorStoreState) => T): T {
  const instance = useOptionalVoucherInstance()
  return useStore(instance ? getInstanceInternals(instance).runtime.editor : useEditorStore, selector)
}

export function useScopedActions() {
  const instance = useOptionalVoucherInstance()
  return instance ? getInstanceInternals(instance).liveActions : composerActions
}
export function useSelectionState() {
  const activeBlockId = useEditorState((state) => state.activeBlockId)
  const activeBlockIds = useEditorState((state) => state.activeBlockIds)
  return { activeBlockId, activeBlockIds }
}

export function useFocusedBlocks(): string[] {
  return useEditorState((state) => state.focusedBlockIds)
}

export function useSectionState() {
  const sections = useDocumentState((state) => state.sections)
  const activeSectionId = useEditorState((state) => state.activeSectionId)
  return { sections, activeSectionId }
}

export function useFrameState() {
  return useDocumentState((state) => state.frame)
}

export function useGlobalSettingsState() {
  return useDocumentState((state) => state.global)
}

export function useHistoryState() {
  const undoStack = useEditorState((state) => state.undoStack)
  const redoStack = useEditorState((state) => state.redoStack)
  return { undoStack, redoStack }
}

export function useClipboardState() {
  const clipboard = useEditorState((state) => state.clipboard)
  return { clipboard }
}

export function useVisualToolingState() {
  return {
    showRulers: useEditorState((s) => s.showRulers),
    showGrid: useEditorState((s) => s.showGrid),
    gridSize: useEditorState((s) => s.gridSize),
    snapToGrid: useEditorState((s) => s.snapToGrid),
    debugMode: useEditorState((s) => s.debugMode),
    showPreviewData: useEditorState((s) => s.showPreviewData),
    zoomLevel: useEditorState((s) => s.zoomLevel),
    zoomMode: useEditorState((s) => s.zoomMode),
  }
}

export function useSelectionActions() {
  const actions = useScopedActions()
  return {
    setActiveBlock: actions.setActiveBlock,
    setActiveBlocks: actions.setActiveBlocks,
    clearActiveSelection: actions.clearActiveSelection,
    setFocusedBlocks: actions.setFocusedBlocks,
    clearFocusedBlocks: actions.clearFocusedBlocks,
  }
}

export function useHistoryActions() {
  const actions = useScopedActions()
  return {
    pushHistory: actions.pushHistory,
    undo: actions.undo,
    redo: actions.redo,
  }
}

export function useSectionActions() {
  const actions = useScopedActions()
  return {
    updateSection: actions.updateSection,
    setActiveSectionId: actions.setActiveSectionId,
  }
}

export function useProjectActions() {
  const actions = useScopedActions()
  return {
    resetProject: actions.resetProject,
    loadProject: actions.loadProject,
    getProject: actions.getProject,
  }
}

export function useGlobalSettingsActions() {
  const actions = useScopedActions()
  return {
    updateGlobal: actions.updateGlobal,
    updateLayout: actions.updateLayout,
    updateColors: actions.updateColors,
    updateTypography: actions.updateTypography,
    updateMetadata: actions.updateMetadata,
    updateFrame: actions.updateFrame,
  }
}

export function useBlockActions() {
  const actions = useScopedActions()
  return {
    addBlock: actions.addBlock,
    updateBlock: actions.updateBlock,
    updateBlockCommonSettings: actions.updateBlockCommonSettings,
    updateBlockCommonSettingsMany: actions.updateBlockCommonSettingsMany,
    removeBlock: actions.removeBlock,
    removeBlocks: actions.removeBlocks,
    duplicateBlock: actions.duplicateBlock,
    duplicateBlocks: actions.duplicateBlocks,
    moveBlockUp: actions.moveBlockUp,
    moveBlockDown: actions.moveBlockDown,
    duplicateBlockInColumn: actions.duplicateBlockInColumn,
    reorderBlocks: actions.reorderBlocks,
    reorderColumnBlocks: actions.reorderColumnBlocks,
  }
}

export function useContainerActions() {
  const actions = useScopedActions()
  return {
    addBlockToColumn: actions.addBlockToColumn,
    removeBlockFromColumn: actions.removeBlockFromColumn,
    duplicateBlockInColumn: actions.duplicateBlockInColumn,
    reorderColumnBlocks: actions.reorderColumnBlocks,
    moveBlockBetweenColumns: actions.moveBlockBetweenColumns,
    moveBlockToColumn: actions.moveBlockToColumn,
    moveBlockToSection: actions.moveBlockToSection,
  }
}

export function useClipboardActions() {
  const actions = useScopedActions()
  return {
    copyBlock: actions.copyBlock,
    cutBlock: actions.cutBlock,
    pasteBlock: actions.pasteBlock,
    copyBlocks: actions.copyBlocks,
    cutBlocks: actions.cutBlocks,
    pasteBlocks: actions.pasteBlocks,
  }
}

export function useVisualToolingActions() {
  const actions = useScopedActions()
  return {
    setShowRulers: actions.setShowRulers,
    setShowGrid: actions.setShowGrid,
    setGridSize: actions.setGridSize,
    setSnapToGrid: actions.setSnapToGrid,
    setDebugMode: actions.setDebugMode,
    setShowPreviewData: actions.setShowPreviewData,
    setZoomLevel: actions.setZoomLevel,
    setZoomMode: actions.setZoomMode,
  }
}
