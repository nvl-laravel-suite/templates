import { createTemplateNode } from './defaults'
import { TemplateError, TemplateNodeSchema, type TemplateDefinition, type TemplateNode } from './schema'
import type { TemplateFragment } from './fragments'

type Element = Extract<TemplateNode, { kind: 'element' }>
export interface TemplateColumns {
  columnIds: string[]
  rowId: string
  widths: number[]
  gap: number
  align: 'top' | 'middle' | 'bottom'
  stackOnMobile?: boolean
}
export interface TemplateColumnLayoutPatch {
  count?: number
  /** Positive relative weights, normalized to percentages totaling 100. */
  widths?: number[]
  gap?: number
  align?: TemplateColumns['align']
  /** Email columns only; other layouts have no implicit responsive policy. */
  stackOnMobile?: boolean
}
const fail = (message: string): never => { throw new TemplateError('validation', message) }
function normalizeWidths(widths: number[]): number[] {
  if (!widths.length || widths.length > 4 || widths.some(width => !Number.isFinite(width) || width <= 0 || width > 10000))
    return fail('Use one to four positive column widths.')
  const total = widths.reduce((sum, width) => sum + width, 0)
  const normalized = widths.map(width => Number((100 * width / total).toFixed(4)))
  normalized[normalized.length - 1] = Number((100 - normalized.slice(0, -1).reduce((sum, width) => sum + width, 0)).toFixed(4))
  if (normalized.some(width => width <= 0)) return fail('Column widths must remain greater than zero after normalization.')
  return normalized
}

/** Presentation-table columns use the same editable HTML graph for document and email output. */
export function createTemplateColumns(widths = [50, 50]): TemplateFragment {
  const nodes: Record<string, TemplateNode> = {}
  const columns = normalizeWidths(widths).map((width, index) => {
    const copy = TemplateNodeSchema.parse({ id: `copy_${index}`, kind: 'text', name: `Column ${index + 1} content`, parts: [{ value: { source: 'literal', value: `Column ${index + 1}` } }] })
    nodes[copy.id] = copy
    const column = TemplateNodeSchema.parse({ id: `column_${index}`, kind: 'element', name: `Column ${index + 1}`, tag: 'td', style: { width: `${width}%`, padding: '0', 'vertical-align': 'top' }, children: [copy.id] })
    nodes[column.id] = column
    return column.id
  })
  nodes.row = TemplateNodeSchema.parse({ id: 'row', kind: 'element', name: 'Column row', tag: 'tr', children: columns })
  nodes.body = TemplateNodeSchema.parse({ id: 'body', kind: 'element', name: 'Column body', tag: 'tbody', children: ['row'] })
  nodes.layout = TemplateNodeSchema.parse({ id: 'layout', kind: 'element', name: `${columns.length} columns`, tag: 'table', attributes: { role: 'presentation', 'data-template-layout': 'columns' }, style: { width: '100%', 'table-layout': 'fixed', 'border-collapse': 'separate', 'border-spacing': '16px 0' }, children: ['body'] })
  return { roots: ['layout'], nodes }
}

/** Recognize only the canonical editable shape; custom HTML keeps the normal inspector. */
export function getTemplateColumns(template: Pick<TemplateDefinition, 'nodes'>, id: string): TemplateColumns | null {
  const element = (key: string, tag: string): Element | undefined => {
    const node = Object.hasOwn(template.nodes, key) ? template.nodes[key] : undefined
    return node?.kind === 'element' && node.tag === tag ? node : undefined
  }
  const table = element(id, 'table')
  if (!table || table.attributes['data-template-layout'] !== 'columns' || table.children.length !== 1) return null
  const body = element(table.children[0], 'tbody')
  const row = body?.children.length === 1 ? element(body.children[0], 'tr') : undefined
  if (!row || !row.children.length || row.children.length > 4) return null
  const columns = row.children.map(key => element(key, 'td'))
  if (columns.some(column => !column || !/^\d+(?:\.\d+)?%$/.test(column.style.width ?? ''))) return null
  const widths = columns.map(column => Number(column!.style.width.slice(0, -1)))
  if (widths.some(width => width <= 0) || Math.abs(widths.reduce((sum, width) => sum + width, 0) - 100) > 0.001) return null
  const email = table.attributes['data-template-email'] === 'columns'
  const gapValue = email ? [null, table.attributes['data-template-gap']] : table.style['border-spacing']?.match(/^(\d+(?:\.\d+)?)px 0$/)
  const align = columns[0]!.style['vertical-align']
  if (!gapValue || !Number.isFinite(Number(gapValue[1])) || Number(gapValue[1]) < 0 || Number(gapValue[1]) > 64 || !['top', 'middle', 'bottom'].includes(align)) return null
  return { columnIds: [...row.children], rowId: row.id, widths, gap: Number(gapValue[1]), align: align as TemplateColumns['align'], ...(email ? { stackOnMobile: table.classes.includes('email-stack') } : {}) }
}

export function applyTemplateColumnLayout(template: TemplateDefinition, id: string, patch: TemplateColumnLayoutPatch) {
  const current = getTemplateColumns(template, id)
  if (!current) return fail('Select an unmodified column layout to use column controls.')
  if (patch.stackOnMobile !== undefined && (current.stackOnMobile === undefined || typeof patch.stackOnMobile !== 'boolean')) return fail('Mobile stacking is an email-column setting.')
  const count = patch.count ?? current.columnIds.length
  const gap = patch.gap ?? current.gap
  const align = patch.align ?? current.align
  if (!Number.isInteger(count) || count < 1 || count > 4) return fail('Column count must be an integer from 1 to 4.')
  if (!Number.isFinite(gap) || gap < 0 || gap > 64) return fail('Column spacing must be from 0 to 64 px.')
  if (!['top', 'middle', 'bottom'].includes(align)) return fail('Choose top, middle or bottom alignment.')
  const widths = normalizeWidths(patch.widths ?? (count === current.columnIds.length ? current.widths : Array(count).fill(1)))
  if (widths.length !== count) return fail('Supply one width for each column.')
  const ids = [...current.columnIds]
  if (count < ids.length) {
    const retained = template.nodes[ids[count - 1]] as Element
    for (const removed of ids.splice(count)) {
      retained.children.push(...(template.nodes[removed] as Element).children)
      delete template.nodes[removed]
    }
  }
  while (ids.length < count) {
    const column = createTemplateNode('element', 'td') as Element
    column.name = `Column ${ids.length + 1}`
    column.style.padding = '0'
    template.nodes[column.id] = column
    ids.push(column.id)
  }
  ;(template.nodes[current.rowId] as Element).children = ids
  const table = template.nodes[id] as Element
  const email = current.stackOnMobile !== undefined
  table.style['border-spacing'] = email ? '0px 0' : `${gap}px 0`
  if (email) {
    table.attributes['data-template-gap'] = String(gap)
    table.classes = table.classes.filter(name => name !== 'email-stack')
    if (patch.stackOnMobile ?? current.stackOnMobile) table.classes.push('email-stack')
  }
  for (const [index, key] of ids.entries()) {
    const column = template.nodes[key] as Element
    column.style.width = `${widths[index]}%`
    column.style['vertical-align'] = align
    if (email) {
      column.style.padding = `0 ${gap / 2}px`
      column.attributes.width = `${widths[index]}%`; column.attributes.valign = align
      if (!column.classes.includes('email-column')) column.classes.push('email-column')
    }
  }
}
