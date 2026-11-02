import { nanoid } from 'nanoid'
import {
  TemplateDefinitionSchema,
  TemplateError,
  TemplateNodeSchema,
  type TemplateDefinition,
  type TemplateNode,
  type TemplateValue,
} from './schema'

export function createTemplateNode(
  kind: 'element' | 'text' | 'repeat' | 'condition' = 'element',
  tag = 'p',
): TemplateNode {
  if (!['element', 'text', 'repeat', 'condition'].includes(kind))
    throw new TemplateError(
      'validation',
      'Create block and slot nodes with TemplateNodeSchema and their required references.',
    )
  const id = `n_${nanoid(8).replace(/-/g, '_')}`
  if (kind === 'text')
    return TemplateNodeSchema.parse({
      id,
      kind,
      name: 'Text',
      parts: [{ value: { source: 'literal', value: 'Your text here' } }],
    })
  if (kind === 'repeat' || kind === 'condition')
    return TemplateNodeSchema.parse({
      id,
      kind,
      name: kind === 'repeat' ? 'Repeating content' : 'Conditional content',
      binding: { source: 'literal', value: kind === 'repeat' ? [] : true },
      children: [],
      ...(kind === 'condition' ? { operator: 'truthy' } : {}),
    })
  return TemplateNodeSchema.parse({
    id,
    kind: 'element',
    name: tag === 'div' ? 'Container' : tag.toUpperCase(),
    tag,
  })
}
export function createTemplateDefinition(name = 'Untitled template'): TemplateDefinition {
  return TemplateDefinitionSchema.parse({
    format: 'gct-template',
    schemaVersion: 1,
    id: `t_${nanoid(10).replace(/-/g, '_')}`,
    name,
    page: {},
    roots: [],
    nodes: {},
  })
}
export function createInvoiceTemplate(): TemplateDefinition {
  const template = createTemplateDefinition('Studio invoice')
  const text = (value: TemplateValue, format: 'text' | 'currency' | 'date' = 'text') => {
    const node = TemplateNodeSchema.parse({ ...createTemplateNode('text'), parts: [{ value, format }] })
    template.nodes[node.id] = node
    return node.id
  }
  const literal = (value: string) => text({ source: 'literal', value })
  const field = (fieldId: string, format: 'text' | 'currency' | 'date' = 'text') =>
    text({ source: 'field', fieldId }, format)
  const element = (tag: string, children: string[], classes: string[] = [], name?: string) => {
    const node = TemplateNodeSchema.parse({
      ...createTemplateNode('element', tag),
      children,
      classes,
      ...(name ? { name } : {}),
    })
    template.nodes[node.id] = node
    return node.id
  }
  template.fields = [
    {
      id: 'invoiceNumber',
      path: 'invoice.number',
      label: 'Invoice number',
      description: '',
      schema: { type: 'string', minLength: 1 },
      required: true,
      editable: true,
      sample: 'INV-2026-014',
    },
    {
      id: 'customerName',
      path: 'customer.name',
      label: 'Customer name',
      description: '',
      schema: { type: 'string', minLength: 1 },
      required: true,
      editable: true,
      sample: 'Marlow & Co.',
    },
    {
      id: 'invoiceDate',
      path: 'invoice.date',
      label: 'Issue date',
      description: '',
      schema: { type: 'string', format: 'date' },
      required: true,
      editable: true,
      sample: '2026-10-21',
    },
    {
      id: 'items',
      path: 'invoice.items',
      label: 'Line items',
      description: 'Edit the line items, then enter the matching total below.',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: { description: { type: 'string' }, amount: { type: 'number', minimum: 0 } },
          required: ['description', 'amount'],
          additionalProperties: false,
        },
        minItems: 1,
      },
      required: true,
      editable: true,
      sample: [
        { description: 'Brand direction & identity', amount: 1200 },
        { description: 'Editorial design', amount: 650 },
      ],
    },
    {
      id: 'total',
      path: 'invoice.total',
      label: 'Total amount',
      description: 'Entered separately. Keep this total in sync with the line items.',
      schema: { type: 'number', minimum: 0 },
      required: true,
      editable: true,
      sample: 1850,
    },
  ]
  const intro = element(
    'header',
    [
      element('p', [literal('NORTH / STUDIO')], ['eyebrow']),
      element('h1', [literal('Invoice')]),
      element('p', [field('invoiceNumber')], ['muted']),
    ],
    ['invoice-header'],
    'Invoice header',
  )
  const details = element(
    'section',
    [
      element('div', [
        element('p', [literal('BILL TO')], ['eyebrow']),
        element('h3', [field('customerName')]),
      ]),
      element('div', [
        element('p', [literal('ISSUED')], ['eyebrow']),
        element('p', [field('invoiceDate', 'date')]),
      ]),
    ],
    ['details'],
    'Customer details',
  )
  const repeat = createTemplateNode('repeat')
  if (repeat.kind !== 'repeat') throw new Error('Expected repeater')
  repeat.binding = { source: 'field', fieldId: 'items' }
  repeat.children = [
    element('tr', [
      element('td', [text({ source: 'item', path: 'description' })]),
      element('td', [text({ source: 'item', path: 'amount' }, 'currency')], ['amount']),
    ]),
  ]
  template.nodes[repeat.id] = repeat
  const table = element(
    'table',
    [
      element('thead', [
        element('tr', [
          element('th', [literal('DESCRIPTION')]),
          element('th', [literal('AMOUNT')], ['amount']),
        ]),
      ]),
      element('tbody', [repeat.id]),
    ],
    ['items-table'],
    'Invoice items',
  )
  const total = element(
    'div',
    [element('span', [literal('Total due')]), element('strong', [field('total', 'currency')])],
    ['invoice-total'],
    'Total',
  )
  const noteId = literal('Thank you for the thoughtful work we get to make together.')
  template.nodes[noteId].permissions.content = true
  const footer = element(
    'footer',
    [
      element('p', [noteId]),
      element('p', [literal('Payment within 30 days · hello@north.studio')], ['muted']),
    ],
    ['invoice-footer'],
    'Footer',
  )
  template.roots = [intro, details, table, total, footer]
  template.styles.css = `.eyebrow{font-size:10px;font-weight:700;letter-spacing:2px;color:#52665d}.invoice-header{padding-bottom:30px;border-bottom:2px solid #214e40}.invoice-header h1{font-family:Georgia,serif;font-weight:400;font-size:54px;color:#214e40;margin:18px 0 8px}.muted{color:#788179;font-size:12px}.details{display:flex;justify-content:space-between;padding:32px 0}.details h3{font-size:19px}.items-table{margin:12px 0 24px}.items-table th{font-size:10px;letter-spacing:1.5px;border-bottom:1px solid #c8d2cb;color:#68776d}.items-table td{border-bottom:1px solid #e5eae7;padding-top:18px;padding-bottom:18px}.amount{text-align:right}.invoice-total{display:flex;justify-content:space-between;padding:18px;background:#eef3ef;color:#214e40;font-size:18px}.invoice-footer{margin-top:90px;border-top:1px solid #dce3dd;padding-top:22px;font-size:12px}`
  return template
}
