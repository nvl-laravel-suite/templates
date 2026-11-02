export type DateDisplayFormat = 'long' | 'month-year' | 'short' | 'iso'
export type DateSourceMode = 'auto' | 'static'

export function formatDateValue(
  date: Date,
  format: DateDisplayFormat,
  locale = 'en-US',
): string {
  if (format === 'iso') {
    return date.toISOString().slice(0, 10)
  }

  if (format === 'month-year') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  if (format === 'short') {
    return new Intl.DateTimeFormat(locale, {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(date)
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function resolveDateBlockValue({
  mode,
  format,
  staticValue,
  locale = 'en-US',
  now = new Date(),
}: {
  mode: DateSourceMode
  format: DateDisplayFormat
  staticValue: string
  locale?: string
  now?: Date
}): string {
  if (mode === 'static') {
    return staticValue
  }

  return formatDateValue(now, format, locale)
}
