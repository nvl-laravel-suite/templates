import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Alert, AlertDescription, LoadingState } from 'themelia-react-ui/base/feedback'
import { Button } from 'themelia-react-ui/base/buttons'
import { Card } from 'themelia-react-ui/base/cards'
import { Badge } from 'themelia-react-ui/base/badge'
import { Item } from 'themelia-react-ui/base/item'
import { PillRadioGroup, Select } from 'themelia-react-ui/base/choice-inputs'
import { FormField } from 'themelia-react-ui/base/forms'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { Stack, Grid } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'
import { TemplateCanvas } from '../../../template-creator'
import { applyPresentationSettings, applyTemplateTheme, getEmailTemplateIssues, hydrateTemplateDraft, type JsonObject } from '../../../template-renderer'
import type { EditorBootstrap, FamilyChangeCandidate, FamilyChangeOperation, FamilyConflictChoice, FamilyConflictSnapshot, TemplateGroupSummary, TemplateRepository } from './contracts'
import type { TemplateSession, TemplateSessionState } from './session'
import { reusableContentIdentity } from './resources'

export interface FamilyChangesPanelProps { id: string; repository: TemplateRepository; session: TemplateSession; validateCurrentDraft?: () => void; onApplied: () => void }
interface DraftToken { epoch: number; generation: number; version: number }
interface Review { candidate: FamilyChangeCandidate; token: DraftToken }
const token = (state: TemplateSessionState): DraftToken => ({ epoch: state.epoch, generation: state.generation, version: state.version })
const unchanged = (state: TemplateSessionState, expected: DraftToken) => state.epoch === expected.epoch && state.generation === expected.generation && state.version === expected.version
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Unable to complete the family change.'
const publicationNotice = 'Family change applied to the draft. Publish separately when it is ready.'
const snapshotPreview = (value: FamilyConflictSnapshot) => !value.present || value.type === 'missing' ? 'Not present' : value.truncated && value.preview === '' ? 'Preview omitted' : value.type === 'null' ? 'null' : value.type === 'string' && value.preview === '' ? 'Empty string' : Array.from(value.preview).slice(0, 480).join('')
const displayedSnapshots = (comparison: NonNullable<FamilyChangeCandidate['conflicts'][number]['comparison']>) => comparison.values ?? comparison
const hasMixedSnapshotTypes = (comparison: NonNullable<FamilyChangeCandidate['conflicts'][number]['comparison']>) => {
  const values = displayedSnapshots(comparison)
  return new Set([values.local, values.target, values.previous].filter(snapshot => snapshot.present && snapshot.type !== 'missing').map(snapshot => snapshot.type)).size > 1
}
const operations: { value: FamilyChangeOperation; label: string }[] = [{ value: 'upgrade', label: 'Upgrade family' }, { value: 'rebase', label: 'Rebase family' }, { value: 'detach', label: 'Detach family' }, { value: 'regroup', label: 'Regroup family' }]
const descriptions: Record<FamilyChangeOperation, string> = {
  upgrade: 'Move to a newer revision of the same family. Review how the update affects your customizations.',
  rebase: 'Reconcile your customizations with a specific newer revision of the same family.',
  detach: 'Keep this design as a standalone template, including its reusable content and assets.',
  regroup: 'Move this template to another family. Review any differences its rules cannot retain.',
}

/** Application-owned candidate transport and review. Applying creates a draft; publication remains separate. */
export function FamilyChangesPanel({ id, repository, session, validateCurrentDraft, onApplied }: FamilyChangesPanelProps) {
  const choiceId = useId()
  const validateDraft = useRef(validateCurrentDraft); validateDraft.current = validateCurrentDraft
  const state = useSyncExternalStore(useCallback(listener => session.subscribe(listener), [session]), session.getState, session.getState)
  const context = useMemo(() => ({ id, repository, session }), [id, repository, session])
  const activeContext = useRef(context); activeContext.current = context
  const mounted = useRef(false)
  const initialized = useRef<{ context: typeof context; epoch: number } | null>(null)
  const operationRequest = useRef<AbortController | null>(null)
  const [candidates, setCandidates] = useState<FamilyChangeCandidate[]>([])
  const [groups, setGroups] = useState<TemplateGroupSummary[]>([])
  const [operation, setOperation] = useState<FamilyChangeOperation>('upgrade')
  const [groupId, setGroupId] = useState('')
  const [revision, setRevision] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, FamilyConflictChoice>>({})
  const [resolvedReview, setResolvedReview] = useState<{ review: Review; key: string; candidate?: FamilyChangeCandidate; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const family = state.source?.source.mode === 'group-variant' ? state.source.source.group : null
  const publishedGroupId = state.publication
    ? state.publication.source.source.mode === 'group-variant' ? state.publication.source.source.group.id : null
    : state.bootstrap?.template.groupId ?? null
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    setCandidates([]); setGroups([]); setReview(null); setResolutions({}); setError(''); setNotice(''); setBusy(false); setLoading(true)
    Promise.all([repository.listFamilyChanges(id, { signal: controller.signal }), repository.listGroups({ signal: controller.signal })]).then(([items, catalog]) => {
      if (!controller.signal.aborted && activeContext.current === context) { setCandidates(items); setGroups(catalog.filter(group => group.status === 'active')) }
    }).catch(cause => { if (!controller.signal.aborted && activeContext.current === context) setError(message(cause)) }).finally(() => { if (!controller.signal.aborted && activeContext.current === context) setLoading(false) })
    return () => { mounted.current = false; controller.abort(); operationRequest.current?.abort(); operationRequest.current = null }
  }, [context, state.epoch, id, repository, session])
  useEffect(() => {
    // Epoch changes cancel old requests immediately; defaults wait for the loaded source.
    if (!state.source || state.phase === 'loading' || initialized.current?.context === context && initialized.current.epoch === state.epoch) return
    initialized.current = { context, epoch: state.epoch }
    const pin = state.source.source.mode === 'group-variant' ? state.source.source.group : null
    setOperation(pin ? 'upgrade' : 'regroup'); setGroupId(pin?.id ?? ''); setRevision(pin ? String(pin.revision + 1) : '')
  }, [context, state.epoch, state.source, state.phase])
  const live = () => mounted.current && activeContext.current === context
  const capture = () => {
    validateDraft.current?.()
    const current = session.getState()
    if (current.id !== id || current.phase !== 'idle' || !current.source) throw new Error('Wait for the current draft to finish loading or saving.')
    return token(current)
  }
  const guard = (expected: DraftToken) => {
    validateDraft.current?.()
    if (!live() || !unchanged(session.getState(), expected)) throw new Error('The draft changed while this request was pending. Newer local edits are retained; prepare a fresh family change.')
  }
  const authoritative = (bootstrap: EditorBootstrap, expected: DraftToken) => {
    guard(expected)
    if (bootstrap.version !== expected.version || !bootstrap.sourceChecksum || !/^[a-fA-F0-9]{64}$/.test(bootstrap.sourceChecksum)) throw new Error('The saved draft changed or its checksum is unavailable. Reload the saved draft before reviewing a family change.')
    return bootstrap.sourceChecksum
  }
  const accept = (candidate: FamilyChangeCandidate, expected: DraftToken, checksum: string) => {
    guard(expected)
    if (candidate.templateId !== id || candidate.status !== 'pending' || candidate.expectedVersion !== expected.version || candidate.sourceChecksum !== checksum) throw new Error('This candidate belongs to an older saved draft. Prepare a fresh family change.')
    setOperation(candidate.operation); setGroupId(candidate.targetGroupId ?? ''); setRevision(candidate.targetRevision === null ? '' : String(candidate.targetRevision))
    setReview({ candidate, token: expected }); setResolutions({})
    setCandidates(items => [candidate, ...items.filter(item => item.id !== candidate.id)])
  }
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (operationRequest.current) return
    const request = new AbortController(); operationRequest.current = request
    setBusy(true); setError(''); setNotice('')
    try { await action(request.signal) } catch (cause) { if (live() && !request.signal.aborted) setError(message(cause)) }
    finally { if (operationRequest.current === request) { operationRequest.current = null; if (live()) setBusy(false) } }
  }
  const prepare = () => run(async signal => {
    let expected = capture()
    setReview(null); setResolutions({})
    const pin = session.getState().source?.source
    const version = Number(revision)
    const targetId = operation === 'regroup' ? groupId : pin?.mode === 'group-variant' ? pin.group.id : ''
    if (operation !== 'detach' && (!targetId || !Number.isSafeInteger(version) || version < 1)) throw new Error('Choose a family and an exact positive revision.')
    if (operation === 'regroup' && pin?.mode === 'group-variant' && targetId === pin.group.id) throw new Error('Regroup requires a different family. Use upgrade or rebase for the current family.')
    if (session.getState().dirty) {
      const before = expected
      await session.save()
      if (!live() || session.getState().epoch !== before.epoch || session.getState().generation !== before.generation || session.getState().dirty) throw new Error('The draft changed while saving. Newer local edits are retained; prepare again.')
      expected = capture()
    }
    const current = await repository.load(id, { signal })
    const checksum = authoritative(current, expected)
    const candidate = await repository.prepareFamilyChange(id, { operation, ...(operation === 'detach' ? {} : { target: { groupId: targetId, revision: version } }), expectedVersion: expected.version, sourceChecksum: checksum }, { signal })
    accept(candidate, expected, checksum)
  })
  const open = (candidateId: string) => run(async signal => {
    const expected = capture()
    if (session.getState().dirty) throw new Error('Save or finish your local edits before reviewing an existing candidate.')
    const [candidate, current] = await Promise.all([repository.loadFamilyChange(id, candidateId, { signal }), repository.load(id, { signal })])
    accept(candidate, expected, authoritative(current, expected))
  })
  const stale = Boolean(review && (!unchanged(state, review.token) || state.dirty))
  const unresolved = review?.candidate.conflicts.some(conflict => !resolutions[conflict.id]) ?? false
  const choicesKey = JSON.stringify(Object.entries(resolutions).sort(([a], [b]) => a.localeCompare(b)))
  useEffect(() => {
    if (!review || stale || unresolved || !review.candidate.conflicts.length) return
    const controller = new AbortController()
    repository.reviewFamilyChange(id, review.candidate.id, { resolutions, expectedVersion: review.candidate.expectedVersion, sourceChecksum: review.candidate.sourceChecksum }, { signal: controller.signal }).then(candidate => {
      if (!controller.signal.aborted && live() && unchanged(session.getState(), review.token)) setResolvedReview({ review, key: choicesKey, candidate })
    }).catch(cause => {
      if (!controller.signal.aborted && live() && unchanged(session.getState(), review.token)) setResolvedReview({ review, key: choicesKey, error: message(cause) })
    })
    return () => controller.abort()
  }, [review, choicesKey, stale, unresolved, context])
  const currentResolved = resolvedReview?.review === review && resolvedReview?.key === choicesKey ? resolvedReview : null
  const resolutionReady = !review?.candidate.conflicts.length || Boolean(currentResolved?.candidate)
  const previewCandidate = unresolved ? undefined : review?.candidate.conflicts.length ? currentResolved?.candidate : review?.candidate
  const apply = () => run(async signal => {
    if (!review) return
    guard(review.token)
    if (session.getState().dirty || unresolved || !resolutionReady || !preview?.template) throw new Error('Resolve and preview every conflict against the unchanged saved draft before applying.')
    const applied = await repository.applyFamilyChange(id, review.candidate.id, { resolutions, expectedVersion: review.candidate.expectedVersion, sourceChecksum: review.candidate.sourceChecksum }, { signal })
    if (!live() || signal.aborted) return
    let invalid = false
    try { validateDraft.current?.() } catch { invalid = true }
    if (invalid || !unchanged(session.getState(), review.token) || session.getState().dirty) {
      setError('The family change was applied on the server. Newer local edits are retained. Reload deliberately when you are ready to use the applied draft.'); setReview(null); return
    }
    setCandidates(items => items.map(item => item.id === applied.candidate.id ? applied.candidate : item)); setReview(null)
    setNotice(publicationNotice)
    onApplied()
  })
  const preview = useMemo(() => {
    if (!previewCandidate) return null
    try {
      // The backend authorizes and snapshots the candidate's proposed scope. Never
      // resolve target-family references through the current template's scope.
      const document = hydrateTemplateDraft(previewCandidate.document)
      if (reusableContentIdentity(document.content) !== '[]') throw new Error('The candidate preview contains unresolved reusable content. Reload the candidate before reviewing its preview.')
      const template = applyPresentationSettings(applyTemplateTheme(document.source.definition, document.theme, document.target), document.settingsSpec, document.settingsDefaults)
      if (document.target === 'email') {
        const issue = getEmailTemplateIssues(template).find(issue => issue.severity === 'error')
        if (issue) throw new Error(issue.message)
      }
      for (const asset of template.assets) {
        const url = previewCandidate.previewAssets?.[asset.id]
        if (document.managedAssets?.[asset.id] && !url) throw new Error('Retained media is unavailable in this candidate preview.')
        if (url) asset.url = url
      }
      const data: JsonObject = { content: document.content, inputs: document.inputDefaults, settings: document.settingsDefaults }
      return { template, data, target: document.target }
    } catch (cause) { return { error: message(cause) } }
  }, [previewCandidate])
  const familyName = (group: string | null) => group ? groups.find(item => item.id === group)?.name ?? (group === family?.id ? 'Current family' : 'Selected family') : 'Standalone template'
  const basis = (group: string | null, version: number | null) => `${familyName(group)}${version ? ` · revision ${version}` : ''}`
  const conflictName = (conflict: FamilyChangeCandidate['conflicts'][number]) => {
    const document = review!.candidate.document
    const previous = state.bootstrap?.family?.source ?? state.bootstrap?.family?.document
    const readable = (value: string) => value.replaceAll('.', ' › ').replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
    if (conflict.id.startsWith('variations.')) {
      const id = conflict.id.slice('variations.'.length)
      return document.variationPoints?.find(point => point.id === id)?.label ?? previous?.variationPoints?.find(point => point.id === id)?.label ?? readable(id)
    }
    const path = conflict.path.replace(/^source\.overrides\./, '')
    if (path.startsWith('settingsDefaults.')) {
      const id = path.slice('settingsDefaults.'.length)
      return document.settingsSpec.find(setting => setting.id === id)?.label ?? previous?.settingsSpec.find(setting => setting.id === id)?.label ?? readable(id)
    }
    const field = document.source.definition.fields.find(field => field.path === path)
    if (field) return field.label
    const known: Record<string, string> = { resources: 'Reusable content and assets', 'unavailable-source': 'Current family resources', regroup: 'Layout and family rules', exposedInputs: 'Customer inputs', exposedSettings: 'Customer appearance' }
    return known[conflict.id] ?? readable(path)
  }
  return <Card surface="card" title="Family changes" description="Choose a change, review the result, then apply it to the draft." footerSlot={review ? <Stack gap="md">
    <Heading tag="h3" size="sm">3. Apply to draft</Heading>
    <Text size="sm" type="secondary">Applying updates the draft. Publish it from the template header when you are ready.</Text>
    <Button tone="primary" disabled={busy || stale || unresolved || !resolutionReady || !preview?.template || state.phase !== 'idle'} onClick={() => { void apply() }}>Apply family change</Button>
  </Stack> : undefined}>
    <Stack gap="2xl">
      {error && <Alert tone="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      {!state.publication && (notice || state.bootstrap?.hasProposedBasis || state.bootstrap?.template.hasProposedBasis) && <Text role="status">{notice || publicationNotice}</Text>}
      {loading && <LoadingState label="Loading family changes…" />}
      <Stack gap="sm">
        <Text size="sm" type="secondary">Draft basis: {state.source ? basis(family?.id ?? null, family?.revision ?? null) : 'Loading draft…'}</Text>
        {state.bootstrap && <Text size="sm" type="secondary">Published membership: {familyName(publishedGroupId)}</Text>}
      </Stack>
      <Stack gap="lg">
        <Heading tag="h3" size="sm">1. Choose a change</Heading>
        <PillRadioGroup name={`${choiceId}-operation`} aria-label="Family change" value={operation} disabled={busy} options={operations.map(item => ({ value: item.value, label: <span aria-label={item.label}>{item.label.replace(' family', '')}</span>, disabled: !family && item.value !== 'regroup' }))} onValueChange={value => { const selected = operations.find(item => item.value === value); if (selected) { setOperation(selected.value); setReview(null); setResolutions({}) } }} />
        <Text size="sm" type="secondary">{descriptions[operation]}</Text>
        {operation !== 'detach' && <Grid columns={{ base: 1, sm: 2 }} gap="lg">
          <FormField label="Target family"><Select aria-label="Target family" disabled={busy || operation !== 'regroup'} value={operation === 'regroup' ? groupId : family?.id ?? ''} onValueChange={value => { setGroupId(value ?? ''); setReview(null) }} options={[{ value: '', label: 'Choose a family' }, ...groups.map(group => ({ value: group.id, label: `${group.name} · latest ${group.version}` }))]} /></FormField>
          <FormField label="Exact family revision"><Input aria-label="Exact family revision" type="number" min={1} step={1} disabled={busy} value={revision} onChange={event => { setRevision(event.target.value); setReview(null) }} /></FormField>
        </Grid>}
        <Text size="sm" type="secondary">{state.dirty ? 'Your current edits will be saved before the review is prepared.' : 'Preparing a review keeps the current draft and published template unchanged.'}</Text>
        <Button tone={review ? 'neutral' : 'primary'} buttonStyle={review ? 'outline' : 'solid'} disabled={busy || state.phase !== 'idle'} onClick={() => { void prepare() }}>{state.dirty ? 'Save draft and prepare change' : 'Prepare family change'}</Button>
      </Stack>
      {review && <Stack gap="lg">
        <Heading tag="h3" size="sm">2. Review changes</Heading>
        <Text size="sm" type="secondary">{basis(review.candidate.changes.fromGroupId, review.candidate.changes.fromRevision)} → {basis(review.candidate.changes.toGroupId, review.candidate.changes.toRevision)}</Text>
        {stale && <Alert tone="warning"><AlertDescription>The draft changed after this review began. Your local edits are retained. Prepare a fresh candidate.</AlertDescription></Alert>}
        {review.candidate.conflicts.length > 0 && <Text size="sm" weight="medium">{review.candidate.conflicts.filter(conflict => resolutions[conflict.id]).length} of {review.candidate.conflicts.length} decisions made</Text>}
        {review.candidate.conflicts.map(conflict => <Stack key={conflict.id} gap="sm" role="group" aria-label={`Conflict ${conflict.id}`}>
          <Text weight="medium">{conflictName(conflict)}</Text><Text size="sm" type="secondary">{conflict.message}</Text>
          {conflict.comparison ? <Stack gap="sm">
            {(conflict.comparison.values || conflict.comparison.kind !== 'value') && <Text size="sm" type="secondary">{conflict.comparison.values ? 'Property values' : conflict.comparison.kind === 'structure' ? 'Layout and structure comparison' : 'Family capability comparison'}</Text>}
            <Grid columns={{ base: 1, sm: 3 }} gap="md">
              {([{ label: 'Local value', snapshot: displayedSnapshots(conflict.comparison).local }, { label: 'Target family value', snapshot: displayedSnapshots(conflict.comparison).target }, { label: 'Previous family value', snapshot: displayedSnapshots(conflict.comparison).previous }]).map(({ label, snapshot }) => <Stack key={label} gap="xs" className="min-w-0">
                <Text size="sm" weight="medium">{label}</Text>
                <Text size="sm" className="whitespace-pre-wrap [overflow-wrap:anywhere]">{snapshotPreview(snapshot)}</Text>
                {snapshot.present && snapshot.type !== 'missing' && hasMixedSnapshotTypes(conflict.comparison!) && <Text size="sm" type="secondary">Type: {snapshot.type}</Text>}
                {(snapshot.truncated || Array.from(snapshot.preview).length > 480) && <Text size="sm" type="secondary">Preview truncated</Text>}
              </Stack>)}
            </Grid>
          </Stack> : <Text size="sm" type="secondary">Comparison values unavailable for this review. Review the family rules before choosing.</Text>}
          <PillRadioGroup name={`${choiceId}-${conflict.id}`} aria-label={`Choose value for ${conflictName(conflict)}`} value={resolutions[conflict.id]} disabled={busy || stale} options={[
            ...(conflict.localAllowed && conflict.choices.includes('local') ? [{ value: 'local', label: 'Keep local value' }] : []),
            ...(conflict.choices.includes('family') ? [{ value: 'family', label: 'Use family value' }] : []),
          ]} onValueChange={value => { if (value === 'local' && conflict.localAllowed && conflict.choices.includes('local') || value === 'family' && conflict.choices.includes('family')) setResolutions(values => ({ ...values, [conflict.id]: value })) }} />
        </Stack>)}
        {unresolved && <Text size="sm" type="secondary" role="status">Choose how to handle each conflict to see the final preview.</Text>}
        {!preview && !unresolved && !currentResolved?.error && <LoadingState label="Preparing the final preview…" />}
        {currentResolved?.error && <Alert tone="destructive" role="alert"><AlertDescription>{currentResolved.error}</AlertDescription></Alert>}
        {preview?.template && <Stack gap="sm" role="region" aria-label="Family change preview"><Text size="sm" weight="medium">Resulting draft</Text><Stack gap="none" className="min-h-0 bg-muted" style={{ height: 'min(60dvh, 640px)' }}><TemplateCanvas template={preview.template} selectedId={null} onSelect={() => {}} target={preview.target} data={preview.data} /></Stack></Stack>}
        {preview?.error && <Alert tone="warning"><AlertDescription>Preview unavailable: {preview.error}</AlertDescription></Alert>}
      </Stack>}
      <Stack gap="md" role="region" aria-label="Saved family reviews">
        <Heading tag="h3" size="sm">Saved reviews</Heading>
        {!loading && !candidates.length && <Text size="sm" type="secondary">No reviews yet. Prepare one above to compare the result before applying it.</Text>}
        {candidates.map(item => <Item key={item.id} title={operations.find(operation => operation.value === item.operation)?.label ?? item.operation} description={basis(item.targetGroupId, item.targetRevision)} trailing={<Badge size="sm">{item.status === 'pending' ? 'Awaiting review' : 'Applied'}</Badge>} actions={<Button disabled={busy || item.status !== 'pending'} aria-label={`Review candidate ${item.id}`} onClick={() => { void open(item.id) }}>Review</Button>} />)}
      </Stack>
    </Stack>
  </Card>
}
