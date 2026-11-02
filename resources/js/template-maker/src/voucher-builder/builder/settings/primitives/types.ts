import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// ── Shared option type for pills/select ───────────────────────
export interface SettingOption {
  value: string
  label: string
  icon?: LucideIcon
}

// ── Composite value types ─────────────────────────────────────
export interface SpacingValues {
  top: number
  right: number
  bottom: number
  left: number
}

export interface BorderValues {
  radius: number
  width: number
  color: string
  style?: 'solid' | 'dashed' | 'dotted'
}

export interface ShadowValues {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  inset: boolean
}

export interface DimensionValue {
  value: number
  unit: string
}

export const DEFAULT_SHADOW: ShadowValues = {
  x: 0, y: 4, blur: 12, spread: 0, color: '#00000026', inset: false,
}

// ── Base props shared by every variant ────────────────────────
interface BaseInputProps {
  label: string
  description?: string
  hint?: ReactNode
  /** Extra element rendered right next to the label (e.g. reset button) */
  labelExtra?: ReactNode
  /** Rendered just above the control (e.g. suggestion chips) */
  beforeInput?: ReactNode
  disabled?: boolean
  className?: string
  /** Called once before the first live change in a drag/slider interaction */
  onChangeStart?: () => void
}

// ── Variant discriminated union ───────────────────────────────
// Each variant inherits BaseInputProps and layers its own payload.

export type SettingInputProps =
  // Text
  | (BaseInputProps & { type: 'input'; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean })
  | (BaseInputProps & { type: 'textarea'; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; mono?: boolean })
  | (BaseInputProps & { type: 'rich_editor'; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; multiline?: boolean })

  // Numeric
  | (BaseInputProps & { type: 'number'; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number })
  | (BaseInputProps & { type: 'stepper'; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string })
  | (BaseInputProps & { type: 'slider'; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string })
  | (BaseInputProps & { type: 'spacing'; value: SpacingValues; onChange: (v: SpacingValues) => void; max?: number; step?: number })
  | (BaseInputProps & { type: 'dimension'; value: DimensionValue; onChange: (v: DimensionValue) => void; units: string[]; min?: number; max?: number })

  // Toggles
  | (BaseInputProps & { type: 'switch'; value: boolean; onChange: (v: boolean) => void })
  | (BaseInputProps & { type: 'checkbox'; value: boolean; onChange: (v: boolean) => void })

  // Choice
  | (BaseInputProps & { type: 'pills'; value: string; onChange: (v: string) => void; options: SettingOption[]; size?: 'sm' | 'md' })
  | (BaseInputProps & { type: 'select'; value: string; onChange: (v: string) => void; options: SettingOption[] })
  | (BaseInputProps & { type: 'alignment'; value: string; onChange: (v: string) => void; withJustify?: boolean })
  | (BaseInputProps & { type: 'icon'; value: string; onChange: (v: string) => void })

  // Color
  | (BaseInputProps & { type: 'color'; value: string; onChange: (v: string) => void })
  | (BaseInputProps & { type: 'color_swatch'; value: string; onChange: (v: string) => void; swatches: string[] })

  // Composite
  | (BaseInputProps & { type: 'border'; value: BorderValues; onChange: (v: BorderValues) => void; maxRadius?: number; maxWidth?: number })
  | (BaseInputProps & { type: 'shadow'; value: ShadowValues | null; onChange: (v: ShadowValues | null) => void })
  | (BaseInputProps & { type: 'opacity'; value: number; onChange: (v: number) => void })

  // Media / data
  | (BaseInputProps & { type: 'image'; value: string; onChange: (v: string) => void })
  | (BaseInputProps & { type: 'list'; value: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string; maxItems?: number; richText?: boolean })

export type SettingInputType = SettingInputProps['type']

// ── Helper: slider/array unwrap ──────────────────────────────
export function sliderVal(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number)
}
