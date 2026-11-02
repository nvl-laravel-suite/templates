import { BlockPicker } from './block-picker'
import { getAllBlockDefs, BLOCK_CATEGORIES } from '../blocks'
import '../blocks/definitions'
import type { BlockType } from '../schema'
interface QuickBlockPickerProps {
  context?: 'page' | 'column'
  onSelect: (type: BlockType) => void
  variant?: 'grid' | 'list'
}
/** A searchable choice list; Command owns focus, filtering and keyboard selection. */
export function QuickBlockPicker({ context = 'page', onSelect }: QuickBlockPickerProps) {
  const definitions = getAllBlockDefs().filter((def) => !def.hidden && def.allowedIn.includes(context))
  return <BlockPicker items={BLOCK_CATEGORIES.flatMap(category => definitions.filter(def => def.category === category.key).map(def => ({
    id: def.type, name: def.name, description: def.description, category: category.label, icon: def.icon,
  })))} onSelect={id => onSelect(id as BlockType)} />
}
