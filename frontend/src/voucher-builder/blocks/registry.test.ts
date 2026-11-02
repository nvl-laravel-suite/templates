import { describe, expect, it } from 'vitest'
import {
  getBlockChildKind,
  getStructuralChildIds,
  hasBlockListChildren,
  isComposableType,
  isStructuralType,
} from '#/voucher-builder/blocks'
import '#/voucher-builder/blocks/definitions'

describe('block capability helpers', () => {
  it('classifies structural and block-list child models correctly', () => {
    expect(getBlockChildKind('row')).toBe('row-columns')
    expect(getBlockChildKind('grid')).toBe('grid-cells')
    expect(getBlockChildKind('hero')).toBe('block-list')
    expect(getBlockChildKind('column')).toBe('block-list')
    expect(getBlockChildKind('heading')).toBe('none')

    expect(isStructuralType('row')).toBe(true)
    expect(isStructuralType('grid')).toBe(true)
    expect(isStructuralType('hero')).toBe(false)

    expect(hasBlockListChildren('hero')).toBe(true)
    expect(hasBlockListChildren('column')).toBe(true)
    expect(hasBlockListChildren('heading')).toBe(false)

    expect(isComposableType('hero')).toBe(true)
    // `section` is a container (canContain) but has no childTemplates,
    // so it does not qualify as "composable" under this helper's contract.
    expect(isComposableType('section')).toBe(false)
    expect(isComposableType('column')).toBe(false)
  })

  it('reads structural child IDs through the registry contract', () => {
    expect(getStructuralChildIds({
      type: 'row',
      content: { columnIds: ['col-1', 'col-2'] },
    })).toEqual(['col-1', 'col-2'])

    expect(getStructuralChildIds({
      type: 'grid',
      content: { cellIds: ['cell-1', 'cell-2'] },
    })).toEqual(['cell-1', 'cell-2'])

    expect(getStructuralChildIds({
      type: 'heading',
      content: { text: 'Hello' },
    })).toEqual([])
  })
})
