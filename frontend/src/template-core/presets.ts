import { TemplateNodeSchema, type TemplateNode, type TemplateValue } from './schema'
import type { TemplateFragment } from './fragments'
import { createTemplateColumns } from './columns'

export interface TemplateInsertPreset {
  id: string
  name: string
  category: string
  description: string
  fragment: TemplateFragment
}

/** Fresh JSON building blocks. Extend or replace this list in the host, without registering React renderers. */
export function getTemplatePresets(): TemplateInsertPreset[] {
  const presets: TemplateInsertPreset[] = []
  const add = (id: string, name: string, category: string, description: string, build: (element: ElementBuilder, text: TextBuilder) => string[]) => {
    const nodes: Record<string, TemplateNode> = {}
    const text: TextBuilder = (value, format = 'text') => {
      const node = TemplateNodeSchema.parse({ id: `node_${Object.keys(nodes).length}`, kind: 'text', name: 'Text', parts: [{ value: typeof value === 'object' ? value : { source: 'literal', value }, format }] })
      nodes[node.id] = node; return node.id
    }
    const element: ElementBuilder = (tag, children = [], attributes = {}, style = {}, classes = []) => {
      const node = TemplateNodeSchema.parse({ id: `node_${Object.keys(nodes).length}`, kind: 'element', name: tag.toUpperCase(), tag, children, attributes, style, classes })
      nodes[node.id] = node; return node.id
    }
    const roots = build(element, text)
    nodes[roots[0]].name = name
    presets.push({ id, name, category, description, fragment: { roots, nodes } })
  }
  for (const [id, name, tag, copy] of [
    ['heading', 'Heading', 'h2', 'Your heading'], ['title', 'Title', 'h1', 'Your title'],
    ['paragraph', 'Paragraph', 'p', 'Your text here'], ['small', 'Small text', 'small', 'Supporting information'],
    ['quote', 'Quote', 'blockquote', 'A few words worth sharing'], ['badge', 'Badge', 'span', 'Featured'],
  ]) add(id, name, 'Content', 'Editable text with static or data-bound content.', (el, text) => [el(tag, [text(copy)])])
  add('link', 'Link', 'Content', 'Text and destination can bind separate value/link fields.', (el, text) => [el('a', [text('Read more')], { href: 'https://example.com' })])
  add('button', 'Button', 'Content', 'A link styled with the template theme’s action class.', (el, text) => [el('a', [text('View details')], { href: 'https://example.com' }, {}, ['action'])])
  add('image', 'Image', 'Content', 'Choose a retained image asset or bind its source.', el => [el('img', [], { alt: 'Image' })])
  add('divider', 'Divider', 'Content', 'A horizontal separator.', el => [el('hr')])
  add('spacer', 'Spacer', 'Content', 'An empty spacing element; adjust its height in the inspector.', el => [el('div', [], { 'aria-hidden': 'true' }, { height: '24px' })])
  for (const [id, name, value, format] of [
    ['number', 'Number', 42, 'number'], ['price', 'Price', 100, 'currency'], ['date', 'Date', '2026-01-01', 'date'],
  ] as const) add(id, name, 'Content', 'A formatted value; bind a matching typed field.', (el, text) => [el('p', [text(value, format)])])
  for (const [id, name, tag] of [['list', 'Bulleted list', 'ul'], ['ordered-list', 'Numbered list', 'ol']])
    add(id, name, 'Content', 'Editable list items; a repeater can supply dynamic items.', (el, text) => [el(tag, [el('li', [text('First item')]), el('li', [text('Second item')])])])
  add('list-item', 'List item', 'Structure', 'Insert within a selected list or one of its items.', (el, text) => [el('li', [text('New item')])])
  add('table-row', 'Table row', 'Structure', 'Insert within a selected table body or row; duplicate cells to extend it.', (el, text) => [el('tr', [el('td', [text('Item')]), el('td', [text('Value')])])])
  add('table', 'Data table', 'Layout', 'Headers and body rows ready for values or repeated rows.', (el, text) => [el('table', [el('thead', [el('tr', [el('th', [text('Description')]), el('th', [text('Value')])])]), el('tbody', [el('tr', [el('td', [text('Item')]), el('td', [text('Value')])])])])])
  for (const [id, name, tag] of [['section', 'Section', 'section'], ['container', 'Container', 'div']])
    add(id, name, 'Layout', 'A free container for other blocks and nested layouts.', el => [el(tag)])
  for (const count of [1, 2, 3, 4]) presets.push({ id: `columns-${count}`, name: count === 1 ? 'One column' : `${['', '', 'Two', 'Three', 'Four'][count]} columns`, category: 'Layout', description: 'Presentation-table columns with editable widths, spacing and alignment.', fragment: createTemplateColumns(Array(count).fill(1)) })
  presets.push({ id: 'sidebar', name: 'Sidebar + content', category: 'Layout', description: 'One-third / two-thirds columns; adjust the proportions in the inspector.', fragment: createTemplateColumns([1, 2]) })
  for (const [kind, name] of [['repeat', 'Repeating content'], ['condition', 'Conditional content']] as const) {
    const copy = TemplateNodeSchema.parse({ id: 'copy', name: 'Item content', kind: 'text', parts: [{ value: kind === 'repeat' ? { source: 'item', path: '' } : { source: 'literal', value: 'Conditional content' } }] })
    const node = TemplateNodeSchema.parse({ id: 'root', name, kind, binding: { source: 'literal', value: kind === 'repeat' ? ['First item', 'Second item'] : true }, children: ['copy'], ...(kind === 'condition' ? { operator: 'truthy' } : {}) })
    presets.push({ id: kind, name, category: 'Dynamic', description: kind === 'repeat' ? 'Repeat children for an array. Bind fields or the nearest repeating item.' : 'Show children when a value matches the selected condition.', fragment: { roots: ['root'], nodes: { root: node, copy } } })
  }
  return presets
}

type ElementBuilder = (tag: string, children?: string[], attributes?: Record<string, string>, style?: Record<string, string>, classes?: string[]) => string
type TextBuilder = (value: string | number | TemplateValue, format?: 'text' | 'number' | 'currency' | 'date') => string
