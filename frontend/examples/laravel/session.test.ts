import { describe, expect, it, vi } from 'vitest'
import { createTemplateSession } from './session'
import type { EditorBootstrap, TemplateRepository, TemplateSourceDocument } from './contracts'

function standalone(name = 'A'): TemplateSourceDocument {
  return { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'standalone', definition: { id: name, name } }, content: {}, inputDefaults: {}, settingsDefaults: {}, exposedInputs: [], exposedSettings: [], settingsSpec: [], dependencies: [], theme: {}, dataSchema: { type: 'object', properties: {} } } as unknown as TemplateSourceDocument
}
function bootstrap(id = 'a', source: TemplateSourceDocument | null = standalone()): EditorBootstrap {
  return { template: { id, key: id, name: id, groupId: null, status: 'active' }, version: 1, source, document: null, family: null, currentRevisionId: null, capabilities: { schemaVersion: 1, compilerVersions: ['template-platform/1'], sourceModes: ['standalone', 'group-variant'], targets: ['document', 'email'], engines: { bindings: true, shared: true }, pdf: false, assetTypes: ['image/png'], variantOverrides: ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings'] }, previewAssets: {}, issues: [] }
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (cause: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function repository(overrides: Partial<TemplateRepository> = {}): TemplateRepository {
  return { load: async id => bootstrap(id), saveDraft: async (_id, document, version) => ({ version: version + 1, document }), publish: async () => ({ id: 'release', revision: 1 }), preview: async () => ({ html: 'preview', css: '' }), ...overrides } as TemplateRepository
}

describe('host authoring session', () => {
  it('keeps the immediate authored workspace callback clean while retaining compiled output', async () => {
    const compiled = { ...standalone(), artifacts: { engine: 'bindings', html: '<p>Retained</p>', css: '', bindings: [], subject: 'Subject', text: 'Plain' } } as TemplateSourceDocument
    const session = createTemplateSession({ repository: repository({ load: async () => bootstrap('a', compiled) }), compile: source => source })
    await session.load('a')
    const { artifacts: _, ...authored } = compiled as any
    session.change({ ...authored, rendering: { engine: 'bindings', subject: 'Subject', text: 'Plain' } })
    expect(session.getState()).toMatchObject({ dirty: false, generation: 0, source: { artifacts: { html: '<p>Retained</p>' } } })
    session.change({ ...authored, rendering: { engine: 'shared', subject: 'Subject', text: 'Plain' } })
    expect(session.getState()).toMatchObject({ dirty: true, generation: 1 })
  })

  it('compares authored values independently of object order and derived artifact changes', async () => {
    const source = { ...standalone(), rendering: { engine: 'shared' }, artifacts: { engine: 'bindings', html: 'old', css: '', bindings: [] } } as TemplateSourceDocument
    const session = createTemplateSession({ repository: repository({ load: async () => bootstrap('a', source) }), compile: value => value })
    await session.load('a')
    session.change(Object.fromEntries(Object.entries({ ...source, artifacts: { engine: 'bindings', html: 'new', css: '', bindings: [] } }).reverse()) as unknown as TemplateSourceDocument)
    expect(session.getState()).toMatchObject({ dirty: false, generation: 0 })
  })

  it('saves recoverable raw drafts without compiling and adopts canonical returned source', async () => {
    const compile = vi.fn(() => { throw new Error('Incomplete draft') })
    const session = createTemplateSession({ repository: repository({ saveDraft: async (_id, _source, version) => ({ version: version + 1, document: standalone('Canonical') }) }), compile })
    await session.load('a'); session.change(standalone('Incomplete')); await session.save()
    expect(session.getState()).toMatchObject({ version: 2, dirty: false, source: { source: { definition: { name: 'Canonical' } } } })
    expect(compile).not.toHaveBeenCalled()
  })

  it('keeps edits made during save dirty while advancing the concurrency token', async () => {
    const pending = deferred<any>(); const session = createTemplateSession({ repository: repository({ saveDraft: () => pending.promise }), compile: source => source })
    await session.load('a'); session.change(standalone('Saved')); const saving = session.save(); session.change(standalone('Newer'))
    pending.resolve({ version: 2, document: standalone('Canonical saved') }); await saving
    expect(session.getState()).toMatchObject({ version: 2, dirty: true, source: { source: { definition: { name: 'Newer' } } } })
  })

  it('rejects overlapping writes and retains local source and token on conflicts', async () => {
    const pending = deferred<any>(); const session = createTemplateSession({ repository: repository({ saveDraft: () => pending.promise }), compile: source => source })
    await session.load('a'); session.change(standalone('Local')); const saving = session.save()
    await expect(session.publish()).rejects.toThrow(/progress/i)
    pending.reject(Object.assign(new Error('Conflict'), { status: 409 })); await expect(saving).rejects.toThrow('Conflict')
    expect(session.getState()).toMatchObject({ version: 1, dirty: true, phase: 'idle', source: { source: { definition: { name: 'Local' } } }, error: { status: 409 } })
  })

  it('suppresses stale loads and aborts the previous identity', async () => {
    const first = deferred<EditorBootstrap>(); let oldSignal: AbortSignal | undefined
    const session = createTemplateSession({ repository: repository({ load: (id, options) => { if (id === 'a') { oldSignal = options?.signal; return first.promise } return Promise.resolve(bootstrap('b', standalone('B'))) } }), compile: source => source })
    const a = session.load('a'); await session.load('b'); first.resolve(bootstrap('a')); await a
    expect(oldSignal?.aborted).toBe(true)
    expect(session.getState()).toMatchObject({ id: 'b', epoch: 2, source: { source: { definition: { name: 'B' } } } })
  })

  it('ignores old save completions after a template switch', async () => {
    const pending = deferred<any>(); const session = createTemplateSession({ repository: repository({ saveDraft: () => pending.promise }), compile: source => source })
    await session.load('a'); session.change(standalone('A edit')); const saving = session.save(); await session.load('b')
    pending.resolve({ version: 99, document: standalone('A canonical') }); await saving
    expect(session.getState()).toMatchObject({ id: 'b', version: 1, dirty: false, phase: 'idle', source: { source: { definition: { name: 'A' } } } })
  })

  it('publishes the compiled captured candidate at its exact saved token and reports newer edits', async () => {
    const saved = deferred<any>(); const writes: unknown[] = []
    const session = createTemplateSession({ repository: repository({ saveDraft: async (id, source, token) => { writes.push({ id, source, token }); return saved.promise }, publish: async (id, token) => { writes.push({ publishedId: id, token }); return { id: 'release-2', revision: 2 } } }), compile: source => ({ ...source, artifacts: { engine: 'bindings', html: 'captured', css: '', bindings: [] } }) as TemplateSourceDocument })
    await session.load('a'); session.change(standalone('Candidate')); const publishing = session.publish(); await Promise.resolve(); session.change(standalone('Newer'))
    saved.resolve({ version: 8, document: standalone('Candidate') }); await publishing
    expect(writes).toMatchObject([{ id: 'a', token: 1, source: { artifacts: { html: 'captured' }, source: { definition: { name: 'Candidate' } } } }, { publishedId: 'a', token: 8 }])
    expect(session.getState()).toMatchObject({ version: 8, dirty: true, newerEdits: true, publication: { release: { id: 'release-2' } }, source: { source: { definition: { name: 'Newer' } } } })
  })

  it('never publishes after changing identity while compilation or save is pending', async () => {
    const saved = deferred<any>(); const publish = vi.fn(); const session = createTemplateSession({ repository: repository({ saveDraft: () => saved.promise, publish }), compile: source => source })
    await session.load('a'); const publishing = session.publish(); await Promise.resolve(); await session.load('b'); saved.resolve({ version: 2, document: standalone() }); await publishing
    expect(publish).not.toHaveBeenCalled(); expect(session.getState()).toMatchObject({ id: 'b', version: 1, publication: null })
  })

  it('preserves source when publication qualification fails without issuing a write', async () => {
    const saveDraft = vi.fn(); const session = createTemplateSession({ repository: repository({ saveDraft }), compile: () => { throw new Error('Compiler unavailable') } })
    await session.load('a'); session.change(standalone('Keep editing'))
    await expect(session.publish()).rejects.toThrow('Compiler unavailable')
    expect(saveDraft).not.toHaveBeenCalled(); expect(session.getState()).toMatchObject({ phase: 'idle', dirty: true, version: 1, source: { source: { definition: { name: 'Keep editing' } } } })
  })

  it('does not write a candidate after its asynchronous compiler belongs to an old identity', async () => {
    const compiling = deferred<TemplateSourceDocument>(); const saveDraft = vi.fn(); const session = createTemplateSession({ repository: repository({ saveDraft }), compile: () => compiling.promise })
    await session.load('a'); const publishing = session.publish(); await session.load('b'); compiling.resolve(standalone('A compiled')); await publishing
    expect(saveDraft).not.toHaveBeenCalled(); expect(session.getState()).toMatchObject({ id: 'b', phase: 'idle', version: 1 })
  })

  it('checks identity again when a subscriber navigates after the candidate save', async () => {
    const publish = vi.fn(); const session = createTemplateSession({ repository: repository({ publish }), compile: source => source })
    await session.load('a')
    session.subscribe(() => { const state = session.getState(); if (state.id === 'a' && state.version === 2) void session.load('b') })
    await session.publish()
    expect(publish).not.toHaveBeenCalled(); expect(session.getState()).toMatchObject({ id: 'b', version: 1 })
  })

  it('retains the saved token after publication fails and permits an explicit retry', async () => {
    let attempts = 0
    const session = createTemplateSession({ repository: repository({ publish: async () => { if (++attempts === 1) throw new Error('Publication rejected'); return { id: 'retry-release', revision: 2 } } }), compile: source => source })
    await session.load('a'); session.change(standalone('Candidate')); await expect(session.publish()).rejects.toThrow('Publication rejected')
    expect(session.getState()).toMatchObject({ version: 2, dirty: false, publication: null, phase: 'idle' })
    await session.publish(); expect(session.getState()).toMatchObject({ version: 3, publication: { release: { id: 'retry-release' } } })
  })

  it('keeps a group variant source pinned instead of compiling its materialized graph', async () => {
    const source = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 3 }, overrides: { content: { title: 'Celebrate' } } } } as TemplateSourceDocument
    const compile = vi.fn(() => { throw new Error('Group source must remain raw') }); let saved: unknown
    const session = createTemplateSession({ repository: repository({ load: async () => bootstrap('a', source), saveDraft: async (_id, document) => { saved = document; return { version: 2, document } } }), compile })
    await session.load('a'); await session.publish()
    expect(saved).toEqual(source); expect(compile).not.toHaveBeenCalled(); expect(session.getState().publication?.release.id).toBe('release')
  })

  it('keeps only the latest preview and invalidates it when the source changes', async () => {
    const first = deferred<any>(); const second = deferred<any>(); let calls = 0
    const session = createTemplateSession({ repository: repository({ preview: () => ++calls === 1 ? first.promise : second.promise }), compile: source => source })
    await session.load('a'); const old = session.preview(); await Promise.resolve(); const latest = session.preview(); await Promise.resolve(); second.resolve({ html: 'latest', css: '' }); await latest; first.resolve({ html: 'old', css: '' }); await old
    expect(session.getState().preview?.html).toBe('latest'); session.change(standalone('Edited')); expect(session.getState().preview).toBeNull()
  })

  it('clears a successful preview during a failed refresh and allows a clean retry', async () => {
    const failed = deferred<any>()
    let attempts = 0
    const session = createTemplateSession({ repository: repository({ preview: async () => {
      attempts++
      if (attempts === 2) return failed.promise
      return { html: attempts === 1 ? 'First preview' : 'Retried preview', css: '' }
    } }), compile: source => source })
    await session.load('a')
    await session.preview()
    expect(session.getState().preview?.html).toBe('First preview')
    const refreshing = session.preview()
    expect(session.getState()).toMatchObject({ preview: null, previewing: true, error: null })
    failed.reject(new Error('Preview rejected'))
    await expect(refreshing).rejects.toThrow('Preview rejected')
    expect(session.getState()).toMatchObject({ preview: null, previewing: false, error: { message: 'Preview rejected' } })
    await session.preview()
    expect(session.getState()).toMatchObject({ preview: { html: 'Retried preview' }, previewing: false, error: null })
  })

  it.each(['resolve', 'reject'] as const)('invalidates runtime previews without changing authored state and ignores an old %s', async completion => {
    const pending = deferred<any>()
    let attempts = 0, oldSignal: AbortSignal | undefined
    const session = createTemplateSession({ repository: repository({ preview: async (_id, _source, data, options) => {
      if (++attempts === 2) { oldSignal = options?.signal; return pending.promise }
      return { html: String(data?.inputs?.message), css: '' }
    } }), compile: source => source })
    await session.load('a')
    await session.preview({ inputs: { message: 'First' } })
    session.invalidatePreview()
    expect(session.getState()).toMatchObject({ preview: null, previewing: false, generation: 0, dirty: false, version: 1 })
    const old = session.preview({ inputs: { message: 'Old pending' } })
    await Promise.resolve()
    session.invalidatePreview()
    expect(oldSignal?.aborted).toBe(true)
    expect(session.getState()).toMatchObject({ preview: null, previewing: false, generation: 0, dirty: false, version: 1 })
    await session.preview({ inputs: { message: 'Current' } })
    if (completion === 'resolve') pending.resolve({ html: 'Old pending', css: '' })
    else pending.reject(new Error('Old failure'))
    await old
    expect(session.getState()).toMatchObject({ preview: { html: 'Current' }, previewing: false, error: null, generation: 0, dirty: false, version: 1 })
  })

  it('ignores stale preview errors after a new identity loads', async () => {
    const pending = deferred<any>(); const session = createTemplateSession({ repository: repository({ preview: () => pending.promise }), compile: source => source })
    await session.load('a'); const preview = session.preview(); await Promise.resolve(); await session.load('b'); pending.reject(new Error('Old preview rejected')); await preview
    expect(session.getState()).toMatchObject({ id: 'b', error: null, preview: null, previewing: false })
  })

  it('exposes immutable snapshots and creates an unsaved source for an empty bootstrap', async () => {
    const session = createTemplateSession({ repository: repository({ load: async () => bootstrap('a', null) }), compile: source => source, createSource: () => standalone('New') })
    const observed: unknown[] = []; const unsubscribe = session.subscribe(() => observed.push(session.getState()))
    await session.load('a'); const state = session.getState()
    expect(state).toMatchObject({ dirty: true, source: { source: { definition: { name: 'New' } } } }); expect(Object.isFrozen(state.source)).toBe(true)
    expect(() => { (state.source as any).target = 'email' }).toThrow(); expect(observed.length).toBeGreaterThan(0)
    unsubscribe(); session.dispose()
  })
})
