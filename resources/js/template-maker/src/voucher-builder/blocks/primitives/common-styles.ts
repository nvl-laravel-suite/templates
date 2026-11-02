import type { CSSProperties } from 'react'
import type { CommonBlockSettings } from '../../schema'
import { SHADOW_PRESET_CSS } from './resolve-image'

/**
 * Turn a `commonSettings` record into a CSSProperties object.
 * Every property is applied only when it differs from the field's
 * default so callers can safely spread the result onto any element.
 */
export function buildCommonStyles(cs: CommonBlockSettings): CSSProperties {
  const style: CSSProperties = {}

  // Padding (always set when any side > 0; leave undefined otherwise so
  // parent CSS / Tailwind defaults apply)
  if (cs.paddingTop > 0) style.paddingTop = cs.paddingTop
  if (cs.paddingRight > 0) style.paddingRight = cs.paddingRight
  if (cs.paddingBottom > 0) style.paddingBottom = cs.paddingBottom
  if (cs.paddingLeft > 0) style.paddingLeft = cs.paddingLeft

  // Margin — same treatment; handle missing x-axis fields gracefully
  if (cs.marginTop > 0) style.marginTop = cs.marginTop
  if ((cs.marginRight ?? 0) > 0) style.marginRight = cs.marginRight
  if (cs.marginBottom > 0) style.marginBottom = cs.marginBottom
  if ((cs.marginLeft ?? 0) > 0) style.marginLeft = cs.marginLeft

  // Background
  if (cs.backgroundColor && cs.backgroundColor !== 'transparent') {
    style.backgroundColor = cs.backgroundColor
  }

  // Border
  if (cs.borderWidth > 0) {
    style.borderWidth = cs.borderWidth
    style.borderColor = cs.borderColor
    style.borderStyle = cs.borderStyle ?? 'solid'
  }
  if (cs.borderRadius > 0) style.borderRadius = cs.borderRadius

  // Opacity
  if (cs.opacity < 1) style.opacity = cs.opacity

  // Box shadow (accept either raw CSS or a known preset key)
  if (cs.boxShadow) {
    const preset = SHADOW_PRESET_CSS[cs.boxShadow]
    style.boxShadow = preset || cs.boxShadow
  }

  // Min height
  if (cs.minHeight > 0) style.minHeight = cs.minHeight

  // Page break (affects print-media only; browsers treat these as page-break-*)
  if (cs.pageBreakBefore) (style as Record<string, unknown>).pageBreakBefore = 'page'
  if (cs.pageBreakAfter) (style as Record<string, unknown>).pageBreakAfter = 'page'

  return style
}

/**
 * Child wrapper styles for composable renderers. Composables want margin
 * on the outer wrapper and padding/background/border on the inner
 * (clickable) wrapper so the selection ring doesn't include margin.
 */
export interface ComposableChildStyles {
  /** Goes on the outer div (owns margins). */
  outer: CSSProperties
  /** Goes on the inner clickable div (owns padding/background/border/opacity). */
  inner: CSSProperties
}

export function buildComposableChildStyles(cs: CommonBlockSettings): ComposableChildStyles {
  const outer: CSSProperties = {}
  if (cs.marginTop > 0) outer.marginTop = cs.marginTop
  if ((cs.marginRight ?? 0) > 0) outer.marginRight = cs.marginRight
  if (cs.marginBottom > 0) outer.marginBottom = cs.marginBottom
  if ((cs.marginLeft ?? 0) > 0) outer.marginLeft = cs.marginLeft

  const inner: CSSProperties = {}
  if (cs.paddingTop > 0) inner.paddingTop = cs.paddingTop
  if (cs.paddingRight > 0) inner.paddingRight = cs.paddingRight
  if (cs.paddingBottom > 0) inner.paddingBottom = cs.paddingBottom
  if (cs.paddingLeft > 0) inner.paddingLeft = cs.paddingLeft
  if (cs.backgroundColor && cs.backgroundColor !== 'transparent') {
    inner.backgroundColor = cs.backgroundColor
  }
  if (cs.borderWidth > 0) {
    inner.borderWidth = cs.borderWidth
    inner.borderColor = cs.borderColor
    inner.borderStyle = cs.borderStyle ?? 'solid'
  }
  if (cs.borderRadius > 0) inner.borderRadius = cs.borderRadius
  if (cs.opacity < 1) inner.opacity = cs.opacity

  return { outer, inner }
}
