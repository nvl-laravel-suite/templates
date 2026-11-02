import { useEffect, useCallback } from 'react'
import {
  useBlockActions,
  useClipboardActions,
  useDocumentState,
  useHistoryActions,
  useSectionState,
  useSelectionActions,
  useSelectionState,
} from '#/voucher-builder/store/hooks'
import { useToast } from '#/voucher-builder/hooks/use-toast'
import { getParentContext } from '#/voucher-builder/engine/graph'
import { getNavigableBlockList } from '#/voucher-builder/engine/navigation'
import { useVoucherPortal } from '../context'

interface ShortcutCallbacks {
  onOpenPalette?: () => void
  onOpenShortcuts?: () => void
  onDelete?: (ids: string[]) => void
  clipboardEnabled?: boolean
  undoRedoEnabled?: boolean
  editingEnabled?: boolean
}

export function useKeyboardShortcuts(callbacks?: ShortcutCallbacks) {
  const toast = useToast()
  const scope = useVoucherPortal()

  const { activeBlockId, activeBlockIds } = useSelectionState()
  const { activeSectionId, sections } = useSectionState()
  const blocks = useDocumentState((state) => state.blocks)
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const { duplicateBlock, duplicateBlocks, duplicateBlockInColumn } = useBlockActions()
  const { setActiveBlock, clearActiveSelection } = useSelectionActions()
  const { undo, redo } = useHistoryActions()
  const { copyBlocks, cutBlocks, pasteBlocks } = useClipboardActions()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || !(e.target instanceof Element)) return
      const target = e.target as HTMLElement
      // Nested editors and sibling embeds must keep independent keyboard ownership.
      if (!scope || target.closest('.nc-workspace') !== scope) return
      const tagName = target.tagName.toLowerCase()
      const isInput =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable ||
        !!target.closest('[contenteditable]:not([contenteditable="false"])')

      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const overlay = target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')
      if (overlay && overlay.getAttribute('data-slot') !== 'sheet-content') return

      // Cmd+K — always open palette (even from inputs)
      if (mod && key === 'k' && !e.shiftKey && callbacks?.onOpenPalette) {
        e.preventDefault()
        callbacks?.onOpenPalette?.()
        return
      }

      if (isInput) {
        // Don't intercept native undo in inputs
        return
      }

      // ? key — open shortcut legend (only when not in input)
      if (e.key === '?' && !mod) {
        // shift+/ produces ? on most keyboards, so also check for that
        callbacks?.onOpenShortcuts?.()
        return
      }
      if (e.key === '/' && e.shiftKey && !mod) {
        callbacks?.onOpenShortcuts?.()
        return
      }

      if (callbacks?.editingEnabled === false) return

      // Undo
      if (mod && key === 'z' && !e.shiftKey) {
        if (callbacks?.undoRedoEnabled === false) return
        e.preventDefault()
        undo()
        return
      }

      // Redo
      if (mod && key === 'z' && e.shiftKey) {
        if (callbacks?.undoRedoEnabled === false) return
        e.preventDefault()
        redo()
        return
      }

      // Paste (works even without a selected block)
      if (mod && key === 'v' && !e.shiftKey && activeSectionId) {
        if (callbacks?.clipboardEnabled === false) return
        e.preventDefault()
        pasteBlocks(activeSectionId)
        toast('Block pasted', 'success')
        return
      }

      if (activeBlockIds.length === 0 || !activeSectionId) return

      const section = sections.find((s: { id: string }) => s.id === activeSectionId)
      if (!section) return

      // Copy
      if (mod && key === 'c' && !e.shiftKey) {
        if (callbacks?.clipboardEnabled === false) return
        e.preventDefault()
        const ids = activeBlockIds.length > 0 ? activeBlockIds : activeBlockId ? [activeBlockId] : []
        if (ids.length > 0) {
          copyBlocks(ids)
          toast(`Copied ${ids.length} block${ids.length > 1 ? 's' : ''}`, 'info')
        }
        return
      }

      // Cut
      if (mod && key === 'x' && !e.shiftKey) {
        if (callbacks?.clipboardEnabled === false) return
        e.preventDefault()
        const ids = activeBlockIds.length > 0 ? activeBlockIds : activeBlockId ? [activeBlockId] : []
        if (ids.length > 0) {
          cutBlocks(ids)
          toast(`Cut ${ids.length} block${ids.length > 1 ? 's' : ''}`, 'info')
        }
        return
      }

      // Delete block
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        callbacks?.onDelete?.([...activeBlockIds])
        return
      }

      // Duplicate (detect if block is in a column)
      if (mod && key === 'd' && !e.shiftKey) {
        e.preventDefault()
        if (activeBlockIds.length > 1) {
          const pageSelection = section.blockIds.filter((blockId) => activeBlockIds.includes(blockId))
          if (pageSelection.length === activeBlockIds.length) {
            duplicateBlocks(activeBlockIds, activeSectionId)
            toast(`${activeBlockIds.length} blocks duplicated`, 'success')
            return
          }
        }
        if (!activeBlockId) return
        const parent = getParentContext({ blocks, sections: sections as any, columnBlocks }, activeBlockId)
        if (parent?.kind === 'container') {
          duplicateBlockInColumn(parent.parentId, activeBlockId)
        } else {
          duplicateBlock(activeBlockId, activeSectionId)
        }
        toast('Block duplicated', 'success')
        return
      }

      // Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        clearActiveSelection()
        return
      }

      // Arrow navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!activeBlockId || activeBlockIds.length > 1) return
        e.preventDefault()

        const navigable = getNavigableBlockList(section, blocks, columnBlocks)
        const currentIndex = navigable.indexOf(activeBlockId)
        if (currentIndex === -1) return

        const nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1
        if (nextIndex < 0 || nextIndex >= navigable.length) return

        setActiveBlock(navigable[nextIndex])

        // Scroll into view
        const el = document.querySelector(`[data-block-id="${navigable[nextIndex]}"]`)
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    [
      activeBlockId,
      activeBlockIds,
      activeSectionId,
      blocks,
      sections,
      columnBlocks,
      duplicateBlock,
      duplicateBlocks,
      duplicateBlockInColumn,
      setActiveBlock,
      clearActiveSelection,
      undo,
      redo,
      copyBlocks,
      cutBlocks,
      pasteBlocks,
      callbacks,
      scope,
      toast,
    ],
  )

  useEffect(() => {
    // Listen after React's delegated handlers so local editors can prevent a shortcut.
    const ownerDocument = scope?.ownerDocument
    ownerDocument?.addEventListener('keydown', handleKeyDown)
    return () => ownerDocument?.removeEventListener('keydown', handleKeyDown)
  }, [scope, handleKeyDown])
}
