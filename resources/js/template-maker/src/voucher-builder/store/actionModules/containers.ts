import type { DocumentRuntime } from '../runtime'
import { createCommandHelpers } from './shared'
import type { ComposerActions } from '../types'
import { getDirectChildIds, getSectionForBlock } from '../../engine/graph'

type ContainerCommands = Pick<ComposerActions, 'addBlockToColumn' | 'removeBlockFromColumn' | 'duplicateBlockInColumn' | 'moveBlockBetweenColumns' | 'reorderColumnBlocks' | 'moveBlockToColumn' | 'moveBlockToSection'>

export function createContainerActions(runtime: DocumentRuntime): ContainerCommands {
  const { getEditorState, getProjectState } = runtime
  const { applyProjectCommand, getCurrentLocale } = createCommandHelpers(runtime)
  const emit = runtime.events.emit
  const validContainer = (id: string) => !!getProjectState().blocks[id] && Array.isArray(getProjectState().columnBlocks[id])
  const children = (id: string) => getProjectState().columnBlocks[id] ?? []
  const notifyContainer = (id: string) => emit({ type: 'container.update', containerId: id, blockIds: [...children(id)] })
  const notifySection = (id: string) => emit({ type: 'block.reorder', sectionId: id, blockIds: [...(getProjectState().sections.find(s => s.id === id)?.blockIds ?? [])] })
  const canMove = (blockId: string, targetId: string) => {
    const visited = new Set<string>()
    const visit = (id: string): boolean => {
      if (id === targetId) return true
      if (visited.has(id)) return false
      visited.add(id)
      return getDirectChildIds(getProjectState(), id).some(visit)
    }
    return validContainer(targetId) && !visit(blockId)
  }
  return {
    addBlockToColumn(columnId, blockType) {
      if (!validContainer(columnId)) return
      const result = applyProjectCommand({ type: 'ADD_BLOCK_TO_COLUMN', columnId, blockType, locale: getCurrentLocale() }, { updateSelection: true })
      if (!result.activeBlockId) return
      emit({ type: 'block.add', sectionId: getSectionForBlock(result.project, columnId)?.id ?? '', blockId: result.activeBlockId, blockType })
      notifyContainer(columnId)
    },
    removeBlockFromColumn(columnId, blockId) {
      if (!children(columnId).includes(blockId)) return
      applyProjectCommand({ type: 'REMOVE_BLOCK_FROM_COLUMN', columnId, blockId, activeBlockIds: getEditorState().activeBlockIds }, { updateSelection: true })
      emit({ type: 'block.remove', blockIds: [blockId] }); notifyContainer(columnId)
    },
    duplicateBlockInColumn(columnId, blockId) {
      if (!children(columnId).includes(blockId)) return
      const result = applyProjectCommand({ type: 'DUPLICATE_BLOCK_IN_COLUMN', columnId, blockId }, { updateSelection: true })
      if (!result.activeBlockId) return
      emit({ type: 'block.duplicate', sectionId: getSectionForBlock(result.project, columnId)?.id ?? '', sourceId: blockId, newId: result.activeBlockId })
      notifyContainer(columnId)
    },
    moveBlockBetweenColumns(blockId, fromKey, toKey, toIndex) {
      if (!children(fromKey).includes(blockId) || !canMove(blockId, toKey)) return
      applyProjectCommand({ type: 'MOVE_BLOCK_BETWEEN_COLUMNS', blockId, fromColumnId: fromKey, toColumnId: toKey, toIndex }, { updateSelection: false })
      notifyContainer(fromKey)
      if (fromKey !== toKey) notifyContainer(toKey)
    },
    reorderColumnBlocks(columnId, fromIndex, toIndex) {
      if (!validContainer(columnId)) return
      const before = [...children(columnId)]
      applyProjectCommand({ type: 'REORDER_COLUMN_BLOCKS', columnId, fromIndex, toIndex }, { updateSelection: false })
      if (before.join('\0') !== children(columnId).join('\0')) notifyContainer(columnId)
    },
    moveBlockToColumn(blockId, sectionId, columnId, index) {
      if (!getProjectState().sections.find(s => s.id === sectionId)?.blockIds.includes(blockId) || !canMove(blockId, columnId)) return
      applyProjectCommand({ type: 'MOVE_BLOCK_SECTION_TO_COLUMN', blockId, sectionId, columnId, toIndex: index }, { updateSelection: false })
      notifySection(sectionId); notifyContainer(columnId)
    },
    moveBlockToSection(blockId, columnId, sectionId, index) {
      if (!children(columnId).includes(blockId) || !getProjectState().sections.some(s => s.id === sectionId)) return
      applyProjectCommand({ type: 'MOVE_BLOCK_COLUMN_TO_SECTION', blockId, columnId, sectionId, toIndex: index }, { updateSelection: false })
      notifyContainer(columnId); notifySection(sectionId)
    },
  }
}
