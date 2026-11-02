import type { TemplateNode } from './schema'

/** Keep generic text-node names useful in navigation without changing authored content. */
export function templateNodeLabel(node: TemplateNode, maxLength = 80): string {
  const label = node.kind === 'text' && (!node.name.trim() || node.name === 'Text')
    ? node.parts.map(part => part.value.source === 'literal'
      ? typeof part.value.value === 'object' ? JSON.stringify(part.value.value) : String(part.value.value)
      : 'Bound value').join('').replace(/\s+/g, ' ').trim()
    : node.name.trim()
  return (label || node.kind).slice(0, maxLength)
}
