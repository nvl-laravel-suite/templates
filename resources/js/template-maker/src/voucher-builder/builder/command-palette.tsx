import { useMemo, useState, useEffect } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'themelia-react-ui/base/command'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { buildCommands, fuzzyMatch, type CommandContext } from '../lib/commands'

export function CommandPalette({
  open,
  onClose,
  context,
}: {
  open: boolean
  onClose: () => void
  context: CommandContext
}) {
  const [search, setSearch] = useState('')
  const commands = useMemo(() => buildCommands(context), [context])
  const groups = useMemo(() => [...new Set(commands.map((command) => command.category))], [commands])
  useEffect(() => {
    if (open) setSearch('')
  }, [open])
  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Find a command"
      visuallyHideHeader
      showCloseButton={false}
      showConfirm={false}
      strings={{ cancel: 'Close commands' }}
    >
      <Command
        filter={(value, search) => {
          const command = commands.find((command) => command.id === value)
          return command &&
            (fuzzyMatch(search, command.label) ||
              Boolean(command.keywords && fuzzyMatch(search, command.keywords)))
            ? 1
            : 0
        }}
      >
        <CommandInput
          aria-label="Search commands"
          placeholder="Type a command…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No commands found</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {commands
                .filter((command) => command.category === group)
                .map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => {
                      onClose()
                      requestAnimationFrame(() => command.action())
                    }}
                  >
                    {command.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </ActionDialog>
  )
}
