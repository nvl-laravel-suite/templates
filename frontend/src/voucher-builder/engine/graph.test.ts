import { describe, expect, it } from 'vitest'
import {
  getBlockListChildIds,
  getDirectChildIds,
  getSectionForBlock,
  getSectionRootIds,
  getParentBlockId,
  getParentContext,
  getPlacementContext,
} from './graph'
import { createBlockInstance } from '#/voucher-builder/blocks/factory'
import type { Project } from '#/voucher-builder/schema'
import '#/voucher-builder/blocks/definitions'

function createProject(): Project {
  const row = createBlockInstance('row', 'row-1')
  ;(row.content as any).columnIds = ['col-1', 'col-2']

  const hero = createBlockInstance('hero', 'hero-1')
  ;(hero.content as any).childIds = ['hero-heading', 'hero-text']

  return {
    global: {
      layout: {
        pagePadding: 40,
        margin: 10,
      },
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        baseSize: 16,
        lineHeight: 1.5,
        headingLineHeight: 1.2,
        paragraphSpacing: 0,
        headingSpacing: 0,
      },
      colors: {
        primary: '#111827',
        accent: '#3b82f6',
        background: '#ffffff',
        text: '#111827',
        secondary: '#6b7280',
        border: '#e5e7eb',
        surface: '#f9fafb',
        link: '#2563eb',
      },
      metadata: {
        title: 'Test Voucher',
        author: '',
        subject: undefined,
        keywords: [],
        language: 'en',
      },
      previewData: {},
    },
    blocks: {
      'row-1': row,
      'col-1': createBlockInstance('column', 'col-1'),
      'col-2': createBlockInstance('column', 'col-2'),
      'hero-1': hero,
      'hero-heading': createBlockInstance('heading', 'hero-heading'),
      'hero-text': createBlockInstance('text', 'hero-text'),
    },
    sections: [
      { id: 's1', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: ['row-1'] },
      { id: 's2', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
      { id: 's3', height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
    ],
    columnBlocks: {
      'col-1': ['hero-1'],
      'col-2': [],
      'hero-1': ['hero-heading', 'hero-text'],
    },
    frame: { imageUrl: null, opacity: 1 },
  }
}

describe('graph helpers', () => {
  it('reads section roots and direct children through normalized helpers', () => {
    const project = createProject()

    expect(getSectionRootIds(project.sections[0]!)).toEqual(['row-1'])
    expect(getDirectChildIds(project, 'row-1')).toEqual(['col-1', 'col-2'])
    expect(getBlockListChildIds(project, 'hero-1')).toEqual(['hero-heading', 'hero-text'])
    expect(getDirectChildIds(project, 'hero-1')).toEqual(['hero-heading', 'hero-text'])
  })

  it('resolves parent context across section, container, and structural locations', () => {
    const project = createProject()

    expect(getParentContext(project, 'row-1')).toEqual({ kind: 'section', sectionId: 's1', index: 0 })
    expect(getParentContext(project, 'col-1')).toEqual({ kind: 'structural', parentId: 'row-1', index: 0 })
    expect(getParentContext(project, 'hero-1')).toEqual({ kind: 'container', parentId: 'col-1', index: 0 })
    expect(getParentBlockId(project, 'hero-heading')).toBe('hero-1')
  })

  it('finds placement and section context for deeply nested blocks', () => {
    const project = createProject()

    expect(getSectionForBlock(project, 'hero-heading')?.id).toBe('s1')
    expect(getPlacementContext(project, 'hero-heading')).toEqual({
      sectionId: 's1',
      parent: { kind: 'container', parentId: 'hero-1', index: 0 },
    })
  })
})
