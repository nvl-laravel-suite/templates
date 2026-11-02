import type { FieldSchema, SettingsGroupDef } from '../types'

// ── Source a trait field lives on (content or settings) ─────────
export type TraitFieldSource = 'content' | 'settings'

export interface TraitFieldDef {
  source: TraitFieldSource
  schema: FieldSchema
  /** Fields are conditional on another field's value — useful for date/mode gating */
  when?: { field: string; value: unknown }
}

export interface TraitDefinition {
  id: string
  title: string
  description?: string
  display?: SettingsGroupDef['display']
  defaultOpen?: boolean
  /** Fields this trait contributes to the block. Keyed by local field name. */
  fields: Record<string, TraitFieldDef>
  /**
   * Optional explicit field order for the settings group. If omitted,
   * `Object.keys(fields)` is used.
   */
  fieldOrder?: string[]
}

// ── Block-side configuration for a trait instance ───────────────
export interface TraitInstance {
  /** Which registered trait to apply. */
  trait: string
  /**
   * Prefix to apply to every field name. Lets a block use the same
   * trait twice (e.g. Metric's value and label styles).
   */
  as?: string
  /** Override group title. */
  title?: string
  /** Override default values for specific fields. */
  defaults?: Record<string, unknown>
  /** Hide specific field keys (post-prefix). */
  hideFields?: string[]
  /** Override group open-state. */
  defaultOpen?: boolean
  /** Override display mode. */
  display?: SettingsGroupDef['display']
}

export type TraitRef = string | TraitInstance

// ── Registry ────────────────────────────────────────────────────
const registry = new Map<string, TraitDefinition>()

export function defineTrait(def: TraitDefinition): TraitDefinition {
  registry.set(def.id, def)
  return def
}

export function getTrait(id: string): TraitDefinition | undefined {
  return registry.get(id)
}

export function listTraits(): TraitDefinition[] {
  return [...registry.values()]
}

// ── Helpers used during block registration ──────────────────────

export function normalizeTraitRef(ref: TraitRef): TraitInstance {
  return typeof ref === 'string' ? { trait: ref } : ref
}

/**
 * Apply a `as` prefix to a field name. The prefix becomes the upper-cased
 * first segment — e.g. `prefix('value', 'fontSize') === 'valueFontSize'`.
 */
export function prefixField(prefix: string | undefined, key: string): string {
  if (!prefix) return key
  return `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`
}
