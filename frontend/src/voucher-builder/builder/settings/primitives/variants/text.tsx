import * as React from 'react'
import { RichTextField as RichTextInputField } from '#/voucher-builder/ui/rich-text-editor'
import { useFieldLabel, useFieldControl } from '../field-shell'

import { Input, Textarea } from 'themelia-react-ui/base/text-inputs'
export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { mono?: boolean }
>(({ className, mono: _mono, value, defaultValue, size: _size, ...props }, ref) => (
  <Input
    ref={ref}
    {...useFieldControl()}
    {...props}
    value={value === undefined ? undefined : String(value)}
    defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
    className={className}
  />
))
TextInput.displayName = 'TextInput'
export const TextareaInput = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'> & { mono?: boolean }
>(({ className, mono: _mono, value, defaultValue, ...props }, ref) => (
  <Textarea
    ref={ref}
    {...useFieldControl()}
    {...props}
    value={value === undefined ? undefined : String(value)}
    defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
    className={className}
  />
))
TextareaInput.displayName = 'TextareaInput'

export interface RichTextInputProps {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  multiline?: boolean
  disabled?: boolean
}

export function RichTextInput({
  value,
  onChange,
  rows = 4,
  placeholder,
  multiline = true,
  disabled,
}: RichTextInputProps) {
  return (
    <RichTextInputField
      label={useFieldLabel()}
      control={useFieldControl()}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      multiline={multiline}
      disabled={disabled}
    />
  )
}
