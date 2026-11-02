import { Select } from 'themelia-react-ui/base/choice-inputs'

export interface UnitToggleProps {
  units: readonly string[]
  value: string
  onChange: (unit: string) => void
  /** Optional leading numeric value to display before the unit */
  display?: number | string
  className?: string
  title?: string
}

/** Explicit unit choice; displayed numbers are not converted by this adapter. */
export function UnitToggle({ units, value, onChange, display, className, title = 'Unit' }: UnitToggleProps) {
  return (
    <Select
      aria-label={title}
      className={className}
      value={value}
      options={units.map((unit) => ({
        value: unit,
        label: display === undefined ? unit : `${display} ${unit}`,
      }))}
      onValueChange={(next) => {
        if (next !== undefined) onChange(next)
      }}
    />
  )
}
