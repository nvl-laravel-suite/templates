import { useSelectionActions, useSelectionState } from '../store/hooks'

export function useBlockSelection() {
  const { activeBlockId, activeBlockIds } = useSelectionState()
  const { setActiveBlock, clearActiveSelection } = useSelectionActions()

  const selectBlock = (blockId: string | null, additive = false) => {
    setActiveBlock(blockId, { additive })
  }

  const isSelected = (blockId: string) => activeBlockIds.includes(blockId)

  return {
    activeBlockId,
    activeBlockIds,
    clearActiveSelection,
    isSelected,
    selectBlock,
  }
}
