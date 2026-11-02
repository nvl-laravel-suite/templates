import { getTemplatePresets, type TemplateInsertPreset } from '../template-core/presets'
import { createTemplateColumns } from '../template-core/columns'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateNodeSchema, type TemplateDefinition } from '../template-core/schema'
import { createTemplateCreator } from '../template-core/editing'
import type { TemplateFragment } from '../template-core/fragments'

export function createEmailColumns(widths = [50, 50]): TemplateFragment {
  const fragment = createTemplateColumns(widths)
  const table = fragment.nodes.layout
  if (table.kind !== 'element') throw new Error('Expected column table.')
  table.attributes = { ...table.attributes, 'data-template-email': 'columns', 'data-template-gap': '16' }
  table.classes = ['email-stack']; table.style['border-spacing'] = '0px 0'; table.style['border-collapse'] = 'collapse'
  for (const node of Object.values(fragment.nodes)) if (node.kind === 'element' && node.tag === 'td') {
    node.style.padding = '0 8px'; node.classes = ['email-column']; node.attributes.width = node.style.width; node.attributes.valign = 'top'
  }
  return fragment
}

/** Email markup is stored in the existing graph; these are portable JSON presets, not React renderers. */
export function getEmailPresets(): TemplateInsertPreset[] {
  const content = new Set(['heading', 'title', 'paragraph', 'small', 'quote', 'link', 'image', 'number', 'price', 'date', 'list', 'ordered-list', 'list-item', 'table-row', 'table', 'repeat', 'condition'])
  const presets = getTemplatePresets().filter(preset => content.has(preset.id)).map(preset => ({ ...preset, id: `email-${preset.id}` }))
  const framed = (id: string, name: string, value: string, tag = 'p', style: Record<string, string> = {}) => {
    const fragment = createEmailColumns([100])
    const table = fragment.nodes.layout, cell = fragment.nodes.column_0
    if (table.kind !== 'element' || cell.kind !== 'element') throw new Error('Expected email section.')
    delete table.attributes['data-template-layout']; delete table.attributes['data-template-gap']
    table.attributes['data-template-email'] = id; table.classes = []; table.name = name
    cell.classes = []; cell.style = { padding: '16px', ...style }; delete cell.attributes.width
    fragment.nodes.copy_0 = TemplateNodeSchema.parse({ id: 'copy_0', name: `${name} text`, kind: 'element', tag, children: ['text'] })
    fragment.nodes.text = TemplateNodeSchema.parse({ id: 'text', name: 'Content', kind: 'text', parts: [{ value: { source: 'literal', value } }] })
    presets.push({ id: `email-${id}`, name, category: 'Email layout', description: 'Presentation-table structure with cell-based spacing.', fragment })
    return fragment
  }
  framed('section', 'Section', 'Your email content')
  framed('header', 'Header', 'Your company', 'h2')
  const footer = framed('footer', 'Footer', 'Company details · Contact us')
  if (footer.nodes.copy_0.kind === 'element') footer.nodes.copy_0.classes = ['text-small']
  const button = framed('button', 'Button', 'View details', 'a', { padding: '0', 'text-align': 'left' })
  const cell = button.nodes.column_0; if (cell.kind === 'element') cell.classes = ['email-button-cell']
  const anchor = button.nodes.copy_0
  if (anchor.kind === 'element') { anchor.attributes.href = 'https://example.com'; anchor.classes = ['action'] }
  const spacer = framed('spacer', 'Spacer', '', 'span', { padding: '0', height: '24px', 'font-size': '0', 'line-height': '0' })
  const divider = framed('divider', 'Divider', '', 'span', { padding: '0', 'border-top': '1px solid #d7dfda', height: '1px', 'line-height': '0' })
  for (const fragment of [spacer, divider]) { const cell = fragment.nodes.column_0; if (cell.kind === 'element') cell.attributes['aria-hidden'] = 'true' }
  for (const count of [1, 2, 3, 4]) presets.push({ id: `email-columns-${count}`, name: count === 1 ? 'One column' : `${['', '', 'Two', 'Three', 'Four'][count]} columns`, category: 'Email layout', description: 'Editable table columns with explicit mobile stacking and cell spacing.', fragment: createEmailColumns(Array(count).fill(1)) })
  presets.push({ id: 'email-sidebar', name: 'Sidebar + content', category: 'Email layout', description: 'One-third / two-thirds email columns.', fragment: createEmailColumns([1, 2]) })
  return presets
}
export function createEmailTemplate(name = 'Email template'): TemplateDefinition {
  const template = createTemplateDefinition(name)
  template.description = 'Email-safe table layout. Test the final message in your supported mail clients.'
  const creator = createTemplateCreator({ initialTemplate: template })
  const presets = getEmailPresets()
  for (const id of ['email-header', 'email-section', 'email-button', 'email-footer']) creator.actions.insertFragment(presets.find(preset => preset.id === id)!.fragment, null)
  const result = creator.getTemplate(); creator.destroy(); return result
}
