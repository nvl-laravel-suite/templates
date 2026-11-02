import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ValidateFunction } from 'ajv'
import {
  TemplateError,
  type DataSchema,
  type JsonObject,
  type JsonValue,
  type TemplateDefinition,
  type TemplateField,
  type TemplateIssue,
} from './schema'

const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
export function pathParts(path: string): string[] {
  const parts = path.split('.')
  if (
    !parts.length ||
    parts.length > 16 ||
    parts.some((part) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(part) || forbidden.has(part))
  )
    throw new TemplateError('validation', `Invalid data path: ${path}`)
  return parts
}
export function getValue(data: unknown, path: string): JsonValue | undefined {
  let value: unknown = data
  for (const part of pathParts(path)) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, part))
      return undefined
    value = (value as JsonObject)[part]
  }
  return value as JsonValue | undefined
}
/** Return a supplied non-object ancestor; absence itself is valid for default resolution. */
export function invalidParentPath(data: JsonObject, path: string): string | null {
  let cursor: JsonValue = data
  const prefix: string[] = []
  for (const part of pathParts(path).slice(0, -1)) {
    if (!Object.hasOwn(cursor, part)) return null
    prefix.push(part)
    cursor = (cursor as JsonObject)[part]
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return prefix.join('.')
  }
  return null
}
export function setValue(data: JsonObject, path: string, value: JsonValue | undefined) {
  const parts = pathParts(path)
  const leaf = parts.pop()!
  let cursor = data
  const parents: [JsonObject, string][] = []
  for (const part of parts) {
    if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      if (value === undefined) return
      cursor[part] = {}
    }
    parents.push([cursor, part])
    cursor = cursor[part] as JsonObject
  }
  if (value !== undefined) cursor[leaf] = structuredClone(value)
  else if (Object.hasOwn(cursor, leaf)) {
    delete cursor[leaf]
    for (const [parent, key] of parents.reverse()) {
      if (Object.keys(parent[key] as JsonObject).length) break
      delete parent[key]
    }
  }
}

interface ContractObject extends JsonObject {
  type: 'object'
  properties: JsonObject
  required: string[]
  additionalProperties: false
}
const objectSchema = (): ContractObject => ({
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
})
export function stableJSONStringify(input: unknown): string {
  const sort = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sort)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, sort(item)]),
          )
        : value
  return JSON.stringify(sort(input))
}
export function getTemplateDataSchema(template: Pick<TemplateDefinition, 'fields'>): JsonObject {
  const root = objectSchema()
  for (const field of template.fields) {
    const parts = pathParts(field.path)
    const leaf = parts.pop()!
    let cursor = root
    for (const part of parts) {
      const current = Object.hasOwn(cursor.properties, part) ? cursor.properties[part] : undefined
      if (
        current &&
        (typeof current !== 'object' ||
          Array.isArray(current) ||
          current.type !== 'object' ||
          Object.hasOwn(current, 'title'))
      )
        throw new TemplateError('validation', `Conflicting field paths at ${field.path}`)
      if (!current) cursor.properties[part] = objectSchema()
      if (field.required && !cursor.required.includes(part)) cursor.required.push(part)
      cursor = cursor.properties[part] as ContractObject
    }
    if (Object.hasOwn(cursor.properties, leaf))
      throw new TemplateError('validation', `Duplicate or overlapping field path: ${field.path}`)
    const property = structuredClone(field.schema) as unknown as JsonObject
    property.title = field.label
    property.description = field.description
    if (field.defaultValue !== undefined) property.default = structuredClone(field.defaultValue)
    if (field.sample !== undefined) property.examples = [structuredClone(field.sample)]
    if (!field.editable) property.readOnly = true
    cursor.properties[leaf] = property
    if (field.required) cursor.required.push(leaf)
  }
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...root }
}

const validators = new Map<string, ValidateFunction>()
export function validateJSONData(schema: JsonObject | DataSchema, input: unknown): TemplateIssue[] {
  const key = JSON.stringify(schema)
  let validator = validators.get(key)
  if (!validator) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      allowUnionTypes: false,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
      ownProperties: true,
    })
    addFormats(ajv)
    validator = ajv.compile(schema)
    if (validators.size >= 100) validators.delete(validators.keys().next().value!)
    validators.set(key, validator)
  }
  if (validator(input)) return []
  return (validator.errors ?? []).map((error) => ({
    path:
      `${error.instancePath}${'missingProperty' in error.params ? `/${error.params.missingProperty}` : ''}` ||
      '/',
    code: error.keyword,
    message: `${error.message ?? 'Invalid value'}${'missingProperty' in error.params ? `: ${error.params.missingProperty}` : ''}`,
  }))
}

export function resolveTemplateData(
  template: Pick<TemplateDefinition, 'fields'>,
  input: JsonObject = {},
  mode: 'preview' | 'runtime' = 'runtime',
) {
  const data = structuredClone(input)
  for (const field of template.fields) {
    if (getValue(data, field.path) !== undefined) continue
    // Defaults fill missing values; malformed supplied parents must remain visible to validation.
    if (invalidParentPath(data, field.path)) continue
    const value = mode === 'preview' ? (field.sample ?? field.defaultValue) : field.defaultValue
    if (value !== undefined) setValue(data, field.path, value)
  }
  return { data, issues: validateJSONData(getTemplateDataSchema(template), data) }
}
export function validateFieldExamples(field: TemplateField): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  for (const key of ['sample', 'defaultValue'] as const) {
    if (field[key] === undefined) continue
    issues.push(
      ...validateJSONData(field.schema, field[key]).map((issue) => ({
        ...issue,
        path: `fields.${field.id}.${key}${issue.path}`,
      })),
    )
  }
  return issues
}
