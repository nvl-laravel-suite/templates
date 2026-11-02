// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@nicolasvlachos/voucher-builder/template-creator', async () => import('../src/template-creator'))
vi.mock('@nicolasvlachos/voucher-builder/template-renderer', async () => import('../src/template-renderer'))
import { createTemplateDefinition } from '../src/template-core/defaults'
import { TemplateDefinitionSchema } from '../src/template-core/schema'
import { exportBindingDocument } from '../src/template-platform/bindings'
import type { BindingDocument } from '../src/template-platform/types'
import type { GroupRevision, TemplateRepository } from './laravel/contracts'
import { LaravelFamilyScreen } from './laravel-family-host'
const source = (text = 'AUTHOR SOURCE') => exportBindingDocument(TemplateDefinitionSchema.parse({ ...createTemplateDefinition('Family authoring'), id: 'family', roots: ['copy'], nodes: { copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'literal', value: text } }] } } }), { target: 'document' })
const release = (revision = 3): GroupRevision => ({ id: `gr${revision}`, revision, source: source(), document: source('IMMUTABLE SNAPSHOT') })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
function repository(overrides: Partial<TemplateRepository> = {}) { return { loadGroupRevision: async () => release(), publishGroup: vi.fn(async (_id, document, expectedRevision) => ({ id: 'next', revision: expectedRevision + 1, source: document, document })), ...overrides } as TemplateRepository }
let root: Root; let container: HTMLDivElement
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label)!

it('projects resolved family content and authorized media while retaining raw reusable references', async () => {
  const document = exportBindingDocument(TemplateDefinitionSchema.parse({ ...createTemplateDefinition('Family media'), roots: ['copy','image'], fields: [{ id:'headline',path:'content.headline',label:'Headline',schema:{type:'string'},required:true,editable:false,defaultValue:'FALLBACK' }], nodes: { copy:{id:'copy',name:'Copy',kind:'text',parts:[{value:{source:'field',fieldId:'headline'}}]}, image:{id:'image',name:'Logo',kind:'element',tag:'img',attributeBindings:{src:{source:'asset',assetId:'logo'}}} }, assets:[{id:'logo',name:'Logo',kind:'image',mimeType:'image/png',url:'https://template-assets.invalid/logo'}] }), { target:'document',managedAssets:{logo:'retained'} });
  const raw = structuredClone(document); raw.content.headline={kind:'content',id:'copy',revision:1,path:'headline'};
  document.content.headline='RESOLVED FAMILY COPY';
  const repo = repository({ loadGroupRevision:async()=>({id:'gr3',revision:3,source:raw,document,previewAssets:{logo:'/api/templates/assets/retained/content'}}) });
  await act(async()=>root.render(<LaravelFamilyScreen groupId="g" revision={3} repository={repo}/>));
  const frame=container.querySelector<HTMLIFrameElement>('iframe[title="Template document"]')!;
  expect(frame.srcdoc).toContain('RESOLVED FAMILY COPY');expect(frame.srcdoc).toContain('/api/templates/assets/retained/content');
  await act(async()=>button('Publish family').click());
  expect(repo.publishGroup).toHaveBeenCalledWith('g',expect.objectContaining({content:expect.objectContaining({headline:raw.content.headline})}),3,expect.anything());
})

it('loads the exact raw family source into the complete workspace and compiles declarations only when publishing', async () => {
  const repo = repository()
  await act(async () => root.render(<LaravelFamilyScreen groupId="g" revision={3} repository={repo} />))
  expect(button('Structure')).toBeDefined()
  await act(async () => button('Library').click())
  expect(button('Reusable blocks')).toBeDefined()
  await act(async () => button('Build').click())
  await act(async () => button('Setup').click())
  expect(button('Family variations')).toBeDefined()
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Template document"]')?.srcdoc).toContain('AUTHOR SOURCE')
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Template document"]')?.srcdoc).not.toContain('IMMUTABLE SNAPSHOT')
  await act(async () => button('Allow name changes').click())
  await act(async () => button('Publish family').click())
  expect(repo.publishGroup).toHaveBeenCalledWith('g', expect.objectContaining({ variationPoints: [expect.objectContaining({ kind: 'node-property', nodeId: 'copy' })], artifacts: expect.objectContaining({ html: expect.stringContaining('AUTHOR SOURCE') }) }), 3, expect.anything())
  expect(container.textContent).toContain('Published family revision 4')
})

it('retains newer family source and creator history when a publication completes', async () => {
  const pending = deferred<GroupRevision>(); let captured!: BindingDocument
  const repo = repository({ publishGroup: async (_id, document) => { captured = document; return pending.promise } })
  await act(async () => root.render(<LaravelFamilyScreen groupId="g" revision={3} repository={repo} />))
  await act(async () => button('Publish family').click())
  await act(async () => button('Add section').click())
  await act(async () => pending.resolve({ id: 'gr4', revision: 4, source: captured, document: captured }))
  expect(container.textContent).toMatch(/newer edits.*retained/i)
  expect(button('Undo').disabled).toBe(false)
  expect(container.querySelectorAll('[data-template-workspace-mode="design"] iframe')).toHaveLength(1)
})

it('ignores an old family load after the exact family revision changes', async () => {
  const old = deferred<GroupRevision>()
  const repo = repository({ loadGroupRevision: async (_id, revision) => revision === 3 ? old.promise : { ...release(4), source: source('NEW FAMILY SOURCE') } })
  await act(async () => root.render(<LaravelFamilyScreen groupId="g" revision={3} repository={repo} />))
  await act(async () => root.render(<LaravelFamilyScreen groupId="g" revision={4} repository={repo} />))
  await act(async () => old.resolve(release(3)))
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Template document"]')?.srcdoc).toContain('NEW FAMILY SOURCE')
  expect(container.textContent).not.toContain('revision 3')
})
