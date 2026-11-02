import { describe, expect, it } from 'vitest'
import { applyDocumentCommand, applyProjectCommand } from './commands'
import { captureBlockTree } from '#/voucher-builder/lib/block-tree'
import { createBlockInstance } from '#/voucher-builder/blocks/factory'
import type { Project } from '#/voucher-builder/schema'
import '#/voucher-builder/blocks/definitions'

function createProject(): Project {
  return {
    global: {
      layout: {
        pagePadding: 40,
        margin: 10,
      },
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        baseSize: 16,
        lineHeight: 1.5,
        headingLineHeight: 1.2,
        paragraphSpacing: 0,
        headingSpacing: 0,
      },
      colors: {
        primary: '#111827',
        accent: '#3b82f6',
        background: '#ffffff',
        text: '#111827',
        secondary: '#6b7280',
        border: '#e5e7eb',
        surface: '#f9fafb',
        link: '#2563eb',
      },
      metadata: {
        title: 'Test Voucher',
        author: '',
        subject: undefined,
        keywords: [],
        language: 'en',
      },
      previewData: {},
    },
    blocks: {
      a: createBlockInstance('text', 'a'),
      b: createBlockInstance('text', 'b'),
      c: createBlockInstance('text', 'c'),
      d: createBlockInstance('text', 'd'),
      e: createBlockInstance('text', 'e'),
    },
    sections: [
      { id: 's1', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: ['a', 'b'] },
      { id: 's2', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: ['d'] },
      { id: 's3', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
    ],
    columnBlocks: {
      col1: ['e'],
      col2: [],
    },
    frame: { imageUrl: null, opacity: 1 },
  }
}

describe('applyProjectCommand', () => {
  it('reorders section blocks through explicit commands', () => {
    const reorderedBlocks = applyProjectCommand(createProject(), {
      type: 'REORDER_SECTION_BLOCKS',
      sectionId: 's1',
      fromIndex: 0,
      toIndex: 1,
    })

    expect(reorderedBlocks.sections.find((s) => s.id === 's1')?.blockIds).toEqual(['b', 'a'])
  })

  it('moves blocks from section to column and back', () => {
    const toColumn = applyProjectCommand(createProject(), {
      type: 'MOVE_BLOCK_SECTION_TO_COLUMN',
      blockId: 'b',
      sectionId: 's1',
      columnId: 'col2',
      toIndex: 0,
    })
    const backToSection = applyProjectCommand(toColumn, {
      type: 'MOVE_BLOCK_COLUMN_TO_SECTION',
      blockId: 'b',
      columnId: 'col2',
      sectionId: 's2',
      toIndex: 1,
    })

    expect(toColumn.sections.find((s) => s.id === 's1')?.blockIds).toEqual(['a'])
    expect(toColumn.columnBlocks.col2).toEqual(['b'])
    expect(backToSection.sections.find((s) => s.id === 's2')?.blockIds).toEqual(['d', 'b'])
    expect(backToSection.columnBlocks.col2).toEqual([])
  })

  it('reorders and moves blocks between columns', () => {
    const project: Project = {
      ...createProject(),
      columnBlocks: {
        col1: ['a', 'b'],
        col2: ['c'],
      },
    }

    const reordered = applyProjectCommand(project, {
      type: 'REORDER_COLUMN_BLOCKS',
      columnId: 'col1',
      fromIndex: 0,
      toIndex: 1,
    })
    const moved = applyProjectCommand(reordered, {
      type: 'MOVE_BLOCK_BETWEEN_COLUMNS',
      blockId: 'a',
      fromColumnId: 'col1',
      toColumnId: 'col2',
      toIndex: 1,
    })

    expect(reordered.columnBlocks.col1).toEqual(['b', 'a'])
    expect(moved.columnBlocks.col1).toEqual(['b'])
    expect(moved.columnBlocks.col2).toEqual(['c', 'a'])
  })
})

describe('applyDocumentCommand', () => {
  it('adds, duplicates, and removes blocks through the unified command surface', () => {
    const added = applyDocumentCommand(createProject(), {
      type: 'ADD_BLOCK_TO_SECTION',
      sectionId: 's1',
      blockType: 'hero',
      locale: 'en',
    })
    const addedId = added.activeBlockId!

    const duplicated = applyDocumentCommand(added.project, {
      type: 'DUPLICATE_BLOCKS_IN_SECTION',
      sectionId: 's1',
      blockIds: [addedId],
    })
    const duplicatedId = duplicated.activeBlockId!

    const removed = applyDocumentCommand(duplicated.project, {
      type: 'REMOVE_BLOCKS',
      blockIds: [addedId],
      activeBlockIds: [addedId, duplicatedId],
    })

    expect(added.project.sections.find((s) => s.id === 's1')?.blockIds.includes(addedId)).toBe(true)
    expect(duplicated.project.sections.find((s) => s.id === 's1')?.blockIds.includes(duplicatedId)).toBe(true)
    expect(removed.project.blocks[addedId]).toBeUndefined()
    expect(removed.activeBlockIds).toEqual([duplicatedId])
  })

  it('pastes clipboard trees through the unified command surface', () => {
    const source = applyDocumentCommand(createProject(), {
      type: 'ADD_BLOCK_TO_SECTION',
      sectionId: 's1',
      blockType: 'hero',
      locale: 'en',
    })
    const snapshot = captureBlockTree(source.activeBlockId!, source.project.blocks, source.project.columnBlocks)

    expect(snapshot).not.toBeNull()

    const pasted = applyDocumentCommand(source.project, {
      type: 'PASTE_BLOCK_TREE_TO_SECTION',
      sectionId: 's3',
      snapshot: snapshot!,
    })

    expect(pasted.project.sections.find((s) => s.id === 's3')?.blockIds).toHaveLength(1)
  })
})
