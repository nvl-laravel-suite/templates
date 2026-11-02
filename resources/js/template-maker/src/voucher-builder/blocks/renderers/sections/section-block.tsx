import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SectionHeaderInline } from '../shared/section-header-inline'
import { ComposableChildList } from '../shared/composable-child-list'
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover'
import { Button } from 'themelia-react-ui/base/buttons'
import { QuickBlockPicker } from '../../../builder/quick-block-picker'
import { useContainerActions, useSelectionState } from '../../../store/hooks'
import type { BlockType } from '../../../schema'

interface SectionBlockData {
  id: string
  type: 'section'
  content: { title: string; icon: string; description: string; childIds: string[] }
  settings: {
    showTitle?: boolean; showIcon: boolean; showDivider: boolean; showDescription: boolean;
    titleSize: string; titleFontWeight?: string; titleColor: string; dividerColor: string;
    iconColor: string; iconBgColor: string; headerStyle?: string
  }
}

export function SectionBlockRenderer({ block }: { block: SectionBlockData }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { addBlockToColumn } = useContainerActions()
  const { activeBlockId } = useSelectionState()
  const isSelected = activeBlockId === block.id

  const handleAddChild = (type: BlockType) => {
    addBlockToColumn(block.id, type)
    setPickerOpen(false)
  }

  return (
    <div>
      {block.settings.showTitle !== false && (
        <SectionHeaderInline
          title={block.content.title}
          icon={block.content.icon}
          description={block.content.description}
          showIcon={block.settings.showIcon}
          showDivider={block.settings.showDivider}
          showDescription={block.settings.showDescription}
          titleColor={block.settings.titleColor}
          dividerColor={block.settings.dividerColor}
          iconColor={block.settings.iconColor}
          iconBgColor={block.settings.iconBgColor}
          titleSize={block.settings.titleSize}
          titleFontWeight={block.settings.titleFontWeight}
          headerStyle={block.settings.headerStyle}
        />
      )}
      <ComposableChildList
        blockId={block.id}
        className="space-y-1"
      />
      {(isSelected || pickerOpen) && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={<Button size="sm" buttonStyle="ghost" aria-label="Add block to section" />}
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add block
          </PopoverTrigger>
          <PopoverContent type="menu" inset="flush" className="w-80 max-w-[calc(100vw-2rem)]" side="bottom" sideOffset={8}>
            <QuickBlockPicker onSelect={handleAddChild} variant="list" />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
