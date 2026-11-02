import { describe, expect, it } from 'vitest'
import { createBlockInstance } from '#/voucher-builder/blocks/factory'
import { formatDateValue } from '#/voucher-builder/lib/date-block'
import '#/voucher-builder/blocks/definitions'

describe('createBlockInstance', () => {
  it('creates localized defaults for supported placeholder content', () => {
    const heading = createBlockInstance('heading', 'heading-1', 'ar')
    const text = createBlockInstance('text', 'text-1', 'ar')

    expect((heading.content as any).text).toBe('عنوان')
    expect((text.content as any).body).toBe('ابدأ الكتابة هنا...')
  })

  it('preserves special runtime defaults that are not static schema values', () => {
    const date = createBlockInstance('date', 'date-1')
    const row = createBlockInstance('row', 'row-1')

    expect((date.content as any).value).toBe(formatDateValue(new Date(), 'long'))
    expect((row.content as any).columnIds).toEqual([])
    expect((row.content as any).columnWidths).toEqual([50, 50])
  })
})
