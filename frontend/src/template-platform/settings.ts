import { formatPresentationStyle } from './style-values'
import { validateJSONData } from '../template-core/contracts'
import { DataSchemaSchema, type JsonObject, type TemplateDefinition } from '../template-core/schema'
import { styleIssues } from '../template-core/styles'
import type { PresentationSetting } from './types'

export const PRESENTATION_PROPERTIES = ['font-size', 'line-height', 'font-weight', 'width', 'height', 'text-align', 'color', 'background-color', 'border-radius', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left']

export function resolvePresentationSettings(spec: PresentationSetting[], values: JsonObject = {}, customer = true): JsonObject {
  const ids = new Set<string>()
  for (const field of spec) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.id) || ids.has(field.id)) throw new Error('Setting IDs must be stable and unique.')
    ids.add(field.id)
    DataSchemaSchema.parse(field.schema)
  }
  const result: JsonObject = {}
  for (const id of Object.keys(values)) {
    const field = spec.find(item => item.id === id)
    if (!field || (customer && !field.exposed)) throw new Error(`Setting is not exposed: ${id}`)
  }
  for (const field of spec) {
    const value = Object.hasOwn(values, field.id) ? values[field.id] : field.defaultValue
    const issues = validateJSONData(field.schema, value)
    if (issues.length) throw new Error(`${field.label}: ${issues[0].message}`)
    result[field.id] = value
  }
  return result
}
export function presentationStyle(field: PresentationSetting, value: unknown): string {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Presentation values must be scalar styles.')
  let css = typeof value === 'number' ? `${value}${field.unit ?? ''}` : value
  for (const target of field.targets) {
    css = formatPresentationStyle(target.property, value, field.unit ?? '')
    if (!PRESENTATION_PROPERTIES.includes(target.property) || styleIssues({ [target.property]: css }, target.nodeId).length) throw new Error('Unsupported presentation property or value.')
  }
  return css
}
export function applyPresentationSettings(template: TemplateDefinition, spec: PresentationSetting[], values: JsonObject = {}): TemplateDefinition {
  const resolved = resolvePresentationSettings(spec, values, false)
  const result = structuredClone(template)
  for (const field of spec) {
    if (!field.targets.length) continue
    const value = presentationStyle(field, resolved[field.id])
    for (const target of field.targets) {
      const node = result.nodes[target.nodeId]
      if (!node || node.kind !== 'element') throw new Error('This setting target needs an explicit shared block-instance adapter.')
      node.style[target.property] = value
    }
  }
  return result
}
