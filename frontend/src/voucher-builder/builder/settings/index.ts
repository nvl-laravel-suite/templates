// ═══════════════════════════════════════════════════════════════
// Settings public surface (voucher-builder).
//
// All UI code must import SettingInput / SettingBlock / FieldShell
// from here. There is no legacy shim layer anymore.
// ═══════════════════════════════════════════════════════════════

// ── Primitives (preferred) ───────────────────────────────────
export { SettingBlock } from './primitives/setting-block'
export type { SettingBlockProps, SettingBlockDisplay } from './primitives/setting-block'

export { SettingInput } from './primitives/setting-input'
export type { SettingInputProps, SettingInputType } from './primitives/types'

export { FieldShell } from './primitives/field-shell'
export { UnitToggle } from './primitives/unit-toggle'

// ── Shared types ─────────────────────────────────────────────
export {
  sliderVal,
  DEFAULT_SHADOW,
  type SettingOption,
  type SpacingValues,
  type BorderValues,
  type ShadowValues,
  type DimensionValue,
} from './primitives/types'

// ── Panel shell ──────────────────────────────────────────────
export { SettingsPanel } from './settings-panel'

// ── Scopes ────────────────────────────────────────────────────
export {
  defineScope,
  getScope,
  listScopes,
  DEFAULT_SCOPE_IDS,
  type ScopeDefinition,
  type ScopeField,
  type ScopeSource,
  type ScopeOverride,
  type ScopeContext,
  type SourceRow,
} from './scopes'

export { ScopeRenderer } from './scopes/scope-renderer'

// ── Composite utilities ──────────────────────────────────────
export { ChildManager } from './child-manager'
export { ItemListEditor } from './item-list-editor'
