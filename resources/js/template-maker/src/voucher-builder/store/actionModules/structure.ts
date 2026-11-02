import { nanoid } from 'nanoid'
import { createDefaultBlock, type Block } from '../../schema'
import { removeBlockTree } from '../../engine/document'
import type { DocumentRuntime } from '../runtime'
import type { ComposerActions } from '../types'

export function createStructureActions(runtime: DocumentRuntime): Pick<ComposerActions, 'resizeRow' | 'resizeGrid'> {
  const resize = (id: string, columns: number, rows?: number) => {
    if (!Number.isInteger(columns) || columns < 1 || columns > 4 || rows !== undefined && (!Number.isInteger(rows) || rows < 1 || rows > 4)) throw new RangeError('Rows and columns must be integers between 1 and 4')
    const project = runtime.getProjectSnapshot()
    const block = project.blocks[id]
    if (!block || block.type !== (rows === undefined ? 'row' : 'grid')) return
    const content = block.content as Record<string, unknown>
    const field = rows === undefined ? 'columnIds' : 'cellIds'
    const existing = [...(content[field] as string[])]
    const count = columns * (rows ?? 1)
    if (existing.length === count && (rows === undefined || content.rows === rows && content.columns === columns)) return
    runtime.pushDocumentHistory()
    existing.slice(count).forEach((childId) => removeBlockTree(childId, project.blocks, project.columnBlocks))
    const ids = existing.slice(0, count)
    while (ids.length < count) {
      const childId = nanoid(8)
      const child = createDefaultBlock('column', childId, project.global.metadata.language)
      if (rows !== undefined && child.commonSettings) child.commonSettings.alias = `Cell ${ids.length + 1}`
      project.blocks[childId] = child; project.columnBlocks[childId] = []; ids.push(childId)
    }
    const nextContent = rows === undefined
      ? { ...content, columnIds: ids, columnCount: columns, columnWidths: Array.from({ length: columns }, (_, index) => index === columns - 1 ? 100 - Math.floor(100 / columns) * index : Math.floor(100 / columns)) }
      : { ...content, cellIds: ids, columns, rows, rowHeights: Array.from({ length: rows }, (_, i) => (content.rowHeights as number[] | undefined)?.[i] ?? 180) }
    project.blocks[id] = { ...block, content: nextContent } as Block
    const selected = runtime.normalizeSelection(runtime.getEditorState().activeBlockIds, project.blocks)
    runtime.applyDocumentResult({ project, activeBlockId: selected.at(-1) ?? null, activeBlockIds: selected }, { updateSelection: true })
    runtime.events.emit({ type: 'block.update', blockId: id, patch: { content: nextContent } as Partial<Block> })
  }
  return { resizeRow: (id, columns) => resize(id, columns), resizeGrid: (id, columns, rows) => resize(id, columns, rows) }
}
