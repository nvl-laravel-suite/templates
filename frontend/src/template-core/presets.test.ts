import { describe, expect, it, vi } from 'vitest'
import { createTemplateNode } from './defaults'
import { createTemplateCreator } from './editing'
import { getTemplatePresets } from './presets'
import { createTemplateColumns, getTemplateColumns } from './columns'
import type { TemplateFragment } from './fragments'
import { getTemplateIssues } from './validation'
import { TemplateNodeSchema } from './schema'

describe('portable building blocks', () => {
  it('inserts the built-in catalog as ordinary editable graphs with fresh IDs', () => {
    const creator = createTemplateCreator()
    const presets = getTemplatePresets()
    expect(new Set(presets.map(preset => preset.id)).size).toBe(presets.length)
    for (const preset of presets.filter(preset => preset.id !== 'image' && preset.category !== 'Structure')) {
      const before = creator.getTemplate()
      const roots = creator.actions.insertFragment(preset.fragment)
      expect(roots.length).toBeGreaterThan(0)
      for (const id of roots) expect(before.nodes[id]).toBeUndefined()
    }
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    const output = creator.render()
    expect(output.issues).toEqual([])
    expect(output.html).toContain('role="presentation"')
    expect(output.html).toContain('First item')
    expect(output.html).toContain('href="https://example.com"')
    expect(output.html).not.toContain('data-template-node-id')
    creator.destroy()
  })

  it('copies a host fragment under a chosen parent without changing the supplied fragment', () => {
    const creator = createTemplateCreator()
    const parent = creator.actions.insert('section')
    const fragment = { roots: ['row', 'note'], nodes: {
      row: TemplateNodeSchema.parse({ id: 'row', name: 'Custom group', kind: 'element', tag: 'div', children: ['copy'] }),
      copy: TemplateNodeSchema.parse({ id: 'copy', name: 'Bound name', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'recipient' } }] }),
      note: TemplateNodeSchema.parse({ id: 'note', name: 'Note', kind: 'text', parts: [{ value: { source: 'literal', value: 'Note' } }] }),
    } }
    const original = structuredClone(fragment)
    const first = creator.actions.insertFragment(fragment, parent)
    const second = creator.actions.insertFragment(fragment, parent)
    expect(new Set([...first, ...second]).size).toBe(4)
    const document = creator.getTemplate()
    expect(document.nodes[parent].kind === 'element' && document.nodes[parent].children).toEqual([...first, ...second])
    const group = document.nodes[first[0]]
    expect(group.kind === 'element' && document.nodes[group.children[0]].kind === 'text').toBe(true)
    expect(fragment).toEqual(original)
    creator.actions.undo()
    expect(Object.keys(creator.getTemplate().nodes)).toHaveLength(4)
    creator.actions.redo()
    expect(creator.getTemplate()).toEqual(document)
    creator.destroy()
  })

  it('rejects malformed trees and family-forbidden insertion atomically', () => {
    const creator = createTemplateCreator({ onError: vi.fn() })
    const node = TemplateNodeSchema.parse({ id: 'root', name: 'Root', kind: 'element', tag: 'div' })
    if (node.kind !== 'element') throw new Error('Expected an element fixture')
    const initial = creator.getTemplate()
    const malformed: TemplateFragment[] = [
      { roots: ['missing'], nodes: { root: node } },
      { roots: ['root', 'root'], nodes: { root: node } },
      { roots: ['root'], nodes: { root: { ...node, children: ['root'] } } },
      { roots: ['root'], nodes: { root: node, orphan: { ...node, id: 'orphan' } } },
      { roots: ['root'], nodes: { root: { ...node, id: 'other' } } },
    ]
    for (const fragment of malformed) expect(() => creator.actions.insertFragment(fragment)).toThrow()
    expect(creator.getTemplate()).toEqual(initial)
    creator.actions.undo(); expect(creator.getTemplate()).toEqual(initial)
    const restricted = createTemplateCreator({ onError: vi.fn(), validateChange: () => { throw new Error('Family structure is locked') } })
    expect(() => restricted.actions.insertFragment({ roots: ['root'], nodes: { root: node } })).toThrow('Family structure is locked')
    expect(restricted.getTemplate().roots).toEqual([])
    creator.destroy(); restricted.destroy()
  })

  it('rebalances columns and preserves all content when reducing their count in one Undo step', () => {
    const creator = createTemplateCreator()
    const [id] = creator.actions.insertFragment(createTemplateColumns([25, 50, 25]))
    const columns = getTemplateColumns(creator.getTemplate(), id)!
    expect(columns.widths).toEqual([25, 50, 25])
    for (const [index, column] of columns.columnIds.entries()) {
      const text = createTemplateNode('text')
      if (text.kind === 'text') text.parts[0].value = { source: 'literal', value: `Content ${index + 1}` }
      creator.actions.insertFragment({ roots: [text.id], nodes: { [text.id]: text } }, column)
    }
    const before = creator.getTemplate()
    creator.actions.setColumnLayout(id, { count: 2, widths: [1, 2], gap: 24, align: 'middle' })
    expect(getTemplateColumns(creator.getTemplate(), id)?.widths).toEqual([33.3333, 66.6667])
    const output = creator.render()
    expect(output.issues).toEqual([])
    expect(output.html).toContain('width:33.3333%')
    expect(output.html).toContain('border-spacing:24px 0')
    expect(output.html).toContain('vertical-align:middle')
    expect(output.html.indexOf('Content 1')).toBeLessThan(output.html.indexOf('Content 2'))
    expect(output.html.indexOf('Content 2')).toBeLessThan(output.html.indexOf('Content 3'))
    creator.actions.undo(); expect(creator.getTemplate()).toEqual(before)
    creator.actions.redo()
    creator.actions.setColumnLayout(id, { count: 4 })
    expect(getTemplateColumns(creator.getTemplate(), id)?.columnIds).toHaveLength(4)
    expect(getTemplateIssues(creator.getTemplate())).toEqual([])
    creator.destroy()
  })

  it('rejects invalid column settings and leaves custom HTML under ordinary graph editing', () => {
    const creator = createTemplateCreator({ onError: vi.fn() })
    const [id] = creator.actions.insertFragment(createTemplateColumns())
    const initial = creator.getTemplate()
    for (const patch of [{ count: 0 }, { count: 2.5 }, { count: 5 }, { widths: [0, 1] }, { widths: [1] }, { gap: -1 }, { gap: NaN }])
      expect(() => creator.actions.setColumnLayout(id, patch)).toThrow()
    expect(creator.getTemplate()).toEqual(initial)
    creator.actions.updateNode(id, { tag: 'div' })
    expect(getTemplateColumns(creator.getTemplate(), id)).toBeNull()
    expect(() => creator.actions.setColumnLayout(id, { count: 3 })).toThrow()
    creator.destroy()
  })

  it.each(['table', 'tbody', 'tr', 'ul', 'ol'])('reports invalid content beneath %s before browsers can relocate it', tag => {
    const creator = createTemplateCreator()
    const parent = creator.actions.insert(tag)
    creator.actions.insert('p', parent)
    expect(getTemplateIssues(creator.getTemplate()).some(issue => issue.code === 'html-structure')).toBe(true)
    expect(creator.render().html).toBe('')
    creator.destroy()
  })
})
