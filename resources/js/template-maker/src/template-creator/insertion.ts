import type { TemplateDefinition } from '../template-core/schema'
import { childIds } from '../template-core/validation'
import { getTemplateColumns } from '../template-core/columns'
import type { TemplateFragment } from '../template-core/fragments'
import { templateHtmlChildAllowed, templateHtmlContext } from '../template-core/html-structure'

/** Leaf selections insert alongside their content; recognized column layouts insert into their first cell. */
export function templateInsertionParent(template: TemplateDefinition, selectedId: string | null, fragment?: TemplateFragment): string | null | undefined {
  const parentOf = (id: string) => Object.values(template.nodes).find(parent => childIds(parent).includes(id))?.id ?? null
  const htmlContext = (id: string): string => {
    const seen = new Set<string>()
    let cursor: string | null = id
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const node = template.nodes[cursor]
      if (node?.kind === 'element') return node.tag
      cursor = parentOf(cursor)
    }
    return 'main'
  }
  const accepts = (parent: string) => {
    if (!fragment) return !['table', 'tbody', 'thead', 'tfoot', 'tr', 'ul', 'ol'].includes(parent)
    const seen = new Set<string>()
    const visit = (id: string, context: string | undefined): boolean => {
      const node = fragment.nodes[id]
      if (!node || seen.has(id) || !templateHtmlChildAllowed(context, node)) return false
      seen.add(id)
      return childIds(node).every(child => visit(child, templateHtmlContext(node, context)))
    }
    return fragment.roots.every(id => visit(id, parent))
  }
  let id = selectedId
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const node = Object.hasOwn(template.nodes, id) ? template.nodes[id] : undefined
    if (!node) return null
    const columns = getTemplateColumns(template, id)
    if (columns && accepts('td')) return columns.columnIds[0]
    if ((node.kind === 'repeat' || node.kind === 'condition') && accepts(htmlContext(id))) return id
    if (node.kind === 'element' && ['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'figure', 'figcaption', 'blockquote', 'td', 'th', 'li', 'tbody', 'thead', 'tfoot', 'tr', 'ul', 'ol', 'table'].includes(node.tag) && accepts(node.tag)) return id
    id = parentOf(id)
  }
  return accepts('main') ? null : undefined
}
