import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { Plus, Trash2 } from 'lucide-react'
import { ImageUpload } from '../../../../ui/image-upload'
import { RichTextField } from '../../../../ui/rich-text-editor'
import { TextInput } from './text'

// ── Image ───────────────────────────────────────────────────────
export interface ImageInputProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function ImageInputVariant({ value, onChange, disabled }: ImageInputProps) {
  return <ImageUpload value={value} onChange={onChange} disabled={disabled} />
}

// ── List ────────────────────────────────────────────────────────
export interface ListInputProps {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  addLabel?: string
  maxItems?: number
  richText?: boolean
  disabled?: boolean
}

export function ListInput({
  value,
  onChange,
  placeholder = 'Item',
  addLabel = 'Add',
  maxItems,
  richText = false,
  disabled,
}: ListInputProps) {
  const canAdd = maxItems === undefined || value.length < maxItems
  return (
    <UIStack gap="md">
      {value.map((item, i) => (
        <UIStack direction="horizontal" gap="sm" wrap={false} key={i} align="start">
          {richText ? (
            <RichTextField
              value={item}
              onChange={(next) => {
                const arr = [...value]
                arr[i] = next
                onChange(arr)
              }}
              placeholder={`${placeholder} ${i + 1}`}
              multiline={false}
              label={`${placeholder} ${i + 1}`}
              className="min-w-0 flex-1"
              disabled={disabled}
            />
          ) : (
            <TextInput
              value={item}
              onChange={(e) => {
                const arr = [...value]
                arr[i] = e.target.value
                onChange(arr)
              }}
              placeholder={`${placeholder} ${i + 1}`}
              aria-label={`${placeholder} ${i + 1}`}
              disabled={disabled}
              className="min-w-0 flex-1"
            />
          )}
          <UIAction
            buttonStyle="ghost"
            iconOnly
            aria-label={`Remove ${placeholder.toLowerCase()} ${i + 1}`}
            disabled={disabled}
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </UIAction>
        </UIStack>
      ))}
      {canAdd && (
        <UIAction
          buttonStyle="ghost"
          type="button"
          onClick={() => onChange([...value, ''])}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </UIAction>
      )}
    </UIStack>
  )
}
