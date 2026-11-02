import { getBlockListChildIds } from '../engine/graph'
import type { Block } from '../schema'
import { useBlockSelection } from './use-block-selection'
import { useDocumentState } from '../store/hooks'

export function useComposableChildren(blockId: string) {
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const blocks = useDocumentState((state) => state.blocks)
  const { selectBlock: setActiveBlock, activeBlockId, activeBlockIds } = useBlockSelection()

  const childIds = getBlockListChildIds({ blocks, sections: [] as any, columnBlocks }, blockId)
  const children = childIds.map((id) => blocks[id]).filter(Boolean) as Block[]

  return { children, childIds, setActiveBlock, activeBlockId, activeBlockIds }
}
