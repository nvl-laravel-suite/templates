import { describe, expect, it } from 'vitest'
import { createLaravelTemplateRepository, TemplateRequestError } from './repository'

describe('Laravel host transport', () => {
  it('encodes opaque identities and sends raw recoverable sources and concurrency tokens', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const request = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ data: { version: 4, document: { source: { mode: 'standalone' } } } })
    }
    const repository = createLaravelTemplateRepository('/api/templates/', request)
    const signal = new AbortController().signal
    const source = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'standalone' } } as any
    const result = await repository.saveDraft('template/a', source, 3, { signal })
    expect(result.version).toBe(4)
    expect(calls[0].url).toBe('/api/templates/template%2Fa/draft')
    expect(calls[0].init?.signal).toBe(signal)
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ document: source, expectedVersion: 3 })
    expect(calls[0].init).not.toHaveProperty('credentials')
  })

  it('uses editor bootstrap and exact scoped resource and group revisions', async () => {
    const urls: string[] = []
    const repository = createLaravelTemplateRepository('/templates', async url => {
      urls.push(String(url)); return Response.json({ data: { id: 'result' } })
    })
    await repository.load('a b')
    await repository.listResources('a b', { kind: 'partial' })
    await repository.loadResource('a b', 'private/id', 2)
    await repository.loadGroupRevision('group/id', 3)
    expect(urls).toEqual(['/templates/a%20b/editor', '/templates/a%20b/resources?kind=partial', '/templates/a%20b/resources/private%2Fid/revisions/2', '/templates/groups/group%2Fid/revisions/3'])
  })

  it('preserves structured validation and conflict errors without exposing arbitrary response bodies', async () => {
    const repository = createLaravelTemplateRepository('/templates', async () => Response.json({ message: 'Invalid source', errors: { 'source.definition': ['Repair the graph.'] } }, { status: 422 }))
    await expect(repository.load('a')).rejects.toMatchObject({ status: 422, message: 'Invalid source', errors: { 'source.definition': ['Repair the graph.'] } })
    const conflict = createLaravelTemplateRepository('/templates', async () => new Response('<html>private diagnostics</html>', { status: 409 }))
    await expect(conflict.load('a')).rejects.toMatchObject({ status: 409, code: 'conflict' })
    await expect(conflict.load('a')).rejects.not.toThrow('private diagnostics')
    expect(new TemplateRequestError('x', 409).status).toBe(409)
  })

  it('bounds errors and reports malformed successful responses explicitly', async () => {
    const huge = createLaravelTemplateRepository('/templates', async () => Response.json({ message: 'x'.repeat(50000) }, { status: 422 }))
    await expect(huge.load('a')).rejects.toMatchObject({ status: 422, code: 'response_too_large' })
    const malformed = createLaravelTemplateRepository('/templates', async () => new Response('not json'))
    await expect(malformed.load('a')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('normalizes network failures while retaining cancellation semantics', async () => {
    const unavailable = createLaravelTemplateRepository('/templates', async () => { throw new TypeError('private network detail') })
    await expect(unavailable.load('a')).rejects.toMatchObject({ status: 0, code: 'network_error' })
    await expect(unavailable.load('a')).rejects.not.toThrow('private network detail')
    const stopped = new DOMException('Cancelled', 'AbortError')
    const aborted = createLaravelTemplateRepository('/templates', async () => { throw stopped })
    await expect(aborted.load('a')).rejects.toBe(stopped)
  })

  it('uploads multipart bytes without a JSON content type and preserves asset pagination', async () => {
    const calls: RequestInit[] = []
    const repository = createLaravelTemplateRepository('/templates', async (_url, init) => {
      calls.push(init ?? {})
      return calls.length === 1 ? Response.json({ data: { id: 'asset', previewUrl: '/asset' } }) : Response.json({ data: [{ id: 'asset', previewUrl: '/asset' }], current_page: 2, last_page: 3, next_page_url: '/assets?page=3' })
    })
    await repository.uploadAsset(new File(['bytes'], 'logo.png', { type: 'image/png' }))
    expect(calls[0].body).toBeInstanceOf(FormData)
    expect(new Headers(calls[0].headers).has('Content-Type')).toBe(false)
    expect(await repository.listAssets({ page: 2 })).toMatchObject({ data: [{ id: 'asset' }], currentPage: 2, lastPage: 3, nextPageUrl: '/assets?page=3' })
  })

  it('keeps staff preview and owner rendering namespaces separate', async () => {
    const calls: { url: string; body: unknown }[] = []
    const repository = createLaravelTemplateRepository('/templates', async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return Response.json({ data: { html: '<p>Resolved</p>', css: '' } })
    })
    await repository.preview('a', { source: { mode: 'standalone' } } as any, { facts: { code: 'STAFF' }, inputs: { message: 'Hi' }, document: { forged: true } } as any)
    await repository.render('release/id', { owner: { id: 'owner' }, inputs: { message: 'Hi' }, settings: { font: 20 }, facts: { code: 'FORGED' } } as any)
    await repository.preparePublished('release/id', { owner: { id: 'owner' }, inputs: { message: 'Hi' }, settings: { font: 20 }, context: { forged: true } } as any)
    expect(calls[0]).toEqual({ url: '/templates/a/preview', body: { facts: { code: 'STAFF' }, inputs: { message: 'Hi' }, document: { source: { mode: 'standalone' } }, include_inline_assets: false } })
    expect(calls[1]).toEqual({ url: '/templates/revisions/release%2Fid/render', body: { owner: { id: 'owner' }, inputs: { message: 'Hi' }, settings: { font: 20 } } })
    expect(calls[2]).toEqual({ url: '/templates/revisions/release%2Fid/prepare', body: { owner: { id: 'owner' }, inputs: { message: 'Hi' }, settings: { font: 20 } } })
  })
})

it('uses exact family candidate tokens, explicit conflict choices and pinned group publication', async () => {
  const calls: { url: string; method?: string; body?: unknown }[] = []
  const repository = createLaravelTemplateRepository('/templates', async (url, init) => {
    calls.push({ url: String(url), method: init?.method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) }); return Response.json({ data: {} })
  })
  const sourceChecksum = 'a'.repeat(64)
  await repository.listGroups()
  await repository.listFamilyChanges('a/b')
  await repository.loadFamilyChange('a/b', 'candidate/id')
  await repository.reviewFamilyChange('a/b', 'candidate/id', { resolutions: { conflict: 'family' }, expectedVersion: 4, sourceChecksum })
  await repository.prepareFamilyChange('a/b', { operation: 'upgrade', target: { groupId: 'g', revision: 2 }, expectedVersion: 4, sourceChecksum })
  await repository.applyFamilyChange('a/b', 'candidate/id', { resolutions: { conflict: 'family' }, expectedVersion: 4, sourceChecksum })
  const document = { source: { mode: 'standalone' }, variationPoints: [{ id: 'point' }] } as any
  await repository.publishGroup('g/a', document, 2)
  expect(calls).toEqual([
    { url: '/templates/groups', method: 'GET' },
    { url: '/templates/a%2Fb/family-changes', method: 'GET' },
    { url: '/templates/a%2Fb/family-changes/candidate%2Fid', method: 'GET' },
    { url: '/templates/a%2Fb/family-changes/candidate%2Fid/review', method: 'POST', body: { resolutions: { conflict: 'family' }, expectedVersion: 4, sourceChecksum } },
    { url: '/templates/a%2Fb/family-changes', method: 'POST', body: { operation: 'upgrade', target: { groupId: 'g', revision: 2 }, expectedVersion: 4, sourceChecksum } },
    { url: '/templates/a%2Fb/family-changes/candidate%2Fid/apply', method: 'POST', body: { resolutions: { conflict: 'family' }, expectedVersion: 4, sourceChecksum } },
    { url: '/templates/groups/g%2Fa/publish', method: 'POST', body: { document, expectedRevision: 2 } },
  ])
})

describe('response byte budgets', () => {
  const envelope = JSON.stringify({ data: { html: 'é🙂' } })
  const bytes = new TextEncoder().encode(envelope).byteLength

  it('uses the configured byte boundary, including multibyte UTF-8 split across chunks', async () => {
    const payload = new TextEncoder().encode(envelope)
    const request = async () => new Response(new ReadableStream({ start(controller) { for (const byte of payload) controller.enqueue(new Uint8Array([byte])); controller.close() } }))
    await expect(createLaravelTemplateRepository('/templates', request, { maxResponseBytes: bytes }).load('a')).resolves.toEqual({ html: 'é🙂' })
    await expect(createLaravelTemplateRepository('/templates', request, { maxResponseBytes: bytes - 1 }).load('a')).rejects.toMatchObject({ code: 'response_too_large' })
  })

  it('allows a server-configured limit above the legacy default and retains two-argument calls', async () => {
    const response = JSON.stringify({ data: { html: 'x'.repeat(8 * 1024 * 1024) } })
    const request = async () => new Response(response)
    await expect(createLaravelTemplateRepository('/templates', request, { maxResponseBytes: response.length }).load('a')).resolves.toHaveProperty('html')
    await expect(createLaravelTemplateRepository('/templates', request).load('a')).rejects.toMatchObject({ code: 'response_too_large' })
  })

  it('keeps the independent 32 KiB error cap under both smaller and larger success limits', async () => {
    const smallError = async () => Response.json({ message: 'Validation failed' }, { status: 422 })
    await expect(createLaravelTemplateRepository('/templates', smallError, { maxResponseBytes: 1 }).load('a')).rejects.toMatchObject({ code: 'request_failed', message: 'Validation failed' })
    const largeError = async () => Response.json({ message: 'x'.repeat(32 * 1024) }, { status: 422 })
    await expect(createLaravelTemplateRepository('/templates', largeError, { maxResponseBytes: 64 * 1024 * 1024 }).load('a')).rejects.toMatchObject({ code: 'response_too_large' })
  })

  it.each([0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '1024'])('rejects invalid configured limits synchronously: %s', value => {
    const maxResponseBytes = value as number
    expect(() => createLaravelTemplateRepository('/templates', async () => Response.json({ data: {} }), { maxResponseBytes })).toThrow(/positive safe integer/)
  })

  it('accepts the positive safe integer range without an arbitrary upper ceiling', async () => {
    await expect(createLaravelTemplateRepository('/templates', async () => Response.json({ data: {} }), { maxResponseBytes: Number.MAX_SAFE_INTEGER }).load('a')).resolves.toEqual({})
  })
})

it('sends optional asset targets before page metadata while keeping old queries compatible', async () => {
  const urls: string[] = []
  const repository = createLaravelTemplateRepository('/templates', async url => { urls.push(String(url)); return Response.json({ data: [], meta: { current_page: 2, last_page: 3 }, links: { next: '/assets?page=3' } }) })
  expect(await repository.listAssets({ target: 'email', page: 2 })).toEqual({ data: [], currentPage: 2, lastPage: 3, nextPageUrl: '/assets?page=3' })
  await repository.listAssets({ page: 2 })
  await repository.listAssets()
  expect(urls).toEqual(['/templates/assets?target=email&page=2', '/templates/assets?page=2', '/templates/assets'])
})
