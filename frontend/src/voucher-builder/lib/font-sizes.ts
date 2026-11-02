/** Standardized font size scale used across all blocks */
export const FONT_SIZE_SCALE = {
  'xxs': '0.625rem',   // 10px
  'xs': '0.75rem',     // 12px
  'sm': '0.875rem',    // 14px
  'md': '1rem',        // 16px
  'lg': '1.125rem',    // 18px
  'xl': '1.25rem',     // 20px
  '2xl': '1.5rem',     // 24px
} as const

export type FontSizeKey = keyof typeof FONT_SIZE_SCALE

/** Options for settings enum fields (4 options = pills, 5+ = dropdown) */
export const FONT_SIZE_OPTIONS = [
  { value: 'xxs', label: '10 px' },
  { value: 'xs', label: '12 px' },
  { value: 'sm', label: '14 px' },
  { value: 'md', label: '16 px' },
  { value: 'lg', label: '18 px' },
  { value: 'xl', label: '20 px' },
  { value: '2xl', label: '24 px' },
] as const

/** Resolve a font size key to a CSS value */
export function resolveFontSize(key: string): string {
  return FONT_SIZE_SCALE[key as FontSizeKey] || FONT_SIZE_SCALE.md
}
