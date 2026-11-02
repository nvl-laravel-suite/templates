import { Badge } from 'themelia-react-ui/base/badge'
import { ActionDialog } from 'themelia-react-ui/features/overlays'
import { Stack } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
const mod = isMac ? '⌘' : 'Ctrl'

interface Capabilities {
  commands: boolean
  history: boolean
  clipboard: boolean
  editing: boolean
}
type Requirement = keyof Capabilities
const groups: {
  title: string
  requires?: Requirement[]
  shortcuts: { keys: string; label: string; requires?: Requirement[] }[]
}[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: `${mod}+K`, label: 'Command palette', requires: ['commands'] },
      { keys: `${mod}+Z`, label: 'Undo', requires: ['history', 'editing'] },
      { keys: `${mod}+Shift+Z`, label: 'Redo', requires: ['history', 'editing'] },
      { keys: '?', label: 'Keyboard shortcuts' },
      { keys: 'Escape', label: 'Deselect block / Close dialog' },
    ],
  },
  {
    title: 'Block Actions',
    requires: ['editing'],
    shortcuts: [
      { keys: `${mod}+C`, label: 'Copy block', requires: ['clipboard'] },
      { keys: `${mod}+X`, label: 'Cut block', requires: ['clipboard'] },
      { keys: `${mod}+V`, label: 'Paste block', requires: ['clipboard'] },
      { keys: `${mod}+D`, label: 'Duplicate block' },
      { keys: 'Delete', label: 'Delete block' },
    ],
  },
  {
    title: 'Navigation',
    requires: ['editing'],
    shortcuts: [{ keys: '↑ / ↓', label: 'Navigate blocks' }],
  },
  {
    title: 'Editing',
    requires: ['editing'],
    shortcuts: [
      { keys: 'Double-click', label: 'Edit text inline' },
      { keys: `${mod}+B`, label: 'Bold selection' },
      { keys: `${mod}+I`, label: 'Italic selection' },
      { keys: `${mod}+U`, label: 'Underline selection' },
      { keys: `${mod}+K`, label: 'Add link' },
      { keys: 'Enter', label: 'Commit single-line edit' },
      { keys: 'Escape', label: 'Cancel inline edit' },
    ],
  },
]

export function ShortcutLegend({
  open,
  onClose,
  capabilities,
}: {
  open: boolean
  onClose: () => void
  capabilities: Capabilities
}) {
  if (!open) return null
  const available = (requires: Requirement[] = []) => requires.every((key) => capabilities[key])
  const visibleGroups = groups
    .filter((group) => available(group.requires))
    .map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((shortcut) => available(shortcut.requires)),
    }))
    .filter((group) => group.shortcuts.length)

  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Keyboard shortcuts"
      size="md"
      showConfirm={false}
      showCancel={false}
    >
      <Stack gap="xl" className="max-h-[65vh] overflow-auto">
        {visibleGroups.map((group) => (
          <Stack key={group.title} gap="md">
            <Heading tag="h3" size="sm">
              {group.title}
            </Heading>
            <Stack gap="md">
              {group.shortcuts.map((s) => (
                <Stack
                  key={s.label}
                  direction="horizontal"
                  gap="md"
                  align="center"
                  justify="between"
                  wrap={false}
                >
                  <Text size="sm">{s.label}</Text>
                  <Stack direction="horizontal" gap="xs" wrap={false}>
                    {s.keys.split('+').map((key, i) => (
                      <kbd key={i}>
                        <Badge size="sm">
                          <code>{key}</code>
                        </Badge>
                      </kbd>
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </ActionDialog>
  )
}
