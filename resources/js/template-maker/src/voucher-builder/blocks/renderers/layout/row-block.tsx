import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useBlockActions,
  useContainerActions,
  useDocumentState,
  useHistoryActions,
  useSelectionActions,
  useSelectionState,
} from '../../../store/hooks'
import { BlockRenderer } from '../block-renderer'
import type { RowBlock as RowBlockType, Block } from '../../../schema'
import { defaultCommonSettings } from '../../../schema'
import { Plus, Trash2, GripVertical, Columns2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover'
import { Button } from 'themelia-react-ui/base/buttons'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { QuickBlockPicker } from '../../../builder/quick-block-picker'
import '../../definitions'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, DragOverlay,
  useDroppable, type CollisionDetection, type UniqueIdentifier,
  pointerWithin, rectIntersection,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── ID helpers ────────────────────────────────────────────────

function parseCanvasId(id: string): { blockId: string; columnId: string } {
  const parts = String(id).split(':')
  return { blockId: parts[2], columnId: parts[1] }
}

function isCanvasChildId(id: string): boolean {
  return String(id).startsWith('canvas:')
}

function getAvailableGridWidth(containerWidth: number, gap: number, columnCount: number) {
  return Math.max(containerWidth - Math.max(columnCount - 1, 0) * gap, 1)
}

function getDividerPositions(widths: number[], gap: number, containerWidth: number) {
  if (widths.length < 2 || containerWidth <= 0) return []

  const totalWeight = widths.reduce((sum, width) => sum + width, 0) || 1
  const availableWidth = getAvailableGridWidth(containerWidth, gap, widths.length)
  const positions: number[] = []
  let usedWeight = 0

  for (let index = 0; index < widths.length - 1; index += 1) {
    usedWeight += widths[index]
    const linePosition = (usedWeight / totalWeight) * availableWidth
    positions.push(linePosition + index * gap + gap / 2)
  }

  return positions
}

// ── Canvas insertion indicator ────────────────────────────────

function CanvasInsertionLine() {
  return (
    <div className="relative h-0 z-10 mx-1">
      <div className="absolute left-0 right-0 top-0 flex items-center -translate-y-1/2">
        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
        <div className="flex-1 border-t border-dashed border-primary" />
        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
      </div>
    </div>
  )
}

// ── Custom collision for canvas ───────────────────────────────
// Prefer canvas child items, then column drop zones, then fallback
const canvasCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length === 0) return rectIntersection(args)

  const children = hits.filter((c) => isCanvasChildId(String(c.id)))
  const dropZones = hits.filter((c) => String(c.id).startsWith('canvas-col-drop:'))

  if (children.length > 0) return children
  if (dropZones.length > 0) return dropZones
  return rectIntersection(args)
}

// ── Column add menu ───────────────────────────────────────────

function ColumnAddButton({ columnId }: { columnId: string }) {
  const { addBlockToColumn } = useContainerActions()

  return (
    <Popover>
      <PopoverTrigger
        render={<Button size="sm" buttonStyle="ghost" aria-label="Add block to column" />}
        onClick={(e) => e.stopPropagation()}
      >
        <Plus className="h-3 w-3" />
        Add Block
      </PopoverTrigger>
      <PopoverContent type="menu" inset="flush" className="w-80 max-w-[calc(100vw-2rem)]" side="top" sideOffset={4}>
        <QuickBlockPicker
          context="column"
          variant="list"
          onSelect={(type) => addBlockToColumn(columnId, type)}
        />
      </PopoverContent>
    </Popover>
  )
}

// ── Sortable child block ──────────────────────────────────────

function SortableColumnChild({ child, columnId, showIndicatorBefore, showIndicatorAfter }: {
  child: Block; columnId: string
  showIndicatorBefore?: boolean; showIndicatorAfter?: boolean
}) {
  const { activeBlockIds } = useSelectionState()
  const { setActiveBlock } = useSelectionActions()
  const { removeBlockFromColumn } = useContainerActions()
  const isActive = activeBlockIds.includes(child.id)

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: `canvas:${columnId}:${child.id}`,
    data: { blockId: child.id, columnId },
  })

  const cs = child.commonSettings || defaultCommonSettings

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    margin: `${cs.marginTop}px ${cs.marginRight ?? 0}px ${cs.marginBottom}px ${cs.marginLeft ?? 0}px`,
  }

  return (
    <>
      {showIndicatorBefore && <CanvasInsertionLine />}
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group/child relative cursor-pointer',
          isActive ? 'nc-selected' : 'nc-selectable'
        )}
        onClick={(e) => { e.stopPropagation(); setActiveBlock(child.id, { additive: e.shiftKey }) }}
      >
        <div className="absolute -right-1 -top-1 z-40 flex gap-0.5 opacity-0 transition group-hover/child:opacity-100 group-focus-within/child:opacity-100">
          <Button
            {...attributes}
            {...listeners}
            size="sm" buttonStyle="outline" iconOnly aria-label={`Move ${child.commonSettings?.alias || child.type} block`}
            className="cursor-grab"
          >
            <GripVertical className="h-3 w-3" />
          </Button>
          <Button
            size="sm" buttonStyle="outline" tone="destructive" iconOnly aria-label={`Remove ${child.commonSettings?.alias || child.type} block`}
            onClick={(e) => { e.stopPropagation(); removeBlockFromColumn(columnId, child.id) }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <div style={{
          padding: `${cs.paddingTop}px ${cs.paddingRight}px ${cs.paddingBottom}px ${cs.paddingLeft}px`,
          backgroundColor: cs.backgroundColor !== 'transparent' ? cs.backgroundColor : undefined,
          borderWidth: cs.borderWidth > 0 ? cs.borderWidth : undefined,
          borderColor: cs.borderWidth > 0 ? cs.borderColor : undefined,
          borderStyle: cs.borderWidth > 0 ? 'solid' : undefined,
          borderRadius: cs.borderRadius > 0 ? cs.borderRadius : undefined,
          opacity: cs.opacity < 1 ? cs.opacity : undefined,
        }}>
          <BlockRenderer block={child} />
        </div>
      </div>
      {showIndicatorAfter && <CanvasInsertionLine />}
    </>
  )
}

// ── Droppable column wrapper ──────────────────────────────────

function DroppableColumn({ colId, colSettings, isDropTarget, children }: {
  colId: string; colSettings: any; isDropTarget?: boolean; children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: `canvas-col-drop:${colId}`,
    data: { type: 'canvas-column', columnId: colId },
  })

  const columnStyle: React.CSSProperties = {}

  if (colSettings?.backgroundColor && colSettings.backgroundColor !== 'transparent') {
    columnStyle.backgroundColor = colSettings.backgroundColor
  }
  if (colSettings?.borderRadius) {
    columnStyle.borderRadius = colSettings.borderRadius
  }
  if (colSettings?.borderWidth && colSettings.borderWidth > 0) {
    columnStyle.borderWidth = colSettings.borderWidth
    columnStyle.borderColor = colSettings.borderColor ?? 'var(--nc-border, #e5e7eb)'
    columnStyle.borderStyle = 'solid'
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-h-[40px] border border-dashed transition-all',
        isDropTarget
          ? 'border-primary bg-primary/5'
          : 'border-transparent'
      )}
      style={columnStyle}
    >
      {children}
    </div>
  )
}

// ── Main renderer ─────────────────────────────────────────────

export function RowBlockRenderer({ block }: { block: RowBlockType }) {
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const blocks = useDocumentState((state) => state.blocks)
  const { reorderColumnBlocks, moveBlockBetweenColumns } = useContainerActions()
  const { activeBlockId, activeBlockIds } = useSelectionState()
  const { updateBlock } = useBlockActions()
  const { pushHistory } = useHistoryActions()
  const [overInfo, setOverInfo] = useState<{ overId: string; overColId: string } | null>(null)
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const resizeMoveListenerRef = useRef<((event: PointerEvent) => void) | null>(null)
  const resizeStateRef = useRef<{
    dividerIndex: number
    containerLeft: number
    containerWidth: number
    widths: number[]
    gap: number
  } | null>(null)

  const widths = block.content.columnWidths
  const gridTemplate = widths.map((w) => `${w}fr`).join(' ')
  const columnIds = block.content.columnIds || []
  const showResizeHandles = activeBlockId === block.id && activeBlockIds.length === 1 && columnIds.length > 1

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const dividerPositions = useMemo(
    () => getDividerPositions(widths, block.settings.gap, gridWidth),
    [block.settings.gap, gridWidth, widths]
  )

  const handleResizeMove = useCallback((event: PointerEvent) => {
    const state = resizeStateRef.current
    if (!state) return

    const { dividerIndex, containerLeft, containerWidth, widths: startingWidths, gap } = state
    const totalWeight = startingWidths.reduce((sum, width) => sum + width, 0) || 1
    const availableWidth = getAvailableGridWidth(containerWidth, gap, startingWidths.length)
    const pairWeight = startingWidths[dividerIndex] + startingWidths[dividerIndex + 1]
    const weightBefore = startingWidths.slice(0, dividerIndex).reduce((sum, width) => sum + width, 0)
    const pairStart = (weightBefore / totalWeight) * availableWidth + dividerIndex * gap
    const pairWidth = (pairWeight / totalWeight) * availableWidth
    const minWidth = Math.min(
      Math.max(pairWidth * 0.12, 48),
      Math.max(pairWidth / 2 - 12, 16)
    )
    const rawLeftWidth = event.clientX - containerLeft - pairStart - gap / 2
    const nextLeftWidth = Math.max(minWidth, Math.min(pairWidth - minWidth, rawLeftWidth))
    const nextLeftWeight = pairWeight * (nextLeftWidth / Math.max(pairWidth, 1))
    const nextWidths = [...startingWidths]
    nextWidths[dividerIndex] = nextLeftWeight
    nextWidths[dividerIndex + 1] = pairWeight - nextLeftWeight

    updateBlock(block.id, {
      content: {
        ...block.content,
        columnWidths: nextWidths,
      },
    } as Partial<RowBlockType>)
  }, [block.content, block.id, updateBlock])

  const stopResize = useCallback(() => {
    const moveListener = resizeMoveListenerRef.current
    if (moveListener) {
      window.removeEventListener('pointermove', moveListener)
    }
    window.removeEventListener('pointerup', stopResize)
    resizeMoveListenerRef.current = null
    resizeStateRef.current = null
  }, [])

  const handleResizeStart = useCallback((dividerIndex: number, event: React.PointerEvent<HTMLButtonElement>) => {
    const grid = gridRef.current
    if (!grid) return

    event.preventDefault()
    event.stopPropagation()
    pushHistory()

    const rect = grid.getBoundingClientRect()
    resizeStateRef.current = {
      dividerIndex,
      containerLeft: rect.left,
      containerWidth: rect.width,
      widths: [...block.content.columnWidths],
      gap: block.settings.gap,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    resizeMoveListenerRef.current = handleResizeMove
    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', stopResize)
  }, [block.content.columnWidths, block.settings.gap, handleResizeMove, pushHistory, stopResize])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const measure = () => setGridWidth(grid.getBoundingClientRect().width)
    measure()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [columnIds.length])

  useEffect(() => () => {
    if (resizeStateRef.current) {
      stopResize()
    }
  }, [stopResize])

  const handleDragStart = (event: { active: { id: UniqueIdentifier } }) => {
    setActiveDragId(event.active.id)
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setOverInfo(null)
      return
    }
    const overStr = String(event.over.id)
    if (overStr.startsWith('canvas-col-drop:')) {
      const colId = overStr.replace('canvas-col-drop:', '')
      setOverInfo({ overId: overStr, overColId: colId })
    } else if (isCanvasChildId(overStr)) {
      const parsed = parseCanvasId(overStr)
      setOverInfo({ overId: overStr, overColId: parsed.columnId })
    } else {
      setOverInfo(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    setOverInfo(null)

    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeStr = String(active.id)
    const overStr = String(over.id)
    const source = parseCanvasId(activeStr)

    // Dropping on a column drop zone
    if (overStr.startsWith('canvas-col-drop:')) {
      const targetColId = overStr.replace('canvas-col-drop:', '')
      if (source.columnId !== targetColId) {
        moveBlockBetweenColumns(
          source.blockId, source.columnId, targetColId,
          (columnBlocks[targetColId] || []).length
        )
      }
      return
    }

    // Dropping on another sortable item
    const target = parseCanvasId(overStr)

    if (source.columnId === target.columnId) {
      const list = columnBlocks[source.columnId] || []
      const oldIndex = list.indexOf(source.blockId)
      const newIndex = list.indexOf(target.blockId)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderColumnBlocks(source.columnId, oldIndex, newIndex)
      }
    } else {
      const targetList = columnBlocks[target.columnId] || []
      const targetIndex = targetList.indexOf(target.blockId)
      moveBlockBetweenColumns(
        source.blockId, source.columnId, target.columnId,
        targetIndex !== -1 ? targetIndex : targetList.length
      )
    }
  }

  // Compute which column is being targeted for highlighting
  const targetColId = overInfo?.overColId ?? null
  // Compute indicator position for items
  const computeChildIndicator = (childId: string, colId: string): { before: boolean; after: boolean } => {
    if (!overInfo || !activeDragId) return { before: false, after: false }
    const overStr = overInfo.overId
    const sortableId = `canvas:${colId}:${childId}`
    if (overStr !== sortableId) return { before: false, after: false }

    // Determine before/after based on index comparison
    const source = parseCanvasId(String(activeDragId))
    if (source.columnId === colId) {
      const list = columnBlocks[colId] || []
      const activeIdx = list.indexOf(source.blockId)
      const overIdx = list.indexOf(childId)
      return { before: activeIdx > overIdx, after: activeIdx < overIdx }
    }
    // Cross-column: show before
    return { before: true, after: false }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={canvasCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        <div
          ref={gridRef}
          data-responsive={block.settings.responsive || 'stack'}
          data-reverse-mobile={block.settings.reverseOnMobile ? 'true' : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            gap: block.settings.gap,
            alignItems: block.settings.verticalAlign === 'center' ? 'center'
              : block.settings.verticalAlign === 'bottom' ? 'end'
              : block.settings.verticalAlign === 'stretch' ? 'stretch'
              : 'start',
          }}
        >
          {columnIds.map((colId) => {
            const childIds = columnBlocks[colId] || []
            const childBlocks = childIds.map((id) => blocks[id]).filter(Boolean)
            const colBlock = blocks[colId]
            const colSettings = colBlock?.type === 'column' ? colBlock.settings : undefined
            const sortableIds = childIds.map((id) => `canvas:${colId}:${id}`)
            const isTarget = targetColId === colId && activeDragId != null

            // Show indicator inside empty column when it's the drop target
            const showEmptyColIndicator = isTarget && childBlocks.length === 0
              && overInfo?.overId === `canvas-col-drop:${colId}`
            // Show indicator at end of column when dropping on the zone (non-empty)
            const showEndIndicator = isTarget && childBlocks.length > 0
              && overInfo?.overId === `canvas-col-drop:${colId}`

            return (
              <DroppableColumn key={colId} colId={colId} colSettings={colSettings} isDropTarget={isTarget}>
                {childBlocks.length === 0 && !showEmptyColIndicator && (
                  <div className="flex items-center justify-center h-full min-h-[40px] border border-dashed border-border/30 rounded">
                    <span className="text-[9px] text-muted-foreground/40 select-none">Drop blocks here</span>
                  </div>
                )}

                {showEmptyColIndicator && (
                  <Stack gap="xs">
                    <CanvasInsertionLine />
                    <Text size="xs" align="center">Drop here</Text>
                  </Stack>
                )}

                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {childBlocks.map((child) => {
                    const ind = computeChildIndicator(child.id, colId)
                    return (
                      <SortableColumnChild
                        key={child.id}
                        child={child}
                        columnId={colId}
                        showIndicatorBefore={ind.before}
                        showIndicatorAfter={ind.after}
                      />
                    )
                  })}
                </SortableContext>

                {showEndIndicator && <CanvasInsertionLine />}

                <div className="nc-col-add-btn absolute bottom-1 left-1/2 -translate-x-1/2 z-40 opacity-0 transition-opacity focus-within:opacity-100">
                  <ColumnAddButton columnId={colId} />
                </div>
              </DroppableColumn>
            )
          })}
        </div>

        {showResizeHandles && (
          <div className="pointer-events-none absolute inset-y-2 left-0 right-0">
            {dividerPositions.map((position, dividerIndex) => (
              <div
                key={`${block.id}-divider-${dividerIndex}`}
                className="pointer-events-auto absolute inset-y-0"
                style={{ left: position, transform: 'translateX(-50%)' }}
              >
                <button
                  type="button"
                  aria-label={`Resize columns ${dividerIndex + 1} and ${dividerIndex + 2}`}
                  className="group/resize relative flex h-full w-5 cursor-col-resize items-center justify-center bg-transparent"
                  style={{ touchAction: 'none' }}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => handleResizeStart(dividerIndex, event)}
                >
                  <span className="h-full w-px bg-border/70 transition group-hover/resize:bg-[var(--nc-selection)]" />
                  <span className="absolute flex h-8 w-5 items-center justify-center rounded-full border border-border/80 bg-background/92 text-muted-foreground shadow-sm backdrop-blur-sm transition group-hover/resize:scale-105 group-hover/resize:text-foreground">
                    <Columns2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragId ? (
          <div className="rounded bg-background/90 shadow-lg border px-2 py-1 text-[10px] text-muted-foreground">
            Moving block...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
