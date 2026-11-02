import type { VoucherSection, Block } from '#/voucher-builder/schema'
import { getBlockChildKind } from '#/voucher-builder/blocks/registry'

/**
 * Returns a flat, depth-first ordered list of all navigable block IDs
 * in a section. Structural blocks (columns, grid cells) are skipped —
 * navigation goes directly to their children.
 */
export function getNavigableBlockList(
  section: VoucherSection,
  blocks: Record<string, Block>,
  columnBlocks: Record<string, string[]>,
): string[] {
  const result: string[] = []

  function visit(blockId: string) {
    const block = blocks[blockId]
    if (!block) return

    const childKind = getBlockChildKind(block.type)

    if (childKind === 'row-columns' || childKind === 'grid-cells') {
      // Structural block — add self, then visit structural children's contents
      result.push(blockId)
      const structField = childKind === 'row-columns' ? 'columnIds' : 'cellIds'
      const structIds: string[] = (block.content as any)?.[structField] || []
      for (const structId of structIds) {
        // Skip the column/cell itself, visit its children directly
        const childIds = columnBlocks[structId] || []
        for (const childId of childIds) {
          visit(childId)
        }
      }
    } else if (childKind === 'block-list') {
      // Composable or section block — add self, then visit children
      result.push(blockId)
      const childIds = columnBlocks[blockId] || []
      for (const childId of childIds) {
        visit(childId)
      }
    } else {
      // Leaf block
      result.push(blockId)
    }
  }

  for (const rootId of section.blockIds) {
    visit(rootId)
  }

  return result
}
