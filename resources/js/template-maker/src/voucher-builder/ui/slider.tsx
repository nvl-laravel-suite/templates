import { SliderField, type SliderProps } from 'themelia-react-ui/base/value-inputs'
import { cn } from '../lib/utils'
type Props = Omit<SliderProps, 'value' | 'defaultValue'> & {
  value?: number | number[]
  defaultValue?: number | number[]
}
/** Voucher models store one scalar; older settings express it as a one-thumb array. */
export function Slider({ value, defaultValue, className, ...props }: Props) {
  return (
    <SliderField
      {...props}
      className={cn('min-w-0 flex-1', className)}
      value={Array.isArray(value) ? value[0] : value}
      defaultValue={Array.isArray(defaultValue) ? defaultValue[0] : defaultValue}
      showValue={false}
    />
  )
}
