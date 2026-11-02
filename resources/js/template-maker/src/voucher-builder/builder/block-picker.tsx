import type { LucideIcon } from 'lucide-react'
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from 'themelia-react-ui/base/command'

export interface BlockPickerItem {
  id: string
  name: string
  description: string
  category: string
  icon?: LucideIcon
  disabled?: boolean
}

/** Shared voucher/template choice surface; callers supply definitions and own insertion. */
export function BlockPicker({ items, onSelect }: { items: BlockPickerItem[]; onSelect: (id: string) => void }) {
  const categories = [...new Set(items.map(item => item.category))]
  return <Command filter={(id, search) => {
    const item = items.find(item => item.id === id)
    return item && `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
  }}>
    <CommandInput aria-label="Search blocks" placeholder="Search blocks…" />
    <CommandList>
      <CommandEmpty>No matching blocks</CommandEmpty>
      {categories.map(category => <CommandGroup key={category} heading={category}>
        {items.filter(item => item.category === category).map(item => <CommandItem key={item.id} value={item.id} title={item.description} disabled={item.disabled} onSelect={() => onSelect(item.id)}>
          {item.icon && <item.icon aria-hidden />}{item.name}
        </CommandItem>)}
      </CommandGroup>)}
    </CommandList>
  </Command>
}
