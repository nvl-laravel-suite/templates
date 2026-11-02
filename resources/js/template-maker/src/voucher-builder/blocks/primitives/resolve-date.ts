export type DateFormat = 'long' | 'month-year' | 'short' | 'iso'

/**
 * Format a date per the block's chosen preset. Accepts a Date or string;
 * returns the empty string for invalid input.
 */
export function resolveDate(value: string | Date | undefined, format: string = 'long', locale: string = 'en'): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''

  switch (format) {
    case 'iso':
      return date.toISOString().slice(0, 10)
    case 'short':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric' })
    case 'month-year':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' })
    case 'long':
    default:
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
  }
}
