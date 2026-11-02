import type { TemplateDefinition } from '../template-core/schema'
import { nodeValues } from '../template-core/validation'
import type { FamilyVariationPoint } from './types'
import { hasAuthoredBindingTokens } from './binding-literals'

/** Choose a compiler from authored capabilities; fixed export itself remains an explicit strict API. */
export function requiresSharedCompiler(definition: TemplateDefinition, points: FamilyVariationPoint[] = []): boolean {
  // Structural regions and property/parts variations can introduce dynamic content
  // in variants. The published family must support that before a variant is made.
  if (points.some(point => ['placement', 'children', 'block-property'].includes(point.kind) || point.kind === 'node-property' && point.property === 'parts')) return true
  const structuredFields = new Set(definition.fields.filter(field => ['array', 'object'].includes(field.schema.type)).map(field => field.id))
  const optionalFields = new Set(definition.fields.filter(field => !field.required).map(field => field.id))
  return [...Object.values(definition.nodes), ...definition.blocks.flatMap(block => Object.values(block.nodes))].some(node =>
    node.kind === 'repeat' || node.kind === 'condition' ||
    node.kind === 'block' && Object.values(node.props).some(value => value.source !== 'literal') ||
    node.kind === 'element' && Object.entries(node.attributeBindings).some(([attribute, value]) => attribute !== 'src' && value.source === 'field' && optionalFields.has(value.fieldId)) ||
    node.kind === 'text' && node.parts.some(part => part.format !== 'text' && part.value.source !== 'literal') ||
    nodeValues(node).some(value => value.source === 'field' && structuredFields.has(value.fieldId))) || hasAuthoredBindingTokens(definition)
}
