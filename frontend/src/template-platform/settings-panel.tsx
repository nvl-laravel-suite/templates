import { useState } from 'react'
import { Button } from 'themelia-react-ui/base/buttons'
import { Stack } from 'themelia-react-ui/base/structure'
import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import { Text } from 'themelia-react-ui/typography'
import type { JsonObject, JsonValue } from '../template-core/schema'
import { SettingInput } from '../voucher-builder/builder/settings/primitives/setting-input'
import { CommitInput } from '../template-creator/controls'
import { resolvePresentationSettings } from './settings'
import type { PresentationSetting } from './types'

export interface TemplateSettingsPanelProps {
  defaults?: JsonObject
  spec: PresentationSetting[]
  values: JsonObject
  onChange: (values: JsonObject) => void
  disabled?: boolean
}

export function TemplateSettingsPanel({ spec: declaredSpec, defaults = {}, values, onChange, disabled = false }: TemplateSettingsPanelProps) {
  const spec = declaredSpec.map(field => ({ ...field, defaultValue: Object.hasOwn(defaults, field.id) ? defaults[field.id] : field.defaultValue }))
  const visible = spec.filter(field => field.exposed)
  const commit = (id: string, value: JsonValue) => {
    const next = { ...values, [id]: value }
    resolvePresentationSettings(spec, next)
    onChange(next)
  }
  if (!visible.length) return <EmptyState title="No appearance settings" description="This template keeps its published appearance." />
  return <Stack gap="xl">
    {visible.map(field => <Stack key={field.id} gap="sm">
      <SettingControl field={field} value={Object.hasOwn(values, field.id) ? values[field.id] : field.defaultValue} onChange={value => commit(field.id, value)} disabled={disabled} />
      <Stack direction="horizontal" justify="between" align="center" gap="sm">
        <Text size="sm" type="secondary">{Object.hasOwn(values, field.id) ? 'Customized' : 'Using template default'}</Text>
        <Button buttonStyle="ghost" size="sm" disabled={disabled || !Object.hasOwn(values, field.id)} aria-label={`Reset ${field.label}`} onClick={() => { const next = { ...values }; delete next[field.id]; onChange(next) }}>Use default</Button>
      </Stack>
    </Stack>)}
  </Stack>
}

function SettingControl({ field, value, onChange, disabled }: { field: PresentationSetting; value: JsonValue; onChange: (value: JsonValue) => void; disabled: boolean }) {
  const [error, setError] = useState('')
  const change = (next: JsonValue) => { try { onChange(next); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check this value.') } }
  const common = { label: field.label, description: field.description, disabled }
  let control
  if (field.schema.type === 'boolean') control = <SettingInput {...common} type="switch" value={Boolean(value)} onChange={change} />
  else if (field.control === 'color') control = <SettingInput {...common} type="color" value={String(value)} onChange={change} labelExtra={<></>} />
  else if (field.control === 'alignment') control = <SettingInput {...common} type="alignment" value={String(value)} onChange={change} withJustify={field.schema.type === 'string' && field.schema.enum?.includes('justify')} />
  else if (field.schema.type === 'string' && field.schema.enum) control = <SettingInput {...common} type="select" value={String(value)} options={field.schema.enum.map(option => ({ value: option, label: option }))} onChange={change} />
  else if ((field.schema.type === 'number' || field.schema.type === 'integer') && field.control === 'slider') control = <SettingInput {...common} type="slider" value={Number(value)} onChange={change} min={field.schema.minimum ?? 0} max={field.schema.maximum ?? 100} step={field.schema.type === 'integer' ? 1 : 0.5} hint={`${value}${field.unit ?? ''}`} />
  else if (disabled) control = <Text>{field.label}: {String(value)}</Text>
  else {
    const numeric = field.schema.type === 'number' || field.schema.type === 'integer'
    control = <CommitInput label={field.label} value={String(value ?? '')} type={numeric ? 'number' : 'text'} hint={field.description ?? (field.unit ? `Value in ${field.unit}.` : undefined)} onCommit={next => onChange(numeric ? Number(next) : next)} />
  }
  return <Stack gap="sm">{control}{error && <Text role="alert">{error}</Text>}</Stack>
}
