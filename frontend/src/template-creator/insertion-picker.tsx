import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from 'themelia-react-ui/base/buttons'
import { Popover, PopoverContent, PopoverTrigger } from 'themelia-react-ui/base/popover'
import { BlockPicker } from '../voucher-builder/builder/block-picker'
import { useTemplateActions, useTemplateDocument } from './hooks'
import type { TemplateInsertPreset } from '../template-core/presets'
import { templateInsertionParent } from './insertion'

/** Grouped commands reuse the voucher picker. PopoverMenu does not expose grouped options. */
export function InsertionPicker({ presets, selectedId, disabled, canInsert, run }: {
  presets: TemplateInsertPreset[]
  selectedId: string | null
  canInsert?: (parentId: string | null) => boolean
  disabled: boolean
  run: (task: () => unknown) => void
}) {
  const actions = useTemplateActions()
  const template = useTemplateDocument()
  const [open, setOpen] = useState(false)
  const items = [
    ...presets.map((preset, index) => {
      const parentId = templateInsertionParent(template, selectedId, preset.fragment)
      return { id: `preset:${index}`, name: preset.name, description: preset.description, category: preset.category, disabled: parentId === undefined || Boolean(canInsert && !canInsert(parentId)) }
    }),
    ...template.blocks.map((block, index) => ({ id: `block:${index}`, name: `${block.name} · v${block.version}`, description: 'Insert this pinned reusable block revision.', category: 'Reusable blocks', disabled: Boolean(canInsert && !canInsert(templateInsertionParent(template, selectedId) ?? null)) })),
  ]
  const unavailable = disabled || !items.some(item => !item.disabled)
  return <Popover open={open && !unavailable} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button aria-label="Insert element" disabled={unavailable} />}><Plus />Insert block</PopoverTrigger>
    <PopoverContent aria-label="Building blocks" inset="flush" align="start" className="w-80 max-w-[calc(100vw-2rem)]">
      <BlockPicker items={items} onSelect={id => run(() => {
        // A stale popup cannot bypass current family insertion capabilities.
        if (unavailable || items.find(item => item.id === id)?.disabled) return
        const [kind, index] = id.split(':')
        if (kind === 'preset') {
          const fragment = presets[Number(index)].fragment
          const parentId = templateInsertionParent(template, selectedId, fragment)
          if (parentId === undefined) return
          actions.insertFragment(fragment, parentId)
        } else { const block = template.blocks[Number(index)]; actions.insertBlock(block.id, block.version, templateInsertionParent(template, selectedId)) }
        setOpen(false)
      })} />
    </PopoverContent>
  </Popover>
}
