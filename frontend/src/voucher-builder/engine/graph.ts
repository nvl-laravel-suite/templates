import type { Block, Project, VoucherSection } from '#/voucher-builder/schema'
import { getStructuralChildIds, hasBlockListChildren, isStructuralType } from '#/voucher-builder/blocks'

type GraphSource = Pick<Project, 'blocks' | 'sections' | 'columnBlocks'>

export type BlockParentContext =
  | { kind: 'section'; sectionId: string; index: number }
  | { kind: 'container'; parentId: string; index: number }
  | { kind: 'structural'; parentId: string; index: number }

export interface BlockPlacementContext {
  sectionId: string | null
  parent: BlockParentContext | null
}

export function getSectionRootIds(section: VoucherSection): string[] {
  return [...section.blockIds]
}

export function getBlockListChildIds(source: GraphSource, parentId: string): string[] {
  return [...(source.columnBlocks[parentId] || [])]
}

export function getDirectChildIds(source: GraphSource, blockId: string): string[] {
  const block = source.blocks[blockId]
  if (!block) return []

  if (isStructuralType(block.type)) {
    return getStructuralChildIds(block as any)
  }

  if (hasBlockListChildren(block.type)) {
    return getBlockListChildIds(source, blockId)
  }

  return []
}

export function getDirectChildren(source: GraphSource, blockId: string): Block[] {
  return getDirectChildIds(source, blockId)
    .map((childId) => source.blocks[childId])
    .filter(Boolean) as Block[]
}

export function getParentContext(source: GraphSource, blockId: string): BlockParentContext | null {
  for (const section of source.sections) {
    const sectionIndex = section.blockIds.indexOf(blockId)
    if (sectionIndex !== -1) {
      return { kind: 'section', sectionId: section.id, index: sectionIndex }
    }
  }

  for (const [parentId, childIds] of Object.entries(source.columnBlocks)) {
    const index = childIds.indexOf(blockId)
    if (index !== -1) {
      return { kind: 'container', parentId, index }
    }
  }

  for (const block of Object.values(source.blocks)) {
    if (!isStructuralType(block.type)) continue
    const index = getStructuralChildIds(block as any).indexOf(blockId)
    if (index !== -1) {
      return { kind: 'structural', parentId: block.id, index }
    }
  }

  return null
}

export function getParentBlockId(source: GraphSource, blockId: string): string | null {
  const parent = getParentContext(source, blockId)
  if (!parent) return null
  return parent.kind === 'container' || parent.kind === 'structural' ? parent.parentId : null
}

export function getParentBlock(source: GraphSource, blockId: string): Block | null {
  const parentId = getParentBlockId(source, blockId)
  return parentId ? source.blocks[parentId] || null : null
}

export function getSectionForBlock(source: GraphSource, blockId: string): VoucherSection | null {
  let currentId: string | null = blockId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const parent = getParentContext(source, currentId)
    if (!parent) return null
    if (parent.kind === 'section') {
      return source.sections.find((section) => section.id === parent.sectionId) || null
    }
    currentId = parent.parentId
  }

  return null
}

export function getPlacementContext(source: GraphSource, blockId: string): BlockPlacementContext {
  return {
    sectionId: getSectionForBlock(source, blockId)?.id ?? null,
    parent: getParentContext(source, blockId),
  }
}
