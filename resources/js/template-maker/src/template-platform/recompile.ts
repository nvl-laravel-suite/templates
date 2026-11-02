import { validateJSONData } from '../template-core/contracts'
import type { DataSchema, JsonObject, TemplateDefinition } from '../template-core/schema'
import { exportBindingDocument } from './bindings'
import { exportSharedTemplateDocument } from './document'
import type { BindingDocument } from './types'
import { validateAuthoredContent } from './references'
import { hydrateTemplateDraft } from './hydration'

/** Rebuild derived output while preserving the loaded document's authored sidecars. */
export function recompileTemplateDocument(previous: BindingDocument, definition: TemplateDefinition): BindingDocument {
  const rendering = hydrateTemplateDraft(previous).rendering!
  const compile = rendering.engine === 'shared' ? exportSharedTemplateDocument : exportBindingDocument
  const next = compile(definition, { target: previous.target, theme: previous.theme, settings: previous.settingsSpec, managedAssets: previous.managedAssets, subject: rendering.subject, text: rendering.text })
  const retainedContent = structuredClone(previous.content)
  // Generated image content has no source field and may move when authored keys change.
  const previousContentFields = new Set(previous.source.definition.fields.filter(field => field.path.startsWith('content.')).map(field => field.path.split('.')[1]))
  const previousContentSchema = previous.dataSchema.properties.content
  if (previousContentSchema?.type === 'object') for (const key of Object.keys(previousContentSchema.properties)) {
    if (!previousContentFields.has(key)) delete retainedContent[key]
  }
  const fieldPaths = new Set(next.source.definition.fields.map(field => field.path))
  for (const binding of next.artifacts.bindings) {
    const [namespace, key, ...nested] = binding.path.split('.')
    if (binding.kind === 'image' && namespace === 'content' && nested.length === 0 && !fieldPaths.has(binding.path)) delete retainedContent[key]
  }
  const merge = (base: JsonObject, overrides: JsonObject): JsonObject => Object.fromEntries(Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key]) ? merge(base[key] as JsonObject, value) : value]))
  const result: BindingDocument = { ...next,
    rendering,
    content: merge(next.content, retainedContent), inputDefaults: merge(next.inputDefaults, structuredClone(previous.inputDefaults)), settingsDefaults: merge(next.settingsDefaults, structuredClone(previous.settingsDefaults)),
    exposedInputs: previous.exposedInputs.filter(path => next.exposedInputs.includes(path)),
    exposedSettings: previous.exposedSettings.filter(id => next.exposedSettings.includes(id)),
    dependencies: structuredClone(previous.dependencies),
    ...(previous.variationPoints ? { variationPoints: structuredClone(previous.variationPoints) } : {}),
  }
  for (const [key, namespace] of [['content', 'content'], ['inputDefaults', 'inputs'], ['settingsDefaults', 'settings']] as const) {
    const schema = { ...result.dataSchema.properties[namespace], required: [] }
    const errors = key === 'content' ? validateAuthoredContent(schema, result[key]) : validateJSONData(schema, result[key])
    if (errors.length) throw new Error(`Stored ${key} no longer match the edited fields: ${errors[0].message}`)
  }
  const sidecars = [result.artifacts.subject, result.artifacts.text].join('\n')
  for (const binding of rendering.bindings ?? []) {
    if (binding.kind !== 'text') throw new Error('Sidecar bindings must be text bindings.')
    if (!sidecars.includes(`{{${binding.id}}}`)) continue
    let schema: DataSchema | undefined = result.dataSchema
    for (const part of binding.path.split('.')) schema = schema?.type === 'object' ? schema.properties[part] : undefined
    if (!schema) throw new Error(`Sidecar binding ${binding.id} references an undeclared data path.`)
    const generated = result.artifacts.bindings.find(item => item.id === binding.id)
    if (generated && (generated.kind !== 'text' || generated.path !== binding.path)) throw new Error(`Sidecar binding ID collision: ${binding.id} was reused by the compiled graph.`)
    if (!generated) result.artifacts.bindings.push(structuredClone(binding))
  }
  return result
}
