import { cn } from '#/voucher-builder/lib/utils'
import type { ListBlock as ListBlockType } from '#/voucher-builder/schema'
import { Check, ChevronRight, Minus } from 'lucide-react'
import { RichTextEditable } from '#/voucher-builder/ui/rich-text-editor'
import { useBlockActions, useHistoryActions } from '#/voucher-builder/store/hooks'
import { DEFAULT_TEXT_COLOR, resolveTypography } from '#/voucher-builder/blocks/primitives'

const spacingClasses: Record<string, string> = {
  none: 'space-y-0',
  compact: 'space-y-0.5',
  normal: 'space-y-1.5',
  relaxed: 'space-y-3',
}

const iconTypeToListStyle: Record<string, string> = {
  disc: 'list-disc',
  circle: 'list-[circle]',
  square: 'list-[square]',
}

function CustomMarker({ iconType, color }: { iconType: string; color: string }) {
  if (iconType === 'dash') return <Minus className="mt-1 h-3 w-3 shrink-0" style={{ color }} />
  if (iconType === 'check') return <Check className="mt-1 h-3 w-3 shrink-0" style={{ color }} />
  if (iconType === 'arrow') return <ChevronRight className="mt-1 h-3 w-3 shrink-0" style={{ color }} />
  return null
}

function EditableListItem({
  block,
  item,
  index,
  className,
  style,
}: {
  block: ListBlockType
  item: string
  index: number
  className?: string
  style?: React.CSSProperties
}) {
  const { pushHistory } = useHistoryActions()
  const { updateBlock } = useBlockActions()

  const handleCommit = (nextItem: string) => {
    if (nextItem === item) return
    pushHistory()
    const nextItems = [...block.content.items]
    nextItems[index] = nextItem
    updateBlock(block.id, {
      content: { ...block.content, items: nextItems },
    } as Partial<ListBlockType>)
  }

  return (
    <RichTextEditable
      as="div"
      value={item}
      onCommit={handleCommit}
      placeholder={`Item ${index + 1}`}
      multiline={false}
      className={className}
      style={style}
      editingClassName="rounded-radius outline outline-1 outline-dashed outline-primary outline-offset-4"
    />
  )
}

export function ListBlockRenderer({ block }: { block: ListBlockType }) {
  const s = block.settings as Record<string, unknown>
  const spacing = spacingClasses[s.spacing as string] || spacingClasses.normal
  const columns = (s.columns as string) || '1'
  const iconType = (s.iconType as string) || 'disc'
  const columnCount = Number(columns)

  const typo = resolveTypography(
    {
      fontSize: s.fontSize as string,
      fontWeight: s.fontWeight as string,
      lineHeight: s.lineHeight as number,
      textColor: s.textColor as string,
    },
    { fallbackTextColor: DEFAULT_TEXT_COLOR },
  )

  // Extract the resolved color for marker coloring.
  const markerColor = (typo.style.color as string) || DEFAULT_TEXT_COLOR
  const columnStyle: React.CSSProperties = columnCount > 1 ? { columnCount, columnGap: '1.5rem' } : {}
  const useCustomMarker = ['dash', 'check', 'arrow'].includes(iconType)

  if (block.settings.listType === 'checklist') {
    return (
      <div className={cn(spacing)} style={columnStyle}>
        {block.content.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-muted-foreground/30">
              <Check className="h-3 w-3 text-muted-foreground/40" />
            </div>
            <EditableListItem
              block={block}
              item={item}
              index={i}
              className={cn('flex-1', ...typo.classes)}
              style={typo.style}
            />
          </div>
        ))}
      </div>
    )
  }

  if (useCustomMarker) {
    return (
      <div className={cn(spacing)} style={columnStyle}>
        {block.content.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <CustomMarker iconType={iconType} color={markerColor} />
            <EditableListItem
              block={block}
              item={item}
              index={i}
              className={cn('flex-1', ...typo.classes)}
              style={typo.style}
            />
          </div>
        ))}
      </div>
    )
  }

  const Tag = block.settings.listType === 'ordered' ? 'ol' : 'ul'
  const listClass = block.settings.listType === 'ordered' ? 'list-decimal' : (iconTypeToListStyle[iconType] || 'list-disc')

  return (
    <Tag className={cn(listClass, 'pl-5', spacing)} style={columnStyle}>
      {block.content.items.map((item, i) => (
        <li key={i} style={{ lineHeight: typo.style.lineHeight }}>
          <EditableListItem
            block={block}
            item={item}
            index={i}
            className={cn(...typo.classes)}
            style={typo.style}
          />
        </li>
      ))}
    </Tag>
  )
}
