import type { AssetPage, RequestOptions, TemplateRepository } from './contracts'

export class TemplateRequestError extends Error {
  readonly name = 'TemplateRequestError'
  constructor(message: string, public readonly status: number, public readonly code = status === 409 ? 'conflict' : 'request_failed', public readonly errors: Readonly<Record<string, readonly string[]>> = {}) { super(message) }
}

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }

export interface LaravelTemplateRepositoryOptions { maxResponseBytes?: number }

async function readJSON(response: Response, maxResponseBytes: number): Promise<unknown> {
  const limit = response.ok ? maxResponseBytes : 32 * 1024
  let text = ''
  if (response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > limit) { await reader.cancel(); throw new TemplateRequestError('Template response exceeds the supported size.', response.status, 'response_too_large') }
        text += decoder.decode(chunk.value, { stream: true })
      }
      text += decoder.decode()
    } finally { reader.releaseLock() }
  }
  try { return JSON.parse(text) }
  catch {
    if (!response.ok) return null
    throw new TemplateRequestError('The server returned an invalid template response.', response.status, 'invalid_response')
  }
}

function responseError(response: Response, body: unknown): TemplateRequestError {
  const values = object(body) ? body : {}
  const errors: Record<string, string[]> = {}
  if (object(values.errors)) for (const [path, value] of Object.entries(values.errors).slice(0, 50)) {
    if (Array.isArray(value)) errors[path.slice(0, 200)] = value.filter((item): item is string => typeof item === 'string').slice(0, 10).map(item => item.slice(0, 1000))
  }
  const fallback = response.status === 409 ? 'This draft changed. Reload it before saving.' : `Template request failed (${response.status}).`
  return new TemplateRequestError(typeof values.message === 'string' ? values.message.slice(0, 1000) : fallback, response.status, response.status === 409 ? 'conflict' : 'request_failed', Object.freeze(errors))
}

/** Inject a request function that supplies the host's authentication and CSRF policy. */
export function createLaravelTemplateRepository(baseUrl: string, request: typeof fetch, options: LaravelTemplateRepositoryOptions = {}): TemplateRepository {
  const maxResponseBytes = options.maxResponseBytes === undefined ? 8 * 1024 * 1024 : options.maxResponseBytes
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) throw new Error('maxResponseBytes must be a positive safe integer.')
  const base = baseUrl.replace(/\/+$/, '')
  const id = encodeURIComponent
  const revision = (value: number) => { if (!Number.isSafeInteger(value) || value < 1) throw new Error('Choose a positive resource revision.'); return value }
  async function send(path: string, method = 'GET', body?: unknown, options: RequestOptions = {}): Promise<unknown> {
    const multipart = body instanceof FormData
    try {
      const response = await request(`${base}/${path}`, {
        method, signal: options.signal,
        headers: { Accept: 'application/json', ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      })
      const value = await readJSON(response, maxResponseBytes)
      if (!response.ok) throw responseError(response, value)
      if (!object(value) || !Object.hasOwn(value, 'data')) throw new TemplateRequestError('The server returned an invalid template envelope.', response.status, 'invalid_response')
      return value
    } catch (error) {
      if (error instanceof TemplateRequestError || options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
      throw new TemplateRequestError('Unable to reach the template server.', 0, 'network_error')
    }
  }
  async function data<T>(path: string, method = 'GET', body?: unknown, options?: RequestOptions): Promise<T> {
    return (await send(path, method, body, options) as { data: T }).data
  }
  return {
    load: (templateId, options) => data(`${id(templateId)}/editor`, 'GET', undefined, options),
    saveDraft: (templateId, document, expectedVersion, options) => data(`${id(templateId)}/draft`, 'PUT', { document, expectedVersion }, options),
    publish: (templateId, expectedVersion, options) => data(`${id(templateId)}/publish`, 'POST', { expectedVersion }, options),
    preview: (templateId, document, values = {}, options) => data(`${id(templateId)}/preview`, 'POST', { document, facts: values.facts, context: values.context, inputs: values.inputs, settings: values.settings, include_inline_assets: false }, options),
    render: (releaseId, input, options) => data(`revisions/${id(releaseId)}/render`, 'POST', { owner: input.owner, inputs: input.inputs, settings: input.settings }, options),
    preparePublished: (releaseId, input, options) => data(`revisions/${id(releaseId)}/prepare`, 'POST', { owner: input.owner, inputs: input.inputs, settings: input.settings }, options),
    capabilities: options => data('capabilities', 'GET', undefined, options),
    listResources: (templateId, query = {}, options) => data(`${id(templateId)}/resources${query.kind ? '?'+new URLSearchParams({ kind: query.kind }) : ''}`, 'GET', undefined, options),
    loadResource: (templateId, resourceId, version, options) => data(`${id(templateId)}/resources/${id(resourceId)}/revisions/${revision(version)}`, 'GET', undefined, options),
    loadGroupRevision: (groupId, version, options) => data(`groups/${id(groupId)}/revisions/${revision(version)}`, 'GET', undefined, options),
    listGroups: options => data('groups', 'GET', undefined, options),
    publishGroup: (groupId, document, expectedRevision, options) => data(`groups/${id(groupId)}/publish`, 'POST', { document, expectedRevision }, options),
    listFamilyChanges: (templateId, options) => data(`${id(templateId)}/family-changes`, 'GET', undefined, options),
    loadFamilyChange: (templateId, candidateId, options) => data(`${id(templateId)}/family-changes/${id(candidateId)}`, 'GET', undefined, options),
    reviewFamilyChange: (templateId, candidateId, input, options) => data(`${id(templateId)}/family-changes/${id(candidateId)}/review`, 'POST', input, options),
    prepareFamilyChange: (templateId, input, options) => data(`${id(templateId)}/family-changes`, 'POST', input, options),
    applyFamilyChange: (templateId, candidateId, input, options) => data(`${id(templateId)}/family-changes/${id(candidateId)}/apply`, 'POST', input, options),
    listAssets: async (query = {}, options) => {
      const params = new URLSearchParams()
      if (query.target) params.set('target', query.target)
      if (query.page) params.set('page', String(query.page))
      const value = await send(`assets${params.size ? '?'+params : ''}`, 'GET', undefined, options) as Record<string, unknown>
      const meta = object(value.meta) ? value.meta : value
      const links = object(value.links) ? value.links : {}
      return { data: value.data, currentPage: meta.currentPage ?? meta.current_page, lastPage: meta.lastPage ?? meta.last_page, nextPageUrl: value.nextPageUrl ?? value.next_page_url ?? links.next ?? null } as AssetPage
    },
    uploadAsset: (file, options) => { const body = new FormData(); body.append('file', file); return data('assets', 'POST', body, options) },
    importAsset: (input, options) => data('assets/import', 'POST', input, options),
  }
}
