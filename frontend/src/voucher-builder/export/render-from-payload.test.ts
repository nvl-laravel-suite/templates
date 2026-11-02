import { describe, expect, it } from 'vitest'
import { renderFromPayload } from './render-from-payload'
import { exportToJSON } from './json'
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

function projectWithHeading(dynamicKey: string): Project {
  const empty = createEmptyProject()
  return {
    global: empty.global,
    blocks: {
      h1: {
        id: 'h1',
        type: 'heading',
        commonSettings: { ...DEFAULT_CS, dynamicKey },
        content: { text: 'baseline' },
        settings: { alignment: 'left', fontSize: 'lg', fontWeight: 'bold', letterSpacing: 'normal', textTransform: 'none', level: 'h2', lineHeight: 0, maxWidth: 0, textColor: '' },
      } as Project['blocks'][string],
    },
    sections: [
      { ...empty.sections[0], blockIds: ['h1'] },
      empty.sections[1],
      empty.sections[2],
    ],
    columnBlocks: {},
    frame: empty.frame,
  }
}

describe('renderFromPayload — input formats', () => {
  it('accepts a raw Project', () => {
    const r = renderFromPayload({ project: projectWithHeading('name'), data: { name: 'Jane' } })
    expect(r.errors).toEqual([])
    expect(r.html).toContain('Jane')
  })

  it('accepts a v2 envelope object', () => {
    const envelope = exportToJSON(projectWithHeading('name'))
    const r = renderFromPayload({ project: envelope as unknown as Record<string, unknown>, data: { name: 'Jane' } })
    expect(r.errors).toEqual([])
    expect(r.html).toContain('Jane')
  })

  it('accepts a JSON string', () => {
    const json = JSON.stringify(exportToJSON(projectWithHeading('name')))
    const r = renderFromPayload({ project: json, data: { name: 'Jane' } })
    expect(r.errors).toEqual([])
    expect(r.html).toContain('Jane')
  })

  it('rejects malformed JSON string', () => {
    const r = renderFromPayload({ project: '{not json' })
    expect(r.html).toBe('')
    expect(r.errors[0]).toMatch(/Invalid JSON/)
  })

  it('rejects unrecognized object', () => {
    const r = renderFromPayload({ project: { random: 'thing' } as Record<string, unknown> })
    expect(r.html).toBe('')
    expect(r.errors.length).toBeGreaterThan(0)
  })
})

describe('renderFromPayload — substitution fallback chain', () => {
  it('payload data overrides project previewData', () => {
    const project = projectWithHeading('name')
    project.global = { ...project.global, previewData: { name: 'project-default' } }
    const r = renderFromPayload({ project, data: { name: 'PAYLOAD' } })
    expect(r.html).toContain('PAYLOAD')
    expect(r.html).not.toContain('project-default')
  })

  it('falls back to project previewData when payload has no key', () => {
    const project = projectWithHeading('name')
    project.global = { ...project.global, previewData: { name: 'project-default' } }
    const r = renderFromPayload({ project })
    expect(r.html).toContain('project-default')
  })

  it('falls back to block previewValue when neither payload nor previewData has it', () => {
    const project = projectWithHeading('name')
    project.blocks.h1.commonSettings = { ...project.blocks.h1.commonSettings!, previewValue: 'block-fallback' }
    const r = renderFromPayload({ project })
    expect(r.html).toContain('block-fallback')
  })

  it('keeps original content when no substitution is available', () => {
    const project = projectWithHeading('name')
    const r = renderFromPayload({ project })
    expect(r.html).toContain('baseline')
  })
})

describe('renderFromPayload — validate flag', () => {
  it('does not fail when validate is omitted and required keys are missing', () => {
    const r = renderFromPayload({ project: projectWithHeading('name') })
    expect(r.errors).toEqual([])
    expect(r.html.length).toBeGreaterThan(0)
  })

  it('fails fast when validate is true and required keys missing', () => {
    const r = renderFromPayload({ project: projectWithHeading('name'), validate: true })
    expect(r.html).toBe('')
    expect(r.errors[0]).toMatch(/Missing required dynamic keys/)
    expect(r.validation?.ok).toBe(false)
    expect(r.validation?.missing).toEqual(['name'])
  })

  it('warns about unused keys without failing', () => {
    const r = renderFromPayload({
      project: projectWithHeading('name'),
      data: { name: 'Jane', extra: 'noop' },
      validate: true,
    })
    expect(r.errors).toEqual([])
    expect(r.warnings.some((w) => w.includes('unused'))).toBe(true)
    expect(r.validation?.unused).toEqual(['extra'])
  })

  it('populates manifest on every successful parse', () => {
    const r = renderFromPayload({ project: projectWithHeading('name'), data: { name: 'X' } })
    expect(r.manifest?.keys).toEqual(['name'])
  })
})

describe('renderFromPayload — frame and title overrides', () => {
  it('overrides documentTitle', () => {
    const r = renderFromPayload({ project: projectWithHeading('name'), data: { name: 'X' }, documentTitle: 'Custom' })
    expect(r.html).toContain('<title>Custom</title>')
  })

  it('overrides frame imageUrl', () => {
    const r = renderFromPayload({ project: projectWithHeading('name'), data: { name: 'X' }, frame: { imageUrl: 'https://override/frame.png' } })
    expect(r.html).toContain('https://override/frame.png')
  })
})

describe('renderFromPayload — strict mode', () => {
  it('rejects malformed projects when strict is true', () => {
    const malformed = { global: {}, blocks: {}, sections: [], columnBlocks: {}, frame: { imageUrl: null, opacity: 1 } }
    const r = renderFromPayload({ project: malformed as unknown as Record<string, unknown>, strict: true })
    expect(r.html).toBe('')
    expect(r.errors[0]).toMatch(/Strict validation failed/)
  })

  it('accepts well-formed projects when strict is true', () => {
    const r = renderFromPayload({ project: projectWithHeading('name'), data: { name: 'X' }, strict: true })
    expect(r.errors).toEqual([])
    expect(r.html.length).toBeGreaterThan(0)
  })
})
