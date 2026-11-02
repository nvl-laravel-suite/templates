// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@nicolasvlachos/voucher-builder/template-creator', async () => import('../../src/template-creator'))
vi.mock('@nicolasvlachos/voucher-builder/template-renderer', async () => import('../../src/template-renderer'))
import { LaravelTemplateScreen } from '../laravel-host'
import { LaravelPublishedTemplateScreen } from '../laravel-published-host'
import { createTemplateDefinition } from '../../src/template-core/defaults'
import { TemplateDefinitionSchema, TemplateFieldSchema } from '../../src/template-core/schema'
import { exportBindingDocument } from '../../src/template-platform/bindings'
import type { BindingDocument } from '../../src/template-platform/types'
import type { EditorBootstrap, ManagedTemplateAsset, PreparedPublishedTemplate, ResourceRevision, TemplatePreviewData, TemplateRepository, TemplateSourceDocument } from './contracts'

function source() {
  return exportBindingDocument(TemplateDefinitionSchema.parse({
    ...createTemplateDefinition('Alignment document'), id: 'alignment', roots: ['p'],
    nodes: { p: { id: 'p', name: 'Paragraph', kind: 'element', tag: 'p', children: ['text'] }, text: { id: 'text', name: 'Text', kind: 'text', parts: [{ value: { source: 'field', fieldId: 'other' } }, { value: { source: 'field', fieldId: 'code' } }] } },
    fields: [
      { id: 'other', path: 'content.other', label: 'Other copy', schema: { type: 'string' }, defaultValue: 'Old', editable: false },
      { id: 'reused', path: 'content.reused', label: 'Reusable copy', schema: { type: 'string' }, defaultValue: 'Initial', editable: false },
      { id: 'message', path: 'inputs.message', label: 'Message', schema: { type: 'string' }, defaultValue: 'Enjoy', editable: true },
      { id: 'code', path: 'facts.code', label: 'Code', schema: { type: 'string' }, editable: false, sample: 'SAMPLE' },
    ],
  }), { target: 'document', settings: [{ id: 'font', label: 'Font size', schema: { type: 'number', minimum: 10, maximum: 48 }, defaultValue: 16, unit: 'px', exposed: true, targets: [{ nodeId: 'p', property: 'font-size' }] }] })
}
function bootstrap(document: BindingDocument): EditorBootstrap {
  return { template: { id: 'a', key: 'a', name: 'Alignment document', groupId: null, status: 'active' }, version: 1, source: document, document, family: null, currentRevisionId: null, capabilities: { schemaVersion: 1, compilerVersions: ['template-platform/1'], sourceModes: ['standalone', 'group-variant'], targets: ['document', 'email'], engines: { bindings: true, shared: true }, pdf: false, assetTypes: ['image/png'], variantOverrides: ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings'] }, previewAssets: {}, issues: [] }
}
const resource: ResourceRevision = { id: 'copy', revision: 1, kind: 'content', document: { value: 'Pinned' }, name: 'Copy', key: 'copy', revisionId: 'r1', checksum: 'sum', scope: 'tenant', groupId: null, templateId: null }
function prepared(document: BindingDocument, code = 'FIRST'): PreparedPublishedTemplate { return { revisionId: 'release', document, data: { facts: { code }, context: {}, content: document.content, inputs: document.inputDefaults, settings: { font: 16 } }, previewAssets: {} } }
function repository(overrides: Partial<TemplateRepository> = {}): TemplateRepository { return { load: async () => bootstrap(source()), listResources: async () => [], listAssets: async () => ({ data: [] }), ...overrides } as TemplateRepository }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
let root: Root, container: HTMLDivElement
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => !node.closest('[hidden]') && (node.textContent?.trim() === label || node.getAttribute('aria-label') === label))
async function change(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}
async function action(label: string) {
  let element: HTMLElement | undefined = button(label)
  if (!element) {
    await act(async () => button('More actions')!.click())
    element = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent?.trim() === label)
  }
  expect(element).toBeDefined()
  await act(async () => element!.click())
}

it('keeps raw saving and resource repair available after a reusable reference fails', async () => {
  const document = source(); document.content.reused = { kind: 'content', id: 'missing', revision: 1, path: 'value' }
  let saved: TemplateSourceDocument | undefined
  const repo = repository({ load: async () => bootstrap(document), loadResource: async () => { throw new Error('Missing content revision') }, saveDraft: async (_id, value, token) => { saved = value; return { document: value, version: token + 1 } } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  expect(container.textContent).toContain('Missing content revision')
  expect(button('Resources and media')).toBeDefined()
  await action('Save draft')
  expect(saved).toMatchObject({ content: { reused: { kind: 'content', id: 'missing', revision: 1, path: 'value' } } })
})

it('preserves content-default edits and raw reference authority without resetting the editor', async () => {
  const document = source(); document.content.reused = { kind: 'content', id: 'copy', revision: 1, path: 'value' }
  let saved: TemplateSourceDocument | undefined
  const repo = repository({ load: async () => bootstrap(document), loadResource: async () => resource, saveDraft: async (_id, value, token) => { saved = value; return { document: value, version: token + 1 } } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  await action('Fields')
  await change(container.querySelector<HTMLTextAreaElement>('[aria-label="Runtime default"]')!, '"New"')
  expect(button('Undo')?.disabled).toBe(false)
  await action('Save draft')
  expect(saved).toMatchObject({ content: { other: 'New', reused: { kind: 'content', id: 'copy', revision: 1, path: 'value' } } })
  expect(container.querySelector('[aria-label="Runtime default"]')).not.toBeNull()
})

it('does not let an upload completion replace edits made during the request', async () => {
  const document = source(); document.source.definition.assets = [{ id: 'logo', name: 'Logo', kind: 'image', url: 'https://example.com/logo.png', mimeType: 'image/png' }]
  const upload = deferred<ManagedTemplateAsset>(); let saved: TemplateSourceDocument | undefined
  const repo = repository({ load: async () => bootstrap(document), uploadAsset: () => upload.promise, saveDraft: async (_id, value, token) => { saved = value; return { document: value, version: token + 1 } } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  await action('Resources and media')
  await act(async () => container.querySelector<HTMLElement>('[aria-label="Template image"]')!.click())
  const option = [...documentGlobal().querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent === 'Logo')!
  await act(async () => option.click())
  const input = container.querySelector<HTMLInputElement>('[aria-label="Upload retained image"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['bytes'], 'logo.png', { type: 'image/png' })] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  await action('Add section')
  await act(async () => upload.resolve({ id: 'managed', name: 'Logo', mimeType: 'image/png', size: 5, checksum: 'sum', previewUrl: '/asset' }))
  expect(container.textContent).toContain('changed while this resource operation was pending')
  await action('Save draft')
  expect((saved as BindingDocument).source.definition.roots).toHaveLength(2)
  expect((saved as BindingDocument).managedAssets?.logo).toBeUndefined()
})
// Avoid shadowing the browser document with the authored fixture in the upload test.
function documentGlobal() { return globalThis.document }

it('keeps untouched published setting defaults out of the owner customization patch', async () => {
  const document = source(); const onPersonalizationChange = vi.fn()
  const repo = repository({ preparePublished: async () => prepared(document) })
  await act(async () => root.render(<LaravelPublishedTemplateScreen revisionId="release" repository={repo} owner={{ id: 'owner' }} onPersonalizationChange={onPersonalizationChange} />))
  const reset = container.querySelector<HTMLButtonElement>('[data-template-workspace-mode="personalize"] [aria-label="Reset Font size"]')!
  expect(reset.disabled).toBe(true)
  await change(container.querySelector<HTMLInputElement>('[data-template-workspace-mode="personalize"] input[aria-label^="Message"]')!, 'Personalized')
  expect(onPersonalizationChange.mock.lastCall?.[0]).toEqual({ inputs: { message: 'Personalized' }, settings: {} })
})

it('hides output from the old repository while the replacement repository authorizes preparation', async () => {
  const document = source(); const next = deferred<PreparedPublishedTemplate>()
  const first = repository({ preparePublished: async () => prepared(document, 'FIRST') })
  const second = repository({ preparePublished: () => next.promise })
  await act(async () => root.render(<LaravelPublishedTemplateScreen revisionId="release" repository={first} owner={{ id: 'owner' }} />))
  await act(async () => root.render(<LaravelPublishedTemplateScreen revisionId="release" repository={second} owner={{ id: 'owner' }} />))
  expect(container.querySelector('iframe')).toBeNull()
  await act(async () => next.resolve(prepared(document, 'SECOND')))
  expect(container.querySelector<HTMLIFrameElement>('[data-template-workspace-mode="personalize"] iframe')!.srcdoc).toContain('SECOND')
})

it.each(['standalone', 'group-variant'] as const)('sends current native %s customer inputs and appearance to Server preview', async sourceMode => {
  const document = source()
  document.source.definition.fields.push(TemplateFieldSchema.parse({ id: 'recipient', path: 'inputs.delivery.name', label: 'Recipient', schema: { type: 'string' }, editable: true }))
  document.exposedInputs.push('delivery.name')
  document.settingsSpec.push({ id: 'spacing', label: 'Spacing', schema: { type: 'number', minimum: 0 }, defaultValue: 8, unit: 'px', exposed: true, targets: [{ nodeId: 'p', property: 'padding' }] })
  document.exposedSettings.push('spacing')
  document.settingsDefaults.spacing = 8
  const samples = { facts: { code: 'TRUSTED' }, context: { channel: 'email' }, inputs: { message: 'Sample', delivery: { name: 'Sample recipient', email: 'keep@example.com' }, empty: null, enabled: false, count: 0 }, settings: { font: 16, spacing: 0 } }
  let values: TemplatePreviewData | undefined
  const repo = repository({
    load: async () => sourceMode === 'standalone' ? bootstrap(document) : {
      ...bootstrap(document),
      source: { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } },
      family: { id: 'family', revisionId: 'family-1', revision: 1, document },
    },
    preview: async (_id, _document, data) => { values = data; return { html: '<p>Server preview</p>', css: '' } },
  })
  const screen = (mode: 'staff' | 'customer', id = 'a') => <LaravelTemplateScreen id={id} repository={repo} previewData={samples} mode={mode} />
  await act(async () => root.render(screen('customer')))
  const customer = sourceMode === 'standalone' ? '[data-template-workspace-mode="personalize"]' : '[data-variant-mode="customer"]'
  await change(container.querySelector<HTMLInputElement>(`${customer} input[aria-label^="Message"]`)!, 'Personalized')
  await change(container.querySelector<HTMLInputElement>(`${customer} input[aria-label^="Recipient"]`)!, 'Current recipient')
  await change(container.querySelector<HTMLInputElement>(`${customer} input[aria-label="Font size"]`)!, '24')
  await act(async () => root.render(screen('staff')))
  await action('Server preview')
  expect(values).toEqual({ facts: { code: 'TRUSTED' }, context: { channel: 'email' }, inputs: { message: 'Personalized', delivery: { name: 'Current recipient', email: 'keep@example.com' }, empty: null, enabled: false, count: 0 }, settings: { font: 24, spacing: 0 } })
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Draft saved')
  await act(async () => root.render(screen('customer')))
  await act(async () => container.querySelector<HTMLButtonElement>(`${customer} [aria-label="Reset Font size"]`)!.click())
  await act(async () => root.render(screen('staff')))
  await action('Server preview')
  expect(values?.settings).toEqual({ font: 16, spacing: 0 })
  await act(async () => root.render(screen('staff', 'b')))
  await action('Server preview')
  expect(values).toEqual(samples)
})

it.each(['standalone', 'group-variant'] as const)('uses sample appearance in the native %s customer preview', async sourceMode => {
  const document = source()
  const repo = repository({ load: async () => sourceMode === 'standalone' ? bootstrap(document) : {
    ...bootstrap(document),
    source: { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } },
    family: { id: 'family', revisionId: 'family-1', revision: 1, document },
  } })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} mode="customer" previewData={{ facts: { code: 'SAMPLE' }, settings: { font: 32 } }} />))
  const customer = sourceMode === 'standalone' ? '[data-template-workspace-mode="personalize"]' : '[data-variant-mode="customer"]'
  expect(container.querySelector<HTMLInputElement>(`${customer} input[aria-label="Font size"]`)!.value).toBe('32')
  expect(container.querySelector<HTMLIFrameElement>(`${customer} iframe`)!.srcdoc).toContain('font-size:32px')
})

it('lets staff switch a variant into customer preview while explicit customer mode stays controlled', async () => {
  const document = source()
  const repo = repository({ load: async () => ({
    ...bootstrap(document),
    source: { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } },
    family: { id: 'family', revisionId: 'family-1', revision: 1, document },
  }) })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} />))
  expect(button('Customer preview')).toBeDefined()
  await act(async () => button('Customer preview')!.click())
  expect(container.querySelector('[data-variant-mode="customer"]')!.hasAttribute('hidden')).toBe(false)
  await act(async () => button('Variant')!.click())
  expect(container.querySelector('[data-variant-mode="staff"]')!.hasAttribute('hidden')).toBe(false)
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} mode="customer" />))
  expect(button('Variant')).toBeUndefined()
  expect(container.querySelector('[data-variant-mode="customer"]')!.hasAttribute('hidden')).toBe(false)
})

it.each(['standalone', 'group-variant'] as const)('invalidates displayed %s server previews only when effective runtime values change', async sourceMode => {
  const document = source()
  let values: TemplatePreviewData | undefined
  const repo = repository({
    load: async () => sourceMode === 'standalone' ? bootstrap(document) : {
      ...bootstrap(document),
      source: { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } },
      family: { id: 'family', revisionId: 'family-1', revision: 1, document },
    },
    preview: async (_id, _source, data) => { values = data; return { html: '<p>Current server preview</p>', css: '' } },
  })
  const samples = { facts: { code: 'FIRST' }, context: { locale: 'en' }, inputs: { message: 'Sample' }, settings: { font: 20 } }
  const screen = (data = samples) => <LaravelTemplateScreen id="a" repository={repo} previewData={data} />
  const serverPreview = () => container.querySelector<HTMLIFrameElement>('iframe[title="Server template preview"]')
  await act(async () => root.render(screen()))
  await action('Server preview')
  expect(serverPreview()?.srcdoc).toContain('Current server preview')
  await act(async () => root.render(screen({ settings: { font: 20 }, inputs: { message: 'Sample' }, context: { locale: 'en' }, facts: { code: 'FIRST' } })))
  expect(serverPreview()).not.toBeNull()
  await action(sourceMode === 'standalone' ? 'Personalize' : 'Customer preview')
  const customer = sourceMode === 'standalone' ? '[data-template-workspace-mode="personalize"]' : '[data-variant-mode="customer"]'
  await change(container.querySelector<HTMLInputElement>(`${customer} input[aria-label^="Message"]`)!, 'Sample')
  expect(serverPreview()).not.toBeNull()
  await change(container.querySelector<HTMLInputElement>(`${customer} input[aria-label^="Message"]`)!, 'Current input')
  expect(serverPreview()).toBeNull()
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Draft saved (version 1)')
  await action('Server preview')
  expect(values?.inputs).toEqual({ message: 'Current input' })
  await act(async () => root.render(screen({ ...samples, inputs: { message: 'Shadowed sample' } })))
  expect(serverPreview()).not.toBeNull()
  await act(async () => root.render(screen({ facts: { code: 'SECOND' }, context: { locale: 'fr' }, inputs: { message: 'Shadowed sample' }, settings: { font: 28 } })))
  expect(serverPreview()).toBeNull()
  await action('Server preview')
  expect(values).toEqual({ facts: { code: 'SECOND' }, context: { locale: 'fr' }, inputs: { message: 'Current input' }, settings: { font: 28 } })
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Draft saved (version 1)')
})

it.each(['standalone', 'group-variant'] as const)('ignores an in-flight %s server preview after a personalization edit and retries current values', async sourceMode => {
  const document = source(), pending = deferred<{ html: string; css: string }>()
  let calls = 0, oldSignal: AbortSignal | undefined, values: TemplatePreviewData | undefined
  const repo = repository({
    load: async () => sourceMode === 'standalone' ? bootstrap(document) : {
      ...bootstrap(document),
      source: { format: 'template-document', schemaVersion: 1, target: 'document', source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } },
      family: { id: 'family', revisionId: 'family-1', revision: 1, document },
    },
    preview: async (_id, _source, data, options) => {
      values = data
      if (++calls === 1) { oldSignal = options?.signal; return pending.promise }
      return { html: '<p>Retried current values</p>', css: '' }
    },
  })
  await act(async () => root.render(<LaravelTemplateScreen id="a" repository={repo} previewData={{ facts: { code: 'FIRST' }, inputs: { message: 'Sample' }, settings: { font: 20 } }} />))
  await action(sourceMode === 'standalone' ? 'Personalize' : 'Customer preview')
  await action('Server preview')
  expect(button('Server preview')?.disabled).toBe(true)
  const customer = sourceMode === 'standalone' ? '[data-template-workspace-mode="personalize"]' : '[data-variant-mode="customer"]'
  await change(container.querySelector<HTMLInputElement>(`${customer} input[aria-label="Font size"]`)!, '24')
  expect(oldSignal?.aborted).toBe(true)
  expect(button('Server preview')?.disabled).toBe(false)
  await act(async () => pending.resolve({ html: '<p>Stale response</p>', css: '' }))
  expect(container.querySelector('iframe[title="Server template preview"]')).toBeNull()
  await action('Server preview')
  expect(values).toEqual({ facts: { code: 'FIRST' }, context: undefined, inputs: { message: 'Sample' }, settings: { font: 24 } })
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Server template preview"]')?.srcdoc).toContain('Retried current values')
  expect(container.querySelector('[data-template-host-status]')?.textContent).toContain('Draft saved (version 1)')
})

it.each([
  { namespace: 'facts', replacement: { code: 'SECOND' } },
  { namespace: 'context', replacement: { locale: 'fr' } },
  { namespace: 'inputs', replacement: { message: 'New sample' } },
  { namespace: 'settings', replacement: { font: 28 } },
])('ignores an in-flight server preview after $namespace samples change', async ({ namespace, replacement }) => {
  const document = source(), pending = deferred<{ html: string; css: string }>()
  let calls = 0, oldSignal: AbortSignal | undefined, values: TemplatePreviewData | undefined
  const repo = repository({ load: async () => bootstrap(document), preview: async (_id, _source, data, options) => {
    values = data
    if (++calls === 1) { oldSignal = options?.signal; return pending.promise }
    return { html: '<p>New sample preview</p>', css: '' }
  } })
  const samples = { facts: { code: 'FIRST' }, context: { locale: 'en' }, inputs: { message: 'Sample' }, settings: { font: 20 } }
  const screen = (data = samples) => <LaravelTemplateScreen id="a" repository={repo} previewData={data} />
  await act(async () => root.render(screen()))
  await action('Server preview')
  const next = { ...samples, [namespace]: replacement }
  await act(async () => root.render(screen(next)))
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => pending.resolve({ html: '<p>Old sample preview</p>', css: '' }))
  expect(container.querySelector('iframe[title="Server template preview"]')).toBeNull()
  await action('Server preview')
  expect(values).toEqual(next)
  expect(container.querySelector<HTMLIFrameElement>('iframe[title="Server template preview"]')?.srcdoc).toContain('New sample preview')
})
