import { nanoid } from 'nanoid'
import type { Block } from '../schema'
import { getBlockListChildIds, getDirectChildIds } from '../engine/graph'
import { isStructuralType } from '../blocks'

export interface BlockTreeSnapshot {
  block: Block
  descendants: Record<string, Block>
  columnBlocks: Record<string, string[]>
}

function cloneBlock<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function captureBlockTree(
  blockId: string,
  blocks: Record<string, Block>,
  columnBlocks: Record<string, string[]>,
): BlockTreeSnapshot | null {
  const root = blocks[blockId]
  if (!root) return null

  const descendants: Record<string, Block> = {}
  const columnBlocksSnapshot: Record<string, string[]> = {}
  const visited = new Set<string>()

  function collectColumnChildren(parentId: string) {
    if (visited.has(parentId)) return
    visited.add(parentId)

    const childIds = getBlockListChildIds({ blocks, sections: [] as any, columnBlocks }, parentId)
    if (!childIds?.length) return

    columnBlocksSnapshot[parentId] = [...childIds]

    for (const childId of childIds) {
      const child = blocks[childId]
      if (!child) continue

      descendants[childId] = cloneBlock(child)

      if (isStructuralType(child.type)) {
        collectStructuralChildren(child)
      }

      collectColumnChildren(childId)
    }
  }

  function collectStructuralChildren(structuralBlock: Block) {
    for (const containerId of getDirectChildIds({ blocks, sections: [] as any, columnBlocks }, structuralBlock.id)) {
      const containerBlock = blocks[containerId]
      if (!containerBlock) continue

      descendants[containerId] = cloneBlock(containerBlock)
      collectColumnChildren(containerId)
    }
  }

  if (isStructuralType(root.type)) {
    collectStructuralChildren(root)
  }

  collectColumnChildren(root.id)

  return {
    block: cloneBlock(root),
    descendants,
    columnBlocks: columnBlocksSnapshot,
  }
}

export function instantiateBlockTree(snapshot: BlockTreeSnapshot) {
  const idMap: Record<string, string> = {
    [snapshot.block.id]: nanoid(8),
  }

  for (const oldId of Object.keys(snapshot.descendants)) {
    idMap[oldId] = nanoid(8)
  }

  const clonedRoot = cloneBlock(snapshot.block)
  clonedRoot.id = idMap[snapshot.block.id]

  const clonedBlocks: Record<string, Block> = {
    [clonedRoot.id]: clonedRoot,
  }

  for (const [oldId, block] of Object.entries(snapshot.descendants)) {
    const cloned = cloneBlock(block)
    cloned.id = idMap[oldId]
    clonedBlocks[cloned.id] = cloned
  }

  const clonedColumnBlocks: Record<string, string[]> = {}

  for (const [oldParentId, oldChildIds] of Object.entries(snapshot.columnBlocks)) {
    const newParentId = idMap[oldParentId]
    if (!newParentId) continue

    clonedColumnBlocks[newParentId] = oldChildIds
      .map((oldChildId) => idMap[oldChildId])
      .filter((childId): childId is string => Boolean(childId))
  }

  for (const block of Object.values(clonedBlocks)) {
    const content = block.content as Record<string, unknown>

    if (Array.isArray(content.columnIds)) {
      content.columnIds = content.columnIds
        .map((oldId) => idMap[String(oldId)])
        .filter((id): id is string => Boolean(id))
    }

    if (Array.isArray(content.cellIds)) {
      content.cellIds = content.cellIds
        .map((oldId) => idMap[String(oldId)])
        .filter((id): id is string => Boolean(id))
    }

    if (Array.isArray(content.childIds)) {
      content.childIds = content.childIds
        .map((oldId) => idMap[String(oldId)])
        .filter((id): id is string => Boolean(id))
    }
  }

  return {
    rootId: clonedRoot.id,
    blocks: clonedBlocks,
    columnBlocks: clonedColumnBlocks,
  }
}
