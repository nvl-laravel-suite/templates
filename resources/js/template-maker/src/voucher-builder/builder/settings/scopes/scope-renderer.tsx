import { SettingBlock } from '../primitives/setting-block'
import { SettingInput } from '../primitives/setting-input'
import type { SettingInputProps } from '../primitives/types'
import type { ScopeDefinition, ScopeField, ScopeOverride, SourceRow } from './registry'

interface ScopeRendererProps {
  scope: ScopeDefinition
  /** Row of data this scope reads/writes against. */
  row: SourceRow[ScopeDefinition['source']]
  /** Apply a patch — the renderer passes the field's `write()` result here. */
  onPatch: (patch: Record<string, unknown>) => void
  /** Called once before the first live update in a drag/slider interaction. */
  onChangeStart?: () => void
  /** Per-block override (hidden fields, title, default-open). */
  override?: ScopeOverride
  /** Hide the scope's chrome; render the fields directly (used by mixed selection). */
  naked?: boolean
}

/**
 * Render a single scope against a block's source row.
 * Dispatches each field through the `SettingInput` polymorphic primitive.
 */
export function ScopeRenderer({ scope, row, onPatch, onChangeStart, override, naked }: ScopeRendererProps) {
  const hidden = override?.hiddenFields ?? []
  const visible = scope.fields.filter((f) => {
    if (hidden.includes(f.key)) return false
    if (f.when && !f.when(row)) return false
    return true
  })

  if (visible.length === 0) return null

  const body = (
    <>
      {visible.map((field) => (
        <ScopeFieldRenderer
          key={field.key}
          field={field}
          row={row}
          onPatch={onPatch}
          onChangeStart={onChangeStart}
        />
      ))}
    </>
  )

  if (naked) return body

  return (
    <SettingBlock
      label={override?.title ?? scope.title}
      description={scope.description}
      icon={scope.icon}
      display={scope.display ?? 'collapsible'}
      defaultOpen={override?.defaultOpen ?? scope.defaultOpen ?? true}
    >
      {body}
    </SettingBlock>
  )
}

function ScopeFieldRenderer({
  field,
  row,
  onPatch,
  onChangeStart,
}: {
  field: ScopeField
  row: Record<string, unknown> | object
  onPatch: (patch: Record<string, unknown>) => void
  onChangeStart?: () => void
}) {
  const value = field.read(row as never)

  // Build the `SettingInput` props — the scope's config flows through as
  // variant-specific extras. We trust the scope author's config shape matches
  // the field's type (the InputConfig helper constrains this at author time).
  const props = {
    type: field.type,
    label: field.label,
    description: field.description,
    hint: field.hint,
    value,
    onChange: (next: unknown) => onPatch(field.write(next, row as never) as Record<string, unknown>),
    onChangeStart,
    ...(field.config ?? {}),
  } as unknown as SettingInputProps

  return <SettingInput {...props} />
}
