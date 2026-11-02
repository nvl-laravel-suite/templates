import { Button } from 'themelia-react-ui/base/buttons'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { ColorPicker } from '../../../../ui/color-picker'
import { useFieldLabel, useFieldControl } from '../field-shell'

export interface ColorInputProps {
  value: string
  onChange: (v: string) => void
  onChangeStart?: () => void
  disabled?: boolean
}

export function ColorInput({ value, onChange, onChangeStart, disabled }: ColorInputProps) {
  return (
    <UIStack gap="md">
      <ColorPicker
        control={useFieldControl()}
        label={useFieldLabel()}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onChangeStart={onChangeStart}
      />
    </UIStack>
  )
}

export interface ColorSwatchInputProps extends ColorInputProps {
  swatches: string[]
}

export function ColorSwatchInput({
  value,
  onChange,
  onChangeStart,
  swatches,
  disabled,
}: ColorSwatchInputProps) {
  return (
    <UIStack gap="md">
      <ColorPicker
        control={useFieldControl()}
        label={useFieldLabel()}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onChangeStart={onChangeStart}
      />
      {swatches.length > 0 && (
        <UIStack direction="horizontal" gap="xs">
          {swatches.map((swatch, i) => (
            <Button
              iconOnly
              buttonStyle="ghost"
              key={i}
              type="button"
              onClick={() => {
                onChangeStart?.()
                onChange(swatch)
              }}
              aria-label={`Use ${swatch}`}
              title={swatch}
              disabled={disabled}
            >
              <span className="nc-color-sample" style={{ backgroundColor: swatch }} />
            </Button>
          ))}
        </UIStack>
      )}
    </UIStack>
  )
}
