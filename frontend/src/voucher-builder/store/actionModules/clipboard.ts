import { captureBlockTree } from '#/voucher-builder/lib/block-tree'
import type { DocumentRuntime } from '../runtime'
import { createCommandHelpers } from './shared'
import type { ComposerActions } from '../types'

export function createClipboardActions(runtime: DocumentRuntime) {
  const { getEditorState, getProjectState } = runtime
  const { applyProjectCommand } = createCommandHelpers(runtime)
  const emitAction = runtime.events.emit
  function copyBlocks(blockIds: string[]) {
    const { blocks, columnBlocks } = getProjectState()
    const snapshots = blockIds
      .map((id) => captureBlockTree(id, blocks, columnBlocks))
      .filter(Boolean) as NonNullable<ReturnType<typeof captureBlockTree>>[]

    if (snapshots.length > 0) {
      runtime.editor.setState({ clipboard: snapshots })
      emitAction({ type: 'clipboard.copy', blockIds })
    }
  }

  function cutBlocks(blockIds: string[]) {
    const { blocks, columnBlocks } = getProjectState()
    const snapshots = blockIds
      .map((id) => captureBlockTree(id, blocks, columnBlocks))
      .filter(Boolean) as NonNullable<ReturnType<typeof captureBlockTree>>[]

    if (snapshots.length > 0) {
      runtime.editor.setState({ clipboard: snapshots })
      applyProjectCommand(
        { type: 'REMOVE_BLOCKS', blockIds, activeBlockIds: getEditorState().activeBlockIds },
        { updateSelection: true, updateActivePage: false },
      )
      emitAction({ type: 'clipboard.cut', blockIds })
    }
  }

  function pasteBlocks(sectionId: string) {
    const { clipboard } = getEditorState()
    if (!getProjectState().sections.some(section => section.id === sectionId)) return
    if (!clipboard || clipboard.length === 0) return

    for (const snapshot of clipboard) {
      applyProjectCommand(
        { type: 'PASTE_BLOCK_TREE_TO_SECTION', sectionId, snapshot },
        { updateSelection: true, updateActivePage: false },
      )
    }
    emitAction({ type: 'clipboard.paste', sectionId, count: clipboard.length })
  }

  const clipboardActions: Pick<ComposerActions, 'copyBlock' | 'cutBlock' | 'pasteBlock' | 'copyBlocks' | 'cutBlocks' | 'pasteBlocks'> = {
    copyBlock: (blockId) => copyBlocks([blockId]),
    cutBlock: (blockId) => cutBlocks([blockId]),
    pasteBlock: (sectionId) => pasteBlocks(sectionId),
    copyBlocks,
    cutBlocks,
    pasteBlocks,
  }
  return clipboardActions
}
