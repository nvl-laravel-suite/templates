import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { useContainerActions, useDocumentState, useSelectionActions, useSelectionState } from '#/voucher-builder/store/hooks'
import { cn } from '#/voucher-builder/lib/utils'
import { BlockRenderer } from '../block-renderer'
import type { Block, GridBlock as GridBlockType } from '#/voucher-builder/schema'
import { defaultCommonSettings } from '#/voucher-builder/schema'
import { Popover, PopoverContent, PopoverTrigger } from '#/voucher-builder/ui/popover'
import { Button } from 'themelia-react-ui/base/buttons'
import { QuickBlockPicker } from '#/voucher-builder/builder/quick-block-picker'

function CellAddButton({ cellId }: { cellId: string }) {
  const { addBlockToColumn } = useContainerActions()

  return (
    <Popover>
      <PopoverTrigger
        render={<Button size="sm" buttonStyle="ghost" aria-label="Add block to cell" />}
        onClick={(event) => event.stopPropagation()}
      >
        <Plus className="h-3 w-3" />
        Add Block
      </PopoverTrigger>
      <PopoverContent type="menu" inset="flush" className="w-80 max-w-[calc(100vw-2rem)]" side="top" sideOffset={4}>
        <QuickBlockPicker
          context="column"
          variant="list"
          onSelect={(type) => addBlockToColumn(cellId, type)}
        />
      </PopoverContent>
    </Popover>
  )
}

function renderCellStyle(cell: Block) {
  const settings = (cell as any).settings || {}
  const style: CSSProperties = {
    padding: settings.padding ?? 16,
    gridColumn: `span ${Math.max(settings.gridColumnSpan || 1, 1)} / span ${Math.max(settings.gridColumnSpan || 1, 1)}`,
    gridRow: `span ${Math.max(settings.gridRowSpan || 1, 1)} / span ${Math.max(settings.gridRowSpan || 1, 1)}`,
  }

  if (settings.backgroundColor && settings.backgroundColor !== 'transparent') {
    style.backgroundColor = settings.backgroundColor
  }
  if (settings.borderRadius) {
    style.borderRadius = settings.borderRadius
  }
  if (settings.borderWidth && settings.borderWidth > 0) {
    style.borderWidth = settings.borderWidth
    style.borderStyle = 'solid'
    style.borderColor = settings.borderColor ?? 'var(--nc-border, #e5e7eb)'
  }

  return style
}

export function GridBlockRenderer({ block }: { block: GridBlockType }) {
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const blocks = useDocumentState((state) => state.blocks)
  const { activeBlockIds } = useSelectionState()
  const { setActiveBlock } = useSelectionActions()

  const cellIds = block.content.cellIds || []
  const rowHeights = block.content.rowHeights || []

  return (
    <div
      className={cn(
        'grid',
        block.settings.responsive === 'scroll' && 'overflow-x-auto'
      )}
      style={{
        gap: block.settings.gap,
        gridTemplateColumns: `repeat(${block.content.columns}, minmax(0, 1fr))`,
        gridTemplateRows: rowHeights.map((height) => `minmax(${height}px, auto)`).join(' '),
      }}
    >
      {cellIds.map((cellId, index) => {
        const cell = blocks[cellId]
        if (!cell) return null

        const childIds = columnBlocks[cellId] || []
        const children = childIds.map((id) => blocks[id]).filter(Boolean)
        const isCellActive = activeBlockIds.includes(cellId)

        return (
          <div
            key={cellId}
            className={cn(
              'relative min-h-[96px] border border-dashed border-muted-foreground/20 transition',
              isCellActive && 'nc-selected'
            )}
            style={renderCellStyle(cell)}
            onClick={(event) => {
              event.stopPropagation()
              setActiveBlock(cellId, { additive: event.shiftKey })
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">
                {cell.commonSettings?.alias || `Cell ${index + 1}`}
              </span>
              <CellAddButton cellId={cellId} />
            </div>

            <div className="space-y-2">
              {children.length > 0 ? children.map((child) => {
                const cs = child.commonSettings || defaultCommonSettings
                return (
                  <div
                    key={child.id}
                    style={{
                      marginTop: cs.marginTop > 0 ? cs.marginTop : undefined,
                      marginRight: (cs.marginRight ?? 0) > 0 ? cs.marginRight : undefined,
                      marginBottom: cs.marginBottom > 0 ? cs.marginBottom : undefined,
                      marginLeft: (cs.marginLeft ?? 0) > 0 ? cs.marginLeft : undefined,
                    }}
                  >
                    <div
                      className={cn(
                        'relative cursor-pointer',
                        activeBlockIds.includes(child.id) ? 'nc-selected' : 'nc-selectable'
                      )}
                      style={{
                        paddingTop: cs.paddingTop > 0 ? cs.paddingTop : undefined,
                        paddingRight: cs.paddingRight > 0 ? cs.paddingRight : undefined,
                        paddingBottom: cs.paddingBottom > 0 ? cs.paddingBottom : undefined,
                        paddingLeft: cs.paddingLeft > 0 ? cs.paddingLeft : undefined,
                        backgroundColor: cs.backgroundColor !== 'transparent' ? cs.backgroundColor : undefined,
                        borderWidth: cs.borderWidth > 0 ? cs.borderWidth : undefined,
                        borderColor: cs.borderWidth > 0 ? cs.borderColor : undefined,
                        borderStyle: cs.borderWidth > 0 ? 'solid' : undefined,
                        borderRadius: cs.borderRadius > 0 ? cs.borderRadius : undefined,
                        opacity: cs.opacity < 1 ? cs.opacity : undefined,
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveBlock(child.id, { additive: event.shiftKey })
                      }}
                    >
                      <BlockRenderer block={child} />
                    </div>
                  </div>
                )
              }) : (
                <div className="flex min-h-[64px] items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 text-[11px] text-muted-foreground/60">
                  Empty cell
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
