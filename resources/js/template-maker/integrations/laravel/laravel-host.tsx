import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { GroupVariantWorkspace, TemplateWorkspace } from '../../template-creator'
import { compileFamilyVariant, hydrateTemplateDraft, recompileTemplateDocument, type GroupVariantDocument, type JsonObject, type StandaloneTemplateDraft } from '../../template-renderer'
import { Alert, AlertDescription, LoadingState } from 'themelia-react-ui/base/feedback'
import { Button } from 'themelia-react-ui/base/buttons'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { createLaravelTemplateRepository, TemplateRequestError } from './laravel/repository'
import { createTemplateSession, type TemplateSession } from './laravel/session'
import type { EditorBootstrap, StoredTemplateDraft, TemplateCapabilities, TemplateRepository, TemplateSourceDocument, TemplateValues } from './laravel/contracts'
import { projectResolvedContent, resolveReusableContent, reusableContentIdentity } from './laravel/resources'
import { TemplateResourceTools } from './laravel/resource-tools'
import { FamilyChangesPanel } from './laravel/family-panel'

export { createLaravelTemplateRepository as laravelTemplateRepository }
export type { TemplateRepository } from './laravel/contracts'
export type DraftState = StoredTemplateDraft

export interface TemplateHostToolsContext {
  id: string
  repository: TemplateRepository
  source: TemplateSourceDocument
  bootstrap: EditorBootstrap
  /** Explicit imports/resource changes replace and remount the document. Normal saves do not. */
  replaceSource(source: TemplateSourceDocument): void
  refreshPreviewAssets(map: Record<string, string>): void
}
export interface LaravelTemplateScreenProps {
  id: string
  repository: TemplateRepository
  previewData?: JsonObject
  createSource?: (bootstrap: EditorBootstrap) => TemplateSourceDocument
  mode?: 'staff' | 'customer'
  renderTools?: (context: TemplateHostToolsContext) => ReactNode
}

function publicationIssue(source: TemplateSourceDocument, capabilities: TemplateCapabilities, effective?: StandaloneTemplateDraft | null): string | null {
  if (source.schemaVersion !== capabilities.schemaVersion) return 'This template schema is not supported by the server.'
  if (!capabilities.sourceModes.includes(source.source.mode)) return 'This authoring source mode is not supported by the server.'
  if (!capabilities.targets.includes(source.target)) return 'This output target is not supported by the server.'
  const document = source.source.mode === 'standalone' ? hydrateTemplateDraft(source as StandaloneTemplateDraft) : effective ? hydrateTemplateDraft(effective) : null
  if (!document) return 'The pinned family definition is unavailable.'
  const engine = document.rendering?.engine ?? document.artifacts.engine
  if (!capabilities.engines[engine]) return `The ${engine} compiler is unavailable on the server. Drafts can still be saved.`
  if (source.source.mode === 'group-variant' && Object.keys(source.source.overrides.variations ?? {}).length && !capabilities.engines.shared) return 'Structural family variants require a configured server compiler. Drafts can still be saved.'
  if (!capabilities.compilerVersions.includes(document.compilerVersion ?? 'template-platform/1')) return 'This compiler version is not supported by the server.'
  if (source.source.mode === 'group-variant' && Object.keys(source.source.overrides).some(key => !capabilities.variantOverrides.includes(key))) return 'This family override is not supported by the server.'
  return null
}

function compileSource(source: TemplateSourceDocument, capabilities: TemplateCapabilities, bootstrap: EditorBootstrap): TemplateSourceDocument {
  const issue = publicationIssue(source, capabilities, bootstrap.document)
  if (issue) throw new Error(issue)
  if (source.source.mode === 'group-variant') {
    if (!bootstrap.family) throw new Error('The pinned family is unavailable.')
    return compileFamilyVariant(bootstrap.family.source ?? bootstrap.family.document, source as GroupVariantDocument, { id: bootstrap.document?.source.definition.id ?? `t_${bootstrap.template.id.replaceAll('-', '')}`, name: bootstrap.template.name })
  }
  const document = hydrateTemplateDraft(source as StandaloneTemplateDraft)
  return recompileTemplateDocument(document, source.source.definition)
}

const ignoreReportedError = () => {}

function mergePreviewValues(samples: TemplateValues | undefined, patch: TemplateValues | undefined): TemplateValues | undefined {
  if (patch === undefined) return samples
  const object = (value: unknown): value is TemplateValues => value !== null && typeof value === 'object' && !Array.isArray(value)
  return Object.fromEntries(Object.entries({ ...samples, ...patch }).map(([key, value]) => {
    const previous = samples?.[key], next = patch[key]
    return [key, object(previous) && object(next) ? mergePreviewValues(previous, next) : value]
  }))
}

function previewValuesIdentity(value: unknown): string {
  const ordered = (item: unknown): unknown => Array.isArray(item) ? item.map(ordered) : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, ordered(entry)])) : item
  return JSON.stringify(ordered(value))
}

/** Connected host route. Transport, mutation state and concurrency stay outside the pure editor. */
export function LaravelTemplateScreen({ id, repository, previewData, createSource, mode = 'staff', renderTools }: LaravelTemplateScreenProps) {
  const workspaceRoot = useRef<HTMLDivElement>(null)
  const [commandError, setCommandError] = useState('')
  const createSourceRef = useRef(createSource)
  createSourceRef.current = createSource
  const connectionSerial = useRef(0)
  const [connection, setConnection] = useState<{ id: string; repository: TemplateRepository; session: TemplateSession; serial: number } | null>(null)
  useEffect(() => {
    // Each effect setup owns a new session, including React StrictMode's setup/cleanup replay.
    const session = createTemplateSession({ repository, compile: compileSource, ...(createSourceRef.current ? { createSource: (bootstrap: EditorBootstrap) => createSourceRef.current!(bootstrap) } : {}) })
    setConnection({ id, repository, session, serial: ++connectionSerial.current })
    void session.load(id).catch(ignoreReportedError)
    return () => session.dispose()
  }, [id, repository])
  const session = connection?.id === id && connection.repository === repository ? connection.session : null
  const state = useSyncExternalStore(
    useCallback(listener => session?.subscribe(listener) ?? (() => {}), [session]),
    useCallback(() => session?.getState() ?? null, [session]),
    () => null,
  )
  const activeSession = useRef(session)
  activeSession.current = session
  const [seed, setSeed] = useState(0)
  const [showTools, setShowTools] = useState(false)
  const [showFamily, setShowFamily] = useState(false)
  const [assetOverrides, setAssetOverrides] = useState<{ session: TemplateSession; epoch: number; map: Record<string, string> } | null>(null)
  const personalization = useRef<{ session: TemplateSession; epoch: number; seed: number; inputs: JsonObject; settings: JsonObject } | null>(null)
  const previewValues = useRef<{ session: TemplateSession; epoch: number; seed: number; key: string } | null>(null)
  const familySource = state?.bootstrap?.family?.source ?? state?.bootstrap?.family?.document
  const content = state?.source?.source.mode === 'standalone' ? (state.source as StandaloneTemplateDraft).content : state?.source?.source.mode === 'group-variant' ? { ...familySource?.content, ...state.source.source.overrides.content } : {}
  const contentKey = reusableContentIdentity(content)
  const hasReferences = contentKey !== '[]'
  const [resolved, setResolved] = useState<{ session: TemplateSession; epoch: number; key: string; content?: JsonObject; error?: string } | null>(null)
  useEffect(() => {
    if (!session || !state || !hasReferences) return
    const controller = new AbortController(); const epoch = state.epoch
    resolveReusableContent(id, content, repository, controller.signal).then(value => {
      if (!controller.signal.aborted && activeSession.current === session && session.getState().epoch === epoch) setResolved({ session, epoch, key: contentKey, content: value })
    }).catch(cause => {
      if (!controller.signal.aborted && activeSession.current === session && session.getState().epoch === epoch) setResolved({ session, epoch, key: contentKey, error: cause instanceof Error ? cause.message : 'Unable to resolve reusable content.' })
    })
    return () => controller.abort()
  }, [session, state?.epoch, contentKey, hasReferences, id, repository])
  const currentResolution = resolved?.session === session && resolved?.epoch === state?.epoch && resolved?.key === contentKey ? resolved : null
  const contentReady = !hasReferences || Boolean(currentResolution?.content)
  const canOpenEditor = contentReady || Boolean(currentResolution?.error)
  const preparedPreviewData = { ...previewData, content: hasReferences ? currentResolution?.content ? projectResolvedContent(content, currentResolution.content) : {} : content } as JsonObject
  const ready = Boolean(state?.source && state.bootstrap)
  const editor = useMemo(() => {
    if (!state?.source || !state.bootstrap) return null
    const source = structuredClone(state.source)
    return { source, document: source.source.mode === 'standalone' ? hydrateTemplateDraft(source as StandaloneTemplateDraft) : state.bootstrap.document ? hydrateTemplateDraft(state.bootstrap.document) : null, family: state.bootstrap.family?.source ?? state.bootstrap.family?.document ?? null }
    // A normal save changes source/token state without resetting editing history or unfinished fields.
  }, [session, state?.epoch, ready, seed, contentKey])
  const epoch = state?.epoch
  const change = useCallback((source: TemplateSourceDocument) => { if (session && activeSession.current === session && session.getState().epoch === epoch) session.change(source) }, [session, epoch])
  const currentPreviewData = useCallback(() => {
    const current = personalization.current
    const patch = current?.session === session && current.epoch === epoch && current.seed === seed ? current : null
    return {
      facts: previewData?.facts as TemplateValues | undefined,
      context: previewData?.context as TemplateValues | undefined,
      inputs: mergePreviewValues(previewData?.inputs as TemplateValues | undefined, patch?.inputs),
      settings: mergePreviewValues(previewData?.settings as TemplateValues | undefined, patch?.settings),
    }
  }, [session, epoch, seed, previewData])
  const previewDefaults = state?.source?.source.mode === 'standalone' ? state.source as StandaloneTemplateDraft : state?.bootstrap?.document
  const invalidateChangedPreview = useCallback(() => {
    if (!session || activeSession.current !== session || session.getState().epoch !== epoch) return
    const data = currentPreviewData()
    const key = previewValuesIdentity({
      facts: data.facts ?? {}, context: data.context ?? {},
      inputs: mergePreviewValues(previewDefaults?.inputDefaults, data.inputs) ?? {},
      settings: mergePreviewValues(previewDefaults?.settingsDefaults, data.settings) ?? {},
    })
    const previous = previewValues.current
    previewValues.current = { session, epoch, seed, key }
    if (previous?.session === session && previous.epoch === epoch && previous.seed === seed && previous.key !== key) session.invalidatePreview()
  }, [session, epoch, seed, currentPreviewData, previewDefaults])
  useEffect(invalidateChangedPreview, [invalidateChangedPreview])
  const personalize = useCallback((patch: { inputs: JsonObject; settings: JsonObject }) => {
    if (session && activeSession.current === session && session.getState().epoch === epoch) {
      personalization.current = { session, epoch, seed, ...structuredClone(patch) }
      invalidateChangedPreview()
    }
  }, [session, epoch, seed, invalidateChangedPreview])
  const issue = state?.source && state.bootstrap ? publicationIssue(state.source, state.bootstrap.capabilities, state.bootstrap.document) : null
  const busy = state?.phase === 'saving' || state?.phase === 'publishing'
  const validateCurrentDraft = () => {
    const authoring = workspaceRoot.current?.querySelectorAll<HTMLElement>('[data-template-workspace-mode="design"]:not([hidden]),[data-variant-mode="staff"]:not([hidden])')
    if (authoring && [...authoring].some(node => node.querySelector('[aria-invalid="true"]'))) throw new Error('Fix the highlighted fields before publishing or changing family.')
  }
  const publishCurrent = async () => {
    try { validateCurrentDraft() } catch (cause) { setCommandError((cause as Error).message); return }
    setCommandError('')
    await session?.publish().catch(ignoreReportedError)
  }
  const previewCurrent = () => {
    invalidateChangedPreview()
    void session?.preview(currentPreviewData()).catch(ignoreReportedError)
  }
  const commands = {
    primaryAction: { label: 'Save draft', disabled: busy, onClick: () => { void session?.save().catch(ignoreReportedError) } },
    secondaryActions: [
      { label: 'Publish', disabled: busy || Boolean(issue), onClick: () => { void publishCurrent() } },
      { label: 'Server preview', disabled: state?.previewing, onClick: previewCurrent },
      { label: 'Resources and media', onClick: () => setShowTools(value => !value) },
      { label: 'Family changes', onClick: () => setShowFamily(value => !value) },
    ],
  }
  const status = !state || state.phase === 'loading' ? 'Loading template…' : state.phase === 'saving' ? 'Saving draft…' : state.phase === 'publishing' ? 'Publishing…' : state.publication ? `Published revision ${state.publication.release.revision} from draft version ${state.publication.version}.${state.newerEdits ? ' Newer edits remain in the draft.' : ''}` : state.dirty ? 'Unsaved changes' : state.source ? `Draft saved (version ${state.version})` : 'No authoring draft is available.'
  let replacementGeneration: number | null = null
  const capturedGeneration = state?.generation
  const toolsContext: TemplateHostToolsContext | null = state?.source && state.bootstrap && session && mode === 'staff' ? {
    id, repository, source: state.source, bootstrap: state.bootstrap,
    replaceSource: source => { if (activeSession.current !== session || session.getState().epoch !== epoch) return; if (session.getState().generation !== capturedGeneration) throw new Error('The template changed while this resource operation was pending. Apply it again to preserve your edits.'); session.change(source); replacementGeneration = session.getState().generation; setSeed(value => value + 1) },
    refreshPreviewAssets: map => { if (activeSession.current === session && session.getState().epoch === epoch && [capturedGeneration, replacementGeneration].includes(session.getState().generation)) setAssetOverrides(previous => ({ session, epoch: state.epoch, map: { ...(previous?.session === session && previous.epoch === epoch ? previous.map : {}), ...map } })) },
  } : null
  const tools = toolsContext ? renderTools ? renderTools(toolsContext) : <TemplateResourceTools key={`${id}:${state?.epoch}`} {...toolsContext} /> : null
  const assets = { ...state?.bootstrap?.previewAssets, ...(assetOverrides?.session === session && assetOverrides?.epoch === epoch ? assetOverrides?.map : {}) }
  const sessionKey = `${id}:${state?.epoch ?? 0}:${connection?.serial ?? 0}:${seed}`
  const error = state?.error
  return <Stack ref={workspaceRoot} gap="md">
    <Text role="status" data-template-host-status>{status}</Text>
    {commandError && <Alert tone="destructive" role="alert"><AlertDescription>{commandError}</AlertDescription></Alert>}
    {error != null && <Alert tone="destructive" role="alert"><AlertDescription>
      <Text>{error instanceof Error ? error.message : 'The template request failed.'}</Text>
      {error instanceof TemplateRequestError && <>
        {error.status === 409 && <Text>Your local edits are retained. Reload when you are ready to replace them with the saved draft.</Text>}
        {Object.entries(error.errors).map(([path, messages]) => <Text key={path}>{path}: {messages.join(' ')}</Text>)}
      </>}
      {session && <Button onClick={() => { void session.load(id).catch(ignoreReportedError) }}>Reload saved draft</Button>}
    </AlertDescription></Alert>}
    {issue && mode === 'staff' && <Alert tone="warning"><AlertDescription>{issue}</AlertDescription></Alert>}
    {state?.bootstrap?.issues.length && !state.dirty ? <Alert tone="warning"><AlertDescription>{state.bootstrap.issues.map(item => <Text key={`${item.path}:${item.message}`}>{item.path}: {item.message}</Text>)}</AlertDescription></Alert> : null}
    {showTools && tools}
    {showFamily && mode === 'staff' && session && <FamilyChangesPanel id={id} repository={repository} session={session} validateCurrentDraft={validateCurrentDraft} onApplied={() => { void session.load(id).catch(ignoreReportedError) }} />}
    {!contentReady && mode === 'staff' && session && <Stack direction="horizontal" gap="sm"><Button disabled={busy} onClick={() => { void session.save().catch(ignoreReportedError) }}>Save draft</Button><Button onClick={() => setShowTools(value => !value)}>Resources and media</Button></Stack>}
    {currentResolution?.error && <Alert tone="destructive" role="alert"><AlertDescription>{currentResolution.error}</AlertDescription></Alert>}
    {!contentReady && !currentResolution?.error && <LoadingState label="Resolving pinned content…" />}
    {state?.phase !== 'loading' && !editor && session && <Button onClick={() => { void session.load(id).catch(ignoreReportedError) }}>Reload template</Button>}
    {canOpenEditor && editor?.source.source.mode === 'standalone' && editor.document && <TemplateWorkspace sessionKey={sessionKey} initialDocument={editor.document} previewData={preparedPreviewData} previewSettings={previewData?.settings as JsonObject | undefined} previewAssets={assets}
      mode={mode === 'customer' ? 'personalize' : undefined} onDraftChange={change} onPersonalizationChange={personalize} header={mode === 'staff' ? commands : undefined} />}
    {canOpenEditor && editor?.source.source.mode === 'group-variant' && editor.document && editor.family && <>
      <GroupVariantWorkspace sessionKey={sessionKey} initialDocument={editor.source as GroupVariantDocument} effectiveDocument={editor.document} familyDocument={editor.family}
        mode={mode === 'customer' ? 'customer' : undefined} previewData={preparedPreviewData} previewSettings={previewData?.settings as JsonObject | undefined} previewAssets={assets} onDraftChange={change} onPersonalizationChange={personalize} header={mode === 'staff' ? commands : undefined} />
    </>}
    {state?.preview && <iframe title="Server template preview" sandbox="" srcDoc={state.preview.previewHtml ?? state.preview.html} style={{ width: '100%', minHeight: 360, border: 0 }} />}
  </Stack>
}
