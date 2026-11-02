export interface LinkValues {
  url?: string
  openInNew?: boolean
  rel?: string
}

export interface LinkResult {
  href: string | undefined
  target: '_blank' | undefined
  rel: string | undefined
}

/**
 * Resolve a link from its values. Returns `href === undefined` for empty
 * or placeholder URLs so callers can render a disabled state.
 */
export function resolveLink({ url, openInNew, rel }: LinkValues): LinkResult {
  const href = url && url !== '#' ? url : undefined
  const target = openInNew ? '_blank' : undefined
  const resolvedRel = openInNew ? (rel || 'noopener noreferrer') : rel || undefined
  return { href, target, rel: resolvedRel }
}
