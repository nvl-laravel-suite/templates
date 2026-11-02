import type { CSSProperties } from 'react'
import { resolveFontSize } from '../../lib/font-sizes'

// ── className maps (single source of truth) ────────────────────────

export const WEIGHT_CLASSES: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
}

export const TRACKING_CLASSES: Record<string, string> = {
  tighter: 'tracking-tighter',
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
  wider: 'tracking-wider',
}

export const ALIGN_CLASSES: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
}

export const HEADING_LEVEL_SIZES: Record<string, string> = {
  h1: 'text-4xl',
  h2: 'text-3xl',
  h3: 'text-2xl',
  h4: 'text-xl',
  h5: 'text-lg',
  h6: 'text-base',
}

// ── Resolver ────────────────────────────────────────────────────

export interface TypographyValues {
  fontSize?: string
  fontWeight?: string
  letterSpacing?: string
  textTransform?: string
  alignment?: string
  lineHeight?: number
  maxWidth?: number
  textColor?: string
}

export interface TypographyResult {
  classes: string[]
  style: CSSProperties
}

/**
 * Turn a set of typography values into a list of classes + a style object.
 * Any undefined / zero value is omitted. Callers compose the returned
 * `classes` array with their own className builder (cn).
 */
export function resolveTypography(values: TypographyValues, options: { fallbackTextColor?: string } = {}): TypographyResult {
  const classes: string[] = []
  const style: CSSProperties = {}

  if (values.fontWeight && WEIGHT_CLASSES[values.fontWeight]) {
    classes.push(WEIGHT_CLASSES[values.fontWeight])
  }
  if (values.letterSpacing && TRACKING_CLASSES[values.letterSpacing]) {
    classes.push(TRACKING_CLASSES[values.letterSpacing])
  }
  if (values.alignment && ALIGN_CLASSES[values.alignment]) {
    classes.push(ALIGN_CLASSES[values.alignment])
  }
  if (values.fontSize && values.fontSize !== 'auto') {
    style.fontSize = resolveFontSize(values.fontSize)
  }
  if (values.textTransform && values.textTransform !== 'none') {
    style.textTransform = values.textTransform as CSSProperties['textTransform']
  }
  if (values.textColor) {
    style.color = values.textColor
  } else if (options.fallbackTextColor !== undefined) {
    style.color = options.fallbackTextColor
  }
  if (typeof values.lineHeight === 'number' && values.lineHeight > 0) {
    style.lineHeight = values.lineHeight
  }
  if (typeof values.maxWidth === 'number' && values.maxWidth > 0) {
    style.maxWidth = `${values.maxWidth}%`
  }

  return { classes, style }
}

export const DEFAULT_TEXT_COLOR = 'var(--nc-text, #111827)'
