import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import {
  useHistoryActions,
  useSectionActions,
  useSectionState,
  useSelectionState,
} from '../store/hooks'
import type { VoucherSection } from '../schema'
import { SettingBlock, SettingInput, SettingsPanel } from './settings'

function SectionSettingsPanel({ section, sectionIndex }: { section: VoucherSection; sectionIndex: number }) {
  const { updateSection } = useSectionActions()
  const { pushHistory } = useHistoryActions()

  const update = (updates: Partial<VoucherSection>) => {
    updateSection(section.id, updates)
  }

  const updateWithHistory = (updates: Partial<VoucherSection>) => {
    pushHistory()
    updateSection(section.id, updates)
  }

  return (
    <SettingsPanel
      label={`Section ${sectionIndex + 1}`}
      hideHeader
      description="Settings for this section of the voucher."
    >
      <SettingBlock label="Appearance">
        <SettingInput
          type="color"
          label="Background Color"
          value={section.backgroundColor}
          onChange={(value) => update({ backgroundColor: value })}
          onChangeStart={() => pushHistory()}
        />
        <SettingInput
          type="pills"
          label="Width Mode"
          value={section.widthMode ?? 'wide'}
          onChange={(value) => updateWithHistory({ widthMode: value as 'wide' | 'narrow' | 'tight' })}
          options={[
            { label: 'Default', value: 'wide' },
            { label: 'Narrow', value: 'narrow' },
            { label: 'Tight', value: 'tight' },
          ]}
        />
        <SettingInput
          type="pills"
          label="Vertical Align"
          value={section.verticalAlign ?? 'center'}
          onChange={(value) => updateWithHistory({ verticalAlign: value as 'center' | 'start' | 'end' })}
          options={[
            { label: 'Top', value: 'start' },
            { label: 'Center', value: 'center' },
            { label: 'Bottom', value: 'end' },
          ]}
        />
      </SettingBlock>

      <SettingBlock label="Dimensions" defaultOpen={true}>
        <SettingInput
          type="slider"
          label="Height"
          value={section.height}
          onChange={(value) => update({ height: value })}
          onChangeStart={() => pushHistory()}
          min={20}
          max={300}
          step={1}
          suffix="mm"
        />
        <SettingInput
          type="slider"
          label="Padding"
          value={section.padding}
          onChange={(value) => update({ padding: value })}
          onChangeStart={() => pushHistory()}
          min={0}
          max={20}
          step={0.5}
          suffix="mm"
        />
      </SettingBlock>
    </SettingsPanel>
  )
}

export function SectionSettings() {
  const { activeSectionId, sections } = useSectionState()
  const { activeBlockId } = useSelectionState()

  if (!activeSectionId || activeBlockId) {
    return (
      <EmptyState
        className="h-full"
        title="Select a section"
        description="Choose a section on the canvas to edit its settings."
      />
    )
  }

  const sectionIndex = sections.findIndex((s: VoucherSection) => s.id === activeSectionId)
  const section = sections[sectionIndex]

  if (!section) {
    return (
      <EmptyState
        className="h-full"
        title="Section unavailable"
        description="Select another section to continue editing."
      />
    )
  }

  return <SectionSettingsPanel section={section} sectionIndex={sectionIndex} />
}
