import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ZodError } from 'zod'
import { validateJSONData } from '../template-core/contracts'
import { Card } from 'themelia-react-ui/base/cards'
import { FormField } from 'themelia-react-ui/base/forms'
import { Input, Textarea } from 'themelia-react-ui/base/text-inputs'
import { Select, ToggleField } from 'themelia-react-ui/base/choice-inputs'
import { Button } from 'themelia-react-ui/base/buttons'
import { Badge } from 'themelia-react-ui/base/badge'
import { Trash2 } from 'lucide-react'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import type { DataSchema, JsonValue, TemplateDefinition, TemplateField, TemplateValue } from '../template-core/schema'

export const STYLE_LABELS: Record<string, string> = {
  color: 'Text color',
  'background-color': 'Background',
  'font-size': 'Font size',
  'line-height': 'Line height',
  width: 'Width',
  height: 'Height',
  'border-radius': 'Corner radius',
  padding: 'Padding',
  margin: 'Margin',
  display: 'Display',
  gap: 'Gap',
  'text-align': 'Text alignment',
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <FormField label={label} hint={hint} className="tc-field">
      {children}
    </FormField>
  )
}

export function CommitInput({
  label,
  value,
  onCommit,
  multiline = false,
  type = 'text',
  placeholder,
  mono = false,
  hint,
  inputClassName,
  rows = 3,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
  multiline?: boolean
  type?: string
  placeholder?: string
  mono?: boolean
  hint?: string
  inputClassName?: string
  rows?: number
}) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const id = useId()
  const skipCommit = useRef(false)
  useEffect(() => {
    setDraft(value)
    setError('')
  }, [value])
  const commit = () => {
    if (skipCommit.current) {
      skipCommit.current = false
      return
    }
    if (draft === value) {
      setError('')
      return
    }
    try {
      onCommit(draft)
      setError('')
    } catch (error) {
      setError(
        error instanceof ZodError
          ? (error.issues[0]?.message ?? 'Check this value.')
          : error instanceof Error
            ? error.message
            : String(error),
      )
    }
  }
  const props = {
    id,
    value: draft,
    'aria-label': label,
    'aria-invalid': !!error,
    'aria-describedby': error || hint ? `${id}-help` : undefined,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Enter' && !multiline) event.currentTarget.blur()
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        skipCommit.current = true
        setDraft(value)
        setError('')
        event.currentTarget.blur()
      }
    },
    className: `${mono ? 'tc-input tc-mono' : 'tc-input'} ${inputClassName ?? ''}`,
  }
  return (
    <FormField
      className="tc-field"
      label={label}
      htmlFor={id}
      error={error || undefined}
      hint={hint}
      supportingTextId={`${id}-help`}
    >
      {multiline ? (
        <Textarea {...props} rows={rows} />
      ) : (
        <Input {...props} type={type} step={type === 'number' ? 'any' : undefined} />
      )}
    </FormField>
  )
}

export function JsonInput({
  label,
  value,
  onCommit,
  hint,
}: {
  label: string
  value: unknown
  onCommit: (value: unknown) => void
  hint?: string
}) {
  return (
    <CommitInput
      label={label}
      multiline
      rows={5}
      mono
      value={value === undefined ? '' : JSON.stringify(value, null, 2)}
      onCommit={(text) => onCommit(text.trim() ? (JSON.parse(text) as unknown) : undefined)}
      hint={hint}
    />
  )
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  hint?: string
}) {
  return (
    <ToggleField kind="checkbox" label={label} description={hint} value={checked} onValueChange={onChange} />
  )
}

export function DataInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField
  value: JsonValue | undefined
  onChange: (value: JsonValue | undefined) => void
}) {
  return (
    <>
      <SchemaInput
        label={field.label}
        schema={field.schema}
        required={field.required}
        value={value}
        onChange={onChange}
      />
      {field.description && (
        <Text type="secondary" size="xs">
          {field.description}
        </Text>
      )}
    </>
  )
}
function emptyValue(schema: DataSchema | undefined): JsonValue {
  if (!schema) return null
  switch (schema.type) {
    case 'string':
      return schema.enum?.[0] ?? ''
    case 'boolean':
      return false
    case 'number':
    case 'integer':
      return schema.type === 'integer'
        ? Math.ceil(schema.minimum ?? Math.min(0, schema.maximum ?? 0))
        : (schema.minimum ?? Math.min(0, schema.maximum ?? 0))
    case 'array':
      return []
    case 'object':
      return Object.fromEntries(
        (schema.required ?? []).map((key) => [key, emptyValue(schema.properties[key])]),
      )
  }
}
function SchemaInput({
  label,
  schema,
  required = false,
  value,
  onChange,
  depth = 0,
}: {
  label: string
  schema: DataSchema
  required?: boolean
  value: JsonValue | undefined
  onChange: (value: JsonValue | undefined) => void
  depth?: number
}) {
  const title = `${label}${required ? ' *' : ''}`
  if (depth > 8)
    return (
      <JsonInput label={title} value={value} onCommit={(value) => onChange(value as JsonValue | undefined)} />
    )
  if (schema.type === 'boolean')
    return (
      <Field label={title}>
        <Select
          placeholder="Choose…"
          className="tc-input"
          aria-label={title}
          value={value === undefined ? '' : String(value)}
          onValueChange={(value) => onChange((value ?? '') === '' ? undefined : (value ?? '') === 'true')}
          options={[
            { value: '', label: 'Choose…' },
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
        />
      </Field>
    )
  if (schema.type === 'array') {
    const items = Array.isArray(value) ? value : []
    return (
      <Stack gap="lg" className="tc-collection" role="group" aria-label={label}>
        <Stack
          direction="horizontal"
          align="center"
          justify="between"
          gap="lg"
          className="tc-collection-heading"
        >
          <Text tag="span" weight="medium">
            {title}
          </Text>
          <Badge>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </Stack>
        {items.map((item, index) => (
          <Card
            key={index}
            surface="card"
            padding="md"
            title={`Item ${index + 1}`}
            headerClassName="flex-nowrap"
            headerAction={
              <Button
                buttonStyle="ghost"
                iconOnly
                type="button"
                aria-label={`Remove ${label} item ${index + 1}`}
                withTooltip={`Remove item ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden />
              </Button>
            }
            className="tc-array-item"
            role="group"
            aria-label={`${label} ${index + 1}`}
          >
            <Stack gap="md">
              <SchemaInput
                label={schema.items.type === 'object' ? '' : 'Value'}
                schema={schema.items}
                required
                value={item}
                depth={depth + 1}
                onChange={(value) =>
                  onChange(items.map((item, i) => (i === index ? (value ?? emptyValue(schema.items)) : item)))
                }
              />
            </Stack>
          </Card>
        ))}
        {!items.length && (
          <Text type="secondary" className="tc-hint">
            No items added yet.
          </Text>
        )}
        <Button
          buttonStyle="ghost"
          type="button"
          className="tc-add-item"
          disabled={schema.maxItems !== undefined && items.length >= schema.maxItems}
          onClick={() => onChange([...items, emptyValue(schema.items)])}
        >
          + Add item
        </Button>
        {!required && (
          <Button buttonStyle="ghost" type="button" disabled={value === undefined}
            aria-label={`Clear ${label}`} onClick={() => onChange(undefined)}>
            Clear field
          </Button>
        )}
      </Stack>
    )
  }
  if (schema.type === 'object') {
    const object = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    return (
      <Stack gap="lg" className="tc-object-fields" role="group" aria-label={label || 'Item details'}>
        <Stack direction="horizontal" align="center" justify="between" gap="md">
          {label && <Text weight="medium">{title}</Text>}
          {!required && (
            <Button buttonStyle="ghost" type="button" disabled={value === undefined}
              aria-label={`Clear ${label || 'object'}`} onClick={() => onChange(undefined)}>
              Clear field
            </Button>
          )}
        </Stack>
        {Object.entries(schema.properties).map(([key, property]) => (
          <SchemaInput
            key={key}
            label={key
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .replace(/_/g, ' ')
              .replace(/^./, (letter) => letter.toUpperCase())}
            schema={property}
            required={schema.required?.includes(key)}
            value={Object.hasOwn(object, key) ? object[key] : undefined}
            depth={depth + 1}
            onChange={(value) => {
              const next = { ...object }
              if (value === undefined) delete next[key]
              else
                Object.defineProperty(next, key, {
                  value,
                  enumerable: true,
                  writable: true,
                  configurable: true,
                })
              onChange(next)
            }}
          />
        ))}
      </Stack>
    )
  }
  if (schema.type === 'string' && schema.enum)
    return (
      <Field label={title}>
        <Select
          placeholder="Choose…"
          className="tc-input"
          aria-label={title}
          value={value === undefined ? '' : String(schema.enum.indexOf(String(value)))}
          onValueChange={(value) =>
            onChange((value ?? '') === '' ? undefined : schema.enum![Number(value ?? '')])
          }
          options={[
            { value: '', label: 'Choose…' },
            ...schema.enum.map((value, index) => ({
              value: String(String(index)),
              label: [value || '(Empty value)'].join(''),
            })),
          ]}
        />
      </Field>
    )
  return (
    <CommitInput
      label={title}
      value={value === undefined || value === null ? '' : String(value)}
      multiline={schema.type === 'string' && !schema.format && (schema.maxLength ?? 0) >= 240}
      type={
        schema.type === 'number' || schema.type === 'integer'
          ? 'number'
          : schema.type === 'string' && schema.format === 'date'
            ? 'date'
            : schema.type === 'string' && schema.format === 'email'
              ? 'email'
              : 'text'
      }
      onCommit={(text) =>
        onChange(
          text === ''
            ? schema.type === 'string' && required && !schema.minLength
              ? ''
              : undefined
            : schema.type === 'number' || schema.type === 'integer'
              ? Number(text)
              : text,
        )
      }
    />
  )
}
export function ValueInput({
  value: authoritativeValue,
  fields,
  onChange: commitValue,
  props: blockProps = [],
  onError,
  assets = [],
  allowedSources,
  literalSchema,
  literalArray = false,
}: {
  value: TemplateValue
  fields: TemplateField[]
  onChange: (value: TemplateValue) => void
  props?: string[]
  assets?: TemplateDefinition['assets']
  allowedSources?: TemplateValue['source'][]
  literalSchema?: DataSchema
  literalArray?: boolean
  /** Receives rejected native selections; buffered inputs retain their own invalid state. */
  onError?: (cause: unknown) => void
}) {
  const [pending, setPending] = useState<TemplateValue | null>(null)
  const identity = JSON.stringify(authoritativeValue)
  useEffect(() => setPending(null), [identity])
  const value = pending ?? authoritativeValue
  const onChange = (next: TemplateValue) => { commitValue(next); setPending(null) }
  const literal = (value: JsonValue | undefined) => {
    if (literalSchema) {
      const issues = validateJSONData(literalSchema, value)
      if (issues.length) throw new Error(issues[0].message)
    }
    if (value === undefined) throw new Error('Enter a value or use Reset to inherit.')
    onChange({source:'literal',value})
  }
  const select = (value: TemplateValue) => {
    try { onChange(value) } catch (cause) {
      // Keep a rejected source selection editable until its required value is supplied.
      if (literalSchema && onError) setPending(value)
      if (onError) onError(cause); else throw cause
    }
  }
  return (
    <Stack gap="lg" className="tc-value-input" aria-invalid={pending ? true : undefined}>
      <Select
        className="tc-input"
        aria-label="Value source"
        value={value.source}
        onValueChange={(value) => {
          const source = value ?? ''
          select(
            source === 'field'
              ? { source, fieldId: fields[0]?.id ?? 'field' }
              : source === 'item'
                ? { source, path: '' }
                : source === 'asset'
                  ? { source, assetId: assets[0]?.id ?? '' }
                : source === 'prop'
                  ? { source, name: blockProps[0] ?? 'value' }
                  : { source: 'literal', value: literalArray ? [] : '' },
          )
        }}
        options={[
          { value: 'literal', label: 'Static value' },
          { value: 'field', label: 'Data field', disabled: !fields.length },
          { value: 'item', label: 'Repeating item' },
          ...(blockProps.length > 0 ? [{ value: 'prop', label: 'Block property' }] : []),
          ...(assets.length || value.source === 'asset' ? [{ value: 'asset', label: 'Asset' }] : []),
        ].filter(option => !allowedSources || allowedSources.includes(option.value as TemplateValue['source']))}
      />
      {value.source === 'field' ? (
        <Select
          className="tc-input"
          aria-label="Bound field"
          value={value.fieldId}
          onValueChange={(value) => select({ source: 'field', fieldId: value ?? '' })}
          options={[...fields.map((field) => ({ value: String(field.id), label: String(field.label) }))]}
        />
      ) : value.source === 'item' ? (
        <CommitInput
          label="Item property"
          value={value.path}
          placeholder="Current item"
          hint="Leave empty for the whole item, or enter a property such as name or price.amount. Nested repeaters use their nearest item."
          onCommit={(path) => onChange({ source: 'item', path })}
        />
      ) : value.source === 'literal' && literalArray ? (
        <JsonInput label="Static items" value={value.value} hint="Enter a JSON array. Each child uses the current item or one of its properties."
          onCommit={value => {
            if (!Array.isArray(value)) throw new Error('Repeating content requires an array.')
            onChange({ source: 'literal', value })
          }} />
      ) : value.source === 'literal' && literalSchema ? (
        literalSchema.type === 'array' || literalSchema.type === 'object'
          ? <JsonInput label="Static value" value={value.value} onCommit={value => literal(value as JsonValue | undefined)} />
          : literalSchema.type === 'string' && !literalSchema.enum ? <CommitInput label="Static text" multiline value={String(value.value ?? '')} onCommit={literal} />
          : <DataInput field={{id:'literal',path:'literal',label:literalSchema.type === 'string' ? 'Static text' : 'Static value',schema:literalSchema,required:false,editable:true,description:''}} value={value.value} onChange={literal} />
      ) : value.source === 'literal' ? (
        <>
          <Field label="Static value type">
            <Select
              className="tc-input"
              aria-label="Static value type"
              value={typeof value.value === 'string' ? 'text' : 'json'}
              onValueChange={(value) =>
                select({ source: 'literal', value: (value ?? '') === 'text' ? '' : 0 })
              }
              options={[
                { value: 'text', label: 'Text' },
                { value: 'json', label: 'Number, boolean, or structured data' },
              ]}
            />
          </Field>
          {typeof value.value === 'string' ? (
            <CommitInput
              label="Static text"
              value={value.value}
              multiline
              onCommit={(text) => onChange({ source: 'literal', value: text })}
            />
          ) : (
            <JsonInput
              label="Static value"
              value={value.value}
              onCommit={(value) => onChange({ source: 'literal', value: value as JsonValue })}
            />
          )}
        </>
      ) : value.source === 'prop' ? (
        <span className="tc-code">{value.name}</span>
      ) : assets.length ? (
        <Select aria-label="Bound asset" value={value.assetId} options={assets.map(asset => ({value:asset.id,label:asset.name}))} onValueChange={id => select({source:'asset',assetId:id ?? ''})} />
      ) : (
        <span className="tc-code">{value.assetId}</span>
      )}
    </Stack>
  )
}
export function defaultDataSchema(type: DataSchema['type']): DataSchema {
  if (type === 'string') return { type, minLength: 1 }
  if (type === 'array') return { type, items: { type: 'string' } }
  if (type === 'object') return { type, properties: {}, additionalProperties: false }
  if (type === 'boolean') return { type }
  return { type }
}
