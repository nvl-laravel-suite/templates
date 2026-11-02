import { Textarea as ThemeliaTextarea } from 'themelia-react-ui/base/text-inputs'
import type { ComponentProps } from 'react'
export function Textarea({ value, defaultValue, ...props }: ComponentProps<'textarea'>) {
  return (
    <ThemeliaTextarea
      {...props}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
    />
  )
}
