import { create } from 'zustand'
import type { EditorStoreState } from './types'
import { SECTION_IDS } from '../lib/voucher'

export function createInitialEditorState(): EditorStoreState {
  return {
    activeSectionId: SECTION_IDS[0],
    activeBlockId: null,
    activeBlockIds: [],
    focusedBlockIds: [],
    undoStack: [],
    redoStack: [],
    history: [],
    historyIndex: -1,
    clipboard: null,
    showRulers: false,
    showGrid: false,
    gridSize: 5,
    snapToGrid: false,
    debugMode: false,
    showPreviewData: false,
    zoomLevel: 100,
    zoomMode: 'fit',
  }
}

export const useEditorStore = create<EditorStoreState>(() => createInitialEditorState())
