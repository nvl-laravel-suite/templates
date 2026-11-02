import type { CSSProperties } from 'react'

export interface ImageValues {
  src?: string
  alt?: string
  objectFit?: string
  aspectRatio?: string
}

export interface ImageResult {
  src: string | undefined
  alt: string
  style: CSSProperties
}

/**
 * Resolve image source + common layout styles.
 * `aspectRatio === 'auto'` means the intrinsic ratio is preserved.
 */
export function resolveImage({ src, alt, objectFit, aspectRatio }: ImageValues): ImageResult {
  const style: CSSProperties = {}
  if (objectFit) style.objectFit = objectFit as CSSProperties['objectFit']
  if (aspectRatio && aspectRatio !== 'auto') style.aspectRatio = aspectRatio
  return {
    src: src || undefined,
    alt: alt ?? '',
    style,
  }
}

// ── Shadow preset → CSS value (shared with image/filter-like blocks) ───
export const SHADOW_PRESET_CSS: Record<string, string> = {
  none: '',
  sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.08)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.08)',
}

export const IMAGE_FILTER_CSS: Record<string, string> = {
  none: '',
  grayscale: 'grayscale(100%)',
  sepia: 'sepia(80%)',
}
