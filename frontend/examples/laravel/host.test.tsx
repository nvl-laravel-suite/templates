// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
// Exercise current public implementations before the package build is refreshed.
vi.mock('@nicolasvlachos/voucher-builder/template-creator', async () => import('../../src/template-creator'))
vi.mock('@nicolasvlachos/voucher-builder/template-renderer', async () => import('../../src/template-renderer'))
import { LaravelTemplateScreen, type TemplateHostToolsContext } from '../laravel-host'
import { createTemplateDefinition } from '../../src/template-core/defaults'
import { TemplateDefinitionSchema } from '../../src/template-core/schema'
import { exportBindingDocument } from '../../src/template-platform/bindings'
import { renderSharedTemplateDocument } from '../../src/template-platform/shared'
import type { BindingDocument } from '../../src/template-platform/types'
import type { EditorBootstrap, TemplateOutput, TemplateRepository, TemplateSourceDocument } from './contracts'
import { TemplateRequestError } from './repository'

const documentFor = (id: string) => exportBindingDocument({ ...createTemplateDefinition(`Template ${id}`), id }, { target: 'document' })
const bootstrap = (id: string, document = documentFor(id)): EditorBootstrap => ({ template: { id, key: id, name: `Template ${id}`, groupId: null, status: 'active' }, version: 1, source: document, document, family: null, currentRevisionId: null, capabilities: { schemaVersion: 1, compilerVersions: ['template-platform/1'], sourceModes: ['standalone', 'group-variant'], targets: ['document', 'email'], engines: { bindings: true, shared: true }, pdf: false, assetTypes: ['image/png'], variantOverrides: ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings'] }, previewAssets: {}, issues: [] })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
function repository(overrides: Partial<TemplateRepository> = {}): TemplateRepository { return { load: async id => bootstrap(id), saveDraft: async (_id, document, token) => ({ document, version: token + 1 }), publish: async () => ({ id: 'release', revision: 2 }), ...overrides } as TemplateRepository }
let root: Root, container: HTMLDivElement
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...container.querySelectorAll('button')].find(node => !node.closest('[hidden]') && (node.textContent?.trim() === label || node.getAttribute('aria-label') === label))!

it('loads safely under StrictMode and keeps the initial workspace callback clean', async () => {
  await act(async () => root.render(<StrictMode><LaravelTemplateScreen id="a" repository={repository()} /></StrictMode>))
  expect(button('Structure')).toBeDefined()
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Draft saved')
  expect(container.textContent).not.toContain('session is closed')
  expect(container.querySelector('[data-template-host-status]')?.textContent).not.toContain('Unsaved')
})

it.each([
  { output: { html: '<p>Delivery HTML</p>', previewHtml: '<p>Browser HTML</p>', css: '' }, expected: '<p>Browser HTML</p>' },
  { output: { html: '<p>Delivery HTML</p>', previewHtml: '', css: '' }, expected: '' },
  { output: { html: '<p>Delivery HTML</p>', css: '' }, expected: '<p>Delivery HTML</p>' },
])('shows the server browser preview with a delivery HTML fallback: $expected', async ({ output, expected }) => {
  const repo = repository({ preview: async () => output })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  await act(async () => button('Server preview').click())
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Server template preview"]')!.srcdoc).toBe(expected)
})

it('never saves source from the previous template after a mounted identity change', async () => {
  const writes: { id: string; source: TemplateSourceDocument; token: number }[] = []
  const repo = repository({ saveDraft: async (id, source, token) => { writes.push({ id, source, token }); return { document: source, version: token + 1 } } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  await act(async () => button('Add section').click())
  await act(async () => root.render(<LaravelTemplateScreen id="b" repository={repo} />))
  await act(async () => button('Save draft').click())
  expect(writes[0]).toMatchObject({ id: 'b', token: 1, source: { source: { definition: { id: 'b', roots: [] } } } })
  expect(button('Undo').disabled).toBe(true)
})

it('retains newer source and editor history while a draft save completes', async () => {
  const pending = deferred<{ version: number; document: TemplateSourceDocument }>(); let captured!: TemplateSourceDocument
  const repo = repository({ saveDraft: async (_id, document) => { captured = document; return pending.promise } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  await act(async () => button('Save draft').click())
  await act(async () => button('Add section').click())
  await act(async () => { pending.resolve({ version: 2, document: captured }) })
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Unsaved changes')
  expect(button('Undo').disabled).toBe(false)
})

it('allows explicit host-tool replacement to remount the document', async () => {
  let tools!: TemplateHostToolsContext
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repository()} renderTools={context => { tools = context; return null }} />))
  const replacement = documentFor('a'); replacement.source.definition.name = 'Imported replacement'
  await act(async () => tools.replaceSource(replacement))
  expect(container.textContent).toContain('Imported replacement')
  expect(button('Undo').disabled).toBe(true)
})

it('retains conflicted editing state and ignores old tool completions after an explicit reload', async () => {
  let tools!: TemplateHostToolsContext
  const repo = repository({ saveDraft: async () => { throw new TemplateRequestError('Conflict', 409) } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} renderTools={context => { tools = context; return null }} />))
  const oldTools = tools
  await act(async () => button('Add section').click())
  await act(async () => button('Save draft').click())
  expect(button('Undo').disabled).toBe(false)
  expect(container.textContent).toContain('local edits are retained')
  await act(async () => button('Reload saved draft').click())
  const replacement = documentFor('a'); replacement.source.definition.name = 'Stale import'
  await act(async () => oldTools.replaceSource(replacement))
  expect(container.textContent).not.toContain('Stale import')
  expect(button('Undo').disabled).toBe(true)
})

it('keeps raw saving available when publication requires an unavailable engine', async () => {
  const doc = documentFor('a'); doc.rendering = { engine: 'shared' }
  let saved: TemplateSourceDocument | undefined
  const repo = repository({ load: async () => { const value = bootstrap('a', doc); value.capabilities.engines.shared = false; return value }, saveDraft: async (_id, document, token) => { saved = document; return { document, version: token + 1 } } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  expect(button('Publish').disabled).toBe(true)
  await act(async () => button('Save draft').click())
  expect(saved).toMatchObject({ rendering: { engine: 'shared' } })
})

it.each([false, true])('keeps raw family drafts saveable without a server compiler and gates structural publication: %s', async structural => {
  const family = exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Family'), roots: ['message'],
    nodes: {
      message: { id: 'message', name: 'Message', kind: 'element', tag: 'p', children: ['copy'] },
      copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'literal', value: 'Family text' } }] },
    },
  }), { target: 'document' })
  family.variationPoints = [{ id: 'weight', label: 'Message weight', kind: 'node-style', nodeId: 'message', property: 'font-weight', schema: { type: 'string', enum: ['normal', 'bold'] } }]
  const source = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'g', revision: 1 }, overrides: structural ? { variations: { weight: { kind: 'node-style', value: 'bold' } } } : {} } } as TemplateSourceDocument
  let saved: TemplateSourceDocument | undefined
  let previews = 0
  const value: EditorBootstrap = { ...bootstrap('variant', family), source, family: { id: 'g', revisionId: 'gr', revision: 1, document: family } }
  value.capabilities.engines.shared = false
  value.capabilities.variantOverrides.push('variations')
  const repo = repository({
    load: async () => value,
    saveDraft: async (_id, document, token) => { saved = document; return { document, version: token + 1 } },
    preview: async () => { previews++; return { html: '<p>Server preview</p>', css: '' } },
  })
  await act(async () => root.render(<LaravelTemplateScreen id="variant" repository={repo} />))

  expect(button('Publish').disabled).toBe(structural)
  await act(async () => button('Save draft').click())
  expect(saved).toEqual(source)
  await act(async () => button('Server preview').click())
  expect(previews).toBe(structural ? 0 : 1)
  if (structural) expect(container.textContent).toContain('Structural family variants require a configured server compiler')
})

it('opens grouped source with the variant workspace and saves the raw pinned source', async () => {
  const family = documentFor('family')
  const source = { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'g', revision: 3 }, overrides: {} } } as TemplateSourceDocument
  let saved: TemplateSourceDocument | undefined
  const repo = repository({ load: async () => ({ ...bootstrap('variant', family), source, family: { id: 'g', revisionId: 'gr', revision: 3, document: family } }), saveDraft: async (_id, document, token) => { saved = document; return { document, version: token + 1 } } })
  await act(async () => root.render(<LaravelTemplateScreen id="variant" repository={repo} />))
  expect(container.textContent).toContain('Layout is inherited')
  expect(button('Structure')).toBeUndefined()
  await act(async () => button('Save draft').click())
  expect(saved).toEqual(source)
})

it('blocks publication while a structural JSON control contains an unfinished invalid draft',async()=>{
 const family=exportBindingDocument(TemplateDefinitionSchema.parse({...createTemplateDefinition('Family'),roots:['copy'],nodes:{copy:{id:'copy',name:'Copy',kind:'text',parts:[{value:{source:'literal',value:'Valid'}}]}}}),{target:'document'})
 family.variationPoints=[{id:'parts',label:'Text parts',kind:'node-property',nodeId:'copy',property:'parts',schema:{type:'array',items:{type:'object',properties:{value:{type:'object',properties:{source:{type:'string'},value:{type:'string'}},additionalProperties:false},format:{type:'string'},currency:{type:'string'}},additionalProperties:false}}}]
 const source={format:'template-document',schemaVersion:1,target:'document',source:{mode:'group-variant',group:{id:'g',revision:1},overrides:{}}} as TemplateSourceDocument
 const saveDraft=vi.fn(async(_id,document,token)=>({document,version:token+1}));const publish=vi.fn(async()=>({id:'r',revision:1}))
 const repo=repository({load:async()=>({...bootstrap('t',family),source,family:{id:'g',revisionId:'gr',revision:1,document:family}}),saveDraft,publish})
 await act(async()=>root.render(<LaravelTemplateScreen id="t" repository={repo}/>))
 await act(async()=>button('Variation points').click())
 const field=container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Text parts"]')!
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'{');field.dispatchEvent(new Event('input',{bubbles:true}))})
 await act(async()=>field.dispatchEvent(new FocusEvent('focusout',{bubbles:true})))
 expect(field.getAttribute('aria-invalid')).toBe('true')
 await act(async()=>button('Publish').click())
 expect(saveDraft).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();expect(container.textContent).toContain('Fix the highlighted fields')
})

it.each(['bindings', 'shared'] as const)('retains custom email sidecar bindings through a raw edit, save and reload with %s compilation', async engine => {
  const initial = exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Email'), id: 'email', roots: ['copy'],
    nodes: { copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'literal', value: 'Original body' } }] } },
    fields: [
      { id: 'customer', path: 'facts.customer', label: 'Customer', schema: { type: 'string' }, editable: false },
      { id: 'recipient', path: 'inputs.recipient', label: 'Recipient', schema: { type: 'string' }, editable: true, defaultValue: 'Bea' },
    ],
  }), { target: 'email', subject: 'Hello {{subjectAlias}}', text: 'Dear {{plainAlias}}' })
  initial.artifacts.engine = engine
  initial.artifacts.bindings = [{ id: 'subjectAlias', path: 'facts.customer', kind: 'text' }, { id: 'plainAlias', path: 'inputs.recipient', kind: 'text' }]
  delete initial.rendering
  let stored: TemplateSourceDocument = initial
  let version = 1
  let previewed: BindingDocument | undefined
  let output: TemplateOutput | undefined
  const repo = repository({
    load: async () => ({ ...bootstrap('email', initial), source: stored, version }),
    saveDraft: async (_id, document, token) => {
      stored = JSON.parse(JSON.stringify(document)) as TemplateSourceDocument
      version = token + 1
      return { document: stored, version }
    },
    preview: async (_id, document) => {
      previewed = document as BindingDocument
      output = renderSharedTemplateDocument(previewed, { facts: { customer: 'Ada' }, inputs: { recipient: 'Bea' }, content: {}, context: {}, settings: {} })
      return output
    },
  })
  const screen = () => <LaravelTemplateScreen id="email" repository={repo} previewData={{ facts: { customer: 'Ada' } }} />
  await act(async () => root.render(screen()))
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Draft saved')
  await act(async () => button('Add section').click())
  await act(async () => button('Save draft').click())
  expect(stored).not.toHaveProperty('artifacts')
  expect(stored).toMatchObject({ rendering: { engine, subject: 'Hello {{subjectAlias}}', text: 'Dear {{plainAlias}}', bindings: [{ id: 'subjectAlias', path: 'facts.customer', kind: 'text' }, { id: 'plainAlias', path: 'inputs.recipient', kind: 'text' }] } })
  await act(async () => { root.unmount(); root = createRoot(container); root.render(screen()) })
  await act(async () => button('Server preview').click())
  expect(previewed?.artifacts.engine).toBe(engine)
  expect(previewed?.artifacts.bindings).toEqual(expect.arrayContaining([{ id: 'subjectAlias', path: 'facts.customer', kind: 'text' }, { id: 'plainAlias', path: 'inputs.recipient', kind: 'text' }]))
  expect(output).toMatchObject({ subject: 'Hello Ada', text: 'Dear Bea' })
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Server template preview"]')?.srcdoc).toContain('Original body')
  expect(container.textContent).not.toContain('undeclared or missing')
})
