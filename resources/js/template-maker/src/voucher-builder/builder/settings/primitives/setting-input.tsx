import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { Undo2 } from 'lucide-react'
import { Hint } from '../../../ui/typography'
import { FieldShell } from './field-shell'
import { TextInput, TextareaInput, RichTextInput } from './variants/text'
import { DimensionFieldInput, SliderInput, SpacingInput, StepperInput } from './variants/numeric'
import { AlignmentInput, IconInput, PillsInput, SelectInput } from './variants/choice'
import { CheckboxInput, SwitchInput } from './variants/toggle'
import { ColorInput, ColorSwatchInput } from './variants/color'
import { BorderInput, OpacityInput, ShadowInput } from './variants/composite'
import { ImageInputVariant, ListInput } from './variants/media'
import type { SettingInputProps } from './types'

/**
 * Polymorphic settings input. One JSX entry point — the `type` prop
 * picks the right variant. Every variant shares the same outer API
 * (label, description, hint, disabled, className, onChangeStart).
 */
export function SettingInput(props: SettingInputProps) {
  // Boolean controls keep their visible label beside the control.
  const isInline = props.type === 'switch' || props.type === 'checkbox'

  switch (props.type) {
    // ── Text ──────────────────────────────────────────────────
    case 'input':
      return (
        <FieldShell {...shellProps(props)}>
          <TextInput
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            disabled={props.disabled}
            mono={props.mono}
          />
        </FieldShell>
      )
    case 'textarea':
      return (
        <FieldShell {...shellProps(props)}>
          <TextareaInput
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            rows={props.rows}
            mono={props.mono}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'rich_editor':
      return (
        <FieldShell {...shellProps(props)}>
          <RichTextInput
            value={props.value}
            onChange={props.onChange}
            placeholder={props.placeholder}
            rows={props.rows}
            multiline={props.multiline}
            disabled={props.disabled}
          />
        </FieldShell>
      )

    // ── Numeric ────────────────────────────────────────────────
    case 'number':
      return (
        <FieldShell {...shellProps(props)}>
          <TextInput
            type="number"
            value={props.value}
            onChange={(e) => props.onChange(Number(e.target.value))}
            min={props.min}
            max={props.max}
            step={props.step}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'stepper':
      return (
        <FieldShell {...shellProps(props)}>
          <StepperInput
            value={props.value}
            onChange={props.onChange}
            min={props.min}
            max={props.max}
            step={props.step}
            suffix={props.suffix}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'slider': {
      const suffix = props.suffix ?? ''
      const hint = props.hint ?? (
        <Hint>
          {props.value}
          {suffix}
        </Hint>
      )
      return (
        <FieldShell {...shellProps(props)} hint={hint}>
          <UIStack direction="horizontal" gap="lg" align="center" wrap={false} className="">
            <SliderInput
              value={props.value}
              onChange={props.onChange}
              onChangeStart={props.onChangeStart}
              min={props.min}
              max={props.max}
              step={props.step}
              disabled={props.disabled}
            />
            <div className="w-20 shrink-0">
              <TextInput
                type="number"
                className="tabular-nums"
                value={props.value === 0 && typeof props.hint === 'string' ? '' : props.value}
                placeholder={
                  typeof props.hint === 'string'
                    ? props.hint === 'No limit'
                      ? 'None'
                      : props.hint
                    : undefined
                }
                min={props.min}
                max={props.max}
                step={props.step ?? 1}
                disabled={props.disabled}
                onFocus={() => props.onChangeStart?.()}
                onChange={(e) => {
                  if (e.target.value !== '')
                    props.onChange(Math.min(props.max, Math.max(props.min, Number(e.target.value))))
                }}
              />
            </div>
          </UIStack>
        </FieldShell>
      )
    }
    case 'spacing':
      // spacing owns its own label/hint row internally
      return (
        <SpacingInput
          label={props.label}
          value={props.value}
          onChange={props.onChange}
          onChangeStart={props.onChangeStart}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
        />
      )
    case 'dimension':
      return (
        <FieldShell {...shellProps(props)}>
          <DimensionFieldInput
            value={props.value}
            onChange={props.onChange}
            units={props.units}
            min={props.min}
            max={props.max}
            disabled={props.disabled}
          />
        </FieldShell>
      )

    // ── Toggles ────────────────────────────────────────────────
    case 'switch':
      return (
        <FieldShell {...shellProps(props)} inline={isInline}>
          <SwitchInput value={props.value} onChange={props.onChange} disabled={props.disabled} />
        </FieldShell>
      )
    case 'checkbox':
      return (
        <FieldShell {...shellProps(props)} inline={isInline}>
          <CheckboxInput value={props.value} onChange={props.onChange} disabled={props.disabled} />
        </FieldShell>
      )

    // ── Choice ─────────────────────────────────────────────────
    case 'pills':
      return (
        <FieldShell {...shellProps(props)}>
          <PillsInput
            value={props.value}
            onChange={props.onChange}
            options={props.options}
            size={props.size}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'select':
      return (
        <FieldShell {...shellProps(props)}>
          <SelectInput
            value={props.value}
            onChange={props.onChange}
            options={props.options}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'alignment':
      return (
        <FieldShell {...shellProps(props)} inline={isInline}>
          <AlignmentInput
            value={props.value}
            onChange={props.onChange}
            withJustify={props.withJustify}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'icon':
      return (
        <FieldShell {...shellProps(props)}>
          <IconInput value={props.value} onChange={props.onChange} disabled={props.disabled} />
        </FieldShell>
      )

    // ── Color ──────────────────────────────────────────────────
    case 'color': {
      const hasCustom = !!props.value && props.value !== 'transparent'
      const labelExtra = hasCustom ? (
        <UIAction
          buttonStyle="ghost"
          type="button"
          onClick={() => {
            props.onChangeStart?.()
            props.onChange('')
          }}
          iconOnly
          size="sm"
          aria-label="Reset to default"
          title="Reset to default"
        >
          <Undo2 className="h-3 w-3" />
        </UIAction>
      ) : undefined
      return (
        <FieldShell {...shellProps(props)} labelExtra={props.labelExtra ?? labelExtra}>
          <ColorInput
            value={props.value}
            onChange={props.onChange}
            onChangeStart={props.onChangeStart}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    }
    case 'color_swatch':
      return (
        <FieldShell {...shellProps(props)}>
          <ColorSwatchInput
            value={props.value}
            onChange={props.onChange}
            onChangeStart={props.onChangeStart}
            swatches={props.swatches}
            disabled={props.disabled}
          />
        </FieldShell>
      )

    // ── Composite ──────────────────────────────────────────────
    case 'border':
      return (
        <FieldShell {...shellProps(props)}>
          <BorderInput
            value={props.value}
            onChange={props.onChange}
            onChangeStart={props.onChangeStart}
            maxRadius={props.maxRadius}
            maxWidth={props.maxWidth}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'shadow':
      return (
        <FieldShell {...shellProps(props)}>
          <ShadowInput
            value={props.value}
            onChange={props.onChange}
            onChangeStart={props.onChangeStart}
            disabled={props.disabled}
          />
        </FieldShell>
      )
    case 'opacity':
      return (
        <FieldShell {...shellProps(props)} hint={<Hint>{Math.round(props.value * 100)}%</Hint>}>
          <OpacityInput
            value={props.value}
            onChange={props.onChange}
            onChangeStart={props.onChangeStart}
            disabled={props.disabled}
          />
        </FieldShell>
      )

    // ── Media ──────────────────────────────────────────────────
    case 'image':
      return (
        <FieldShell {...shellProps(props)}>
          <ImageInputVariant value={props.value} onChange={props.onChange} disabled={props.disabled} />
        </FieldShell>
      )
    case 'list':
      return (
        <FieldShell {...shellProps(props)}>
          <ListInput
            value={props.value}
            onChange={props.onChange}
            placeholder={props.placeholder}
            addLabel={props.addLabel}
            maxItems={props.maxItems}
            richText={props.richText}
            disabled={props.disabled}
          />
        </FieldShell>
      )
  }
}

function shellProps(props: SettingInputProps) {
  return {
    label: props.label,
    associateControl: [
      'input',
      'textarea',
      'rich_editor',
      'number',
      'stepper',
      'switch',
      'checkbox',
      'select',
      'color',
      'color_swatch',
      'icon',
    ].includes(props.type),
    description: props.description,
    hint: props.hint,
    labelExtra: props.labelExtra,
    beforeInput: props.beforeInput,
    disabled: props.disabled,
    className: props.className,
  }
}
