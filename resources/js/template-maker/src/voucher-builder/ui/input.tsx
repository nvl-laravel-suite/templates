import { Input as ThemeliaInput } from 'themelia-react-ui/base/text-inputs'
import type { ComponentProps } from 'react'
export function Input({ value, defaultValue, size: _size, ...props }: ComponentProps<'input'>) {
  return (
    <ThemeliaInput
      {...props}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
    />
  )
}
