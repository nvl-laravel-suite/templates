import type { DocumentRuntime } from '../runtime'
import type { ComposerActions } from '../types'
import { getSectionForBlock } from '../../engine/graph'

export function createSelectionActions(runtime: DocumentRuntime): Pick<
  ComposerActions,
  'setActiveBlock' | 'setActiveBlocks' | 'clearActiveSelection' | 'setFocusedBlocks' | 'clearFocusedBlocks'
> {
  const { getEditorState, getProjectState, normalizeSelection } = runtime
  return {
    setActiveBlock: (blockId, options) => {
      if (!blockId) {
        runtime.editor.setState({ activeBlockId: null, activeBlockIds: [] })
        return
      }

      const project = getProjectState()
      const editor = getEditorState()
      if (!project.blocks[blockId]) return
      const activeSectionId = getSectionForBlock(project, blockId)?.id ?? editor.activeSectionId

      if (options?.additive) {
        const exists = editor.activeBlockIds.includes(blockId)
        const activeBlockIds = exists
          ? editor.activeBlockIds.filter((id) => id !== blockId)
          : [...editor.activeBlockIds, blockId]
        runtime.editor.setState({
          activeBlockId: activeBlockIds[activeBlockIds.length - 1] ?? null,
          activeBlockIds,
          activeSectionId,
        })
        return
      }

      runtime.editor.setState({ activeBlockId: blockId, activeBlockIds: [blockId], activeSectionId })
    },

    setActiveBlocks: (blockIds) => {
      const activeBlockIds = normalizeSelection(blockIds, getProjectState().blocks)
      runtime.editor.setState({
        activeBlockId: activeBlockIds[activeBlockIds.length - 1] ?? null,
        activeBlockIds,
        activeSectionId: activeBlockIds.length ? getSectionForBlock(getProjectState(), activeBlockIds[activeBlockIds.length - 1])?.id ?? getEditorState().activeSectionId : getEditorState().activeSectionId,
      })
    },

    clearActiveSelection: () => {
      runtime.editor.setState({ activeBlockId: null, activeBlockIds: [] })
    },

    setFocusedBlocks: (blockIds) => {
      const valid = normalizeSelection(blockIds, getProjectState().blocks)
      runtime.editor.setState({ focusedBlockIds: valid })
    },

    clearFocusedBlocks: () => {
      runtime.editor.setState({ focusedBlockIds: [] })
    },
  }
}
