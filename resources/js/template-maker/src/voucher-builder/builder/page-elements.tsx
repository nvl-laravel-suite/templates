import { Text } from 'themelia-react-ui/typography'
import { Item } from 'themelia-react-ui/base/item'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { useState } from 'react'
import {
  useBlockActions,
  useDocumentState,
  useSectionState,
  useSelectionActions,
  useSelectionState,
  useContainerActions,
} from '../store/hooks'
import { cn } from '../lib/utils'
import {
  canPlaceIn,
  getBlockChildKind,
  getBlockDef,
  hasBlockListChildren,
  isComposableType,
  isStructuralType,
  labelOf,
} from '../blocks'
import { getBlockListChildIds, getDirectChildIds, getSectionRootIds } from '../engine/graph'
import '../blocks/definitions'
import {
  FileText,
  GripVertical,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
} from 'lucide-react'
import type { Block } from '../schema'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip'
import { Input } from '../ui/input'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
  useDroppable,
  type UniqueIdentifier,
  type CollisionDetection,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** Resolve a block's icon from its registered definition. */
function iconFor(type: string): typeof FileText {
  return (getBlockDef(type)?.icon as typeof FileText | undefined) || FileText
}

// ── ID helpers ────────────────────────────────────────────────

/** Parse a sortable ID → real blockId + columnId (if inside a column) */
function parseSortableId(id: string): { blockId: string; columnId: string | null } {
  if (id.startsWith('col:')) {
    const parts = id.split(':')
    return { blockId: parts[2], columnId: parts[1] }
  }
  return { blockId: id, columnId: null }
}

function isColumnChildId(id: string): boolean {
  return id.startsWith('col:')
}

// ── Context type for element actions ─────────────────────────
type ElementContext = { type: 'section'; sectionId: string } | { type: 'column'; columnId: string }

// ── Drag state (shared down to rows for indicator rendering) ──
interface DragIndicator {
  /** The sortable/droppable ID being hovered */
  overId: string
  /** Which zone the drag is targeting */
  zone: 'page' | string // 'page' or columnId
  /** Position relative to the over item: 'before' | 'after' | 'inside' */
  position: 'before' | 'after' | 'inside'
}

// ── Insertion Line ────────────────────────────────────────────
function InsertionLine({ depth }: { depth: number }) {
  return (
    <div className="relative h-0 z-10" style={{ marginLeft: 4 + depth * 12 }}>
      <div className="absolute left-0 right-1 top-0 flex items-center -translate-y-1/2">
        <div className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
        <div className="flex-1 h-[2px] bg-accent rounded-full" />
      </div>
    </div>
  )
}

// ── Sortable Element Row ──────────────────────────────────────
function SortableElementRow({
  block,
  depth = 0,
  context,
  indicator,
  activeDragBlockId,
  index,
}: {
  block: Block
  depth?: number
  context: ElementContext
  indicator?: DragIndicator | null
  activeDragBlockId?: string | null
  index?: number
}) {
  const { activeBlockIds } = useSelectionState()
  const { setActiveBlock } = useSelectionActions()
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const blocks = useDocumentState((state) => state.blocks)
  const { removeBlock, duplicateBlock, updateBlockCommonSettings } = useBlockActions()
  const { removeBlockFromColumn, duplicateBlockInColumn } = useContainerActions()
  const { activeSectionId } = useSectionState()
  const isActive = activeBlockIds.includes(block.id)
  const childKind = getBlockChildKind(block.type)
  const isRow = childKind === 'row-columns'
  const isGrid = childKind === 'grid-cells'
  const isStructural = isStructuralType(block.type)
  const isColumn = block.type === 'column'
  const isComposable = isComposableType(block.type)
  const hasBlockList = !isComposable && !isRow && !isGrid && hasBlockListChildren(block.type)
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const blockDef = getBlockDef(block.type)
  const blockDescription = blockDef?.description || ''

  const sortableId = context.type === 'column' ? `col:${context.columnId}:${block.id}` : block.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: isColumn || isStructural || isComposable,
    data: { blockId: block.id, context },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const handleRename = () => {
    setRenaming(true)
    setRenameValue(block.commonSettings?.alias || '')
  }

  const commitRename = () => {
    const alias = renameValue.trim() || undefined
    updateBlockCommonSettings(block.id, { alias })
    setRenaming(false)
  }

  const handleDelete = () => {
    if (context.type === 'column') {
      removeBlockFromColumn(context.columnId, block.id)
    } else {
      removeBlock(block.id)
    }
  }

  const handleDuplicate = () => {
    if (context.type === 'column') {
      duplicateBlockInColumn(context.columnId, block.id)
    } else {
      duplicateBlock(block.id, context.sectionId)
    }
  }

  const columnIds = isRow ? getDirectChildIds({ blocks, sections: [] as any, columnBlocks }, block.id) : []
  const cellIds = isGrid ? getDirectChildIds({ blocks, sections: [] as any, columnBlocks }, block.id) : []

  // ── Indicator logic for THIS row ──
  const showIndicatorBefore = indicator && indicator.overId === sortableId && indicator.position === 'before'
  const showIndicatorAfter =
    indicator && indicator.overId === sortableId && indicator.position === 'after' && !isRow && !isGrid // structural containers show indicators on their children instead

  return (
    <div ref={setNodeRef} style={style}>
      {showIndicatorBefore && <InsertionLine depth={depth} />}

      <Item
        variant={isActive ? 'muted' : 'default'}
        density="compact"
        padding="none"
        className="nc-layer-row flex-nowrap"
        style={{ marginInlineStart: depth * 14, width: `calc(100% - ${depth * 14}px)` }}
      >
        {isRow || isGrid || isComposable || hasBlockList ? (
          <UIAction
            buttonStyle="ghost"
            iconOnly
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${labelOf(block)}`}
            aria-expanded={expanded}
            className="shrink-0"
          >
            {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          </UIAction>
        ) : isColumn ? (
          <span className="h-2.5 w-2.5 shrink-0" />
        ) : (
          <UIAction
            buttonStyle="ghost"
            iconOnly
            size="sm"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${labelOf(block)}`}
            className="shrink-0 cursor-grab"
          >
            <GripVertical className="h-2.5 w-2.5" />
          </UIAction>
        )}

        {renaming ? (
          <Input
            autoFocus
            aria-label={`Rename ${labelOf(block)}`}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="flex-1 min-w-0"
          />
        ) : (
          <TooltipProvider delay={600}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <UIAction buttonStyle="ghost" size="sm" truncate className="flex-1 min-w-0 justify-start" />
                }
                onClick={(e) => setActiveBlock(block.id, { additive: e.shiftKey })}
                aria-pressed={isActive}
              >
                {labelOf(block, { index })}
              </TooltipTrigger>
              {!renaming && (
                <TooltipContent side="right" className="max-w-[180px]">
                  {labelOf(block, { index })}
                  {blockDescription ? ` — ${blockDescription}` : ''}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        {!isColumn && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0"
              aria-label={`Actions for ${labelOf(block)}`}
              render={<UIAction buttonStyle="ghost" size="sm" iconOnly />}
            >
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28 min-w-0">
              <DropdownMenuItem onClick={handleRename} className="">
                <Pencil className="h-3 w-3" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate} className="">
                <Copy className="h-3 w-3" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} variant="destructive">
                <Trash2 className="h-3 w-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Item>

      {showIndicatorAfter && <InsertionLine depth={depth} />}

      {/* Composable children (bio, hero, quote, callout) — not draggable, just selectable */}
      {isComposable &&
        expanded &&
        (() => {
          const compChildIds = getBlockListChildIds({ blocks, sections: [] as any, columnBlocks }, block.id)
          const compChildren = compChildIds.map((id) => blocks[id]).filter(Boolean)
          return compChildren.map((child) => (
            <ComposableChildRow key={child.id} block={child} depth={depth + 1} />
          ))
        })()}

      {/* Block-list children (section blocks with managed children) */}
      {hasBlockList &&
        expanded &&
        (() => {
          const listChildIds = getBlockListChildIds({ blocks, sections: [] as any, columnBlocks }, block.id)
          const listChildren = listChildIds.map((id) => blocks[id]).filter(Boolean)
          const sortableChildIds = listChildIds.map((id) => `col:${block.id}:${id}`)

          return (
            <ColumnDropZone
              columnId={block.id}
              isDropTarget={
                !!(
                  indicator &&
                  (indicator.overId === `column-drop:${block.id}` || indicator.zone === block.id)
                )
              }
            >
              <SortableContext items={sortableChildIds} strategy={verticalListSortingStrategy}>
                {listChildren.map((child) => (
                  <SortableElementRow
                    key={child.id}
                    block={child}
                    depth={depth + 1}
                    context={{ type: 'column', columnId: block.id }}
                    indicator={indicator}
                    activeDragBlockId={activeDragBlockId}
                  />
                ))}
              </SortableContext>
              {indicator &&
                indicator.overId === `column-drop:${block.id}` &&
                indicator.position === 'inside' && <InsertionLine depth={depth + 1} />}
            </ColumnDropZone>
          )
        })()}

      {/* Row children */}
      {isRow &&
        expanded &&
        columnIds.map((colId, colIndex) => {
          const colBlock = blocks[colId]
          if (!colBlock) return null
          const childIds = getBlockListChildIds({ blocks, sections: [] as any, columnBlocks }, colId)
          const childBlocks = childIds.map((id) => blocks[id]).filter(Boolean)
          const sortableChildIds = childIds.map((id) => `col:${colId}:${id}`)

          // Is this column the current drop target?
          const isColDropTarget =
            indicator && (indicator.overId === `column-drop:${colId}` || indicator.zone === colId)

          // "inside" indicator = dropping into an empty column
          const showInsideIndicator =
            indicator && indicator.overId === `column-drop:${colId}` && indicator.position === 'inside'

          return (
            <ColumnDropZone key={colId} columnId={colId} isDropTarget={!!isColDropTarget}>
              <SortableElementRow
                block={colBlock}
                depth={depth + 1}
                context={{ type: 'section', sectionId: activeSectionId! }}
                indicator={indicator}
                activeDragBlockId={activeDragBlockId}
                index={colIndex}
              />
              <SortableContext items={sortableChildIds} strategy={verticalListSortingStrategy}>
                {childBlocks.map((child) => (
                  <SortableElementRow
                    key={child.id}
                    block={child}
                    depth={depth + 2}
                    context={{ type: 'column', columnId: colId }}
                    indicator={indicator}
                    activeDragBlockId={activeDragBlockId}
                  />
                ))}
              </SortableContext>
              {/* Indicator for empty column or "append to end" */}
              {showInsideIndicator && <InsertionLine depth={depth + 2} />}
            </ColumnDropZone>
          )
        })}

      {isGrid &&
        expanded &&
        cellIds.map((cellId, cellIndex) => {
          const cellBlock = blocks[cellId]
          if (!cellBlock) return null
          const childIds = getBlockListChildIds({ blocks, sections: [] as any, columnBlocks }, cellId)
          const childBlocks = childIds.map((id) => blocks[id]).filter(Boolean)
          const sortableChildIds = childIds.map((id) => `col:${cellId}:${id}`)

          const isCellDropTarget =
            indicator && (indicator.overId === `column-drop:${cellId}` || indicator.zone === cellId)

          const showInsideIndicator =
            indicator && indicator.overId === `column-drop:${cellId}` && indicator.position === 'inside'

          return (
            <ColumnDropZone key={cellId} columnId={cellId} isDropTarget={!!isCellDropTarget}>
              <SortableElementRow
                block={cellBlock}
                depth={depth + 1}
                context={{ type: 'section', sectionId: activeSectionId! }}
                indicator={indicator}
                activeDragBlockId={activeDragBlockId}
                index={cellIndex}
              />
              <SortableContext items={sortableChildIds} strategy={verticalListSortingStrategy}>
                {childBlocks.map((child) => (
                  <SortableElementRow
                    key={child.id}
                    block={child}
                    depth={depth + 2}
                    context={{ type: 'column', columnId: cellId }}
                    indicator={indicator}
                    activeDragBlockId={activeDragBlockId}
                  />
                ))}
              </SortableContext>
              {showInsideIndicator && <InsertionLine depth={depth + 2} />}
            </ColumnDropZone>
          )
        })}
    </div>
  )
}

// ── Composable Child Row (not draggable, just selectable) ─────
function ComposableChildRow({ block, depth }: { block: Block; depth: number }) {
  const { activeBlockIds } = useSelectionState()
  const { setActiveBlock } = useSelectionActions()
  const { updateBlockCommonSettings } = useBlockActions()
  const isActive = activeBlockIds.includes(block.id)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const handleRename = () => {
    setRenaming(true)
    setRenameValue(block.commonSettings?.alias || '')
  }

  const commitRename = () => {
    const alias = renameValue.trim() || undefined
    updateBlockCommonSettings(block.id, { alias })
    setRenaming(false)
  }

  return (
    <Item
      variant={isActive ? 'muted' : 'default'}
      density="compact"
      padding="none"
      className="nc-layer-row flex-nowrap"
      style={{ marginInlineStart: depth * 14, width: `calc(100% - ${depth * 14}px)` }}
    >
      {renaming ? (
        <Input
          autoFocus
          aria-label={`Rename ${labelOf(block)}`}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenaming(false)
          }}
          className="flex-1 min-w-0"
        />
      ) : (
        <UIAction
          buttonStyle="ghost"
          onClick={(e) => setActiveBlock(block.id, { additive: e.shiftKey })}
          aria-pressed={isActive}
          size="sm"
          className="flex-1 min-w-0 justify-start"
        >
          {labelOf(block)}
        </UIAction>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="shrink-0"
          aria-label={`Actions for ${labelOf(block)}`}
          render={<UIAction buttonStyle="ghost" size="sm" iconOnly />}
        >
          <MoreHorizontal className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-28 min-w-0">
          <DropdownMenuItem onClick={handleRename} className="">
            <Pencil className="h-3 w-3" /> Rename
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Item>
  )
}

// ── Column Drop Zone ──────────────────────────────────────────
function ColumnDropZone({
  columnId,
  isDropTarget,
  children,
}: {
  columnId: string
  isDropTarget?: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: `column-drop:${columnId}`,
    data: { type: 'column-drop', columnId },
  })

  return (
    <div ref={setNodeRef} className={cn('rounded-radius transition-colors', isDropTarget && 'bg-accent')}>
      {children}
    </div>
  )
}

// ── Page Drop Zone ────────────────────────────────────────────
function PageDropZone({
  children,
  isDropTarget,
  showEndIndicator,
}: {
  children: React.ReactNode
  isDropTarget?: boolean
  showEndIndicator?: boolean
}) {
  const { setNodeRef } = useDroppable({
    id: 'page-drop',
    data: { type: 'page-drop' },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn('rounded-radius transition-colors min-h-[20px]', isDropTarget && 'bg-accent')}
    >
      {children}
      {showEndIndicator && <InsertionLine depth={0} />}
    </div>
  )
}

// ── Drag Overlay ──────────────────────────────────────────────
function DragOverlayContent({ blockId }: { blockId: string }) {
  const blocks = useDocumentState((state) => state.blocks)
  const block = blocks[blockId]
  if (!block) return null
  const Icon = iconFor(block.type)

  return (
    <Item
      title={labelOf(block)}
      media={<Icon aria-hidden />}
      mediaVariant="icon"
      variant="outline"
      density="compact"
      padding="default"
      className="flex-nowrap bg-popover shadow-lg"
    />
  )
}

// ── Custom collision detection ────────────────────────────────
//
// Priority:
// 1. Column-child sortable items (col:xxx:yyy) — precise within-column targeting
// 2. Column drop zones (column-drop:xxx) — empty column or "append to column"
// 3. Page-level sortable items — page reorder
// 4. Page drop zone — "pull out of column to page"
// 5. rectIntersection fallback
//
const customCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length === 0) return rectIntersection(args)

  // Bucket by type
  const columnChildren: typeof pointerCollisions = []
  const columnDropZones: typeof pointerCollisions = []
  const pageSortables: typeof pointerCollisions = []
  const pageDropZone: typeof pointerCollisions = []

  for (const c of pointerCollisions) {
    const id = String(c.id)
    if (isColumnChildId(id)) columnChildren.push(c)
    else if (id.startsWith('column-drop:')) columnDropZones.push(c)
    else if (id === 'page-drop') pageDropZone.push(c)
    else pageSortables.push(c)
  }

  // Return the highest-priority non-empty bucket
  if (columnChildren.length > 0) return columnChildren
  if (columnDropZones.length > 0) return columnDropZones
  if (pageSortables.length > 0) return pageSortables
  if (pageDropZone.length > 0) return pageDropZone

  return rectIntersection(args)
}

// ── Main Component ────────────────────────────────────────────
export function PageElements({ sectionId }: { sectionId?: string }) {
  const { activeSectionId: focusedSectionId, sections } = useSectionState()
  const activeSectionId = sectionId ?? focusedSectionId
  const blocks = useDocumentState((state) => state.blocks)
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const { reorderBlocks } = useBlockActions()
  const { reorderColumnBlocks, moveBlockBetweenColumns, moveBlockToColumn, moveBlockToSection } =
    useContainerActions()
  const activeSection = sections.find((s: { id: string }) => s.id === activeSectionId)
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null)
  const [indicator, setIndicator] = useState<DragIndicator | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!activeSection) return null

  const mainPageBlockIds = getSectionRootIds(activeSection)
  const pageBlocks = mainPageBlockIds.map((id) => blocks[id]).filter(Boolean)
  if (pageBlocks.length === 0)
    return <Text size="sm" type="secondary">This section is empty.</Text>

  // ── Compute indicator from over event ──
  const computeIndicator = (overId: string | null, activeId: string | null): DragIndicator | null => {
    if (!overId || !activeId) return null
    const overStr = String(overId)
    const activeParsed = parseSortableId(String(activeId))
    const draggedBlock = blocks[activeParsed.blockId]
    if (!draggedBlock) return null

    // Dropping onto a column drop zone → "inside" (empty) or "after last child"
    if (overStr.startsWith('column-drop:')) {
      const colId = overStr.replace('column-drop:', '')
      // Validate placement
      if (!canPlaceIn(draggedBlock.type, 'column')) return null
      // Don't show indicator if dragging within same column (no-op)
      if (activeParsed.columnId === colId) return null
      return { overId: overStr, zone: colId, position: 'inside' }
    }

    // Dropping onto page drop zone
    if (overStr === 'page-drop') {
      if (activeParsed.columnId) {
        return { overId: overStr, zone: 'page', position: 'after' }
      }
      return null // already on page
    }

    // Dropping onto a sortable item
    const overParsed = parseSortableId(overStr)
    const overBlock = blocks[overParsed.blockId]
    if (!overBlock) return null

    // Determine zone
    const zone = overParsed.columnId || 'page'

    // Determine position: if the dragged item is BEFORE the target in the same list → 'after', else 'before'
    const sameContainer = activeParsed.columnId === overParsed.columnId
    if (sameContainer) {
      let list: string[]
      if (overParsed.columnId) {
        list = getBlockListChildIds({ blocks, sections: sections as any, columnBlocks }, overParsed.columnId)
      } else {
        list = mainPageBlockIds
      }
      const activeIdx = list.indexOf(activeParsed.blockId)
      const overIdx = list.indexOf(overParsed.blockId)
      return { overId: overStr, zone, position: activeIdx < overIdx ? 'after' : 'before' }
    }

    // Cross-container: show 'before' the target by default
    return { overId: overStr, zone, position: 'before' }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id ? String(event.over.id) : null
    const activeId = activeDragId ? String(activeDragId) : null
    setIndicator(computeIndicator(overId, activeId))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    setIndicator(null)

    const { active, over } = event
    if (!over || active.id === over.id || !activeSectionId) return

    const activeStr = String(active.id)
    const overStr = String(over.id)
    const activeParsed = parseSortableId(activeStr)
    const block = blocks[activeParsed.blockId]
    if (!block) return

    // Rows can't enter columns
    if (isStructuralType(block.type)) {
      const overParsed = parseSortableId(overStr)
      const oldIndex = mainPageBlockIds.indexOf(activeParsed.blockId)
      const newIndex = mainPageBlockIds.indexOf(overParsed.blockId)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderBlocks(activeSectionId, oldIndex, newIndex)
      }
      return
    }

    const sourceColumnId = activeParsed.columnId

    // ── Column drop zone ──
    if (overStr.startsWith('column-drop:')) {
      const targetColId = overStr.replace('column-drop:', '')
      if (!canPlaceIn(block.type, 'column')) return
      if (sourceColumnId === targetColId) return // same column no-op

      if (!sourceColumnId) {
        moveBlockToColumn(
          activeParsed.blockId,
          activeSectionId,
          targetColId,
          getBlockListChildIds({ blocks, sections: sections as any, columnBlocks }, targetColId).length,
        )
      } else {
        moveBlockBetweenColumns(
          activeParsed.blockId,
          sourceColumnId,
          targetColId,
          getBlockListChildIds({ blocks, sections: sections as any, columnBlocks }, targetColId).length,
        )
      }
      return
    }

    // ── Page drop zone ──
    if (overStr === 'page-drop') {
      if (sourceColumnId) {
        moveBlockToSection(activeParsed.blockId, sourceColumnId, activeSectionId, mainPageBlockIds.length)
      }
      return
    }

    // ── Sortable item ──
    const overParsed = parseSortableId(overStr)
    const targetColumnId = overParsed.columnId

    // Same container reorder
    if (sourceColumnId === targetColumnId) {
      if (!sourceColumnId) {
        const oldIndex = mainPageBlockIds.indexOf(activeParsed.blockId)
        const newIndex = mainPageBlockIds.indexOf(overParsed.blockId)
        if (oldIndex !== -1 && newIndex !== -1) reorderBlocks(activeSectionId, oldIndex, newIndex)
      } else {
        const list = getBlockListChildIds({ blocks, sections: sections as any, columnBlocks }, sourceColumnId)
        const oldIndex = list.indexOf(activeParsed.blockId)
        const newIndex = list.indexOf(overParsed.blockId)
        if (oldIndex !== -1 && newIndex !== -1) reorderColumnBlocks(sourceColumnId, oldIndex, newIndex)
      }
      return
    }

    // column → page
    if (sourceColumnId && !targetColumnId) {
      const targetIndex = mainPageBlockIds.indexOf(overParsed.blockId)
      if (targetIndex !== -1)
        moveBlockToSection(activeParsed.blockId, sourceColumnId, activeSectionId, targetIndex)
      return
    }

    // page → column
    if (!sourceColumnId && targetColumnId) {
      if (!canPlaceIn(block.type, 'column')) return
      const list = getBlockListChildIds({ blocks, sections: sections as any, columnBlocks }, targetColumnId)
      const targetIndex = list.indexOf(overParsed.blockId)
      moveBlockToColumn(
        activeParsed.blockId,
        activeSectionId,
        targetColumnId,
        targetIndex !== -1 ? targetIndex : list.length,
      )
      return
    }

    // column → different column
    if (sourceColumnId && targetColumnId && sourceColumnId !== targetColumnId) {
      const list = getBlockListChildIds({ blocks, sections: sections as any, columnBlocks }, targetColumnId)
      const targetIndex = list.indexOf(overParsed.blockId)
      moveBlockBetweenColumns(
        activeParsed.blockId,
        sourceColumnId,
        targetColumnId,
        targetIndex !== -1 ? targetIndex : list.length,
      )
    }
  }

  const activeDragBlockId = activeDragId ? parseSortableId(String(activeDragId)).blockId : null

  // Page drop zone should show end-indicator when dragging from a column and hovering page-drop
  const showPageEndIndicator = indicator?.overId === 'page-drop' && indicator?.position === 'after'
  const isPageDropTarget =
    indicator?.zone === 'page' && !!activeDragId && !!parseSortableId(String(activeDragId)).columnId

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <PageDropZone isDropTarget={isPageDropTarget} showEndIndicator={showPageEndIndicator}>
          <SortableContext items={mainPageBlockIds} strategy={verticalListSortingStrategy}>
            {pageBlocks.map((block) => (
              <SortableElementRow
                key={block.id}
                block={block}
                context={{ type: 'section', sectionId: activeSection.id }}
                indicator={indicator}
                activeDragBlockId={activeDragBlockId}
              />
            ))}
          </SortableContext>
        </PageDropZone>
        <DragOverlay dropAnimation={null}>
          {activeDragBlockId ? <DragOverlayContent blockId={activeDragBlockId} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}
