import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from 'themelia-react-ui/base/navigation'
import { useScopedSnippetActions } from '../store/snippets'
import {
  useBlockActions,
  useClipboardActions,
  useClipboardState,
  useDocumentState,
  useSelectionActions,
  useSelectionState,
} from '../store/hooks'
import { getBlockDef } from '../blocks'
import { useFeature } from '../context'
import { useToast } from '../hooks/use-toast'
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Clipboard,
  Scissors,
  Trash2,
  ClipboardPaste,
  Settings,
  BookmarkPlus,
} from 'lucide-react'

interface Position {
  x: number
  y: number
}

interface BlockContextMenuProps {
  position: Position | null
  blockId: string | null
  sectionId: string | null
  onClose: () => void
  onFocusSettings?: () => void
}

export function BlockContextMenu({
  position,
  blockId,
  sectionId,
  onClose,
  onFocusSettings,
}: BlockContextMenuProps) {
  const toast = useToast()

  const { moveBlockUp, moveBlockDown, duplicateBlock, removeBlock } = useBlockActions()
  const { copyBlocks, cutBlocks, pasteBlocks } = useClipboardActions()
  const { setActiveBlock } = useSelectionActions()
  const { clipboard } = useClipboardState()
  const { activeBlockIds } = useSelectionState()
  const { saveSnippetFromBlock } = useScopedSnippetActions()
  const clipboardEnabled = useFeature('clipboard')
  const blocks = useDocumentState((state) => state.blocks)

  if (!position || !blockId || !sectionId) return null

  const block = blocks[blockId]
  const def = block ? getBlockDef(block.type) : null
  const label = def?.name || 'Block'

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
  const mod = isMac ? '⌘' : 'Ctrl+'

  const targetIds = activeBlockIds.includes(blockId) && activeBlockIds.length > 1 ? activeBlockIds : [blockId]
  const hasClipboard = clipboard !== null && clipboard.length > 0

  const items = [
    ...(clipboardEnabled
      ? [
          {
            icon: Copy,
            label: targetIds.length > 1 ? `Copy ${targetIds.length} blocks` : 'Copy',
            shortcut: `${mod}C`,
            action: () => {
              copyBlocks(targetIds)
              toast(targetIds.length > 1 ? `Copied ${targetIds.length} blocks` : 'Block copied', 'info')
            },
          },
          {
            icon: Scissors,
            label: targetIds.length > 1 ? `Cut ${targetIds.length} blocks` : 'Cut',
            shortcut: `${mod}X`,
            action: () => {
              cutBlocks(targetIds)
              toast(targetIds.length > 1 ? `Cut ${targetIds.length} blocks` : 'Block cut', 'info')
            },
          },
          {
            icon: ClipboardPaste,
            label: 'Paste Below',
            shortcut: `${mod}V`,
            action: () => {
              if (hasClipboard) {
                pasteBlocks(sectionId)
                toast('Block pasted', 'success')
              }
            },
            disabled: !hasClipboard,
          },
          {
            icon: Clipboard,
            label: 'Duplicate',
            shortcut: `${mod}D`,
            action: () => {
              duplicateBlock(blockId, sectionId)
              toast('Block duplicated', 'success')
            },
          },
        ]
      : []),
    {
      icon: BookmarkPlus,
      label: 'Save as Snippet',
      action: () => {
        const snippet = saveSnippetFromBlock(blockId)
        if (snippet) toast(`Saved "${snippet.name}"`, 'success')
      },
    },
    'separator' as const,
    { icon: ArrowUp, label: 'Move Up', action: () => moveBlockUp(blockId, sectionId) },
    { icon: ArrowDown, label: 'Move Down', action: () => moveBlockDown(blockId, sectionId) },
    'separator' as const,
    {
      icon: Settings,
      label: 'Block Settings',
      action: () => {
        setActiveBlock(blockId)
        onFocusSettings?.()
      },
    },
    'separator' as const,
    {
      icon: Trash2,
      label: 'Delete',
      shortcut: 'Del',
      action: () => {
        removeBlock(blockId)
        toast('Block deleted', 'info')
      },
      destructive: true,
    },
  ]

  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      modal={false}
    >
      <DropdownMenuTrigger
        render={<span aria-hidden />}
        style={{ position: 'fixed', left: position.x, top: position.y }}
      />
      <DropdownMenuContent align="start" sideOffset={0} data-context-menu>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {items.map((item, index) =>
            item === 'separator' ? (
              <DropdownMenuSeparator key={index} />
            ) : (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                variant={item.destructive ? 'destructive' : 'default'}
                onClick={() => {
                  item.action()
                  onClose()
                }}
              >
                <item.icon aria-hidden />
                {item.label}
                {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
