import { describe, expect, it } from 'vitest'
import { formatDateValue, resolveDateBlockValue } from './date-block'

describe('formatDateValue', () => {
  const sample = new Date('2026-03-16T12:00:00.000Z')

  it('formats iso dates deterministically', () => {
    expect(formatDateValue(sample, 'iso')).toBe('2026-03-16')
  })

  it('formats month-year dates', () => {
    expect(formatDateValue(sample, 'month-year', 'en-US')).toBe('March 2026')
  })
})

describe('resolveDateBlockValue', () => {
  const sample = new Date('2026-03-16T12:00:00.000Z')

  it('returns static values unchanged', () => {
    expect(resolveDateBlockValue({
      mode: 'static',
      format: 'long',
      staticValue: 'Custom Date',
      now: sample,
    })).toBe('Custom Date')
  })

  it('formats auto dates using the requested format', () => {
    expect(resolveDateBlockValue({
      mode: 'auto',
      format: 'iso',
      staticValue: '',
      now: sample,
    })).toBe('2026-03-16')
  })
})
