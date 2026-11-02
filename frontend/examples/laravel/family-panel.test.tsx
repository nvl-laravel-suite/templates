// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const observed = vi.hoisted(() => ({ template: null as import('../../src/template-core/schema').TemplateDefinition | null }))
vi.mock('@nicolasvlachos/voucher-builder/template-creator', async () => {
  const actual = await import('../../src/template-creator'); const React = await import('react')
  return { ...actual, TemplateCanvas: (props: import('react').ComponentProps<typeof actual.TemplateCanvas>) => { observed.template = props.template; return React.createElement(actual.TemplateCanvas, props) } }
})
vi.mock('@nicolasvlachos/voucher-builder/template-renderer', async () => import('../../src/template-renderer'))
import { createEmailTemplate } from '../../src/template-email/presets'
import { getEmailTemplateIssues } from '../../src/template-email/profile'
import { createTemplateDefinition } from '../../src/template-core/defaults'
import { TemplateDefinitionSchema } from '../../src/template-core/schema'
import { exportBindingDocument } from '../../src/template-platform/bindings'
import { createExperienceDocument } from '../../src/template-platform/demo-documents'
import { createTemplateSession } from './session'
import type { EditorBootstrap, FamilyChangeCandidate, FamilyConflictSnapshot, TemplateRepository, TemplateSourceDocument } from './contracts'
import { FamilyChangesPanel } from './family-panel'
const doc = () => exportBindingDocument(TemplateDefinitionSchema.parse({ ...createTemplateDefinition('Candidate'), roots: ['copy'], nodes: { copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'literal', value: 'Candidate preview' } }] } } }), { target: 'document' })
const variant = (): TemplateSourceDocument => ({ format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'g', revision: 2 }, overrides: {} } })
const bootstrap = (version = 1, source = variant()): EditorBootstrap => ({ template: { id: 't', key: 't', name: 'Template', groupId: 'g', status: 'active' }, version, sourceChecksum: String(version).repeat(64), source, document: doc(), family: { id: 'g', revisionId: 'gr', revision: 2, document: doc() }, currentRevisionId: null, capabilities: { schemaVersion: 1, compilerVersions: ['template-platform/1'], sourceModes: ['standalone', 'group-variant'], targets: ['document'], engines: { bindings: true, shared: true }, pdf: false, assetTypes: [], variantOverrides: ['content', 'variations'] }, previewAssets: {}, issues: [] })
const candidate = (version = 1): FamilyChangeCandidate => ({ id: 'c', templateId: 't', operation: 'detach', expectedVersion: version, sourceChecksum: String(version).repeat(64), status: 'pending', source: doc(), document: doc(), conflicts: [{ id: 'headline', path: 'content.headline', message: 'This value changed in the family.', localAllowed: false, choices: ['family'] }], changes: { fromGroupId: 'g', fromRevision: 2, toGroupId: null, toRevision: null }, targetGroupId: null, targetRevision: null })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
function repository(overrides: Partial<TemplateRepository> = {}) {
  let saved = bootstrap()
  return { load: async () => saved, saveDraft: vi.fn(async (_id, source, version) => { saved = bootstrap(version + 1, source); return { version: saved.version, document: source } }), listGroups: async () => [{ id: 'g', key: 'g', name: 'Family', version: 3, status: 'active' }], listFamilyChanges: async () => [], loadFamilyChange: async () => candidate(), reviewFamilyChange: vi.fn(async (_id, _candidateId, input) => candidate(input.expectedVersion)), prepareFamilyChange: vi.fn(async (_id, input) => candidate(input.expectedVersion)), applyFamilyChange: vi.fn(async () => ({ version: 3, sourceChecksum: '3'.repeat(64), source: doc(), candidate: { ...candidate(), status: 'applied' } })), ...overrides } as TemplateRepository
}
let root: Root; let container: HTMLDivElement
beforeEach(() => { observed.template = null; vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label || [...item.querySelectorAll('[aria-label]')].some(child => child.getAttribute('aria-label') === label))!
const conflictChoices = (id: string) => container.querySelector(`[aria-label="Conflict ${id}"]`)!
const useFamily = (id: string) => [...conflictChoices(id).querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(item => item.textContent?.trim() === 'Use family value')!

describe('host family candidate review', () => {
  it('initializes from the loaded draft after asynchronous load and preserves a selection through edits and saves', async () => {
    const pending = deferred<EditorBootstrap>(); const repo = repository({ load: () => pending.promise })
    const session = createTemplateSession({ repository: repo, compile: source => source })
    const loading = session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => { pending.resolve(bootstrap()); await loading })
    expect(button('Upgrade family').getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector<HTMLInputElement>('[aria-label="Exact family revision"]')!.value).toBe('3')
    await act(async () => button('Rebase family').click())
    const input = container.querySelector<HTMLInputElement>('[aria-label="Exact family revision"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '7'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
    act(() => session.change(variant()))
    await act(async () => session.save())
    expect(button('Rebase family').getAttribute('aria-checked')).toBe('true')
    expect(input.value).toBe('7')
    session.dispose()
  })

  it.each([
    { label: 'detached', source: () => doc() as TemplateSourceDocument, basis: 'Standalone template', operation: 'Regroup family', revision: '' },
    { label: 'upgraded', source: () => ({ ...variant(), source: { mode: 'group-variant' as const, group: { id: 'g', revision: 3 }, overrides: {} } }), basis: 'Family · revision 3', operation: 'Upgrade family', revision: '4' },
  ])('reloads the $label draft basis asynchronously and retains publication guidance after remount', async ({ source, basis, operation, revision }) => {
    const change = { ...candidate(), conflicts: [] }; const pending = deferred<EditorBootstrap>(); let loads = 0
    const repo = repository({ load: async () => ++loads <= 2 ? bootstrap() : pending.promise, listFamilyChanges: async () => [change], loadFamilyChange: async () => change })
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    let reload: Promise<void> | undefined
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => { reload = session.load('t') }} />))
    await act(async () => button('Review candidate c').click())
    await act(async () => button('Apply family change').click())
    expect(container.textContent).toContain('Draft basis: Loading draft…')
    expect(container.textContent).not.toContain('Draft basis: Standalone template')
    await act(async () => { pending.resolve({ ...bootstrap(3, source()), hasProposedBasis: true, proposedGroupId: operation === 'Regroup family' ? null : 'g' }); await reload })
    expect(container.textContent).toContain(`Draft basis: ${basis}`)
    expect(button(operation).getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector<HTMLInputElement>('[aria-label="Exact family revision"]')!.value).toBe(revision)
    await act(async () => root.render(<FamilyChangesPanel key="reopened" id="t" repository={repo} session={session} onApplied={() => {}} />))
    expect(container.textContent).toContain('Publish separately')
    expect(container.textContent).toContain('Published membership: Family')
    session.dispose()
  })

  it('prepares an email-compatible preview using the candidate output target', async () => {
    const document = exportBindingDocument(createEmailTemplate(), { target: 'email' })
    const change = { ...candidate(), conflicts: [], document }
    const repo = repository({ prepareFamilyChange: async () => change }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Detach family').click())
    await act(async () => button('Prepare family change').click())
    expect(observed.template).not.toBeNull()
    expect(getEmailTemplateIssues(observed.template!).filter(issue => issue.severity === 'error')).toEqual([])
    expect(button('Apply family change').disabled).toBe(false)
    session.dispose()
  })

  it('shows bounded authoritative conflict comparisons while retaining legacy decisions', async () => {
    const snapshot = (type: FamilyConflictSnapshot['type'], preview: string, present = true, truncated = false): FamilyConflictSnapshot => ({ type, preview, present, truncated })
    const change: FamilyChangeCandidate = { ...candidate(), conflicts: [
      { id: 'variations.old_weight', path: 'source.overrides.variations.old_weight', message: 'Structure changed.', localAllowed: true, choices: ['local', 'family'], comparison: { kind: 'structure', previous: snapshot('null', 'null'), local: snapshot('number', '0'), target: snapshot('boolean', 'false') } },
      { id: 'missing', path: 'content.missing', message: 'Value removed.', localAllowed: true, choices: ['local', 'family'], comparison: { kind: 'value', previous: snapshot('string', 'Old'), local: snapshot('object', 'x'.repeat(900), true, true), target: snapshot('missing', '', false) } },
      { id: 'emoji', path: 'content.emoji', message: 'Value changed.', localAllowed: true, choices: ['local', 'family'], comparison: { kind: 'value', previous: snapshot('string', ''), local: snapshot('string', 'a'.repeat(479) + '🙂' + 'b'), target: snapshot('string', 'New') } },
      { id: 'unicode-fit', path: 'content.unicode-fit', message: 'Value changed.', localAllowed: true, choices: ['local', 'family'], comparison: { kind: 'value', previous: snapshot('string', ''), local: snapshot('string', '🙂'.repeat(300)), target: snapshot('string', 'New') } },
      ...candidate().conflicts,
    ] }
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Review candidate c').click())
    const structure = conflictChoices('variations.old_weight')
    expect(structure.textContent).toContain('old weight')
    expect(structure.textContent).toContain('Local value0')
    expect(structure.textContent).toContain('Target family valuefalse')
    expect(structure.textContent).toContain('Previous family valuenull')
    expect(conflictChoices('missing').textContent).toContain('Not present')
    expect(conflictChoices('missing').textContent).toContain('Preview truncated')
    expect(conflictChoices('missing').textContent).not.toContain('x'.repeat(600))
    expect(conflictChoices('headline').textContent).toContain('Comparison values unavailable')
    expect(useFamily('headline')).toBeDefined()
    const emoji = conflictChoices('emoji').textContent!
    expect(emoji).toContain('a'.repeat(479) + '🙂')
    expect(emoji).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u)
    expect(emoji).toContain('Preview truncated')
    expect(conflictChoices('unicode-fit').textContent).toContain('🙂'.repeat(300))
    expect(conflictChoices('unicode-fit').textContent).not.toContain('Preview truncated')
    session.dispose()
  })

  it('distinguishes omitted previews from empty strings and annotates mixed types only', async () => {
    const snapshot = (type: FamilyConflictSnapshot['type'], preview: string, truncated = false): FamilyConflictSnapshot => ({ present: true, type, preview, truncated })
    const conflict = (id: string, previous: FamilyConflictSnapshot, local: FamilyConflictSnapshot, target: FamilyConflictSnapshot) => ({ id, path: `content.${id}`, message: 'Value changed.', localAllowed: true, choices: ['local' as const, 'family' as const], comparison: { kind: 'value' as const, previous, local, target } })
    const change: FamilyChangeCandidate = { ...candidate(), conflicts: [
      conflict('omitted', snapshot('string', ''), snapshot('string', '', true), snapshot('string', 'New')),
      conflict('omitted-object', snapshot('object', '{}'), snapshot('object', '', true), snapshot('object', '{"updated":true}')),
      conflict('mixed', snapshot('null', 'null'), snapshot('string', 'false'), snapshot('boolean', 'false')),
      conflict('text-only', snapshot('string', 'Old'), snapshot('string', 'false'), snapshot('string', 'New')),
    ] }
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Review candidate c').click())
    const column = (id: string, label: string) => [...conflictChoices(id).querySelectorAll('p')].find(item => item.textContent === label)!.parentElement!
    expect(column('omitted', 'Local value').textContent).toContain('Preview omitted')
    expect(column('omitted', 'Local value').textContent).not.toContain('Empty string')
    expect(column('omitted', 'Previous family value').textContent).toContain('Empty string')
    expect(column('omitted-object', 'Local value').textContent).toContain('Preview omitted')
    expect(column('mixed', 'Local value').textContent).toContain('Type: string')
    expect(column('mixed', 'Target family value').textContent).toContain('Type: boolean')
    expect(column('mixed', 'Previous family value').textContent).toContain('Type: null')
    expect(conflictChoices('text-only').textContent).not.toContain('Type:')
    expect(conflictChoices('omitted').textContent).not.toContain('Type:')
    session.dispose()
  })

  it.each(['detach', 'regroup'] as const)('updates published membership after %s publication without losing newer edits', async operation => {
    const source: TemplateSourceDocument = operation === 'detach' ? doc() : { ...variant(), source: { mode: 'group-variant', group: { id: 'h', revision: 1 }, overrides: {} } }
    let loaded: EditorBootstrap = { ...bootstrap(3, source), hasProposedBasis: true, proposedGroupId: operation === 'detach' ? null : 'h' }
    const pending = deferred<{ id: string; revision: number }>()
    const publish = vi.fn<TemplateRepository['publish']>().mockRejectedValueOnce(new Error('Publication unavailable')).mockImplementationOnce(() => pending.promise)
    const repo = repository({ load: async () => loaded, saveDraft: vi.fn(async (_id, document, version) => ({ version: version + 1, document })), publish, listGroups: async () => [{ id: 'g', key: 'g', name: 'Family', version: 3, status: 'active' }, { id: 'h', key: 'h', name: 'Other family', version: 1, status: 'active' }] })
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    expect(container.textContent).toContain('Published membership: Family')
    expect(container.textContent).toContain('Publish separately')
    await act(async () => { await expect(session.publish()).rejects.toThrow('Publication unavailable') })
    expect(container.textContent).toContain('Published membership: Family')
    expect(container.textContent).toContain('Publish separately')
    let publishing: ReturnType<typeof session.publish>
    await act(async () => { publishing = session.publish() })
    const newer = structuredClone(source)
    if (newer.source.mode === 'standalone') newer.source.definition.name = 'Newer local edits'
    else newer.source.overrides.content = { headline: 'Newer local edits' }
    act(() => session.change(newer))
    await act(async () => { pending.resolve({ id: 'release', revision: 2 }); await publishing })
    expect(session.getState().source).toEqual(newer)
    expect(session.getState().dirty).toBe(true)
    expect(session.getState().newerEdits).toBe(true)
    expect(container.textContent).toContain(`Published membership: ${operation === 'detach' ? 'Standalone template' : 'Other family'}`)
    expect(container.textContent).not.toContain('Publish separately')
    loaded = { ...loaded, hasProposedBasis: false, template: { ...loaded.template, groupId: operation === 'detach' ? null : 'h' } }
    await act(async () => session.load('t'))
    expect(container.textContent).not.toContain('Publish separately')
    expect(container.textContent).toContain(`Published membership: ${operation === 'detach' ? 'Standalone template' : 'Other family'}`)
    session.dispose()
  })

  it('gives conflict radios their visible action names and supports arrow selection', async () => {
    const change = { ...candidate(), conflicts: [{ ...candidate().conflicts[0], localAllowed: true, choices: ['local' as const, 'family' as const] }] }
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Review candidate c').click())
    const radios = [...conflictChoices('headline').querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(radios.map(radio => radio.getAttribute('aria-label'))).toEqual(['Keep local value', 'Use family value'])
    expect(radios[0].closest('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Choose value for content › headline')
    await act(async () => { radios[0].focus(); radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(document.activeElement).toBe(radios[1])
    expect(radios[1].getAttribute('aria-checked')).toBe('true')
    expect(radios[0].getAttribute('aria-checked')).toBe('false')
    session.dispose()
  })

  it('prefers explicit property values over long diagnostic declarations without parsing them', async () => {
    const document = doc(); document.variationPoints = [{ id: 'heading', label: 'Email heading', kind: 'node-property', nodeId: 'copy', property: 'name', schema: { type: 'string' } }]
    const diagnostic: FamilyConflictSnapshot = { present: true, type: 'object', preview: '{"declaration":"Diagnostic declaration ' + 'schema '.repeat(150) + '"}', truncated: true }
    const value = (preview: string): FamilyConflictSnapshot => ({ present: true, type: 'string', preview, truncated: false })
    const change: FamilyChangeCandidate = { ...candidate(), document, conflicts: [{ id: 'variations.heading', path: 'source.overrides.variations.heading', message: 'Heading changed.', localAllowed: true, choices: ['local', 'family'], comparison: { kind: 'structure', previous: diagnostic, local: diagnostic, target: diagnostic, values: { previous: value('Previous heading'), local: value('Local heading'), target: value('Updated heading') } } }] }
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Review candidate c').click())
    const comparison = conflictChoices('variations.heading').textContent!
    expect(comparison).toContain('Email heading')
    expect(comparison).toContain('Property values')
    expect(comparison).toContain('Local valueLocal heading')
    expect(comparison).toContain('Target family valueUpdated heading')
    expect(comparison).toContain('Previous family valuePrevious heading')
    expect(comparison).not.toContain('Diagnostic declaration')
    expect(comparison).not.toContain('Preview truncated')
    expect(comparison).not.toContain('Type:')
    session.dispose()
  })

  it.each([
    { target: 'email' as const, css: '.copy { min-height: 12px; }', blocked: true },
    { target: 'document' as const, css: '.copy { min-height: 12px; }', blocked: false },
    { target: 'email' as const, css: '.copy { border-radius: 4px; }', blocked: false },
  ])('blocks incompatible email CSS only ($target, $css)', async ({ target, css, blocked }) => {
    const document = exportBindingDocument(createEmailTemplate(), { target })
    document.source.definition.styles.css += css
    const change = { ...candidate(), conflicts: [], document }
    const repo = repository({ prepareFamilyChange: async () => change }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Detach family').click())
    await act(async () => button('Prepare family change').click())
    expect(button('Apply family change').disabled).toBe(blocked)
    expect(Boolean(container.querySelector('[aria-label="Family change preview"] iframe'))).toBe(!blocked)
    if (blocked) expect(container.textContent).toContain('Preview unavailable: Email: min-height is outside the email profile.')
    session.dispose()
  })

  it.each([
    { operation: 'rebase' as const, label: 'Rebase family', targetGroupId: 'g', targetRevision: 7, targetLabel: 'Family' },
    { operation: 'regroup' as const, label: 'Regroup family', targetGroupId: 'h', targetRevision: 4, targetLabel: 'Other family' },
    { operation: 'detach' as const, label: 'Detach family', targetGroupId: null, targetRevision: null, targetLabel: '' },
  ])('reflects an opened saved $operation review in the chooser', async ({ operation, label, targetGroupId, targetRevision, targetLabel }) => {
    const change = { ...candidate(), operation, targetGroupId, targetRevision, conflicts: [], changes: { ...candidate().changes, toGroupId: targetGroupId, toRevision: targetRevision } }
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change, listGroups: async () => [{ id: 'g', key: 'g', name: 'Family', version: 7, status: 'active' }, { id: 'h', key: 'h', name: 'Other family', version: 4, status: 'active' }] })
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    expect(button('Upgrade family').getAttribute('aria-checked')).toBe('true')
    await act(async () => button('Review candidate c').click())
    expect(button(label).getAttribute('aria-checked')).toBe('true')
    if (targetRevision === null) expect(container.querySelector('[aria-label="Exact family revision"]')).toBeNull()
    else {
      expect(container.querySelector<HTMLInputElement>('[aria-label="Exact family revision"]')!.value).toBe(String(targetRevision))
      expect(container.querySelector('[role="combobox"][aria-label="Target family"]')!.textContent).toContain(targetLabel)
    }
    expect(button('Apply family change').disabled).toBe(false)
    session.dispose()
  })

  it('presents family operations as one exclusive choice before preparing the selected operation', async () => {
    const repo = repository(), session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    const choices = container.querySelector('[role="radiogroup"][aria-label="Family change"]')
    expect(choices).not.toBeNull()
    await act(async () => button('Detach family').click())
    expect(choices!.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
    await act(async () => button('Prepare family change').click())
    expect(repo.prepareFamilyChange).toHaveBeenCalledWith('t', expect.objectContaining({ operation: 'detach' }), expect.anything())
    session.dispose()
  })
  it('keeps conflicts identifiable when a point was removed and uses declared setting labels', async () => {
    const old=createExperienceDocument();old.variationPoints=[{id:'old_weight',label:'Message weight',kind:'node-style',nodeId:'personal_message',property:'font-weight',schema:{type:'string'}}]
    const target=createExperienceDocument();target.settingsSpec.find(setting=>setting.id==='message_size')!.label='Message size'
    const conflicts=['variations.old_weight','variations.removed_footer','settingsDefaults.message_size'].map(id=>({id,path:`source.overrides.${id}`,message:'The inherited value changed.',localAllowed:false,choices:['family' as const]}))
    const change={...candidate(),conflicts,document:target}
    const repo=repository({load:async()=>({...bootstrap(),document:old,family:{id:'g',revisionId:'gr',revision:2,source:old,document:old}}),listFamilyChanges:async()=>[change],loadFamilyChange:async()=>change})
    const session=createTemplateSession({repository:repo,compile:source=>source});await session.load('t')
    await act(async()=>root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={()=>{}}/>))
    await act(async()=>button('Review candidate c').click())
    expect(container.textContent).toContain('Message weight');expect(container.textContent).toContain('removed footer');expect(container.textContent).toContain('Message size')
    session.dispose()
  })
  it('waits for all conflict choices before presenting the final preview', async () => {
    const repo=repository();const session=createTemplateSession({repository:repo,compile:source=>source});await session.load('t')
    await act(async()=>root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={()=>{}}/>))
    await act(async()=>button('Detach family').click());await act(async()=>button('Prepare family change').click())
    expect(container.querySelector('[aria-label="Family change preview"] iframe')).toBeNull()
    expect(button('Apply family change').disabled).toBe(true)
    await act(async()=>useFamily('headline').click())
    expect(container.querySelector('[aria-label="Family change preview"] iframe')).not.toBeNull()
    expect(button('Apply family change').disabled).toBe(false);session.dispose()
  })

  it('blocks applying a review whose retained media prevents a preview', async () => {
    const document=doc();document.source.definition.assets.push({id:'logo',name:'Logo',kind:'image',mimeType:'image/png',url:'https://example.com/logo.png'});document.managedAssets={logo:'retained'}
    const repo=repository({prepareFamilyChange:async()=>({...candidate(),conflicts:[],document})});const session=createTemplateSession({repository:repo,compile:source=>source});await session.load('t')
    await act(async()=>root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={()=>{}}/>))
    await act(async()=>button('Detach family').click());await act(async()=>button('Prepare family change').click())
    expect(container.textContent).toContain('Preview unavailable')
    expect(button('Apply family change').disabled).toBe(true);session.dispose()
  })
  it('rejects buffered invalid edits before preparing, opening or applying a family change', async () => {
    const change = { ...candidate(), conflicts: [] }
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: vi.fn(async () => change) })
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    let invalid = true
    const validateCurrentDraft = () => { if (invalid) throw new Error('Fix the highlighted fields before changing family.') }
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} validateCurrentDraft={validateCurrentDraft} onApplied={() => {}} />))
    await act(async () => button('Detach family').click())
    await act(async () => button('Prepare family change').click())
    expect(repo.prepareFamilyChange).not.toHaveBeenCalled()
    await act(async () => button('Review candidate c').click())
    expect(repo.loadFamilyChange).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Fix the highlighted fields')
    invalid = false
    await act(async () => button('Review candidate c').click())
    invalid = true
    await act(async () => button('Apply family change').click())
    expect(repo.applyFamilyChange).not.toHaveBeenCalled()
    session.dispose()
  })

  it('retains newly invalid buffered work when an in-flight apply finishes', async () => {
    const change = { ...candidate(), conflicts: [] }; const pending = deferred<any>()
    const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change, applyFamilyChange: () => pending.promise })
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    let invalid = false; const onApplied = vi.fn()
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} validateCurrentDraft={() => { if (invalid) throw new Error('Invalid buffered work') }} onApplied={onApplied} />))
    await act(async () => button('Review candidate c').click())
    await act(async () => button('Apply family change').click())
    invalid = true
    await act(async () => pending.resolve({ version: 2, source: change.source, candidate: { ...change, status: 'applied' } }))
    expect(onApplied).not.toHaveBeenCalled()
    expect(container.textContent).toMatch(/newer local edits.*retained/i)
    session.dispose()
  })
  it('previews the authoritative resolved source before applying a conflict choice', async () => {
    const resolved = doc(); const copy = resolved.source.definition.nodes.copy;
    if (copy.kind === 'text') copy.parts[0].value = { source: 'literal', value: 'Replacement preview' };
    const reviewFamilyChange = vi.fn(async () => ({ ...candidate(), document: resolved }));
    const repo = repository({ reviewFamilyChange });
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t');
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />));
    await act(async () => button('Detach family').click());
    await act(async () => button('Prepare family change').click());
    await act(async () => useFamily('headline').click());
    expect(reviewFamilyChange).toHaveBeenCalledWith('t', 'c', { resolutions: { headline: 'family' }, expectedVersion: 1, sourceChecksum: '1'.repeat(64) }, expect.anything());
    expect(container.querySelector<HTMLIFrameElement>('[aria-label="Family change preview"] iframe')!.srcdoc).toContain('Replacement preview');
    session.dispose();
  });

  it('saves raw dirty source, prepares under authoritative tokens, previews and applies explicit permitted conflict choices', async () => {
    const repo = repository(); const compile = vi.fn(() => { throw new Error('Raw save must not compile.') }); const session = createTemplateSession({ repository: repo, compile }); await session.load('t')
    const onApplied = vi.fn(); await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={onApplied} />))
    const changed = variant(); if (changed.source.mode === 'group-variant') changed.source.overrides.content = { headline: 'Local' }
    act(() => session.change(changed))
    await act(async () => button('Detach family').click())
    await act(async () => button('Save draft and prepare change').click())
    expect(repo.saveDraft).toHaveBeenCalledWith('t', changed, 1, expect.anything())
    expect(compile).not.toHaveBeenCalled()
    expect(repo.prepareFamilyChange).toHaveBeenCalledWith('t', { operation: 'detach', expectedVersion: 2, sourceChecksum: '2'.repeat(64) }, expect.anything())
    expect(container.querySelector('[aria-label="Family change preview"] iframe')).toBeNull()
    expect(button('Apply family change').disabled).toBe(true)
    expect(conflictChoices('headline').querySelectorAll('[role="radio"]')).toHaveLength(1)
    expect(useFamily('headline')).toBeDefined()
    await act(async () => useFamily('headline').click())
    expect(container.querySelector<HTMLIFrameElement>('[aria-label="Family change preview"] iframe')?.srcdoc).toContain('Candidate preview')
    await act(async () => button('Apply family change').click())
    expect(repo.applyFamilyChange).toHaveBeenCalledWith('t', 'c', { resolutions: { headline: 'family' }, expectedVersion: 2, sourceChecksum: '2'.repeat(64) }, expect.anything())
    expect(onApplied).toHaveBeenCalledTimes(1); session.dispose()
  })

  it('discards a prepared response after newer local edits without replacing the source', async () => {
    const pending = deferred<FamilyChangeCandidate>(); const repo = repository({ prepareFamilyChange: () => pending.promise }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Detach family').click())
    await act(async () => button('Prepare family change').click())
    const newer = variant(); if (newer.source.mode === 'group-variant') newer.source.overrides.content = { headline: 'Newer local work' }
    act(() => session.change(newer))
    await act(async () => pending.resolve(candidate()))
    expect(container.querySelector('[aria-label="Family change preview"] iframe[title="Template document"]')).toBeNull()
    expect(container.textContent).toMatch(/changed|newer/i)
    expect(session.getState().source).toEqual(newer); session.dispose()
  })

  it('reviews automatic candidates and preserves newer work when an in-flight apply finishes', async () => {
    const change = { ...candidate(), conflicts: [], operation: 'upgrade' as const, targetGroupId: 'g', targetRevision: 3 }
    const pending = deferred<any>(); const repo = repository({ listFamilyChanges: async () => [change], loadFamilyChange: async () => change, applyFamilyChange: () => pending.promise }); const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    const onApplied = vi.fn(); await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={onApplied} />))
    await act(async () => button('Review candidate c').click())
    await act(async () => button('Apply family change').click())
    const newer = variant(); if (newer.source.mode === 'group-variant') newer.source.overrides.content = { headline: 'Keep this edit' }
    act(() => session.change(newer))
    await act(async () => pending.resolve({ version: 2, sourceChecksum: '2'.repeat(64), source: change.source, candidate: { ...change, status: 'applied' } }))
    expect(onApplied).not.toHaveBeenCalled()
    expect(session.getState().source).toEqual(newer)
    expect(container.textContent).toMatch(/newer local edits.*retained/i); session.dispose()
  })
  it('allows a fresh operation after a deliberate reload and ignores the prior request completion', async () => {
    const pending = deferred<FamilyChangeCandidate>(); let requests = 0
    const repo = repository({ prepareFamilyChange: async () => ++requests === 1 ? pending.promise : { ...candidate(), conflicts: [] } })
    const session = createTemplateSession({ repository: repo, compile: source => source }); await session.load('t')
    await act(async () => root.render(<FamilyChangesPanel id="t" repository={repo} session={session} onApplied={() => {}} />))
    await act(async () => button('Detach family').click())
    await act(async () => button('Prepare family change').click())
    await act(async () => session.load('t'))
    await act(async () => button('Detach family').click())
    await act(async () => button('Prepare family change').click())
    expect(requests).toBe(2)
    expect(container.querySelector('[aria-label="Family change preview"] iframe[title="Template document"]')).not.toBeNull()
    await act(async () => pending.resolve({ ...candidate(), id: 'old' }))
    expect(button('Review candidate old')).toBeUndefined()
    session.dispose()
  })

})
