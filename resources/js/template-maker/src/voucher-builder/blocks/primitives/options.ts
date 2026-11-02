import { FONT_SIZE_OPTIONS } from '../../lib/font-sizes'

// ── Reusable option arrays used by traits ────────────────────────

export const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' },
  { value: 'extrabold', label: 'Extra Bold' },
] as const

export const TRACKING_OPTIONS = [
  { value: 'tighter', label: 'Tighter' },
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
  { value: 'wider', label: 'Wider' },
] as const

export const TRANSFORM_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'AA' },
  { value: 'lowercase', label: 'aa' },
  { value: 'capitalize', label: 'Aa' },
] as const

export const FONT_SIZE_FIELD_OPTIONS = [...FONT_SIZE_OPTIONS]
export const FONT_SIZE_FIELD_OPTIONS_WITH_AUTO = [
  { value: 'auto', label: 'Auto · heading level' },
  ...FONT_SIZE_OPTIONS,
]

export const HEADING_LEVEL_OPTIONS = [
  { value: 'h1', label: 'H1' },
  { value: 'h2', label: 'H2' },
  { value: 'h3', label: 'H3' },
  { value: 'h4', label: 'H4' },
  { value: 'h5', label: 'H5' },
  { value: 'h6', label: 'H6' },
] as const

export const ICON_POSITION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const

export const OBJECT_FIT_OPTIONS = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Fill' },
  { value: 'none', label: 'None' },
] as const

export const ASPECT_RATIO_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1/1', label: '1:1' },
  { value: '4/3', label: '4:3' },
  { value: '16/9', label: '16:9' },
  { value: '3/2', label: '3:2' },
  { value: '21/9', label: '21:9' },
] as const

export const SHADOW_PRESET_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
] as const

export const IMAGE_FILTER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'grayscale', label: 'Gray' },
  { value: 'sepia', label: 'Sepia' },
] as const

export const DATE_FORMAT_OPTIONS = [
  { value: 'long', label: 'Long' },
  { value: 'month-year', label: 'Month Year' },
  { value: 'short', label: 'Short' },
  { value: 'iso', label: 'ISO' },
] as const

export const DATE_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'static', label: 'Static' },
] as const

export const QR_EC_OPTIONS = [
  { value: 'L', label: 'Low' },
  { value: 'M', label: 'Med' },
  { value: 'Q', label: 'High' },
  { value: 'H', label: 'Max' },
] as const
