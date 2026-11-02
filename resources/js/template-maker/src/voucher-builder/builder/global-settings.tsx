import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import {
  useGlobalSettingsActions,
  useGlobalSettingsState,
  useHistoryActions,
  useFrameState,
  useSectionState,
  useSectionActions,
} from '../store/hooks'
import { X } from 'lucide-react'
import { FontPicker } from './font-picker'
import { loadFont } from '../lib/fonts'
import { FieldShell, SettingBlock, SettingInput, SettingsPanel } from './settings'
import { TextInput } from './settings/primitives/variants/text'
import { themePresets, type ThemePreset } from '../lib/theme-presets'
import { ListRadioGroup, Select } from 'themelia-react-ui/base/choice-inputs'
import { useId, useState } from 'react'
import { Text } from 'themelia-react-ui/typography'
import { ImageUpload } from '../ui/image-upload'
import { useTranslation } from '../i18n'
import { useFeature } from '../context'

function ThemePresetPicker() {
  const { updateColors, updateTypography } = useGlobalSettingsActions()
  const currentColors = useGlobalSettingsState().colors

  const applyPreset = (preset: ThemePreset) => {
    updateColors(preset.colors)
    if (preset.fonts) {
      loadFont(preset.fonts.headingFont)
      loadFont(preset.fonts.bodyFont)
      updateTypography(preset.fonts)
    }
  }

  const name = useId()
  const active = themePresets.find(
    (preset) =>
      currentColors.primary === preset.colors.primary &&
      currentColors.accent === preset.colors.accent &&
      currentColors.background === preset.colors.background,
  )
  return (
    <ListRadioGroup
      name={name}
      value={active?.id}
      options={themePresets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        description: (
          <UIStack direction="horizontal" gap="xs" aria-hidden>
            {[preset.colors.background, preset.colors.text, preset.colors.accent].map((color, i) => (
              <span key={i} className="nc-color-sample" style={{ backgroundColor: color }} />
            ))}
          </UIStack>
        ),
      }))}
      onValueChange={(id) => {
        const preset = themePresets.find((preset) => preset.id === id)
        if (preset) applyPreset(preset)
      }}
    />
  )
}

function FrameImagePicker({
  imageUrl,
  onUpdate,
}: {
  imageUrl: string | null
  onUpdate: (url: string | null) => void
}) {
  return <ImageUpload value={imageUrl ?? ''} onChange={(url) => onUpdate(url || null)} />
}

export function GlobalSettings() {
  const [area, setArea] = useState('layout')
  const settings = useGlobalSettingsState()
  const { updateGlobal, updateLayout, updateColors, updateTypography, updateMetadata, updateFrame } =
    useGlobalSettingsActions()
  const globalSettings = settings
  const { pushHistory } = useHistoryActions()
  const { t } = useTranslation()
  const frame = useFrameState()
  const { sections } = useSectionState()
  const { updateSection } = useSectionActions()
  const pp = settings.layout?.pagePadding ?? 40

  const previewDataEnabled = useFeature('previewData')
  const beginHistoryChange = () => pushHistory()
  const commitMetadata = (updates: Parameters<typeof updateMetadata>[0]) => {
    pushHistory()
    updateMetadata(updates)
  }

  const colors = settings.colors as Record<string, string>
  const typography = settings.typography as Record<string, unknown> & typeof settings.typography
  const metadata = settings.metadata as Record<string, unknown> & typeof settings.metadata

  return (
    <SettingsPanel label="Document settings" hideHeader>
      <FieldShell label="Settings area">
        <Select aria-label="Document settings area" value={area} onValueChange={(value) => { if (value) setArea(value) }}
          options={[
            { value: 'layout', label: 'Layout' },
            { value: 'appearance', label: 'Appearance' },
            { value: 'details', label: 'Document details' },
            ...(previewDataEnabled ? [{ value: 'samples', label: 'Sample values' }] : []),
          ]} />
      </FieldShell>
      <section className="nc-settings-area" data-settings-area="layout" aria-label="Layout settings" hidden={area !== 'layout'}><UIStack gap="xl">
      <SettingBlock label="Layout" display="inline">
        <SettingInput
          type="slider"
          label="Content Padding"
          value={pp}
          onChange={(v) => updateLayout({ pagePadding: v })}
          onChangeStart={beginHistoryChange}
          min={0}
          max={80}
          step={4}
        />
        <SettingInput
          type="slider"
          label="Margin"
          value={settings.layout?.margin ?? 10}
          onChange={(v) => updateLayout({ margin: v })}
          onChangeStart={beginHistoryChange}
          min={0}
          max={30}
          step={1}
          suffix="mm"
        />
      </SettingBlock>

      <SettingBlock label="Frame" defaultOpen={false}>
        <FieldShell label="Image">
          <FrameImagePicker
            imageUrl={frame?.imageUrl ?? null}
            onUpdate={(url) => {
              pushHistory()
              updateFrame({ imageUrl: url })
            }}
          />
        </FieldShell>
        <SettingInput
          type="slider"
          label="Frame Opacity"
          value={frame?.opacity ?? 1}
          onChange={(v) => updateFrame({ opacity: v })}
          onChangeStart={beginHistoryChange}
          min={0}
          max={1}
          step={0.05}
        />
      </SettingBlock>

      {sections.map((section, i) => (
        <SettingBlock key={section.id} label={`Section ${i + 1}`} defaultOpen={false}>
          <SettingInput
            type="slider"
            label="Height"
            value={section.height}
            onChange={(v) => updateSection(section.id, { height: v })}
            onChangeStart={beginHistoryChange}
            min={20}
            max={297}
            step={1}
            suffix="mm"
          />
          <SettingInput
            type="pills"
            label="Padding"
            value={section.widthMode ?? 'wide'}
            onChange={(v) => {
              beginHistoryChange()
              updateSection(section.id, { widthMode: v as 'wide' | 'narrow' | 'tight' })
            }}
            options={[
              { value: 'wide', label: 'Default' },
              { value: 'narrow', label: 'Narrow' },
              { value: 'tight', label: 'Tight' },
            ]}
          />
          <SettingInput
            type="pills"
            label="Align"
            value={section.verticalAlign ?? 'center'}
            onChange={(v) => {
              beginHistoryChange()
              updateSection(section.id, { verticalAlign: v as 'start' | 'center' | 'end' })
            }}
            options={[
              { value: 'start', label: 'Top' },
              { value: 'center', label: 'Center' },
              { value: 'end', label: 'Bottom' },
            ]}
          />
          <SettingInput
            type="color"
            label="Background"
            value={section.backgroundColor ?? '#ffffff'}
            onChange={(v) => updateSection(section.id, { backgroundColor: v })}
            onChangeStart={beginHistoryChange}
          />
        </SettingBlock>
      ))}
      </UIStack></section>
      <section className="nc-settings-area" data-settings-area="appearance" aria-label="Appearance settings" hidden={area !== 'appearance'}><UIStack gap="xl">
      <SettingBlock label="Theme presets" defaultOpen>
        <ThemePresetPicker />
      </SettingBlock>

      <SettingBlock label="Colors" defaultOpen={false}>
        <SettingInput
          type="color"
          label="Primary"
          value={colors.primary}
          onChange={(v) => updateColors({ primary: v })}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Accent"
          value={colors.accent}
          onChange={(v) => updateColors({ accent: v })}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Background"
          value={colors.background}
          onChange={(v) => updateColors({ background: v })}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Text"
          value={colors.text}
          onChange={(v) => updateColors({ text: v })}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Secondary"
          value={colors.secondary || '#6b7280'}
          onChange={(v) => updateColors({ secondary: v } as never)}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Border"
          value={colors.border || '#e5e7eb'}
          onChange={(v) => updateColors({ border: v } as never)}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Surface"
          value={colors.surface || '#f9fafb'}
          onChange={(v) => updateColors({ surface: v } as never)}
          onChangeStart={beginHistoryChange}
        />
        <SettingInput
          type="color"
          label="Link"
          value={colors.link || '#2563eb'}
          onChange={(v) => updateColors({ link: v } as never)}
          onChangeStart={beginHistoryChange}
        />
      </SettingBlock>

      <SettingBlock label="Typography" defaultOpen={false}>
        <FieldShell label="Heading Font">
          <FontPicker
            value={typography.headingFont}
            onChange={(v) => {
              pushHistory()
              loadFont(v)
              updateTypography({ headingFont: v })
            }}
          />
        </FieldShell>
        <FieldShell label="Body Font">
          <FontPicker
            value={typography.bodyFont}
            onChange={(v) => {
              pushHistory()
              loadFont(v)
              updateTypography({ bodyFont: v })
            }}
          />
        </FieldShell>
        <SettingInput
          type="slider"
          label="Base Size"
          value={typography.baseSize}
          onChange={(v) => updateTypography({ baseSize: v })}
          onChangeStart={beginHistoryChange}
          min={12}
          max={24}
          suffix="px"
        />
        <SettingInput
          type="slider"
          label="Line Height"
          value={typography.lineHeight}
          onChange={(v) => updateTypography({ lineHeight: v })}
          onChangeStart={beginHistoryChange}
          min={1}
          max={2.5}
          step={0.1}
        />
        <SettingInput
          type="slider"
          label="Heading Line Height"
          value={(typography.headingLineHeight as number) ?? 1.2}
          onChange={(v) => updateTypography({ headingLineHeight: v } as never)}
          onChangeStart={beginHistoryChange}
          min={1}
          max={2}
          step={0.1}
        />
        <SettingInput
          type="slider"
          label="Paragraph Spacing"
          value={(typography.paragraphSpacing as number) ?? 0}
          onChange={(v) => updateTypography({ paragraphSpacing: v } as never)}
          onChangeStart={beginHistoryChange}
          min={0}
          max={24}
          suffix="px"
        />
        <SettingInput
          type="slider"
          label="Heading Spacing"
          value={(typography.headingSpacing as number) ?? 0}
          onChange={(v) => updateTypography({ headingSpacing: v } as never)}
          onChangeStart={beginHistoryChange}
          min={0}
          max={32}
          suffix="px"
        />
      </SettingBlock>
      </UIStack></section>
      <section className="nc-settings-area" data-settings-area="details" aria-label="Document details" hidden={area !== 'details'}>
      <SettingBlock label="Document details" display="inline">
        <SettingInput
          type="input"
          label={t('builder.global.metadata.title')}
          value={metadata.title as string}
          onChange={(v) => commitMetadata({ title: v })}
        />
        <SettingInput
          type="input"
          label={t('builder.global.metadata.author')}
          value={metadata.author as string}
          onChange={(v) => commitMetadata({ author: v })}
        />
        <SettingInput
          type="input"
          label={t('builder.global.metadata.subject')}
          value={(metadata.subject as string) ?? ''}
          onChange={(v) => commitMetadata({ subject: v || undefined })}
        />
        <SettingInput
          type="list"
          label={t('builder.global.metadata.keywords')}
          value={(metadata.keywords as string[]) ?? []}
          onChange={(v) => commitMetadata({ keywords: v } as never)}
          addLabel="Add Keyword"
        />
        <SettingInput
          type="input"
          label={t('builder.global.metadata.language')}
          value={(metadata.language as string) ?? 'en'}
          onChange={(v) => commitMetadata({ language: v } as never)}
          placeholder="en"
        />
      </SettingBlock>
      </section>
      {previewDataEnabled && (
        <section className="nc-settings-area" data-settings-area="samples" aria-label="Sample values" hidden={area !== 'samples'}>
        <SettingBlock label="Sample values" display="inline">
          <Text type="secondary">
            Test personalized content before exporting. Match each key to a placeholder, such as :recipient_name.
          </Text>
          {Object.entries(globalSettings.previewData || {}).map(([key, value], i) => (
            <UIStack direction="horizontal" gap="xs" wrap={false} key={i}>
              <TextInput
                value={key}
                onChange={(e) => {
                  const data = { ...(globalSettings.previewData || {}) }
                  const val = data[key]
                  delete data[key]
                  data[e.target.value] = val
                  updateGlobal({ previewData: data })
                }}
                aria-label={`Preview key ${i + 1}`}
                placeholder=":key"
                className="flex-1"
                spellCheck={false}
              />
              <TextInput
                value={value}
                onChange={(e) => {
                  updateGlobal({
                    previewData: { ...(globalSettings.previewData || {}), [key]: e.target.value },
                  })
                }}
                aria-label={`Preview value ${i + 1}`}
                placeholder="value"
                className="flex-1"
              />
              <UIAction
                buttonStyle="ghost"
                onClick={() => {
                  beginHistoryChange()
                  const data = { ...(globalSettings.previewData || {}) }
                  delete data[key]
                  updateGlobal({ previewData: data })
                }}
                iconOnly
                aria-label={`Remove preview entry ${key}`}
              >
                <X className="h-3 w-3" />
              </UIAction>
            </UIStack>
          ))}
          <UIAction
            buttonStyle="ghost"
            onClick={() => {
              beginHistoryChange()
              updateGlobal({ previewData: { ...(globalSettings.previewData || {}), ':new_key': '' } })
            }}
            className="w-full"
          >
            + Add entry
          </UIAction>
        </SettingBlock>
        </section>
      )}
    </SettingsPanel>
  )
}
