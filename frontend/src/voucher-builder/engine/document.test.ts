import { describe, expect, it } from 'vitest'
import {
  addBlockToColumnProject,
  addBlockToSectionProject,
  duplicateBlockInColumnProject,
  pasteBlockTreeToSectionProject,
  removeBlocksFromProject,
} from './document'
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
    blocks: {},
    sections: [
      { id: 's1', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
      { id: 's2', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
      { id: 's3', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
    ],
    columnBlocks: {},
    frame: { imageUrl: null, opacity: 1 },
  }
}

describe('document engine', () => {
  it('instantiates structural blocks with their managed containers when adding to a section', () => {
    const result = addBlockToSectionProject(createProject(), 's1', 'row', 'en')
    const row = result.project.blocks[result.activeBlockId!]

    expect(row.type).toBe('row')
    expect(result.project.sections[0]?.blockIds).toEqual([result.activeBlockId])

    const columnIds = (row.content as any).columnIds as string[]
    expect(columnIds).toHaveLength(2)
    expect(columnIds.every((id) => result.project.blocks[id]?.type === 'column')).toBe(true)
    expect(columnIds.every((id) => Array.isArray(result.project.columnBlocks[id]))).toBe(true)
  })

  it('removes block roots together with their nested child trees', () => {
    const added = addBlockToSectionProject(createProject(), 's1', 'hero', 'en')
    const rootId = added.activeBlockId!
    const childIds = added.project.columnBlocks[rootId] || []

    expect(childIds.length).toBeGreaterThan(0)

    const removed = removeBlocksFromProject(added.project, [rootId], [rootId])

    expect(removed.project.sections[0]?.blockIds).toEqual([])
    expect(removed.project.blocks[rootId]).toBeUndefined()
    expect(childIds.every((id) => removed.project.blocks[id] === undefined)).toBe(true)
    expect(removed.activeBlockId).toBeNull()
  })

  it('duplicates nested block trees inside a column and inserts the clone after the source', () => {
    const column = createBlockInstance('column', 'col-1')
    const project: Project = {
      ...createProject(),
      blocks: { 'col-1': column },
      columnBlocks: { 'col-1': [] },
    }

    const added = addBlockToColumnProject(project, 'col-1', 'hero', 'en')
    const rootId = added.activeBlockId!
    const originalChildIds = added.project.columnBlocks[rootId] || []

    const duplicated = duplicateBlockInColumnProject(added.project, 'col-1', rootId)
    const columnIds = duplicated.project.columnBlocks['col-1'] || []
    const duplicateId = columnIds[1]
    const duplicatedChildIds = duplicated.project.columnBlocks[duplicateId] || []

    expect(columnIds).toEqual([rootId, duplicateId])
    expect(duplicateId).not.toBe(rootId)
    expect(originalChildIds.length).toBeGreaterThan(0)
    expect(duplicatedChildIds).toHaveLength(originalChildIds.length)
    expect(duplicatedChildIds.every((id) => !originalChildIds.includes(id))).toBe(true)
    expect(duplicated.activeBlockId).toBe(duplicateId)
  })

  it('pastes a captured tree onto a section with fresh IDs and preserved nested structure', () => {
    const source = addBlockToSectionProject(createProject(), 's1', 'hero', 'en')
    const sourceRootId = source.activeBlockId!
    const sourceChildIds = source.project.columnBlocks[sourceRootId] || []
    const snapshot = captureBlockTree(sourceRootId, source.project.blocks, source.project.columnBlocks)

    expect(snapshot).not.toBeNull()

    const pasted = pasteBlockTreeToSectionProject(source.project, 's2', snapshot!)
    const pastedRootId = pasted.activeBlockId!
    const pastedChildIds = pasted.project.columnBlocks[pastedRootId] || []

    expect(pasted.project.sections.find((s) => s.id === 's2')?.blockIds).toEqual([pastedRootId])
    expect(pastedRootId).not.toBe(sourceRootId)
    expect(pastedChildIds).toHaveLength(sourceChildIds.length)
    expect(pastedChildIds.every((id) => !sourceChildIds.includes(id))).toBe(true)
  })
})
