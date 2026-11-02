import type { Block, BlockType, CommonBlockSettings, GlobalSettings, Project, VoucherSection, Frame } from '../schema'
import type { BlockTreeSnapshot } from '../lib/block-tree'
import type { VoucherLoadOptions } from '../api-types'

export interface ProjectSnapshot {
  global: GlobalSettings
  blocks: Record<string, Block>
  sections: [VoucherSection, VoucherSection, VoucherSection]
  columnBlocks: Record<string, string[]>
  frame: Frame
}

export interface DocumentStoreState extends Project {}

export interface EditorStoreState {
  activeSectionId: string | null
  activeBlockId: string | null
  activeBlockIds: string[]
  /**
   * Transient "focus" state — blocks that should be highlighted on the canvas
   * as a visual helper without becoming the active selection. Used by the
   * typography cohesion panel, validation hints, and similar inspectors that
   * want to point at blocks without hijacking the right panel.
   */
  focusedBlockIds: string[]
  undoStack: ProjectSnapshot[]
  redoStack: ProjectSnapshot[]
  history: ProjectSnapshot[]
  historyIndex: number
  clipboard: BlockTreeSnapshot[] | null
  // Visual tooling
  showRulers: boolean
  showGrid: boolean
  gridSize: number
  snapToGrid: boolean
  debugMode: boolean
  showPreviewData: boolean
  zoomLevel: number
  zoomMode: 'fit' | 'actual' | 'custom'
}

export interface ComposerActions {
  // Section actions
  updateSection: (sectionId: string, updates: Partial<VoucherSection>) => void
  setActiveSectionId: (sectionId: string | null) => void
  // Block actions
  addBlock: (sectionId: string, type: BlockType) => void
  removeBlock: (blockId: string) => void
  removeBlocks: (blockIds: string[]) => void
  setActiveBlock: (blockId: string | null, options?: { additive?: boolean }) => void
  setActiveBlocks: (blockIds: string[]) => void
  clearActiveSelection: () => void
  /** Visual-only highlight — does not switch panels or mutate the active selection. */
  setFocusedBlocks: (blockIds: string[]) => void
  clearFocusedBlocks: () => void
  updateBlock: (blockId: string, updates: Partial<Block>) => void
  updateBlockCommonSettings: (blockId: string, updates: Partial<CommonBlockSettings>) => void
  updateBlockCommonSettingsMany: (blockIds: string[], updates: Partial<CommonBlockSettings>) => void
  reorderBlocks: (sectionId: string, fromIndex: number, toIndex: number) => void
  duplicateBlock: (blockId: string, sectionId: string) => void
  duplicateBlocks: (blockIds: string[], sectionId: string) => void
  moveBlockUp: (blockId: string, sectionId: string) => void
  moveBlockDown: (blockId: string, sectionId: string) => void
  // Container actions (row/column nesting)
  addBlockToColumn: (columnId: string, blockType: BlockType) => void
  resizeRow: (blockId: string, columns: number) => void
  resizeGrid: (blockId: string, columns: number, rows: number) => void
  removeBlockFromColumn: (columnId: string, blockId: string) => void
  duplicateBlockInColumn: (columnId: string, blockId: string) => void
  moveBlockBetweenColumns: (blockId: string, fromKey: string, toKey: string, toIndex: number) => void
  reorderColumnBlocks: (columnKey: string, fromIndex: number, toIndex: number) => void
  moveBlockToColumn: (blockId: string, sectionId: string, columnId: string, index: number) => void
  moveBlockToSection: (blockId: string, columnId: string, sectionId: string, index: number) => void
  // Global actions
  updateGlobal: (updates: Partial<GlobalSettings>) => void
  updateLayout: (layout: Partial<GlobalSettings['layout']>) => void
  updateColors: (colors: Partial<GlobalSettings['colors']>) => void
  updateTypography: (typography: Partial<GlobalSettings['typography']>) => void
  updateMetadata: (metadata: Partial<GlobalSettings['metadata']>) => void
  updateFrame: (frame: Partial<Frame>) => void
  // History
  undo: () => void
  redo: () => void
  pushHistory: () => void
  // Clipboard
  copyBlock: (blockId: string) => void
  cutBlock: (blockId: string) => void
  pasteBlock: (sectionId: string) => void
  copyBlocks: (blockIds: string[]) => void
  cutBlocks: (blockIds: string[]) => void
  pasteBlocks: (sectionId: string) => void
  // Project
  resetProject: () => void
  loadProject: (project: Project, options?: VoucherLoadOptions) => void
  getProject: () => Project
  updateBlockContent: (blockId: string, key: string, value: unknown) => void
  // Editor visual tooling
  setShowRulers: (show: boolean) => void
  setShowGrid: (show: boolean) => void
  setGridSize: (size: number) => void
  setSnapToGrid: (snap: boolean) => void
  setDebugMode: (debug: boolean) => void
  setShowPreviewData: (show: boolean) => void
  setZoomLevel: (level: number) => void
  setZoomMode: (mode: 'fit' | 'actual' | 'custom') => void
}

export interface ComposerState extends DocumentStoreState, EditorStoreState, ComposerActions {}
