import { describe, expect, it } from 'vitest'
import '#/voucher-builder/blocks/definitions'
import { createBlockInstance } from '#/voucher-builder/blocks/factory'
import type { Project } from '#/voucher-builder/schema'
import { exportToHTML } from './html'

function buildReferenceProject(): Project {
  const heading = createBlockInstance('heading', 'h1') as any
  heading.content = { ...heading.content, text: 'Your Title' }
  heading.settings = { ...heading.settings, alignment: 'center', fontWeight: 'bold', fontSize: 'auto', level: 'h1' }

  const text = createBlockInstance('text', 't1') as any
  text.content = { ...text.content, body: 'Welcome to the voucher.' }
  text.settings = { ...text.settings, alignment: 'center', fontSize: 'md' }

  const divider = createBlockInstance('divider', 'd1') as any
  divider.settings = { ...divider.settings, style: 'solid', weight: 1, width: '100%', alignment: 'center' }

  const button = createBlockInstance('button', 'b1') as any
  button.content = { ...button.content, text: 'Redeem', url: 'https://example.com/redeem' }
  button.settings = { ...button.settings, variant: 'primary', size: 'md', alignment: 'center' }

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
      metadata: { title: 'Reference Voucher', author: 'Test', subject: undefined, keywords: [], language: 'en' },
      previewData: {},
    },
    blocks: { h1: heading, t1: text, d1: divider, b1: button },
    sections: [
      { id: 's1', height: 90, padding: 4, backgroundColor: '#ffffff', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: ['h1', 't1'] },
      { id: 's2', height: 100, padding: 4, backgroundColor: '#ffffff', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: ['d1'] },
      { id: 's3', height: 90, padding: 4, backgroundColor: '#ffffff', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: ['b1'] },
    ],
    columnBlocks: {},
    frame: { imageUrl: null, opacity: 1 },
  }
}

describe('exportToHTML', () => {
  it('produces a standalone document with the reference project', () => {
    const html = exportToHTML(buildReferenceProject())
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<title>Reference Voucher</title>')
    expect(html).toContain('<meta name="author" content="Test">')
    expect(html).toContain('lang="en"')
    expect(html).toContain('dir="ltr"')
  })

  it('inlines the heading with its rich-text content and font family', () => {
    const html = exportToHTML(buildReferenceProject())
    expect(html).toContain('>Your Title</h1>')
    // The font-family fallback uses single quotes so the style attr parses cleanly.
    expect(html).toMatch(/<h1 style="[^"]*font-family:'[^']+'/)
    expect(html).not.toContain('font-family:"')
  })

  it('renders the body text paragraph with alignment center', () => {
    const html = exportToHTML(buildReferenceProject())
    expect(html).toMatch(/<p style="[^"]*text-align:center[^"]*">Welcome to the voucher\.<\/p>/)
  })

  it('renders the divider with border-top style', () => {
    const html = exportToHTML(buildReferenceProject())
    expect(html).toMatch(/<hr style="border:none;border-top:1px solid/)
  })

  it('renders the primary button with variant styles', () => {
    const html = exportToHTML(buildReferenceProject())
    expect(html).toContain('href="https://example.com/redeem"')
    expect(html).toContain('>Redeem</a>')
    expect(html).toMatch(/background:var\(--nc-accent,#3b82f6\)/)
  })

  it('emits one section wrapper per project section with correct heights', () => {
    const html = exportToHTML(buildReferenceProject())
    const sectionMatches = html.match(/height:\d+mm/g) || []
    // 3 section heights (90, 100, 90) + possibly page heights — at least 3 section heights.
    expect(sectionMatches.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('height:90mm')
    expect(html).toContain('height:100mm')
  })

  it('defines CSS variables from global colors', () => {
    const html = exportToHTML(buildReferenceProject())
    expect(html).toContain('--nc-accent: #3b82f6')
    expect(html).toContain('--nc-text: #111827')
    expect(html).toContain('--nc-border: #e5e7eb')
    expect(html).toContain('--nc-surface: #f9fafb')
  })

  it('is deterministic for the same project input', () => {
    const project = buildReferenceProject()
    const a = exportToHTML(project)
    const b = exportToHTML(project)
    expect(a).toBe(b)
  })
})
