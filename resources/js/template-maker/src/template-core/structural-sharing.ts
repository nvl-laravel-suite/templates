/** Reuse unchanged JSON subtrees in a newly parsed snapshot, keeping the previous snapshot immutable. */
export function shareJSON<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next
  if (Array.isArray(previous) !== Array.isArray(next)) return next
  const before = previous as Record<string, unknown>
  const after = next as Record<string, unknown>
  const keys = Object.keys(after)
  let equal = Object.keys(before).length === keys.length
  for (const key of keys) {
    if (!Object.hasOwn(before, key)) equal = false
    else after[key] = shareJSON(before[key], after[key])
    if (!Object.is(before[key], after[key])) equal = false
  }
  return equal ? previous : next
}
