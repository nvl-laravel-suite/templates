import { Switch as ThemeliaSwitch, type SwitchProps } from 'themelia-react-ui/base/choice-inputs'
export function Switch({
  onCheckedChange,
  ...props
}: SwitchProps & { onCheckedChange?: (checked: boolean) => void }) {
  return <ThemeliaSwitch {...props} onValueChange={onCheckedChange ?? props.onValueChange} />
}
