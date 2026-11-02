import type { TemplateNode } from './schema'

const childTags: Record<string, string[]> = {
  table: ['thead', 'tbody', 'tfoot', 'tr'],
  thead: ['tr'], tbody: ['tr'], tfoot: ['tr'], tr: ['td', 'th'], ul: ['li'], ol: ['li'],
}
const parentTags: Record<string, string[]> = {
  thead: ['table'], tbody: ['table'], tfoot: ['table'], tr: ['table', 'thead', 'tbody', 'tfoot'],
  td: ['tr'], th: ['tr'], li: ['ul', 'ol'],
}

/** Transparent controls inherit their HTML context; block instances render a div wrapper. */
export function templateHtmlChildAllowed(parent: string | undefined, node: TemplateNode): boolean {
  if (parent === undefined || ['repeat', 'condition', 'slot'].includes(node.kind)) return true
  if (node.kind === 'element' && parentTags[node.tag] && !parentTags[node.tag].includes(parent)) return false
  if (!childTags[parent]) return true
  if (node.kind === 'text') return node.parts.every(part => part.format === 'text' && part.value.source === 'literal' && typeof part.value.value === 'string' && !part.value.value.trim())
  return node.kind === 'element' && childTags[parent].includes(node.tag)
}

export function templateHtmlContext(node: TemplateNode, parent: string | undefined): string | undefined {
  return node.kind === 'element' ? node.tag : ['repeat', 'condition', 'slot'].includes(node.kind) ? parent : undefined
}
