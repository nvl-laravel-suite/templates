import { Switch } from '../../../../ui/switch'
import { Checkbox } from 'themelia-react-ui/base/choice-inputs'
import { useFieldControl } from '../field-shell'

export interface ToggleInputProps {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

export function SwitchInput({ value, onChange, disabled }: ToggleInputProps) {
  return (
    <Switch
      {...useFieldControl()}
      checked={value}
      onCheckedChange={(checked) => onChange(checked === true)}
      disabled={disabled}
    />
  )
}

export function CheckboxInput({ value, onChange, disabled }: ToggleInputProps) {
  return (
    <Checkbox
      {...useFieldControl()}
      checked={value}
      onCheckedChange={(checked) => onChange(checked === true)}
      disabled={disabled}
    />
  )
}
