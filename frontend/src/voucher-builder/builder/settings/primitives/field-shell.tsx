import { createContext, useContext, useId, type ReactNode, type MouseEvent } from 'react'
import { FormField } from 'themelia-react-ui/base/forms'
import { Stack } from 'themelia-react-ui/base/structure'
import { Label, Text } from 'themelia-react-ui/typography'

type FieldControl = { id?: string; 'aria-label'?: string; 'aria-describedby'?: string }
const FieldContext = createContext<FieldControl>({})
export const useFieldLabel = () => useContext(FieldContext)['aria-label']
/** Control adapters share a stable label target and supporting text reference. */
export const useFieldControl = () => useContext(FieldContext)
export interface FieldShellProps {
  label: string
  description?: string
  hint?: ReactNode
  labelExtra?: ReactNode
  beforeInput?: ReactNode
  associateControl?: boolean
  inline?: boolean
  disabled?: boolean
  className?: string
  children: ReactNode
}
export function FieldShell({
  label,
  description,
  hint,
  labelExtra,
  beforeInput,
  inline,
  disabled,
  className,
  children,
  associateControl = true,
}: FieldShellProps) {
  const controlId = useId()
  const labelId = `${controlId}-label`
  const helpId = `${controlId}-help`
  const help = hint ?? description
  const activateCustomControl = (event: MouseEvent<HTMLLabelElement>) => {
    if (!associateControl) return
    const control = document.getElementById(controlId)
    if (
      control &&
      !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(control.tagName) &&
      control.matches('[role="textbox"],[role="switch"],[role="checkbox"]')
    ) {
      event.preventDefault()
      control.click()
    }
  }
  return (
    <FieldContext.Provider
      value={{
        id: associateControl ? controlId : undefined,
        'aria-label': label,
        'aria-describedby': help ? helpId : undefined,
      }}
    >
      {inline ? (
        <Stack direction="horizontal" align="center" justify="between" gap="lg" className={className}>
          <Stack gap="dense" className="min-w-0 flex-1">
            <Label
              onClick={activateCustomControl}
              id={labelId}
              htmlFor={associateControl ? controlId : undefined}
            >
              {label}
            </Label>
            {help && (
              <Text id={helpId} type="secondary">
                {help}
              </Text>
            )}
          </Stack>
          <Stack direction="horizontal" align="center" gap="sm" wrap={false}>
            {labelExtra}
            {children}
          </Stack>
        </Stack>
      ) : (
        <Stack
          gap="sm"
          className={className}
          role="group"
          aria-labelledby={labelId}
          aria-disabled={disabled || undefined}
        >
          <Stack direction="horizontal" align="center" justify="between" gap="sm">
            <Label
              onClick={activateCustomControl}
              id={labelId}
              htmlFor={associateControl ? controlId : undefined}
            >
              {label}
            </Label>
            {labelExtra}
          </Stack>
          <FormField supportingTextId={helpId} hint={help}>
            <Stack gap="sm">
              {beforeInput}
              {children}
            </Stack>
          </FormField>
        </Stack>
      )}
    </FieldContext.Provider>
  )
}
