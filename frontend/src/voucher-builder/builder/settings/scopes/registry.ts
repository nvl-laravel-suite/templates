import type { LucideIcon } from 'lucide-react'
import type { CommonBlockSettings } from '#/voucher-builder/schema'
import type { SettingBlockDisplay } from '../primitives/setting-block'
import type { SettingInputProps } from '../primitives/types'

// ── Source a scope reads/writes against ───────────────────────
export type ScopeSource = 'common' | 'settings' | 'content'

// ── Source row shape (by source kind) ─────────────────────────
export type SourceRow = {
  common: CommonBlockSettings
  settings: Record<string, unknown>
  content: Record<string, unknown>
}

// ── Field definition inside a scope ───────────────────────────
// Each field owns: UI metadata + a read/write pair that maps between
// the source row and the SettingInput variant's `value`/`onChange`.

type VariantOf<T extends SettingInputProps['type']> = Extract<SettingInputProps, { type: T }>

type InputConfig<T extends SettingInputProps['type']> = Omit<
  VariantOf<T>,
  'type' | 'label' | 'value' | 'onChange' | 'onChangeStart' | 'disabled' | 'description' | 'hint' | 'labelExtra' | 'beforeInput' | 'className'
>

export interface ScopeField<
  S extends ScopeSource = ScopeSource,
  T extends SettingInputProps['type'] = SettingInputProps['type'],
> {
  key: string
  label: string
  description?: string
  hint?: string
  type: T
  /** Variant-specific config (min/max/options/units/etc.) */
  config?: InputConfig<T>
  /** Map source row → input value */
  read: (row: SourceRow[S]) => unknown
  /** Map input value → patch for source row */
  write: (value: unknown, row: SourceRow[S]) => Partial<SourceRow[S]>
  /** Optional conditional visibility — evaluated against the source row */
  when?: (row: SourceRow[S]) => boolean
}

// ── Scope definition ──────────────────────────────────────────
export interface ScopeDefinition<S extends ScopeSource = ScopeSource> {
  id: string
  title: string
  description?: string
  icon?: LucideIcon
  display?: SettingBlockDisplay
  defaultOpen?: boolean
  source: S
  fields: ScopeField<S>[]
  /** Only show the scope if this predicate passes (e.g. hide on nested children) */
  visible?: (ctx: ScopeContext) => boolean
}

export interface ScopeContext {
  blockType: string
  isChild: boolean
  isMixedSelection: boolean
}

// ── Per-block override ────────────────────────────────────────
export interface ScopeOverride {
  /** Field keys to hide */
  hiddenFields?: string[]
  /** Override default-open state */
  defaultOpen?: boolean
  /** Override scope title */
  title?: string
}

// ── Registry ──────────────────────────────────────────────────
const registry = new Map<string, ScopeDefinition<any>>()

export function defineScope<S extends ScopeSource>(def: ScopeDefinition<S>): ScopeDefinition<S> {
  if (registry.has(def.id)) {
    // Overwrite is explicit — useful during HMR and test isolation
    registry.set(def.id, def as ScopeDefinition<any>)
    return def
  }
  registry.set(def.id, def as ScopeDefinition<any>)
  return def
}

export function getScope(id: string): ScopeDefinition | undefined {
  return registry.get(id)
}

export function listScopes(): ScopeDefinition[] {
  return [...registry.values()]
}

/** Default ordered scope ids rendered for every block that doesn't override. */
export const DEFAULT_SCOPE_IDS = [
  'spacing',
  'surface',
  'border-shape',
  'effects',
  'layout',
  'visibility',
  'animation',
  'print',
  'dynamic',
] as const
