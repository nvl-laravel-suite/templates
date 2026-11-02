import { useState } from 'react'
import { Button } from 'themelia-react-ui/base/buttons'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '../ui/command'
import { fontRegistry, loadFont, type FontEntry } from '../lib/fonts'
import { ChevronsUpDown } from 'lucide-react'

interface FontPickerProps {
  value: string
  onChange: (value: string) => void
}

const categories: { key: FontEntry['category']; label: string }[] = [
  { key: 'sans', label: 'Sans Serif' },
  { key: 'serif', label: 'Serif' },
  { key: 'mono', label: 'Monospace' },
  { key: 'display', label: 'Display' },
]

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button className="w-full justify-between" aria-label="Choose font" />}>
        <span style={{ fontFamily: `"${value}", sans-serif` }}>{value}</span>
        <ChevronsUpDown data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent type="menu" inset="flush" className="w-[240px]" align="start">
        <Command>
          <CommandInput placeholder="Search fonts..." />
          <CommandList>
            <CommandEmpty>No font found.</CommandEmpty>
            {categories.map(({ key, label }) => {
              const fonts = fontRegistry.filter((f) => f.category === key)
              return (
                <CommandGroup key={key} heading={label}>
                  {fonts.map((font) => (
                    <CommandItem
                      key={font.name}
                      value={font.name}
                      data-checked={value === font.name ? 'true' : undefined}
                      onSelect={() => {
                        loadFont(font.name)
                        onChange(font.name)
                        setOpen(false)
                      }}
                      onMouseEnter={() => loadFont(font.name)}
                    >
                      <span style={{ fontFamily: `"${font.name}", ${font.fallback}` }}>{font.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
