import { describe, expect, it } from 'vitest'
import { getBlockSettings, getBlockSettingsTyped, patchBlockSettings } from './settings-accessor'
import type { Block } from '#/voucher-builder/schema'

describe('getBlockSettings', () => {
  it('returns the block settings as a record', () => {
    const block = { id: 'a', type: 'heading', commonSettings: undefined, content: { text: '' }, settings: { fontSize: 'lg', fontWeight: 'bold' } } as unknown as Block
    expect(getBlockSettings(block)).toEqual({ fontSize: 'lg', fontWeight: 'bold' })
  })

  it('returns empty record when settings absent', () => {
    const block = { id: 'a', type: 'spacer', content: {}, commonSettings: undefined } as unknown as Block
    expect(getBlockSettings(block)).toEqual({})
  })
})

describe('getBlockSettingsTyped', () => {
  it('narrows by block.type', () => {
    const block = { id: 'a', type: 'heading', commonSettings: undefined, content: { text: '' }, settings: { fontSize: 'lg', fontWeight: 'bold' } } as unknown as Block
    if (block.type === 'heading') {
      const typed = getBlockSettingsTyped(block)
      expect(typed.fontSize).toBe('lg')
    }
  })
})

describe('patchBlockSettings', () => {
  it('returns a new block with merged settings, leaves original untouched', () => {
    const block = { id: 'a', type: 'heading', commonSettings: undefined, content: { text: '' }, settings: { fontSize: 'lg', fontWeight: 'bold' } } as unknown as Block
    const patched = patchBlockSettings(block, { fontSize: 'xl' })
    expect(getBlockSettings(patched).fontSize).toBe('xl')
    expect(getBlockSettings(patched).fontWeight).toBe('bold')
    expect(getBlockSettings(block).fontSize).toBe('lg') // original untouched
    expect(patched).not.toBe(block)
  })

  it('does not drop settings keys absent from the patch', () => {
    const block = { id: 'a', type: 'heading', commonSettings: undefined, content: { text: '' }, settings: { fontSize: 'lg', fontWeight: 'bold', alignment: 'center' } } as unknown as Block
    const patched = patchBlockSettings(block, { fontSize: 'xl' })
    expect(getBlockSettings(patched).alignment).toBe('center')
  })
})
