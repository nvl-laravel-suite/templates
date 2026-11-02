import type { CSSProperties } from 'react'
import type { CommonBlockSettings } from '../schema'
import {
  buildCommonStyles,
  resolveTypography,
  type TypographyValues,
  FONT_WEIGHT_NUMERIC_MAP,
  IMAGE_FILTER_CSS,
  SHADOW_PRESET_CSS,
} from '../blocks/primitives'

// ── CSS serializer ────────────────────────────────────────────────
// Turn a React CSSProperties object into an inline-style string.
// camelCase → kebab-case; numeric values get `px` unless already a string.

const UNITLESS = new Set([
  'opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow',
  'flexShrink', 'order', 'columnCount',
])

function camelToKebab(key: string): string {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export function cssFromStyle(style: CSSProperties | undefined | null): string {
  if (!style) return ''
  const parts: string[] = []
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined || v === null || v === '') continue
    const kebab = camelToKebab(k)
    const val = typeof v === 'number' && !UNITLESS.has(k) ? `${v}px` : String(v)
    parts.push(`${kebab}:${val}`)
  }
  return parts.join(';')
}

// ── Common-settings wrapper CSS ───────────────────────────────────
export function commonWrapperCss(cs: CommonBlockSettings | undefined): string {
  if (!cs) return ''
  const style = buildCommonStyles(cs)
  // Flatten boxShadow preset to raw if needed
  if (style.boxShadow && SHADOW_PRESET_CSS[style.boxShadow as string]) {
    style.boxShadow = SHADOW_PRESET_CSS[style.boxShadow as string]
  }
  return cssFromStyle(style)
}

// ── Typography CSS ────────────────────────────────────────────────
// Export-only: tracking is a CSS value map; the canvas uses Tailwind classes.

export const LETTER_SPACING_CSS: Record<string, string> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: 'normal',
  wide: '0.025em',
  wider: '0.05em',
}

export interface TypographyCssOptions {
  /** Used when `textColor` is empty. */
  fallbackColor?: string
  /** If the block has its own font size override (e.g. 'auto'), pass it here. */
  fontSizeOverride?: string
}

export function typographyCss(
  values: TypographyValues,
  opts: TypographyCssOptions = {},
): string {
  const { style } = resolveTypography(values, { fallbackTextColor: opts.fallbackColor })
  const parts: string[] = []

  if (style.fontSize) parts.push(`font-size:${style.fontSize}`)
  else if (opts.fontSizeOverride) parts.push(`font-size:${opts.fontSizeOverride}`)
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`)
  if (style.lineHeight) parts.push(`line-height:${style.lineHeight}`)
  if (style.textTransform) parts.push(`text-transform:${style.textTransform}`)
  if (style.color) parts.push(`color:${style.color}`)
  if (style.maxWidth) parts.push(`max-width:${style.maxWidth}`)
  if (values.alignment) parts.push(`text-align:${values.alignment}`)
  if (values.letterSpacing && values.letterSpacing !== 'normal') {
    const ls = LETTER_SPACING_CSS[values.letterSpacing]
    if (ls) parts.push(`letter-spacing:${ls}`)
  }

  return parts.join(';')
}

// ── Re-exports for convenience ────────────────────────────────────
export { FONT_WEIGHT_NUMERIC_MAP, IMAGE_FILTER_CSS, SHADOW_PRESET_CSS }
