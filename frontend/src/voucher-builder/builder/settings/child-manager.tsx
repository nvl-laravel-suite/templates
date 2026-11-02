import { Card } from 'themelia-react-ui/base/cards'
import { Badge } from 'themelia-react-ui/base/badge'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { useVoucherActions, useVoucherProject } from '../../hooks/use-voucher-builder'
import { useId } from 'react'
import type { Block, BlockType } from '#/voucher-builder/schema'
import { getAllBlockDefs, labelOf } from '#/voucher-builder/blocks'
import { Trash2, Plus, GripVertical } from 'lucide-react'
import { SettingBlock } from './primitives/setting-block'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

interface ChildManagerProps {
  blockId: string
  /** Single child type for simple sections, or array/function for multi-type sections */
  childType: BlockType | BlockType[]
  labelField: string
  aliasPrefix: string
  addButtonLabel: string
  block: any
  onUpdate: (u: Partial<Block>) => void
  /** Group title (default: "Entries") */
  title?: string
}

function SortableChildRow({
  id,
  index,
  label,
  onRemove,
}: {
  id: string
  index: number
  label: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      surface="card"
      padding="md"
      title={label}
      titleSuffix={<Badge>{index + 1}</Badge>}
      headerEnd={
        <UIAction
          iconOnly
          buttonStyle="ghost"
          type="button"
          className="cursor-grab touch-none"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${label}`}
        >
          <GripVertical />
        </UIAction>
      }
      headerAction={
        <UIAction
          iconOnly
          buttonStyle="ghost"
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <Trash2 />
        </UIAction>
      }
    />
  )
}

export function ChildManager({
  blockId,
  childType,
  labelField,
  aliasPrefix,
  addButtonLabel,
  title = 'Entries',
}: ChildManagerProps) {
  const actions = useVoucherActions()
  const childIds = useVoucherProject((project) => project.columnBlocks[blockId] ?? [])
  const blocks = useVoucherProject((project) => project.blocks)
  const isSingleType = typeof childType === 'string'
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const syncChildren = () => {
    const project = actions.getProject()
    const parent = project.blocks[blockId]
    if (parent)
      actions.updateBlock(blockId, {
        content: { ...parent.content, childIds: project.columnBlocks[blockId] ?? [] },
      } as Partial<Block>)
  }
  const addChild = (type: BlockType) =>
    actions.transaction((commands) => {
      commands.addBlockToColumn(blockId, type)
      const ids = commands.getProject().columnBlocks[blockId] ?? []
      const newId = ids.at(-1)
      if (newId) commands.updateBlockCommonSettings(newId, { alias: `${aliasPrefix} ${ids.length}` })
      syncChildren()
    })
  const removeChild = (id: string) =>
    actions.transaction((commands) => {
      commands.removeBlockFromColumn(blockId, id)
      syncChildren()
    })
  const reorderChildren = (from: number, to: number) =>
    actions.transaction((commands) => {
      commands.reorderColumnBlocks(blockId, from, to)
      syncChildren()
    })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = childIds.indexOf(active.id as string)
    const newIndex = childIds.indexOf(over.id as string)
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderChildren(oldIndex, newIndex)
    }
  }

  return (
    <SettingBlock label={title} display="inline">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          <UIStack gap="md">
            {childIds.map((id: string, index: number) => {
              const child = blocks[id]
              if (!child) return null
              const label =
                child.commonSettings?.alias ||
                ((child.content as Record<string, unknown>)[labelField] as string) ||
                labelOf(child)
              return (
                <SortableChildRow
                  key={id}
                  id={id}
                  index={index}
                  label={label}
                  onRemove={() => removeChild(id)}
                />
              )
            })}
          </UIStack>
        </SortableContext>
      </DndContext>
      {isSingleType ? (
        <UIAction buttonStyle="ghost" onClick={() => addChild(childType as BlockType)} className="w-full">
          <Plus className="h-3.5 w-3.5" /> {addButtonLabel}
        </UIAction>
      ) : (
        <MultiTypeAdder types={childType as BlockType[]} onAdd={addChild} />
      )}
    </SettingBlock>
  )
}

/** Renders a row of small buttons for adding multiple child types */
function MultiTypeAdder({ types, onAdd }: { types: BlockType[]; onAdd: (type: BlockType) => void }) {
  const allDefs = getAllBlockDefs()
  const typeSet = new Set(types)

  return (
    <UIStack direction="horizontal" gap="sm" wrap={true} className="">
      {allDefs
        .filter((d) => typeSet.has(d.type as BlockType))
        .map((def) => (
          <UIAction buttonStyle="ghost" key={def.type} onClick={() => onAdd(def.type as BlockType)}>
            + {def.name}
          </UIAction>
        ))}
    </UIStack>
  )
}
