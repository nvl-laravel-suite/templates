// ── Primitives barrel ─────────────────────────────────────────
export { SettingBlock } from './setting-block'
export type { SettingBlockProps, SettingBlockDisplay } from './setting-block'

export { SettingInput } from './setting-input'
export type { SettingInputProps, SettingInputType } from './types'

export { UnitToggle } from './unit-toggle'
export type { UnitToggleProps } from './unit-toggle'

export { FieldShell } from './field-shell'
export type { FieldShellProps } from './field-shell'

// Shared types (re-exported for convenience)
export {
  sliderVal,
  DEFAULT_SHADOW,
  type SettingOption,
  type SpacingValues,
  type BorderValues,
  type ShadowValues,
  type DimensionValue,
} from './types'
