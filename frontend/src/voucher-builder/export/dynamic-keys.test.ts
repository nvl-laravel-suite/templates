import { describe, expect, it } from 'vitest'
import { getProjectDynamicKeys, validateRenderPayload } from './dynamic-keys'
import { createEmptyProject } from '#/voucher-builder/lib/empty-project'
import type { Project } from '#/voucher-builder/schema'

const DEFAULT_CS = {
  paddingTop:0, paddingRight:0, paddingBottom:0, paddingLeft:0,
  marginTop:0, marginRight:0, marginBottom:0, marginLeft:0,
  backgroundColor:'transparent', opacity:1, borderWidth:0,
  borderColor:'#e5e7eb', borderStyle:'solid' as const, borderRadius:0,
  boxShadow:'', fullWidth:false, minHeight:0, anchor:'',
  visibility:'visible' as const,
  animation:'none' as const, animationDelay:0,
  pageBreakBefore:false, pageBreakAfter:false,
  dynamicKey:'', previewValue:'',
}

function fixture(blocks: Record<string, unknown>, previewData: Record<string, string> = {}): Project {
  const empty = createEmptyProject()
  return {
    global: { ...empty.global, previewData },
    blocks: blocks as Project['blocks'],
    sections: [
      { ...empty.sections[0], blockIds: Object.keys(blocks) },
      empty.sections[1],
      empty.sections[2],
    ],
    columnBlocks: {},
    frame: empty.frame,
  }
}

describe('getProjectDynamicKeys', () => {
  it('returns empty manifest when no dynamic keys are present', () => {
    const m = getProjectDynamicKeys(fixture({}))
    expect(m.keys).toEqual([])
    expect(m.required).toEqual([])
    expect(m.optional).toEqual([])
    expect(m.occurrences).toEqual([])
  })

  it('extracts dynamicKey from any block type', () => {
    const m = getProjectDynamicKeys(fixture({
      h1: { id: 'h1', type: 'heading', commonSettings: { ...DEFAULT_CS, dynamicKey: 'name' }, content: { text: '' }, settings: {} },
    }))
    expect(m.keys).toEqual(['name'])
    expect(m.required).toEqual(['name'])
    expect(m.occurrences[0]).toMatchObject({ blockId: 'h1', source: 'dynamic', hasDefault: false })
  })

  it('marks key optional when previewData supplies a default', () => {
    const m = getProjectDynamicKeys(fixture(
      { h1: { id: 'h1', type: 'heading', commonSettings: { ...DEFAULT_CS, dynamicKey: 'name' }, content: { text: '' }, settings: {} } },
      { name: 'Default Name' },
    ))
    expect(m.required).toEqual([])
    expect(m.optional).toEqual(['name'])
    expect(m.occurrences[0]).toMatchObject({ hasDefault: true, defaultValue: 'Default Name' })
  })

  it('marks key optional when block has previewValue fallback', () => {
    const m = getProjectDynamicKeys(fixture({
      h1: { id: 'h1', type: 'heading', commonSettings: { ...DEFAULT_CS, dynamicKey: 'name', previewValue: 'Fallback' }, content: { text: '' }, settings: {} },
    }))
    expect(m.required).toEqual([])
    expect(m.optional).toEqual(['name'])
    expect(m.occurrences[0].defaultValue).toBe('Fallback')
  })

  it('extracts placeholder valueKey with placeholderType', () => {
    const m = getProjectDynamicKeys(fixture({
      dp1: { id: 'dp1', type: 'dataPlaceholder', commonSettings: DEFAULT_CS, content: { valueKey: 'logo', placeholderText: 'Logo', placeholderType: 'image' }, settings: {} },
    }))
    expect(m.keys).toEqual(['logo'])
    expect(m.occurrences[0]).toMatchObject({ source: 'placeholder', placeholderType: 'image' })
  })

  it('extracts QR overwriteKey only when allowOverwrite is true', () => {
    const m = getProjectDynamicKeys(fixture({
      qr1: { id: 'qr1', type: 'qrCode', commonSettings: DEFAULT_CS, content: { value: 'https://default', label: '' }, settings: { allowOverwrite: true, overwriteKey: 'redeem' } },
      qr2: { id: 'qr2', type: 'qrCode', commonSettings: DEFAULT_CS, content: { value: '', label: '' }, settings: { allowOverwrite: false, overwriteKey: 'unused' } },
    }))
    expect(m.keys).toEqual(['redeem'])
    expect(m.occurrences[0]).toMatchObject({ source: 'qr-overwrite', defaultValue: 'https://default' })
  })

  it('treats QR overwrite as required when fallback content.value is empty', () => {
    const m = getProjectDynamicKeys(fixture({
      qr1: { id: 'qr1', type: 'qrCode', commonSettings: DEFAULT_CS, content: { value: '', label: '' }, settings: { allowOverwrite: true, overwriteKey: 'redeem' } },
    }))
    expect(m.required).toEqual(['redeem'])
  })

  it('deduplicates the same key across blocks', () => {
    const m = getProjectDynamicKeys(fixture({
      h1: { id: 'h1', type: 'heading', commonSettings: { ...DEFAULT_CS, dynamicKey: 'name' }, content: { text: '' }, settings: {} },
      h2: { id: 'h2', type: 'heading', commonSettings: { ...DEFAULT_CS, dynamicKey: 'name' }, content: { text: '' }, settings: {} },
    }))
    expect(m.keys).toEqual(['name'])
    expect(m.occurrences).toHaveLength(2)
  })
})

describe('validateRenderPayload', () => {
  const project = fixture(
    {
      h1: { id: 'h1', type: 'heading', commonSettings: { ...DEFAULT_CS, dynamicKey: 'name' }, content: { text: '' }, settings: {} },
      dp1: { id: 'dp1', type: 'dataPlaceholder', commonSettings: DEFAULT_CS, content: { valueKey: 'code', placeholderText: '', placeholderType: 'text' }, settings: {} },
    },
    { name: 'fallback-name' },
  )

  it('passes when all required keys are present', () => {
    const r = validateRenderPayload(project, { code: 'X9' })
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('reports missing required keys', () => {
    const r = validateRenderPayload(project, {})
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['code'])
  })

  it('treats empty string as missing', () => {
    const r = validateRenderPayload(project, { code: '' })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['code'])
  })

  it('reports unused keys without failing', () => {
    const r = validateRenderPayload(project, { code: 'X9', extra: 'ignored' })
    expect(r.ok).toBe(true)
    expect(r.unused).toEqual(['extra'])
  })

  it('handles null/undefined data', () => {
    const r = validateRenderPayload(project, null)
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['code'])
  })
})
