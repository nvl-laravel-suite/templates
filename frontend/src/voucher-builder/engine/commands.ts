import type { BlockType, Project } from '#/voucher-builder/schema'
import type { BlockTreeSnapshot } from '#/voucher-builder/lib/block-tree'
import {
  addBlockToSectionProject,
  addBlockToColumnProject,
  duplicateBlockInColumnProject,
  duplicateBlocksInSectionProject,
  pasteBlockTreeToSectionProject,
  removeBlockFromColumnProject,
  removeBlocksFromProject,
} from './document'

export type ProjectCommand =
  | { type: 'REORDER_SECTION_BLOCKS'; sectionId: string; fromIndex: number; toIndex: number }
  | { type: 'REORDER_COLUMN_BLOCKS'; columnId: string; fromIndex: number; toIndex: number }
  | { type: 'MOVE_BLOCK_BETWEEN_COLUMNS'; blockId: string; fromColumnId: string; toColumnId: string; toIndex: number }
  | { type: 'MOVE_BLOCK_SECTION_TO_COLUMN'; blockId: string; sectionId: string; columnId: string; toIndex: number }
  | { type: 'MOVE_BLOCK_COLUMN_TO_SECTION'; blockId: string; columnId: string; sectionId: string; toIndex: number }

export type DocumentCommand =
  | ProjectCommand
  | { type: 'ADD_BLOCK_TO_SECTION'; sectionId: string; blockType: BlockType; locale: string }
  | { type: 'ADD_BLOCK_TO_COLUMN'; columnId: string; blockType: BlockType; locale: string }
  | { type: 'REMOVE_BLOCKS'; blockIds: string[]; activeBlockIds: string[] }
  | { type: 'REMOVE_BLOCK_FROM_COLUMN'; columnId: string; blockId: string; activeBlockIds: string[] }
  | { type: 'DUPLICATE_BLOCKS_IN_SECTION'; sectionId: string; blockIds: string[] }
  | { type: 'DUPLICATE_BLOCK_IN_COLUMN'; columnId: string; blockId: string }
  | { type: 'PASTE_BLOCK_TREE_TO_SECTION'; sectionId: string; snapshot: BlockTreeSnapshot }

export interface DocumentCommandResult {
  project: Project
  activeBlockId: string | null
  activeBlockIds: string[]
}

function cloneProject(project: Project): Project {
  return {
    global: project.global,
    blocks: { ...project.blocks },
    sections: project.sections.map((section) => ({
      ...section,
      blockIds: [...section.blockIds],
    })) as [typeof project.sections[0], typeof project.sections[1], typeof project.sections[2]],
    columnBlocks: Object.fromEntries(
      Object.entries(project.columnBlocks).map(([key, value]) => [key, [...value]])
    ),
    frame: project.frame,
  }
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length)
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
    return list
  }

  const next = [...list]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = [...list]
  next.splice(clampIndex(index, next.length), 0, item)
  return next
}

export function applyProjectCommand(project: Project, command: ProjectCommand): Project {
  const next = cloneProject(project)

  switch (command.type) {
    case 'REORDER_SECTION_BLOCKS': {
      next.sections = next.sections.map((section) =>
        section.id === command.sectionId
          ? { ...section, blockIds: reorderList(section.blockIds, command.fromIndex, command.toIndex) }
          : section
      ) as typeof next.sections
      return next
    }

    case 'REORDER_COLUMN_BLOCKS': {
      next.columnBlocks[command.columnId] = reorderList(
        next.columnBlocks[command.columnId] || [],
        command.fromIndex,
        command.toIndex
      )
      return next
    }

    case 'MOVE_BLOCK_BETWEEN_COLUMNS': {
      const fromList = (next.columnBlocks[command.fromColumnId] || []).filter((id) => id !== command.blockId)
      const toListBase =
        command.fromColumnId === command.toColumnId ? fromList : [...(next.columnBlocks[command.toColumnId] || [])]

      next.columnBlocks[command.fromColumnId] = fromList
      next.columnBlocks[command.toColumnId] = insertAt(toListBase, command.toIndex, command.blockId)
      return next
    }

    case 'MOVE_BLOCK_SECTION_TO_COLUMN': {
      next.sections = next.sections.map((section) =>
        section.id === command.sectionId
          ? { ...section, blockIds: section.blockIds.filter((id) => id !== command.blockId) }
          : section
      ) as typeof next.sections
      next.columnBlocks[command.columnId] = insertAt(
        next.columnBlocks[command.columnId] || [],
        command.toIndex,
        command.blockId
      )
      return next
    }

    case 'MOVE_BLOCK_COLUMN_TO_SECTION': {
      next.columnBlocks[command.columnId] = (next.columnBlocks[command.columnId] || []).filter(
        (id) => id !== command.blockId
      )
      next.sections = next.sections.map((section) =>
        section.id === command.sectionId
          ? { ...section, blockIds: insertAt(section.blockIds, command.toIndex, command.blockId) }
          : section
      ) as typeof next.sections
      return next
    }
  }
}

export function applyDocumentCommand(project: Project, command: DocumentCommand): DocumentCommandResult {
  switch (command.type) {
    case 'ADD_BLOCK_TO_SECTION':
      return addBlockToSectionProject(project, command.sectionId, command.blockType, command.locale)

    case 'ADD_BLOCK_TO_COLUMN':
      return addBlockToColumnProject(project, command.columnId, command.blockType, command.locale)

    case 'REMOVE_BLOCKS':
      return removeBlocksFromProject(project, command.blockIds, command.activeBlockIds)

    case 'REMOVE_BLOCK_FROM_COLUMN':
      return removeBlockFromColumnProject(project, command.columnId, command.blockId, command.activeBlockIds)

    case 'DUPLICATE_BLOCKS_IN_SECTION':
      return duplicateBlocksInSectionProject(project, command.sectionId, command.blockIds)

    case 'DUPLICATE_BLOCK_IN_COLUMN':
      return duplicateBlockInColumnProject(project, command.columnId, command.blockId)

    case 'PASTE_BLOCK_TREE_TO_SECTION':
      return pasteBlockTreeToSectionProject(project, command.sectionId, command.snapshot)

    default:
      return { project: applyProjectCommand(project, command), activeBlockId: null, activeBlockIds: [] }
  }
}
