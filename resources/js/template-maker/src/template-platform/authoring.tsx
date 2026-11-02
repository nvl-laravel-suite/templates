import { validateJSONData } from '../template-core/contracts'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { Button } from 'themelia-react-ui/base/buttons'
import { SettingInput } from '../voucher-builder/builder/settings/primitives/setting-input'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'
import { DocumentPaletteProvider } from '../voucher-builder/ui/color-picker'
import { useTemplateDocument, useTemplateSelection } from '../template-creator/hooks'
import { templateNodeLabel } from '../template-core/labels'
import { TemplateSettingsPanel } from './settings-panel'
import { createTemplateTheme } from './theme'
import type { PresentationSetting, TemplateTheme } from './types'

export function TemplateThemePanel({ value, onChange }: { value: TemplateTheme; onChange: (value: TemplateTheme) => void }) {
  const colorLabels: Record<keyof TemplateTheme['colors'], string> = { primary: 'Primary', primaryForeground: 'Primary foreground', background: 'Background', foreground: 'Foreground', muted: 'Muted', mutedForeground: 'Muted foreground' }
  return <DocumentPaletteProvider colors={Object.values(value.colors)}><Stack gap="xl">
    <SettingBlock label="Colors">{(Object.keys(colorLabels) as (keyof TemplateTheme['colors'])[]).map(key => <SettingInput key={key} label={colorLabels[key]} type="color" labelExtra={<></>} value={value.colors[key]} onChange={next => onChange(createTemplateTheme({ ...value, colors: { ...value.colors, [key]: next } }))} />)}</SettingBlock>
    <SettingBlock label="Typography">
      <SettingInput type="input" label="Font family" value={value.typography.fontFamily} onChange={next => { if (/^[a-zA-Z][a-zA-Z0-9 ,_-]{0,119}$/.test(next)) onChange(createTemplateTheme({ ...value, typography: { ...value.typography, fontFamily: next } })) }} />
      {(['text', 'small', 'h1', 'h2', 'lineHeight'] as const).map(key => <SettingInput key={key} type="stepper" label={{ text: 'Default text', small: 'Small text', h1: 'Heading 1', h2: 'Heading 2', lineHeight: 'Line height' }[key]} value={value.typography[key]} min={1} max={key === 'lineHeight' ? 3 : 100} step={key === 'lineHeight' ? 0.1 : 1} suffix={key === 'lineHeight' ? undefined : 'px'} onChange={next => onChange(createTemplateTheme({ ...value, typography: { ...value.typography, [key]: next } }))} />)}
    </SettingBlock>
    <SettingBlock label="Spacing" defaultOpen={false}>{(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(key => <SettingInput key={key} type="stepper" label={`Spacing ${key}`} value={value.spacing[key]} min={0} max={100} suffix="px" onChange={next => onChange(createTemplateTheme({ ...value, spacing: { ...value.spacing, [key]: next } }))} />)}</SettingBlock>
    <SettingBlock label="Actions" defaultOpen={false}>{(['height', 'paddingInline', 'radius'] as const).map(key => <SettingInput key={key} type="stepper" label={{ height: 'Action height', paddingInline: 'Action padding', radius: 'Action radius' }[key]} value={value.actions[key]} min={key === 'height' ? 1 : 0} max={100} suffix="px" onChange={next => onChange(createTemplateTheme({ ...value, actions: { ...value.actions, [key]: next } }))} />)}</SettingBlock>
  </Stack></DocumentPaletteProvider>
}

const presets: { property: string; label: string; control: PresentationSetting['control']; defaultValue: string | number; schema: PresentationSetting['schema']; unit?: PresentationSetting['unit'] }[] = [
  { property: 'font-size', label: 'Font size', control: 'slider', defaultValue: 16, schema: { type: 'number', minimum: 10, maximum: 48 }, unit: 'px' },
  { property: 'color', label: 'Text color', control: 'color', defaultValue: '#202722', schema: { type: 'string', minLength: 4, maxLength: 7 } },
  { property: 'text-align', label: 'Alignment', control: 'alignment', defaultValue: 'left', schema: { type: 'string', enum: ['left', 'center', 'right'] } },
  { property: 'padding', label: 'Padding', control: 'slider', defaultValue: 16, schema: { type: 'number', minimum: 0, maximum: 64 }, unit: 'px' },
  { property: 'border-radius', label: 'Corner radius', control: 'slider', defaultValue: 8, schema: { type: 'number', minimum: 0, maximum: 48 }, unit: 'px' },
]

export function SelectedAppearanceControls({ spec, onChange }: { spec: PresentationSetting[]; onChange: (value: PresentationSetting[]) => void }) {
  const { node } = useTemplateSelection()
  if (!node || node.kind !== 'element') return null
  return <SettingBlock label="Customer appearance controls" description="Choose the appearance controls customers may change on this element.">
    {presets.map(preset => {
      const existing = spec.find(field => field.targets.some(target => target.nodeId === node.id && target.property === preset.property))
      return <SettingInput key={preset.property} type="switch" label={`Allow ${preset.label}`} value={Boolean(existing?.exposed)} onChange={allowed => {
        if (existing) onChange(spec.map(field => field.id === existing.id ? { ...field, exposed: allowed } : field))
        else if (allowed) {
          const literal = node.style[preset.property]
          const parsed = preset.unit && literal?.endsWith(preset.unit) ? Number(literal.slice(0, -preset.unit.length)) : literal
          const candidate = typeof preset.defaultValue === 'number' ? typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 48 ? parsed : preset.defaultValue : typeof parsed === 'string' && (preset.control === 'color' ? /^#[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/.test(parsed) : ['left', 'center', 'right'].includes(parsed)) ? parsed : preset.defaultValue
          const defaultValue = validateJSONData(preset.schema, candidate).length ? preset.defaultValue : candidate
          onChange([...spec, { id: `s_${[...node.id].map(char => char.codePointAt(0)!.toString(16)).join('_')}_${preset.property.replaceAll('-', '_')}`, label: preset.label, control: preset.control, schema: preset.schema, defaultValue, exposed: true, unit: preset.unit, targets: [{ nodeId: node.id, property: preset.property }] }])
        }
      }} />
    })}
  </SettingBlock>
}

export function AppearanceSettingsLibrary({ spec, onChange }: { spec: PresentationSetting[]; onChange: (value: PresentationSetting[]) => void }) {
  const definition = useTemplateDocument()
  if (!spec.length) return <Text type="secondary">Select an element and enable its customer appearance controls in the inspector.</Text>
  return <Stack gap="xl">{spec.map(field => <SettingBlock key={field.id} label={field.label} description={field.targets.map(target => `${definition.nodes[target.nodeId] ? templateNodeLabel(definition.nodes[target.nodeId]) : target.nodeId} · ${target.property}`).join(', ')} action={<Button buttonStyle="ghost" size="sm" onClick={() => onChange(spec.filter(item => item.id !== field.id))}>Remove</Button>}>
    <SettingInput label="Customer editable" type="switch" value={field.exposed} onChange={exposed => onChange(spec.map(item => item.id === field.id ? { ...item, exposed } : item))} />
    <TemplateSettingsPanel spec={[{ ...field, exposed: true }]} values={{}} onChange={values => { if (Object.hasOwn(values, field.id)) onChange(spec.map(item => item.id === field.id ? { ...item, defaultValue: values[field.id] } : item)) }} />
  </SettingBlock>)}</Stack>
}
