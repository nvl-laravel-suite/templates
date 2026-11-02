import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { ToggleField } from 'themelia-react-ui/base/choice-inputs'
import { FormField } from 'themelia-react-ui/base/forms'
import { SliderField } from 'themelia-react-ui/base/value-inputs'
import { DecimalInput } from 'themelia-react-ui/base/forms-numeric'
import * as React from 'react'
import { Slider } from '#/voucher-builder/ui/slider'
import { DimensionInput } from '#/voucher-builder/ui/dimension-input'
import { Label } from '#/voucher-builder/ui/typography'
import { sliderVal, type DimensionValue, type SpacingValues } from '../types'
import { useFieldLabel, useFieldControl } from '../field-shell'

// ── Stepper ─────────────────────────────────────────────────────
export interface StepperInputProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}

export function StepperInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
  disabled,
}: StepperInputProps) {
  const label = useFieldLabel()
  return (
    <DecimalInput
      {...useFieldControl()}
      aria-label={label}
      value={String(value)}
      min={min}
      max={max}
      step={step}
      endAddon={suffix}
      decimalPlaces={Math.max(0, String(step).split('.')[1]?.length ?? 0)}
      allowEmpty={false}
      disabled={disabled}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (event.target.value.trim() && Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
      }}
      strings={{ decrement: `Decrease ${label ?? 'value'}`, increment: `Increase ${label ?? 'value'}` }}
    />
  )
}

// ── Slider ──────────────────────────────────────────────────────
export interface SliderInputProps {
  label?: string
  value: number
  onChange: (v: number) => void
  onChangeStart?: () => void
  min: number
  max: number
  step?: number
  disabled?: boolean
}

export function SliderInput({
  label,
  value,
  onChange,
  onChangeStart,
  min,
  max,
  step = 1,
  disabled,
}: SliderInputProps) {
  const startedRef = React.useRef(false)
  const fieldLabel = useFieldLabel()
  return (
    <Slider
      {...useFieldControl()}
      aria-label={label ?? fieldLabel}
      value={[value]}
      onValueChange={(v) => {
        if (!startedRef.current) {
          startedRef.current = true
          onChangeStart?.()
        }
        onChange(sliderVal(v))
      }}
      onValueCommitted={() => {
        startedRef.current = false
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    />
  )
}

// ── Spacing (4-sided) ───────────────────────────────────────────
export interface SpacingInputProps {
  label?: string
  value: SpacingValues
  onChange: (v: SpacingValues) => void
  onChangeStart?: () => void
  max?: number
  step?: number
  disabled?: boolean
}

export function SpacingInput({
  label,
  value,
  onChange,
  onChangeStart,
  max = 80,
  step = 2,
  disabled,
}: SpacingInputProps) {
  const { top, right, bottom, left } = value
  const allEqual = top === right && right === bottom && bottom === left
  const [linked, setLinked] = React.useState(allEqual)
  const started = React.useRef(false)
  React.useEffect(() => {
    if (!allEqual) setLinked(false)
  }, [top, right, bottom, left, allEqual])
  const begin = () => {
    if (!started.current) {
      started.current = true
      onChangeStart?.()
    }
  }
  const end = () => {
    started.current = false
  }
  const rows = linked
    ? [{ key: 'all', label: 'All sides', value: top }]
    : (
        [
          ['top', top],
          ['right', right],
          ['bottom', bottom],
          ['left', left],
        ] as const
      ).map(([key, value]) => ({ key, label: key[0].toUpperCase() + key.slice(1), value }))
  return (
    <UIStack gap="lg">
      {label && <Label>{label}</Label>}
      <ToggleField
        kind="checkbox"
        label="Link sides"
        value={linked}
        disabled={disabled}
        onValueChange={(next) => {
          if (next) {
            onChangeStart?.()
            onChange({ top, right: top, bottom: top, left: top })
          }
          setLinked(next)
        }}
      />
      {rows.map((row) => (
        <FormField key={row.key} label={row.label}>
          <SliderField
            showValue
            aria-label={`${label ?? 'Spacing'} ${row.label}`}
            value={row.value}
            min={0}
            max={max}
            step={step}
            unit="px"
            disabled={disabled}
            onValueChange={(next) => {
              begin()
              onChange(
                row.key === 'all'
                  ? { top: next, right: next, bottom: next, left: next }
                  : { ...value, [row.key]: next },
              )
            }}
            onValueCommitted={end}
          />
        </FormField>
      ))}
    </UIStack>
  )
}

// ── Dimension (value + unit) ────────────────────────────────────
export interface DimensionInputVariantProps {
  value: DimensionValue
  onChange: (v: DimensionValue) => void
  units: string[]
  min?: number
  max?: number
  disabled?: boolean
}

export function DimensionFieldInput({
  value,
  onChange,
  units,
  min,
  max,
  disabled,
}: DimensionInputVariantProps) {
  const label = useFieldLabel()
  const control = useFieldControl()
  return (
    <DimensionInput
      label={label}
      describedBy={control['aria-describedby']}
      value={value.value}
      unit={value.unit}
      units={units}
      onValueChange={(v) => onChange({ ...value, value: v })}
      onUnitChange={(u) => onChange({ ...value, unit: u })}
      min={min}
      max={max}
      disabled={disabled}
    />
  )
}
