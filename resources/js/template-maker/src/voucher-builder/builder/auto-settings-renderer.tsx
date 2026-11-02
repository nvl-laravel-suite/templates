import { Fragment } from 'react'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import type { BlockDefinition, FieldSchema, SettingsGroupDef } from '../blocks/types'
import { SettingBlock } from './settings/primitives/setting-block'
import { SettingInput } from './settings/primitives/setting-input'
import type { SettingInputProps } from './settings/primitives/types'
import { getFieldSuggestions } from '../lib/suggestions'
import type { SuggestionChip } from '../lib/suggestions'
import { getFieldInspectorTab, type InspectorTab } from '../lib/inspector'

// ═══════════════════════════════════════════════════════════════
// Auto Settings Renderer
//
// Maps BlockDefinition field schemas + settingsLayout onto the
// shared primitives (SettingBlock + SettingInput).
// ═══════════════════════════════════════════════════════════════

interface AutoSettingsProps {
  def: BlockDefinition
  content: Record<string, unknown>
  settings: Record<string, unknown>
  onContentChange: (key: string, value: unknown) => void
  onContentLiveChange: (key: string, value: unknown) => void
  onContentChangeStart: () => void
  onSettingsChange: (key: string, value: unknown) => void
  onSettingsLiveChange: (key: string, value: unknown) => void
  onSettingsChangeStart: () => void
  contentOnly?: boolean
  tab?: InspectorTab
}

function keyToLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function SuggestionChips({
  suggestions,
  onSelect,
}: {
  suggestions: SuggestionChip[]
  onSelect: (v: string) => void
}) {
  if (suggestions.length === 0) return null
  return (
    <UIStack direction="horizontal" gap="xs" wrap={true} className="">
      {suggestions.map((s) => (
        <UIAction buttonStyle="ghost" key={s.label} type="button" onClick={() => onSelect(s.value)}>
          {s.label}
        </UIAction>
      ))}
    </UIStack>
  )
}

function toInputProps(
  blockType: string,
  key: string,
  label: string,
  schema: FieldSchema,
  value: unknown,
  onChange: (v: unknown) => void,
  onLiveChange?: (v: unknown) => void,
  onChangeStart?: () => void,
): SettingInputProps | null {
  const suggestions = getFieldSuggestions(blockType, key)
  const beforeInput =
    suggestions.length > 0 ? (
      <SuggestionChips suggestions={suggestions} onSelect={onChange as (v: string) => void} />
    ) : undefined

  switch (schema.type) {
    case 'string':
      if (schema.richText) {
        return {
          type: 'rich_editor',
          label,
          beforeInput,
          value: (value as string) ?? schema.default,
          onChange: (v) => onChange(v),
          placeholder: schema.placeholder,
          rows: schema.rows,
          multiline: schema.multiline,
        }
      }
      if (schema.multiline) {
        return {
          type: 'textarea',
          label,
          beforeInput,
          value: (value as string) ?? schema.default,
          onChange: (v) => onChange(v),
          placeholder: schema.placeholder,
          rows: schema.rows,
          mono: schema.mono,
        }
      }
      return {
        type: 'input',
        label,
        beforeInput,
        value: (value as string) ?? schema.default,
        onChange: (v) => onChange(v),
        placeholder: schema.placeholder,
        mono: schema.mono,
      }

    case 'number':
      return {
        type: 'number',
        label,
        value: (value as number) ?? schema.default,
        onChange: (v) => onChange(v),
        min: schema.min,
        max: schema.max,
        step: schema.step,
      }

    case 'slider':
      return {
        type: 'slider',
        label,
        value: (value as number) ?? schema.default,
        onChange: (v) => (onLiveChange ?? onChange)(v),
        onChangeStart,
        min: schema.min,
        max: schema.max,
        step: schema.step,
        suffix: schema.suffix,
      }

    case 'stepper':
      return {
        type: 'stepper',
        label,
        value: (value as number) ?? schema.default,
        onChange: (v) => onChange(v),
        min: schema.min,
        max: schema.max,
        step: schema.step,
        suffix: schema.suffix,
      }

    case 'boolean':
      return {
        type: 'switch',
        label,
        value: (value as boolean) ?? schema.default,
        onChange: (v) => onChange(v),
      }

    case 'enum': {
      const forcePills = schema.display === 'pills'
      const forceSelect = schema.display === 'select'
      if (!/fontSize$/i.test(key) && schema.options.length <= 4 && (forcePills || !forceSelect)) {
        return {
          type: 'pills',
          label,
          value: (value as string) ?? schema.default,
          onChange: (v) => onChange(v),
          options: schema.options,
        }
      }
      return {
        type: 'select',
        label,
        value: (value as string) ?? schema.default,
        onChange: (v) => onChange(v),
        options: schema.options,
      }
    }

    case 'color':
      return {
        type: 'color',
        label,
        value: (value as string) ?? schema.default,
        onChange: (v) => (onLiveChange ?? onChange)(v),
        onChangeStart,
      }

    case 'alignment':
      return {
        type: 'alignment',
        label,
        value: (value as string) ?? schema.default,
        onChange: (v) => onChange(v),
        withJustify: schema.withJustify,
      }

    case 'dimension':
      return {
        type: 'dimension',
        label,
        value: (value as { value: number; unit: string }) ?? schema.default,
        onChange: (v) => onChange(v),
        units: schema.units,
      }

    case 'image':
      return {
        type: 'image',
        label,
        value: (value as string) ?? schema.default,
        onChange: (v) => onChange(v),
      }

    case 'list':
      return {
        type: 'list',
        label,
        value: (value as string[]) ?? schema.default,
        onChange: (v) => onChange(v),
        placeholder: schema.placeholder,
        addLabel: schema.addLabel,
        maxItems: schema.maxItems,
        richText: schema.richText,
      }

    case 'icon':
      return {
        type: 'icon',
        label,
        value: (value as string) ?? schema.default,
        onChange: (v) => onChange(v),
      }

    default:
      return null
  }
}

function isGroupVisible(
  when: SettingsGroupDef['when'] | undefined,
  content: Record<string, unknown>,
  settings: Record<string, unknown>,
): boolean {
  if (!when) return true
  const val = content[when.field] ?? settings[when.field]
  return val === when.value
}

export function AutoSettingsRenderer({
  def,
  content,
  settings,
  onContentChange,
  onContentLiveChange,
  onContentChangeStart,
  onSettingsChange,
  onSettingsLiveChange,
  onSettingsChangeStart,
  contentOnly = false,
  tab,
}: AutoSettingsProps) {
  return (
    <>
      {def.settingsLayout.map((entry, gi) => {
        // Trait markers are resolved at registration; skip any stray strings.
        if (typeof entry === 'string') return null
        const group = entry
        if (!isGroupVisible(group.when, content, settings)) return null
        const fields = group.fields.filter((key) => {
          const source = key in def.content ? 'content' : 'settings'
          const schema = def.content[key] ?? def.settings[key]
          return (
            schema &&
            (!contentOnly || source === 'content') &&
            (!tab || getFieldInspectorTab(key, source) === tab) &&
            isGroupVisible(schema.when, content, settings)
          )
        })
        if (!fields.length) return null

        const inputs = fields.map((fieldKey) => {
          const contentSchema = def.content[fieldKey]
          const settingsSchema = def.settings[fieldKey]
          const schema = contentSchema || settingsSchema
          if (!schema) return null

          let props: SettingInputProps | null = null
          if (contentSchema) {
            props = toInputProps(
              def.type,
              fieldKey,
              keyToLabel(fieldKey),
              contentSchema,
              content[fieldKey],
              (v) => onContentChange(fieldKey, v),
              (v) => onContentLiveChange(fieldKey, v),
              onContentChangeStart,
            )
          } else if (settingsSchema) {
            props = toInputProps(
              def.type,
              fieldKey,
              keyToLabel(fieldKey),
              settingsSchema,
              settings[fieldKey],
              (v) => onSettingsChange(fieldKey, v),
              (v) => onSettingsLiveChange(fieldKey, v),
              onSettingsChangeStart,
            )
          }
          if (!props) return null
          if (props.type === 'slider' && props.value === 0) {
            if (/lineHeight$/i.test(fieldKey)) props.hint = 'Auto'
            if (/maxWidth$/i.test(fieldKey)) props.hint = 'No limit'
          }
          return <SettingInput key={fieldKey} {...props} />
        })
        if (inputs.every((input) => input === null)) return null
        // The field's own label is sufficient for a flat, identically named group.
        if (
          group.display === 'flat' &&
          !group.description &&
          group.fields.length === 1 &&
          group.title.trim().toLowerCase() === keyToLabel(fields[0]).toLowerCase()
        ) {
          return <Fragment key={gi}>{inputs}</Fragment>
        }
        return (
          <SettingBlock
            key={gi}
            label={group.title}
            description={group.description}
            display={group.display === 'flat' ? 'inline' : 'collapsible'}
            defaultOpen={
              tab === 'data' || tab === 'content'
                ? true
                : (group.defaultOpen ?? /typography/i.test(group.title))
            }
          >
            {inputs}
          </SettingBlock>
        )
      })}
    </>
  )
}
