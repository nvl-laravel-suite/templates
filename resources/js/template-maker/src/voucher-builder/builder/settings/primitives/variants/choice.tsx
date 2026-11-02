import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react'
import { useId } from 'react'
import { Select, PillRadioGroup } from 'themelia-react-ui/base/choice-inputs'
import { IconPicker } from '../../../../ui/icon-picker'
import type { SettingOption } from '../types'
import { useFieldLabel, useFieldControl } from '../field-shell'

// ── Pills ───────────────────────────────────────────────────────
export interface PillsInputProps {
  value: string
  onChange: (v: string) => void
  options: SettingOption[]
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function PillsInput({ value, onChange, options, size, disabled }: PillsInputProps) {
  const name = useId()
  const label = useFieldLabel()
  if (options.length > 4)
    return <SelectInput value={value} onChange={onChange} options={options} disabled={disabled} />
  return (
    <PillRadioGroup
      name={name}
      aria-label={label}
      value={value}
      options={options}
      size={size}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
      disabled={disabled}
      fullWidth
    />
  )
}

// ── Select ──────────────────────────────────────────────────────
export interface SelectInputProps {
  value: string
  onChange: (v: string) => void
  options: SettingOption[]
  disabled?: boolean
}

export function SelectInput({ value, onChange, options, disabled }: SelectInputProps) {
  const label = useFieldLabel()
  return (
    <Select
      {...useFieldControl()}
      aria-label={label}
      value={value}
      options={options.map((option) => ({ value: option.value, label: option.label }))}
      onValueChange={(next) => {
        if (next !== undefined) onChange(next)
      }}
      disabled={disabled}
    />
  )
}

// ── Alignment ───────────────────────────────────────────────────
const ALIGNMENT_OPTS = [
  { value: 'left', icon: AlignLeft },
  { value: 'center', icon: AlignCenter },
  { value: 'right', icon: AlignRight },
  { value: 'justify', icon: AlignJustify },
] as const

export interface AlignmentInputProps {
  value: string
  onChange: (v: string) => void
  withJustify?: boolean
  disabled?: boolean
}

export function AlignmentInput({ value, onChange, withJustify, disabled }: AlignmentInputProps) {
  const opts = withJustify ? ALIGNMENT_OPTS : ALIGNMENT_OPTS.slice(0, 3)
  const name = useId()
  const label = useFieldLabel()
  return (
    <PillRadioGroup
      name={name}
      aria-label={label ?? 'Text alignment'}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
      options={opts.map((option) => ({
        value: option.value,
        icon: option.icon,
        label: '', // Icon-only choices use the native accessible value without a hidden label gap.
      }))}
    />
  )
}

// ── Icon picker ─────────────────────────────────────────────────
export interface IconInputProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function IconInput({ value, onChange, disabled }: IconInputProps) {
  return (
    <div>
      <IconPicker control={useFieldControl()} value={value} onChange={onChange} disabled={disabled} />
    </div>
  )
}
