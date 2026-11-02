import { useState } from 'react'
import { Button } from 'themelia-react-ui/base/buttons'
import { Popover, PopoverContent, PopoverTrigger } from 'themelia-react-ui/base/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'themelia-react-ui/base/command'
import { iconRegistry, iconCategories, getIcon } from '../lib/icons'
interface IconPickerProps {
  control?: { id?: string; 'aria-label'?: string; 'aria-describedby'?: string }
  value: string
  onChange: (key: string) => void
  className?: string
  disabled?: boolean
}
export function IconPicker({ value, onChange, className, disabled, control }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const CurrentIcon = getIcon(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            {...control}
            disabled={disabled}
            className={className}
            aria-label={control?.['aria-label'] ?? 'Choose icon'}
            icon={CurrentIcon ?? undefined}
          />
        }
      >
        {value || 'None'}
      </PopoverTrigger>
      <PopoverContent type="menu" inset="flush" align="start">
        <Command
          filter={(key, search) => {
            const icon = iconRegistry.find((icon) => icon.key === key)
            return !search ||
              `${key} ${icon?.label ?? ''} ${icon?.category ?? ''}`
                .toLowerCase()
                .includes(search.toLowerCase())
              ? 1
              : 0
          }}
        >
          <CommandInput aria-label="Search icons" placeholder="Search icons…" />
          <CommandList>
            <CommandEmpty>No matching icons</CommandEmpty>
            <CommandItem
              value="none"
              onSelect={() => {
                onChange('none')
                setOpen(false)
              }}
            >
              None
            </CommandItem>
            {iconCategories.map((category) => (
              <CommandGroup key={category} heading={category}>
                {iconRegistry
                  .filter((icon) => icon.category === category)
                  .map((icon) => (
                    <CommandItem
                      key={icon.key}
                      value={icon.key}
                      data-checked={value === icon.key}
                      onSelect={() => {
                        onChange(icon.key)
                        setOpen(false)
                      }}
                    >
                      <icon.icon aria-hidden />
                      {icon.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
