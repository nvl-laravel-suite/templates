import { Card } from 'themelia-react-ui/base/cards'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { type ReactNode, useCallback, useId } from 'react'
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
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { SettingBlock } from './primitives/setting-block'

interface ItemListEditorProps<T> {
  items: T[]
  onUpdate: (items: T[]) => void
  renderItem: (item: T, index: number, setField: (key: string, value: unknown) => void) => ReactNode
  createItem: () => T
  labelFn: (item: T) => string
  title: string
  addLabel: string
  maxItems?: number
  reorderable?: boolean
}

function SortableItem<T>({
  id,
  index,
  item,
  labelFn,
  renderItem,
  setField,
  onRemove,
  reorderable,
}: {
  id: string
  index: number
  item: T
  labelFn: (item: T) => string
  renderItem: (item: T, index: number, setField: (key: string, value: unknown) => void) => ReactNode
  setField: (key: string, value: unknown) => void
  onRemove: () => void
  reorderable: boolean
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
      title={labelFn(item)}
      headerEnd={
        reorderable ? (
          <UIAction
            iconOnly
            buttonStyle="ghost"
            type="button"
            className="cursor-grab touch-none"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${labelFn(item)}`}
          >
            <GripVertical />
          </UIAction>
        ) : undefined
      }
      headerAction={
        <UIAction
          iconOnly
          buttonStyle="ghost"
          type="button"
          aria-label={`Remove ${labelFn(item)}`}
          onClick={onRemove}
        >
          <Trash2 />
        </UIAction>
      }
    >
      <UIStack gap="lg">{renderItem(item, index, setField)}</UIStack>
    </Card>
  )
}

export function ItemListEditor<T extends Record<string, unknown>>({
  items,
  onUpdate,
  renderItem,
  createItem,
  labelFn,
  title,
  addLabel,
  maxItems,
  reorderable = true,
}: ItemListEditorProps<T>) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const itemIds = items.map((_, i) => `item-${i}`)

  const handleAdd = useCallback(() => {
    if (maxItems !== undefined && items.length >= maxItems) return
    onUpdate([...items, createItem()])
  }, [items, onUpdate, createItem, maxItems])

  const handleRemove = useCallback(
    (index: number) => {
      onUpdate(items.filter((_, i) => i !== index))
    },
    [items, onUpdate],
  )

  const handleSetField = useCallback(
    (index: number, key: string, value: unknown) => {
      const next = [...items]
      next[index] = { ...next[index], [key]: value }
      onUpdate(next)
    },
    [items, onUpdate],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = itemIds.indexOf(active.id as string)
      const newIndex = itemIds.indexOf(over.id as string)
      if (oldIndex >= 0 && newIndex >= 0) onUpdate(arrayMove(items, oldIndex, newIndex))
    },
    [items, onUpdate, itemIds],
  )

  const canAdd = maxItems === undefined || items.length < maxItems

  return (
    <SettingBlock label={title} display="inline">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <UIStack gap="2xl">
            {items.map((item, index) => (
              <SortableItem
                key={itemIds[index]}
                id={itemIds[index]}
                index={index}
                item={item}
                labelFn={labelFn}
                renderItem={renderItem}
                setField={(key, value) => handleSetField(index, key, value)}
                onRemove={() => handleRemove(index)}
                reorderable={reorderable}
              />
            ))}
          </UIStack>
        </SortableContext>
      </DndContext>
      {canAdd && (
        <UIAction buttonStyle="ghost" type="button" onClick={handleAdd} className="w-full">
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </UIAction>
      )}
    </SettingBlock>
  )
}
