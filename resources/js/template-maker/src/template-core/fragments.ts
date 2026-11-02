import { TemplateDefinitionSchema, TemplateError, type TemplateDefinition } from './schema'
import { childIds } from './validation'

/** A template-owned subtree. Referenced fields, assets and block revisions belong to the receiving definition. */
export type TemplateFragment = Pick<TemplateDefinition, 'roots' | 'nodes'>

export function parseTemplateFragment(input: unknown): TemplateFragment {
  const fragment = TemplateDefinitionSchema.pick({ roots: true, nodes: true }).parse(input)
  if (!fragment.roots.length || Object.keys(fragment.nodes).length > 5000)
    throw new TemplateError('validation', 'A fragment needs roots and at most 5,000 nodes.')
  const seen = new Set<string>()
  const visit = (id: string, depth: number) => {
    const node = Object.hasOwn(fragment.nodes, id) ? fragment.nodes[id] : undefined
    if (!node || node.id !== id || seen.has(id) || depth > 64)
      throw new TemplateError('validation', 'A fragment must be a complete tree with distinct node identities.')
    if (node.kind === 'slot') throw new TemplateError('validation', 'Slot definitions belong inside reusable blocks.')
    seen.add(id)
    childIds(node).forEach(child => visit(child, depth + 1))
  }
  fragment.roots.forEach(id => visit(id, 0))
  if (seen.size !== Object.keys(fragment.nodes).length)
    throw new TemplateError('validation', 'A fragment cannot contain unreachable nodes.')
  return fragment
}
