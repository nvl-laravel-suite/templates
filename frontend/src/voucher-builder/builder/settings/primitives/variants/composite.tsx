import { useId, useRef } from 'react'
import { Stack } from 'themelia-react-ui/base/structure'
import { FormField } from 'themelia-react-ui/base/forms'
import { PillRadioGroup, ToggleField } from 'themelia-react-ui/base/choice-inputs'
import { SliderField } from 'themelia-react-ui/base/value-inputs'
import { ColorPicker } from '#/voucher-builder/ui/color-picker'
import { type BorderValues, type ShadowValues, DEFAULT_SHADOW } from '../types'

export interface BorderInputProps {
  value: BorderValues
  onChange: (v: BorderValues) => void
  onChangeStart?: () => void
  maxRadius?: number
  maxWidth?: number
  disabled?: boolean
}
function useGestureStart(onChangeStart?: () => void) {
  const started = useRef(false)
  return {
    begin: () => {
      if (!started.current) {
        started.current = true
        onChangeStart?.()
      }
    },
    end: () => {
      started.current = false
    },
  }
}
export function BorderInput({
  value,
  onChange,
  onChangeStart,
  maxRadius = 48,
  maxWidth = 8,
  disabled,
}: BorderInputProps) {
  const gesture = useGestureStart(onChangeStart)
  const name = useId()
  return (
    <Stack gap="lg">
      <FormField label="Radius">
        <SliderField
          showValue
          aria-label="Border radius"
          value={value.radius}
          min={0}
          max={maxRadius}
          step={1}
          unit="px"
          disabled={disabled}
          onValueChange={(next) => {
            gesture.begin()
            onChange({ ...value, radius: next })
          }}
          onValueCommitted={gesture.end}
        />
      </FormField>
      <FormField label="Width">
        <SliderField
          showValue
          aria-label="Border width"
          value={value.width}
          min={0}
          max={maxWidth}
          step={1}
          unit="px"
          disabled={disabled}
          onValueChange={(next) => {
            gesture.begin()
            onChange({ ...value, width: next })
          }}
          onValueCommitted={gesture.end}
        />
      </FormField>
      <FormField label="Color">
        <ColorPicker
          label="Border color"
          value={value.color}
          disabled={disabled}
          onChangeStart={onChangeStart}
          onChange={(color) => onChange({ ...value, color })}
        />
      </FormField>
      {value.width > 0 && (
        <FormField label="Style">
          <PillRadioGroup
            name={name}
            aria-label="Border style"
            value={value.style || 'solid'}
            fullWidth
            disabled={disabled}
            options={['solid', 'dashed', 'dotted'].map((value) => ({
              value,
              label: value[0].toUpperCase() + value.slice(1),
            }))}
            onValueChange={(style) => {
              if (style) {
                onChangeStart?.()
                onChange({ ...value, style: style as BorderValues['style'] })
              }
            }}
          />
        </FormField>
      )}
    </Stack>
  )
}
export interface ShadowInputProps {
  value: ShadowValues | null
  onChange: (v: ShadowValues | null) => void
  onChangeStart?: () => void
  disabled?: boolean
}
export function ShadowInput({ value, onChange, onChangeStart, disabled }: ShadowInputProps) {
  const gesture = useGestureStart(onChangeStart)
  const shadow = value ?? DEFAULT_SHADOW
  return (
    <Stack gap="lg">
      <ToggleField
        label="Enabled"
        value={value !== null}
        disabled={disabled}
        onValueChange={(enabled) => {
          onChangeStart?.()
          onChange(enabled ? { ...DEFAULT_SHADOW } : null)
        }}
      />
      {value && (
        <>
          {(
            [
              { key: 'x', label: 'Horizontal offset', min: -40, max: 40 },
              { key: 'y', label: 'Vertical offset', min: -40, max: 40 },
              { key: 'blur', label: 'Blur', min: 0, max: 80 },
              { key: 'spread', label: 'Spread', min: -20, max: 40 },
            ] as const
          ).map(({ key, label, min, max }) => (
            <FormField key={key} label={label}>
              <SliderField
                showValue
                aria-label={`Shadow ${label}`}
                value={shadow[key]}
                min={min}
                max={max}
                step={1}
                unit="px"
                disabled={disabled}
                onValueChange={(next) => {
                  gesture.begin()
                  onChange({ ...shadow, [key]: next })
                }}
                onValueCommitted={gesture.end}
              />
            </FormField>
          ))}
          <FormField label="Color">
            <ColorPicker
              label="Shadow color"
              value={shadow.color}
              disabled={disabled}
              onChangeStart={onChangeStart}
              onChange={(color) => onChange({ ...shadow, color })}
            />
          </FormField>
          <ToggleField
            label="Inset"
            value={shadow.inset}
            disabled={disabled}
            onValueChange={(inset) => {
              onChangeStart?.()
              onChange({ ...shadow, inset })
            }}
          />
        </>
      )}
    </Stack>
  )
}
export interface OpacityInputProps {
  value: number
  onChange: (v: number) => void
  onChangeStart?: () => void
  disabled?: boolean
}
export function OpacityInput({ value, onChange, onChangeStart, disabled }: OpacityInputProps) {
  const gesture = useGestureStart(onChangeStart)
  return (
    <SliderField
      showValue
      aria-label="Opacity"
      value={value}
      min={0}
      max={1}
      step={0.05}
      disabled={disabled}
      formatValue={(value) => `${Math.round(value * 100)}%`}
      onValueChange={(next) => {
        gesture.begin()
        onChange(next)
      }}
      onValueCommitted={gesture.end}
    />
  )
}
