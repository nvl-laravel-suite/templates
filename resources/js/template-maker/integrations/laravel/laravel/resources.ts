import { createTemplateCreator } from '../../../template-creator'
import { createTemplateTheme, contentReferenceId, isContentReference, parseTemplateBlockLibrary, parseTemplateDefinition, resolvePresentationSettings, type BindingDocument, type ContentReference, type JsonObject, type JsonValue, type PresentationSetting, type StandaloneTemplateDraft, type TemplateThemeInput } from '../../../template-renderer'
import type { ResourceRevision, TemplateRepository } from './contracts'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const clone = <T>(value: T): T => structuredClone(value)

export function reusableContentIdentity(content: JsonObject): string {
  const refs: unknown[] = []
  const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered) : record(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value
  const visit = (value: unknown, path: string[]) => {
    if (record(value) && value.kind === 'content') {
      // Malformed edits must invalidate a cached successful resolution as well.
      refs.push(isContentReference(value) ? [path, contentReferenceId(value), value.revision, value.path ?? ''] : [path, { invalid: ordered(value) }])
      return
    }
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visit(child, [...path, key])
  }
  visit(content, [])
  return JSON.stringify(refs)
}

/** Keep current literal edits while reusing the resolved values of unchanged exact references. */
export function projectResolvedContent(content: JsonObject, resolved: JsonObject): JsonObject {
  const visit = (value: JsonValue, projection: JsonValue | undefined): JsonValue => {
    if (record(value) && value.kind === 'content') {
      if (!isContentReference(value)) throw new Error('Invalid reusable content reference.')
      if (projection === undefined) throw new Error('A reusable content value has not been resolved.')
      return clone(projection)
    }
    if (Array.isArray(value)) return value.map((child, index) => visit(child, Array.isArray(projection) ? projection[index] : undefined))
    if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child as JsonValue, record(projection) ? projection[key] as JsonValue : undefined)])) as JsonObject
    return value
  }
  return visit(content, resolved) as JsonObject
}

/** Use an authorized family snapshot for the same exact references, even after a field is moved. */
export function projectSnapshotContent(content: JsonObject, basis: JsonObject, resolved: JsonObject): JsonObject {
  const values = new Map<string, JsonValue>()
  const key = (ref: ContentReference) => JSON.stringify([contentReferenceId(ref), ref.revision, ref.path ?? ''])
  const collect = (raw: JsonValue, value: JsonValue | undefined) => {
    if (record(raw) && raw.kind === 'content' && !isContentReference(raw)) throw new Error('Invalid reusable content reference.')
    if (isContentReference(raw)) { if (value !== undefined) values.set(key(raw), value); return }
    if (raw && typeof raw === 'object') for (const [name, child] of Object.entries(raw)) collect(child as JsonValue, value && typeof value === 'object' ? (value as JsonObject)[name] : undefined)
  }
  collect(basis, resolved)
  const project = (value: JsonValue): JsonValue => {
    if (record(value) && value.kind === 'content' && !isContentReference(value)) throw new Error('Invalid reusable content reference.')
    if (isContentReference(value)) { const result = values.get(key(value)); if (result === undefined) throw new Error('A family content reference changed. Load an authorized snapshot before previewing that reference.'); return clone(result) }
    if (Array.isArray(value)) return value.map(project)
    if (record(value)) return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, project(child as JsonValue)])) as JsonObject
    return value
  }
  return project(content) as JsonObject
}
function pinned(source: StandaloneTemplateDraft, resource: ResourceRevision): StandaloneTemplateDraft {
  return { ...source, dependencies: [...source.dependencies.filter(pin => pin.resourceId !== resource.id || pin.revision !== resource.revision), { resourceId: resource.id, revision: resource.revision }] }
}

/** Explicit copy/import. The source keeps an exact resource dependency; collisions never shadow existing blocks/assets. */
export function applyTemplateResource(source: StandaloneTemplateDraft, resource: ResourceRevision): StandaloneTemplateDraft {
  const next = clone(source)
  const body = resource.document
  const envelope = record(body) && record(body.library) ? body : null
  if (resource.kind === 'partial') {
    const library = parseTemplateBlockLibrary(envelope ? envelope.library : body)
    const creator = createTemplateCreator({ initialTemplate: next.source.definition })
    try { const entry = creator.actions.importBlockLibrary(library); creator.actions.insertBlock(entry.blockId, entry.version); next.source.definition = creator.getTemplate() }
    finally { creator.destroy() }
    const mappings = envelope?.managedAssets
    if (mappings !== undefined && !record(mappings)) throw new Error('A partial asset mapping must be an object.')
    for (const [id, managedId] of Object.entries(mappings ?? {})) {
      if (typeof managedId !== 'string' || !library.assets.some(asset => asset.id === id)) throw new Error('A partial asset mapping must identify one of its assets.')
      if (next.managedAssets?.[id] && next.managedAssets[id] !== managedId) throw new Error(`A different retained asset already uses ${id}.`)
      next.managedAssets = { ...next.managedAssets, [id]: managedId }
    }
  } else if (resource.kind === 'theme') {
    if (!record(body)) throw new Error('A theme resource must be an object.')
    next.theme = createTemplateTheme(body as TemplateThemeInput)
  } else if (resource.kind === 'settings') {
    if (!record(body) || !Array.isArray(body.settingsSpec)) throw new Error('A settings resource needs settingsSpec.')
    const spec = body.settingsSpec as PresentationSetting[]
    next.settingsDefaults = resolvePresentationSettings(spec, {}, false)
    next.settingsSpec = clone(spec)
    next.exposedSettings = spec.filter(field => field.exposed).map(field => field.id)
  } else if (resource.kind === 'layout') {
    // Layout changes replace the authored graph deliberately. Existing field values remain
    // subject to compilation checks rather than being silently discarded or coerced.
    const definition = parseTemplateDefinition(record(body) && body.format === 'template-document' ? (body.source as BindingDocument['source'])?.definition : body)
    definition.id = next.source.definition.id; definition.name = next.source.definition.name
    next.source.definition = definition
    if (record(body) && body.format === 'template-document') next.managedAssets = clone((body as unknown as BindingDocument).managedAssets ?? {})
  } else throw new Error('Choose a partial, layout, theme or settings resource. Content is referenced explicitly by field.')
  delete next.artifacts
  return pinned(next, resource)
}

export function referenceTemplateContent(source: StandaloneTemplateDraft, fieldPath: string, resource: ResourceRevision, path = ''): StandaloneTemplateDraft {
  if (resource.kind !== 'content' || !source.source.definition.fields.some(field => field.path === `content.${fieldPath}`)) throw new Error('Choose a declared content field and a content resource.')
  const ref: ContentReference = { kind: 'content', id: resource.id, revision: resource.revision, path }
  if (!isContentReference(ref)) throw new Error('Choose a safe reusable content path.')
  const next = clone(source)
  const parts = fieldPath.split('.'); let cursor = next.content
  for (const key of parts.slice(0, -1)) { if (!record(cursor[key])) cursor[key] = {}; cursor = cursor[key] as JsonObject }
  cursor[parts.at(-1)!] = ref as unknown as JsonObject
  delete next.artifacts
  return pinned(next, resource)
}

/** HTTP is confined to the host. Exact revisions are cached per load, never resolved by name/latest. */
export async function resolveReusableContent(templateId: string, content: JsonObject, repository: Pick<TemplateRepository, 'loadResource'>, signal?: AbortSignal): Promise<JsonObject> {
  const cache = new Map<string, Promise<ResourceRevision>>()
  const visit = async (value: JsonValue, active: Set<string>, depth = 0): Promise<JsonValue> => {
    if (depth > 32) throw new Error('Reusable content depth exceeded.')
    if (record(value) && value.kind === 'content') {
      if (!isContentReference(value)) throw new Error('Invalid reusable content reference.')
      const id = contentReferenceId(value)
      const key = `${id}@${value.revision}`
      if (active.has(key)) throw new Error('Circular reusable content reference.')
      if (!cache.has(key)) cache.set(key, repository.loadResource(templateId, id, value.revision, { signal }))
      const resource = await cache.get(key)!
      let selected = resource.document
      for (const part of value.path?.split('.').filter(Boolean) ?? []) {
        if (!record(selected) || !Object.hasOwn(selected, part)) throw new Error('Reusable content path is missing.')
        selected = selected[part]
      }
      return visit(selected as JsonValue, new Set([...active, key]), depth + 1)
    }
    if (Array.isArray(value)) return Promise.all(value.map(item => visit(item, active, depth + 1)))
    if (record(value)) return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, child]) => [key, await visit(child as JsonValue, active, depth + 1)]))) as JsonObject
    return value
  }
  return await visit(content, new Set()) as JsonObject
}
