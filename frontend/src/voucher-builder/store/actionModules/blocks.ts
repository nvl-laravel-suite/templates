import type { DocumentRuntime } from '../runtime'
import { createCommandHelpers } from './shared'
import type { Block } from '#/voucher-builder/schema'
import { defaultCommonSettings } from '#/voucher-builder/schema'
import type { ComposerActions } from '../types'

export function createBlockActions(runtime: DocumentRuntime): Pick<
  ComposerActions,
  | 'addBlock'
  | 'removeBlock'
  | 'removeBlocks'
  | 'updateBlock'
  | 'updateBlockCommonSettings'
  | 'updateBlockCommonSettingsMany'
  | 'reorderBlocks'
  | 'duplicateBlock'
  | 'duplicateBlocks'
  | 'moveBlockUp'
  | 'moveBlockDown'
  | 'updateBlockContent'
> {
  const { getEditorState, getProjectState, normalizeSelection, updateProjectState } = runtime
  const { applyProjectCommand, getCurrentLocale } = createCommandHelpers(runtime)
  const emitAction = runtime.events.emit
  return {
    addBlock: (sectionId, type) => {
      if (!getProjectState().sections.some(section => section.id === sectionId)) return
      const result = applyProjectCommand(
        { type: 'ADD_BLOCK_TO_SECTION', sectionId, blockType: type, locale: getCurrentLocale() },
        { updateSelection: true, updateActivePage: false },
      )
      if (result.activeBlockId) {
        emitAction({ type: 'block.add', sectionId, blockId: result.activeBlockId, blockType: type })
      }
    },

    removeBlock: (blockId) => {
      if (!getProjectState().blocks[blockId]) return
      applyProjectCommand(
        { type: 'REMOVE_BLOCKS', blockIds: [blockId], activeBlockIds: getEditorState().activeBlockIds },
        { updateSelection: true, updateActivePage: false },
      )
      emitAction({ type: 'block.remove', blockIds: [blockId] })
    },

    removeBlocks: (blockIds) => {
      const idsToRemove = normalizeSelection(blockIds, getProjectState().blocks)
      if (idsToRemove.length === 0) return
      applyProjectCommand(
        { type: 'REMOVE_BLOCKS', blockIds: idsToRemove, activeBlockIds: getEditorState().activeBlockIds },
        { updateSelection: true, updateActivePage: false },
      )
      emitAction({ type: 'block.remove', blockIds: idsToRemove })
    },

    updateBlock: (blockId, updates) => {
      if (!getProjectState().blocks[blockId]) return
      // Identity and type are structural; replacing them would break graph references.
      const { id: _id, type: _type, ...patch } = updates
      updateProjectState((state) => {
        const existing = state.blocks[blockId]
        if (!existing) return null
        return { blocks: { ...state.blocks, [blockId]: { ...existing, ...patch } as Block } }
      })
      emitAction({ type: 'block.update', blockId, patch: patch as Partial<Block> })
    },

    updateBlockCommonSettings: (blockId, updates) => {
      if (!getProjectState().blocks[blockId]) return
      updateProjectState((state) => {
        const existing = state.blocks[blockId]
        if (!existing) return null
        return {
          blocks: {
            ...state.blocks,
            [blockId]: {
              ...existing,
              commonSettings: { ...(existing.commonSettings || defaultCommonSettings), ...updates },
            } as Block,
          },
        }
      })
      emitAction({ type: 'block.update', blockId, patch: { commonSettings: updates } as Partial<Block> })
    },

    updateBlockCommonSettingsMany: (blockIds, updates) => {
      updateProjectState((state) => {
        const normalizedIds = normalizeSelection(blockIds, state.blocks)
        if (normalizedIds.length === 0) return null
        const nextBlocks = { ...state.blocks }
        for (const blockId of normalizedIds) {
          const existing = nextBlocks[blockId]
          nextBlocks[blockId] = {
            ...existing,
            commonSettings: { ...(existing.commonSettings || defaultCommonSettings), ...updates },
          } as Block
        }
        return { blocks: nextBlocks }
      })
      for (const blockId of normalizeSelection(blockIds, getProjectState().blocks)) {
        emitAction({ type: 'block.update', blockId, patch: { commonSettings: updates } as Partial<Block> })
      }
    },

    reorderBlocks: (sectionId, fromIndex, toIndex) => {
      applyProjectCommand(
        { type: 'REORDER_SECTION_BLOCKS', sectionId, fromIndex, toIndex },
        { updateSelection: false, updateActivePage: false },
      )
      const section = getProjectState().sections.find((s) => s.id === sectionId)
      emitAction({ type: 'block.reorder', sectionId, blockIds: section ? [...section.blockIds] : [] })
    },

    duplicateBlock: (blockId, sectionId) => {
      if (!getProjectState().sections.find(s => s.id === sectionId)?.blockIds.includes(blockId)) return
      const result = applyProjectCommand(
        { type: 'DUPLICATE_BLOCKS_IN_SECTION', sectionId, blockIds: [blockId] },
        { updateSelection: true, updateActivePage: false },
      )
      if (!result.activeBlockId) return
      emitAction({ type: 'block.duplicate', sourceId: blockId, newId: result.activeBlockId, sectionId })
    },

    duplicateBlocks: (blockIds, sectionId) => {
      const idsToDuplicate = Array.from(new Set(blockIds)).filter(id => getProjectState().sections.find(s => s.id === sectionId)?.blockIds.includes(id))
      if (idsToDuplicate.length === 0) return
      const result = applyProjectCommand(
        { type: 'DUPLICATE_BLOCKS_IN_SECTION', sectionId, blockIds: idsToDuplicate },
        { updateSelection: true, updateActivePage: false },
      )
      if (result.activeBlockIds.length === 0) return
      for (let i = 0; i < idsToDuplicate.length && i < result.activeBlockIds.length; i++) {
        emitAction({ type: 'block.duplicate', sourceId: idsToDuplicate[i], newId: result.activeBlockIds[i], sectionId })
      }
    },

    moveBlockUp: (blockId, sectionId) => {
      const section = getProjectState().sections.find((entry) => entry.id === sectionId)
      if (!section) return
      const index = section.blockIds.indexOf(blockId)
      if (index <= 0) return
      applyProjectCommand(
        { type: 'REORDER_SECTION_BLOCKS', sectionId, fromIndex: index, toIndex: index - 1 },
        { updateSelection: false, updateActivePage: false },
      )
      emitAction({ type: 'block.move', blockId, sectionId, fromIndex: index, toIndex: index - 1 })
    },

    moveBlockDown: (blockId, sectionId) => {
      const section = getProjectState().sections.find((entry) => entry.id === sectionId)
      if (!section) return
      const index = section.blockIds.indexOf(blockId)
      if (index === -1 || index >= section.blockIds.length - 1) return
      applyProjectCommand(
        { type: 'REORDER_SECTION_BLOCKS', sectionId, fromIndex: index, toIndex: index + 1 },
        { updateSelection: false, updateActivePage: false },
      )
      emitAction({ type: 'block.move', blockId, sectionId, fromIndex: index, toIndex: index + 1 })
    },

    updateBlockContent: (blockId, key, value) => {
      if (!getProjectState().blocks[blockId]) return
      updateProjectState((state) => {
        const existing = state.blocks[blockId]
        if (!existing) return null
        return {
          blocks: {
            ...state.blocks,
            [blockId]: { ...existing, content: { ...existing.content, [key]: value } } as Block,
          },
        }
      })
      emitAction({ type: 'block.update', blockId, patch: { content: getProjectState().blocks[blockId].content } as Partial<Block> })
    },
  }
}
