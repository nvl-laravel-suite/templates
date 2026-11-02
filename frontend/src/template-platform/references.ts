import { validateJSONData } from '../template-core/contracts'
import type { DataSchema, JsonObject, JsonValue } from '../template-core/schema'

/** Existing PHP sources may use resourceId; new authored references use id. */
export type ContentReference = { kind: 'content'; revision: number; path?: string } & (
  { id: string; resourceId?: string } | { resourceId: string; id?: string }
)

/** Match the backend's resourceId precedence without normalizing the authored reference. */
export function contentReferenceId(reference: ContentReference): string {
  return reference.resourceId ?? reference.id!
}

export function isContentReference(value: unknown): value is ContentReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as Record<string, unknown>
  const identifiers = ['id', 'resourceId'].filter(key => Object.hasOwn(ref, key))
  return ref.kind === 'content' && identifiers.length > 0 && identifiers.every(key => typeof ref[key] === 'string' && ref[key].length > 0) && Number.isSafeInteger(ref.revision) && Number(ref.revision) > 0 &&
    (ref.path === undefined || (typeof ref.path === 'string' && (ref.path === '' || ref.path.split('.').every(part => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(part) && !['constructor', 'prototype', '__proto__'].includes(part))))) &&
    Object.keys(ref).every(key => ['kind', 'id', 'resourceId', 'revision', 'path'].includes(key))
}

/** Raw references stay authored; the backend resolves and validates their exact values at publication. */
export function validateAuthoredContent(schema: DataSchema, value: JsonValue) {
  const segment = '(?!(?:constructor|prototype|__proto__)(?:\\.|$))[a-zA-Z][a-zA-Z0-9_]*'
  const reference: JsonObject = {
    type: 'object',
    properties: { kind: { const: 'content' }, id: { type: 'string', minLength: 1 }, resourceId: { type: 'string', minLength: 1 }, revision: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, path: { type: 'string', pattern: `^(?:${segment}(?:\\.${segment})*)?$` } },
    required: ['kind', 'revision'],
    anyOf: [{ properties: { id: {} }, required: ['id'] }, { properties: { resourceId: {} }, required: ['resourceId'] }],
    additionalProperties: false,
  }
  const walk = (node: DataSchema, root = false): JsonObject => {
    const copy: JsonObject = structuredClone(node) as JsonObject
    if (node.type === 'object') copy.properties = Object.fromEntries(Object.entries(node.properties).map(([key, child]) => [key, walk(child)]))
    if (node.type === 'array') copy.items = walk(node.items)
    return root ? copy : { anyOf: [copy, reference] }
  }
  return validateJSONData(walk(schema, true), value)
}
