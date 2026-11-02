import { assertManagedMedia } from './media'
import { getTemplateDataSchema } from '../template-core/contracts'
import { parseTemplateDefinition } from '../template-core/validation'
import type { DataSchema, JsonObject, JsonValue, TemplateDefinition } from '../template-core/schema'
import { createTemplateTheme } from './theme'
import { resolvePresentationSettings } from './settings'
import type { BindingDocument, PresentationSetting, TemplateTheme } from './types'
import { assertEmailTemplate } from '../template-email/profile'
import { getEmailSettingIssues } from '../template-email/settings'

export interface TemplateExportOptions {
  target: 'document' | 'email'
  theme?: TemplateTheme
  settings?: PresentationSetting[]
  subject?: string
  text?: string
  managedAssets?: Record<string, string>
}

function setDefault(target: JsonObject, path: string[], value: JsonValue) {
  let parent = target
  for (const part of path.slice(0, -1)) {
    parent[part] ??= {}
    parent = parent[part] as JsonObject
  }
  parent[path[path.length - 1]] = structuredClone(value)
}

export function createDocumentContract(input: TemplateDefinition, options: TemplateExportOptions): BindingDocument {
  const source = parseTemplateDefinition(input)
  const settings = options.settings ?? []
  if (options.target === 'email') {
    assertEmailTemplate(source)
    const issue = getEmailSettingIssues(settings)[0]; if (issue) throw new Error(issue.message)
  }
  const dataSchema = structuredClone(getTemplateDataSchema(source)) as unknown as BindingDocument['dataSchema']
  for (const key of ['facts', 'context', 'content', 'inputs', 'settings']) dataSchema.properties[key] ??= { type: 'object', properties: {}, additionalProperties: false }
  const settingsSchema = dataSchema.properties.settings as Extract<DataSchema, { type: 'object' }>
  for (const setting of settings) settingsSchema.properties[setting.id] = setting.schema
  if (settings.length) settingsSchema.required = settings.map(setting => setting.id)
  const inputDefaults: JsonObject = {}
  const content: JsonObject = {}
  for (const field of source.fields) {
    const [namespace, ...path] = field.path.split('.')
    if (!['facts', 'context', 'content', 'inputs', 'settings'].includes(namespace) || !path.length || path.some(part => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(part) || ['__proto__', 'constructor', 'prototype'].includes(part))) throw new Error('Module fields must use a safe declared namespace and path.')
    if (field.defaultValue !== undefined) {
      if (namespace === 'inputs') setDefault(inputDefaults, path, field.defaultValue)
      if (namespace === 'content') setDefault(content, path, field.defaultValue)
    }
  }
  return { format: 'template-document', schemaVersion: 1, target: options.target,
    source: { mode: 'standalone', definition: source }, dataSchema, content, inputDefaults,
    settingsDefaults: resolvePresentationSettings(settings), settingsSpec: structuredClone(settings), theme: createTemplateTheme(options.theme),
    exposedInputs: [...new Set(source.fields.filter(field => field.editable && field.path.startsWith('inputs.')).map(field => field.path.slice(7)))],
    exposedSettings: settings.filter(field => field.exposed).map(field => field.id), dependencies: [],
    managedAssets: structuredClone(options.managedAssets ?? {}), compilerVersion: 'template-platform/1',
    rendering: { engine: 'shared', ...(options.subject !== undefined ? { subject: options.subject } : {}), ...(options.text !== undefined ? { text: options.text } : {}) },
    artifacts: { engine: 'shared', html: '', css: '', bindings: [], ...(options.subject !== undefined ? { subject: options.subject } : {}), ...(options.text !== undefined ? { text: options.text } : {}) },
  }
}

/** Preserves runtime conditions, loops and dynamic block properties for the same JS compiler on the server. */
export function exportSharedTemplateDocument(input: TemplateDefinition, options: TemplateExportOptions): BindingDocument {
  const document = createDocumentContract(input, options)
  assertManagedMedia(document.source.definition, 'shared')
  for (const asset of document.source.definition.assets) {
    if (asset.kind !== 'image' || !document.managedAssets?.[asset.id]) throw new Error('Shared export requires retained managed image assets; font drivers are not qualified yet.')
  }
  return document
}
