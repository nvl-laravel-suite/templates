import { getTemplateDataSchema, getValue, setValue, stableJSONStringify } from '../template-core/contracts'
import type { DataSchema, JsonObject, JsonValue, TemplateDefinition } from '../template-core/schema'
import type { BindingDocument, PresentationSetting } from './types'

function prune(value: JsonValue, schema: DataSchema): JsonValue {
  if (schema.type !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => Object.hasOwn(schema.properties, key)).map(([key, item]) => [key, prune(item, schema.properties[key])]))
}

/** Explicit field edits update their defaults; untouched persisted overrides remain authoritative. */
export function reconcileSource(before: TemplateDefinition, next: TemplateDefinition, metadata: BindingDocument): BindingDocument {
  const result = structuredClone(metadata)
  for (const field of next.fields) {
    const old = before.fields.find(item => item.id === field.id)
    const [namespace, ...parts] = field.path.split('.')
    if (!['content', 'inputs'].includes(namespace) || !parts.length) continue
    const key = namespace === 'content' ? 'content' : 'inputDefaults'
    const changedDefault = !old || stableJSONStringify(old.defaultValue) !== stableJSONStringify(field.defaultValue)
    const moved = old && old.path !== field.path
    if (changedDefault || moved) {
      const previous = moved && old.path.startsWith(namespace+'.') ? getValue(metadata[key], old.path.slice(namespace.length + 1)) : undefined
      setValue(result[key], parts.join('.'), changedDefault ? field.defaultValue : previous ?? field.defaultValue)
    }
  }
  try {
    const schema = getTemplateDataSchema(next) as unknown as BindingDocument['dataSchema']
    for (const [key, namespace] of [['content', 'content'], ['inputDefaults', 'inputs']] as const) {
      result[key] = prune(result[key], schema.properties[namespace] ?? { type: 'object', properties: {}, additionalProperties: false }) as JsonObject
    }
  } catch {
    // Incomplete authoring drafts retain data until the field contract is repaired.
  }
  return result
}

export function reconcileSettings(metadata: BindingDocument, spec: PresentationSetting[]): BindingDocument {
  const exposedSettings = spec.filter(field => field.exposed).map(field => field.id)
  const settingsSpec = spec.map(field => {
    const previous = metadata.settingsSpec.find(item => item.id === field.id)
    return previous && field.exposed === metadata.exposedSettings.includes(field.id) ? { ...field, exposed: previous.exposed } : field
  })
  const settingsDefaults = Object.fromEntries(spec.map(field => {
    const previous = metadata.settingsSpec.find(item => item.id === field.id)
    const changed = !previous || stableJSONStringify(field.defaultValue) !== stableJSONStringify(previous.defaultValue)
    return [field.id, changed ? field.defaultValue : metadata.settingsDefaults[field.id] ?? field.defaultValue]
  }))
  return { ...metadata, settingsSpec, settingsDefaults, exposedSettings }
}
