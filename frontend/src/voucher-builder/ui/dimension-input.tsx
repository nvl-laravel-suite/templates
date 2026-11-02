import { DecimalInput } from 'themelia-react-ui/base/forms-numeric'
import { Select } from 'themelia-react-ui/base/choice-inputs'
import { Stack } from 'themelia-react-ui/base/structure'
interface DimensionInputProps {
  label?: string
  describedBy?: string
  value: number
  unit: string
  units: string[]
  onValueChange: (value: number) => void
  onUnitChange: (unit: string) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  placeholder?: string
}
export function DimensionInput({
  label = 'Dimension',
  describedBy,
  value,
  unit,
  units,
  onValueChange,
  onUnitChange,
  min = 0,
  max = 9999,
  step = 1,
  disabled,
  placeholder,
}: DimensionInputProps) {
  return (
    <Stack direction="horizontal" gap="sm" wrap={false}>
      <DecimalInput
        aria-label={`${label} value`}
        aria-describedby={describedBy}
        value={unit === 'auto' ? '' : String(value)}
        disabled={disabled || unit === 'auto'}
        placeholder={unit === 'auto' ? 'Auto' : placeholder}
        min={min}
        max={max}
        step={step}
        allowEmpty={false}
        strings={{ decrement: `Decrease ${label}`, increment: `Increase ${label}` }}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (event.target.value.trim() && Number.isFinite(next)) onValueChange(next)
        }}
      />
      {units.length > 1 && (
        <Select
          aria-label={`${label} unit`}
          aria-describedby={describedBy}
          value={unit}
          disabled={disabled}
          options={units.map((unit) => ({ value: unit, label: unit }))}
          onValueChange={(value) => {
            if (value !== undefined) onUnitChange(value)
          }}
        />
      )}
    </Stack>
  )
}
