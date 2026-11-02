import { describe, expect, it } from 'vitest'
import '#/voucher-builder/blocks/definitions'
import { createBlockInstance } from '#/voucher-builder/blocks/factory'
import type { Project } from '#/voucher-builder/schema'
import {
  analyzeTypography,
  buildNormalizationPatches,
} from './typography-audit'

function emptyProject(): Project {
  return {
    global: {
      layout: { pagePadding: 40, margin: 10 },
      typography: {
        headingFont: 'Inter', bodyFont: 'Inter', baseSize: 16,
        lineHeight: 1.5, headingLineHeight: 1.2, paragraphSpacing: 0, headingSpacing: 0,
      },
      colors: {
        primary: '#111827', accent: '#3b82f6', background: '#ffffff',
        text: '#111827', secondary: '#6b7280', border: '#e5e7eb',
        surface: '#f9fafb', link: '#2563eb',
      },
      metadata: { title: '', author: '', subject: undefined, keywords: [], language: 'en' },
      previewData: {},
    },
    blocks: {},
    sections: [
      { id: 's1', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: [] },
      { id: 's2', height: 100, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: [] },
      { id: 's3', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: [] },
    ],
    columnBlocks: {},
    frame: { imageUrl: null, opacity: 1 },
  }
}

function addBlock(project: Project, id: string, type: 'heading' | 'text' | 'metadata', settings: Record<string, unknown>) {
  const block = createBlockInstance(type, id) as any
  block.settings = { ...block.settings, ...settings }
  project.blocks[id] = block
  project.sections[0].blockIds.push(id)
}

describe('analyzeTypography', () => {
  it('returns no variances on an empty project', () => {
    const report = analyzeTypography(emptyProject())
    expect(report.families).toEqual([])
    expect(report.totalVariances).toBe(0)
  })

  it('skips families with fewer than two blocks', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { fontWeight: 'bold' })
    const report = analyzeTypography(project)
    expect(report.families).toEqual([])
  })

  it('skips families where all blocks match', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { fontWeight: 'bold', alignment: 'left', fontSize: 'auto' })
    addBlock(project, 'h2', 'heading', { fontWeight: 'bold', alignment: 'left', fontSize: 'auto' })
    const report = analyzeTypography(project)
    expect(report.totalVariances).toBe(0)
  })

  it('detects a fontWeight variance with the majority first', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { fontWeight: 'bold' })
    addBlock(project, 'h2', 'heading', { fontWeight: 'bold' })
    addBlock(project, 'h3', 'heading', { fontWeight: 'medium' })

    const report = analyzeTypography(project)
    expect(report.families).toHaveLength(1)

    const family = report.families[0]
    expect(family.family).toBe('heading')
    expect(family.blockIds).toEqual(['h1', 'h2', 'h3'])

    const weightVariance = family.variances.find((v) => v.attr === 'fontWeight')
    expect(weightVariance).toBeDefined()
    expect(weightVariance!.majority).toBe('bold')
    expect(weightVariance!.values[0]).toEqual({ value: 'bold', count: 2, blockIds: ['h1', 'h2'] })
    expect(weightVariance!.values[1]).toEqual({ value: 'medium', count: 1, blockIds: ['h3'] })
  })

  it('detects text color variances across headings', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { textColor: '#ef4444' })
    addBlock(project, 'h2', 'heading', { textColor: '#3b82f6' })
    addBlock(project, 'h3', 'heading', { textColor: '#ef4444' })

    const report = analyzeTypography(project)
    const colorVar = report.families[0].variances.find((v) => v.attr === 'textColor')
    expect(colorVar).toBeDefined()
    expect(colorVar!.majority).toBe('#ef4444')
    expect(colorVar!.values).toHaveLength(2)
  })

  it('groups variances by family independently', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { fontWeight: 'bold' })
    addBlock(project, 'h2', 'heading', { fontWeight: 'normal' })
    addBlock(project, 'p1', 'text', { fontSize: 'md' })
    addBlock(project, 'p2', 'text', { fontSize: 'lg' })

    const report = analyzeTypography(project)
    expect(report.families.map((f) => f.family).sort()).toEqual(['heading', 'text'])
  })

  it('reads metadata prefixed field* attributes', () => {
    const project = emptyProject()
    addBlock(project, 'm1', 'metadata', { fieldFontSize: 'sm', fieldFontWeight: 'normal' })
    addBlock(project, 'm2', 'metadata', { fieldFontSize: 'md', fieldFontWeight: 'normal' })

    const report = analyzeTypography(project)
    const fam = report.families.find((f) => f.family === 'metadata-field')
    expect(fam).toBeDefined()
    const sizeVar = fam!.variances.find((v) => v.attr === 'fontSize')
    expect(sizeVar).toBeDefined()
    expect(sizeVar!.values.map((v) => v.value).sort()).toEqual(['md', 'sm'])
  })
})

describe('buildNormalizationPatches', () => {
  it('produces one patch per non-matching block', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { fontWeight: 'bold' })
    addBlock(project, 'h2', 'heading', { fontWeight: 'normal' })
    addBlock(project, 'h3', 'heading', { fontWeight: 'medium' })

    const patches = buildNormalizationPatches(project, 'heading', 'fontWeight', 'bold')
    expect(patches).toHaveLength(2)
    expect(patches.map((p) => p.blockId).sort()).toEqual(['h2', 'h3'])
    expect(patches[0].patch).toEqual({ fontWeight: 'bold' })
  })

  it('emits prefixed keys for metadata families', () => {
    const project = emptyProject()
    addBlock(project, 'm1', 'metadata', { fieldFontSize: 'sm' })
    addBlock(project, 'm2', 'metadata', { fieldFontSize: 'lg' })

    const patches = buildNormalizationPatches(project, 'metadata-field', 'fontSize', 'sm')
    expect(patches).toHaveLength(1)
    expect(patches[0].patch).toEqual({ fieldFontSize: 'sm' })
  })

  it('emits no patches when every block already matches', () => {
    const project = emptyProject()
    addBlock(project, 'h1', 'heading', { fontWeight: 'bold' })
    addBlock(project, 'h2', 'heading', { fontWeight: 'bold' })

    const patches = buildNormalizationPatches(project, 'heading', 'fontWeight', 'bold')
    expect(patches).toEqual([])
  })
})
