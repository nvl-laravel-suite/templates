import { useCallback } from 'react'
import { useBlockActions, useDocumentState, useHistoryActions } from '../store/hooks'

interface UseInlineEditOptions {
  blockId: string
  contentKey: string
  value: string
}

export function useInlineEdit({ blockId, contentKey, value }: UseInlineEditOptions) {
  const { pushHistory } = useHistoryActions()
  const { updateBlock } = useBlockActions()
  const blocks = useDocumentState((state) => state.blocks)

  const commitValue = useCallback((nextValue: string) => {
    if (nextValue === value) return
    const block = blocks[blockId]
    if (!block) return

    pushHistory()
    updateBlock(blockId, {
      content: { ...block.content, [contentKey]: nextValue },
    } as any)
  }, [blockId, blocks, contentKey, pushHistory, updateBlock, value])

  return {
    commitValue,
  }
}
