import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TemplateWorkspace, type TemplateWorkspaceDraft } from '../../template-creator'
import { hydrateTemplateDraft, materializeFamilyDocument, recompileTemplateDocument, type BindingDocument, type JsonObject, type StandaloneTemplateDraft } from '../../template-renderer'
import { Alert, AlertDescription, LoadingState } from 'themelia-react-ui/base/feedback'
import { Button } from 'themelia-react-ui/base/buttons'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import type { TemplateRepository } from './laravel/contracts'
import { projectSnapshotContent } from './laravel/resources'

export interface LaravelFamilyScreenProps { groupId: string; revision: number; repository: TemplateRepository; previewData?: JsonObject }
interface FamilyModel { identity: object; serial: number; source: StandaloneTemplateDraft; initialDocument: BindingDocument; version: number; generation: number; dirty: boolean; basisContent: JsonObject; resolvedContent: JsonObject; previewAssets: Record<string,string> }
function authoredIdentity(source: StandaloneTemplateDraft) {
  const { artifacts, rendering, ...authored } = source
  const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value
  return JSON.stringify(ordered({ ...authored, rendering: rendering ?? { engine: artifacts?.engine ?? 'shared', subject: artifacts?.subject, text: artifacts?.text } }))
}
/** Exact family-revision authoring route. Raw source stays editable; publication builds derived artifacts. */
export function LaravelFamilyScreen({ groupId, revision, repository, previewData }: LaravelFamilyScreenProps) {
  const identity = useMemo(() => ({ groupId, revision, repository }), [groupId, revision, repository])
  const active = useRef(identity); active.current = identity
  const serial = useRef(0)
  const [reload, setReload] = useState(0)
  const [model, setModel] = useState<FamilyModel | null>(null)
  const current = useRef(model); current.current = model
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [notice, setNotice] = useState('')
  const workspace = useRef<HTMLDivElement>(null)
  const publication = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); const epoch = ++serial.current
    setLoading(true); setModel(null); setError(''); setNotice(''); setPublishing(false)
    repository.loadGroupRevision(groupId, revision, { signal: controller.signal }).then(release => {
      if (controller.signal.aborted || active.current !== identity || epoch !== serial.current) return
      if (release.revision !== revision) throw new Error('The server returned a different family revision.')
      const source = structuredClone(release.source ?? release.document)
      if (source.source.mode !== 'standalone') throw new Error('A family requires a standalone authoring source.')
      const document = hydrateTemplateDraft(source)
      setModel({ identity, serial: epoch, source, initialDocument: document, version: release.revision, generation: 0, dirty: false, basisContent:source.content, resolvedContent:release.document.content, previewAssets:release.previewAssets??{} })
    }).catch(cause => { if (!controller.signal.aborted && active.current === identity && epoch === serial.current) setError(cause instanceof Error ? cause.message : 'Unable to load the family revision.') }).finally(() => { if (!controller.signal.aborted && active.current === identity && epoch === serial.current) setLoading(false) })
    return () => { controller.abort(); publication.current?.abort(); publication.current = null }
  }, [identity, groupId, revision, repository, reload])
  const change = useCallback((source: TemplateWorkspaceDraft) => {
    if (active.current !== identity) return
    setModel(previous => previous?.identity !== identity || authoredIdentity(previous.source) === authoredIdentity(source) ? previous : { ...previous, source: structuredClone(source), generation: previous.generation + 1, dirty: true })
  }, [identity])
  const publish = async () => {
    const captured = current.current
    if (!captured || captured.identity !== identity || publication.current) return
    const request = new AbortController(); publication.current = request
    setPublishing(true); setError(''); setNotice('')
    try {
      if (workspace.current?.querySelector('[aria-invalid="true"]')) throw new Error('Fix the highlighted fields before publishing the family.')
      const raw = hydrateTemplateDraft(captured.source)
      materializeFamilyDocument(raw, {})
      const document = recompileTemplateDocument(raw, raw.source.definition)
      const release = await repository.publishGroup(groupId, document, captured.version, { signal: request.signal })
      if (request.signal.aborted || active.current !== identity || serial.current !== captured.serial) return
      const newer = current.current?.generation !== captured.generation
      setModel(previous => previous?.identity !== identity ? previous : { ...previous, version: release.revision, dirty: newer || false, basisContent:captured.source.content, resolvedContent:release.document.content, previewAssets:release.previewAssets??previous.previewAssets })
      setNotice(`Published family revision ${release.revision}.${newer ? ' Newer edits are retained in the editor.' : ''}`)
    } catch (cause) {
      if (!request.signal.aborted && active.current === identity && serial.current === captured.serial) setError(cause instanceof Error ? cause.message : 'Unable to publish the family.')
    } finally { if (publication.current === request) { publication.current = null; if (active.current === identity) setPublishing(false) } }
  }
  const ready = model?.identity === identity ? model : null
  const preview = useMemo(() => {
    if (!ready) return null
    try { return { data: { ...previewData, content: projectSnapshotContent(ready.source.content, ready.basisContent, ready.resolvedContent) } as JsonObject } }
    catch (cause) { return { error: cause instanceof Error ? cause.message : 'Family content is unavailable.' } }
  }, [ready, previewData])
  return <Stack ref={workspace} gap="md">
    <Text role="status">{loading ? 'Loading family revision…' : publishing ? 'Publishing family…' : notice || (ready ? `Family revision ${ready.version}${ready.dirty ? ' · Unsaved family changes' : ''}` : 'Family revision unavailable.')}</Text>
    {error && <Alert tone="destructive" role="alert"><AlertDescription><Stack gap="sm"><Text>{error}</Text><Button disabled={publishing} onClick={() => setReload(value => value + 1)}>Reload family revision</Button></Stack></AlertDescription></Alert>}
    {loading && <LoadingState label="Loading family authoring source…" />}
    {preview?.error && <Alert tone="warning"><AlertDescription>{preview.error}</AlertDescription></Alert>}
    {ready && <TemplateWorkspace sessionKey={`${groupId}:${revision}:${ready.serial}`} initialDocument={ready.initialDocument} familyAuthoring previewData={preview?.data??previewData} previewAssets={ready.previewAssets} onDraftChange={change}
      header={{ title: ready.initialDocument.source.definition.name, description: `Family ${groupId} · exact revision ${revision}`, primaryAction: { label: 'Publish family', disabled: publishing, onClick: () => { void publish() } } }} />}
  </Stack>
}
