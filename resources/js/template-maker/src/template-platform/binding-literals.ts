import type { JsonValue, TemplateDefinition, TemplateValue } from '../template-core/schema'
import { renderTemplate } from '../template-core/render'

const token = /\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/
const contains = (value: JsonValue | undefined): boolean => {
  if (typeof value === 'string') return token.test(value)
  if (Array.isArray(value)) return value.some(contains)
  return value !== null && typeof value === 'object' && Object.entries(value).some(([key, item]) => token.test(key) || contains(item))
}
const literal = (value: TemplateValue) => value.source === 'literal' && contains(value.value)

/** Fixed artifacts reserve token syntax; authored output literals need graph rendering. */
export function hasAuthoredBindingTokens(definition: TemplateDefinition): boolean {
  if (contains(definition.name) || Object.values(definition.styles).some(contains)) return true
  const graphs = [definition.nodes, ...definition.blocks.map(block => block.nodes)]
  for (const block of definition.blocks) {
    if (contains(block.css) || Object.values(block.propertyMetadata ?? {}).some(metadata => contains(metadata.defaultValue))) return true
  }
  for (const nodes of graphs) {
    for (const node of Object.values(nodes)) {
      if (node.kind === 'element' && (contains(node.attributes) || contains(node.style) || Object.values(node.attributeBindings).some(literal))) return true
      if (node.kind === 'text' && node.parts.some(part => literal(part.value))) return true
      if (node.kind === 'block' && Object.values(node.props).some(literal)) return true
    }
  }
  // Use the existing renderer for joins, slots, formatting and annotation boundaries.
  // Runtime substitutions are atomic and must not participate in authored literals.
  const probe = structuredClone(definition)
  const neutralURL = 'https://template-runtime.invalid/'
  for (const nodes of [probe.nodes, ...probe.blocks.map(block => block.nodes)]) {
    for (const node of Object.values(nodes)) {
      if (node.kind === 'text') for (const part of node.parts) {
        if (part.value.source === 'field') part.value = { source: 'literal', value: '|TPL_RUNTIME|' }
      }
      if (node.kind === 'element') for (const [attribute, value] of Object.entries(node.attributeBindings)) {
        if (value.source === 'field') node.attributeBindings[attribute] = { source: 'literal', value: neutralURL }
      }
    }
  }
  probe.fields = []
  return token.test(renderTemplate(probe, { annotate: true, resolveAsset: () => neutralURL }).html)
}
