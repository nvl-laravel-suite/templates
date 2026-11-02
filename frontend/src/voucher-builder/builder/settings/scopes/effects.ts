import { Sparkles } from 'lucide-react'
import type { CommonBlockSettings } from '#/voucher-builder/schema'
import type { ShadowValues } from '../primitives/types'
import { defineScope } from './registry'

/**
 * Parse a CSS box-shadow string into structured values.
 * Only handles the subset this app produces: "X Y BLUR SPREAD COLOR [inset]".
 * Returns null for empty/unparseable strings.
 */
function parseShadow(css: string): ShadowValues | null {
  if (!css || !css.trim()) return null
  const inset = /\binset\b/.test(css)
  const cleaned = css.replace(/\binset\b/g, '').trim()
  const colorMatch = cleaned.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|oklch\([^)]+\))/)
  const color = colorMatch ? colorMatch[0] : '#00000026'
  const numeric = cleaned.replace(color, '').trim()
  const parts = numeric.split(/\s+/).map((p) => parseInt(p.replace('px', ''), 10))
  const [x = 0, y = 4, blur = 12, spread = 0] = parts
  return { x, y, blur, spread, color, inset }
}

function serializeShadow(s: ShadowValues | null): string {
  if (!s) return ''
  const inset = s.inset ? 'inset ' : ''
  return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`
}

export const effectsScope = defineScope<'common'>({
  id: 'effects',
  title: 'Effects',
  icon: Sparkles,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'shadow',
      label: 'Shadow',
      type: 'shadow',
      read: (s: CommonBlockSettings) => parseShadow(s.boxShadow || ''),
      write: (v): Partial<CommonBlockSettings> => ({ boxShadow: serializeShadow(v as ShadowValues | null) }),
    },
  ],
})
