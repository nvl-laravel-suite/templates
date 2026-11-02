import type { EditorBootstrap, PublishedRelease, StoredTemplateDraft, TemplateCapabilities, TemplateOutput, TemplatePreviewData, TemplateRepository, TemplateSourceDocument } from './contracts'
import { hydrateTemplateDraft, type StandaloneTemplateDraft } from '../../../template-renderer'

export interface TemplateSessionState {
  id: string | null
  /** Mount the editor with this identity after a deliberate load transition. */
  epoch: number
  bootstrap: EditorBootstrap | null
  source: TemplateSourceDocument | null
  version: number
  generation: number
  dirty: boolean
  phase: 'idle' | 'loading' | 'saving' | 'publishing'
  error: unknown
  preview: TemplateOutput | null
  previewing: boolean
  publication: { release: PublishedRelease; source: TemplateSourceDocument; generation: number; version: number } | null
  newerEdits: boolean
}
export interface TemplateSessionOptions {
  repository: TemplateRepository
  compile: (source: TemplateSourceDocument, capabilities: TemplateCapabilities, bootstrap: EditorBootstrap) => TemplateSourceDocument | Promise<TemplateSourceDocument>
  createSource?: (bootstrap: EditorBootstrap) => TemplateSourceDocument
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const item of Object.values(value)) freeze(item)
  }
  return value
}
const copy = <T>(value: T): T => structuredClone(value)
function authoredIdentity(source: TemplateSourceDocument | null): string {
  const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value
  if (source?.source.mode === 'group-variant') { const { compiled: _, ...raw } = source as import('../../../template-renderer').GroupVariantDocument; return JSON.stringify(ordered(raw)) }
  if (!source) return 'null'
  const { artifacts: _, ...authored } = hydrateTemplateDraft(source as StandaloneTemplateDraft)
  return JSON.stringify(ordered(authored))
}

/** An application-owned session; it never adds persistence to the pure editor/controller. */
export function createTemplateSession({ repository, compile, createSource }: TemplateSessionOptions) {
  let state: TemplateSessionState = freeze({ id: null, epoch: 0, bootstrap: null, source: null, version: 0, generation: 0, dirty: false, phase: 'idle', error: null, preview: null, previewing: false, publication: null, newerEdits: false })
  const listeners = new Set<() => void>()
  let disposed = false
  let loadRequest: AbortController | null = null
  let writeRequest: AbortController | null = null
  let previewRequest: AbortController | null = null
  let previewSequence = 0
  function update(patch: Partial<TemplateSessionState>) {
    if (disposed) return
    state = freeze({ ...state, ...patch })
    for (const listener of [...listeners]) listener()
  }
  function active() { if (disposed) throw new Error('This template session is closed.') }
  function capture() {
    active()
    if (state.phase === 'loading' || !state.id || !state.source || !state.bootstrap) throw new Error('Load a template before editing or saving.')
    return { id: state.id, epoch: state.epoch, generation: state.generation, version: state.version, source: copy(state.source), capabilities: copy(state.bootstrap.capabilities), bootstrap: copy(state.bootstrap) }
  }
  const current = (epoch: number) => !disposed && state.epoch === epoch
  function beginWrite(phase: 'saving' | 'publishing') {
    const captured = capture()
    if (writeRequest) throw new Error('A template write is already in progress.')
    writeRequest = new AbortController()
    const request = writeRequest
    update({ phase, error: null })
    return { ...captured, request }
  }
  function acceptSaved(captured: ReturnType<typeof capture>, saved: StoredTemplateDraft) {
    if (!current(captured.epoch)) return
    const unchanged = state.generation === captured.generation
    update({ version: saved.version, ...(unchanged ? { source: copy(saved.document), dirty: false } : { dirty: true }), bootstrap: state.bootstrap ? { ...state.bootstrap, version: saved.version, source: copy(saved.document) } : null })
  }
  const candidate = async (captured: ReturnType<typeof capture>) => captured.source.source.mode === 'standalone' || Object.keys(captured.source.source.overrides.variations ?? {}).length ? compile(captured.source, captured.capabilities, captured.bootstrap) : captured.source
  return {
    getState: () => state,
    subscribe(listener: () => void) { active(); listeners.add(listener); return () => { listeners.delete(listener) } },
    async load(id: string) {
      active()
      loadRequest?.abort(); writeRequest?.abort(); previewRequest?.abort(); writeRequest = null; previewSequence++
      const request = new AbortController(); loadRequest = request
      const epoch = state.epoch + 1
      update({ id, epoch, phase: 'loading', bootstrap: null, source: null, version: 0, generation: 0, dirty: false, error: null, preview: null, previewing: false, publication: null, newerEdits: false })
      try {
        const bootstrap = await repository.load(id, { signal: request.signal })
        if (!current(epoch)) return
        const source = bootstrap.source ?? createSource?.(copy(bootstrap)) ?? null
        update({ bootstrap: copy(bootstrap), source: copy(source), version: bootstrap.version, dirty: bootstrap.source === null && source !== null, phase: 'idle' })
      } catch (error) { if (current(epoch)) { update({ error, phase: 'idle' }); throw error } }
      finally { if (loadRequest === request) loadRequest = null }
    },
    change(source: TemplateSourceDocument) {
      capture()
      if (authoredIdentity(source) === authoredIdentity(state.source)) return
      previewRequest?.abort(); previewSequence++
      update({ source: copy(source), generation: state.generation + 1, dirty: true, preview: null, previewing: false, newerEdits: state.publication !== null, error: null })
    },
    invalidatePreview() {
      active()
      previewRequest?.abort(); previewRequest = null; previewSequence++
      if (state.preview !== null || state.previewing) update({ preview: null, previewing: false })
    },
    async save() {
      const captured = beginWrite('saving')
      try {
        const saved = await repository.saveDraft(captured.id, captured.source, captured.version, { signal: captured.request.signal })
        if (!current(captured.epoch)) return
        acceptSaved(captured, saved)
        return saved
      } catch (error) { if (current(captured.epoch)) { update({ error }); throw error } }
      finally { if (writeRequest === captured.request) { writeRequest = null; update({ phase: 'idle' }) } }
    },
    async publish() {
      const captured = beginWrite('publishing')
      try {
        const document = await candidate(captured)
        if (!current(captured.epoch)) return
        const saved = await repository.saveDraft(captured.id, document, captured.version, { signal: captured.request.signal })
        if (!current(captured.epoch)) return
        acceptSaved(captured, saved)
        if (!current(captured.epoch)) return
        const release = await repository.publish(captured.id, saved.version, { signal: captured.request.signal })
        if (!current(captured.epoch)) return
        update({ publication: { release: copy(release), source: copy(saved.document), generation: captured.generation, version: saved.version }, newerEdits: state.generation !== captured.generation })
        return release
      } catch (error) { if (current(captured.epoch)) { update({ error }); throw error } }
      finally { if (writeRequest === captured.request) { writeRequest = null; update({ phase: 'idle' }) } }
    },
    async preview(data: TemplatePreviewData = {}) {
      const captured = capture()
      previewRequest?.abort()
      const request = new AbortController(); previewRequest = request
      const sequence = ++previewSequence
      update({ preview: null, previewing: true, error: null })
      const relevant = () => current(captured.epoch) && sequence === previewSequence && state.generation === captured.generation
      try {
        const document = await candidate(captured)
        if (!relevant()) return
        const output = await repository.preview(captured.id, document, copy(data), { signal: request.signal })
        if (!relevant()) return
        update({ preview: copy(output) })
        return output
      } catch (error) { if (relevant()) { update({ error, preview: null }); throw error } }
      finally { if (previewRequest === request) { previewRequest = null; if (current(captured.epoch)) update({ previewing: false }) } }
    },
    dispose() {
      if (disposed) return
      disposed = true; loadRequest?.abort(); writeRequest?.abort(); previewRequest?.abort(); listeners.clear()
    },
  }
}
export type TemplateSession = ReturnType<typeof createTemplateSession>
