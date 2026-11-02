// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TemplateResourceTools } from './resource-tools'
import type { AssetPage, EditorBootstrap, ManagedTemplateAsset, TemplateRepository, TemplateSourceDocument } from './contracts'

const png = (id: string): ManagedTemplateAsset => ({ id, name: `Image ${id}`, mimeType: 'image/png', size: 5, checksum: 'sum', previewUrl: `/images/${id}` })
const webp = { ...png('webp'), mimeType: 'image/webp' }
const source = (target: 'document' | 'email' = 'document') => ({ format: 'template-document', schemaVersion: 1, target, source: { mode: 'standalone', definition: { assets: [{ id: 'logo', name: 'Logo', kind: 'image' }], fields: [] } } }) as unknown as TemplateSourceDocument
const bootstrap = (target: 'document' | 'email' = 'document', byTarget?: Record<'document' | 'email', string[]>) => ({ document: source(target), family: null, capabilities: { assetTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], ...(byTarget ? { assetTypesByTarget: byTarget } : {}) } }) as EditorBootstrap
const repository = (overrides: Partial<TemplateRepository> = {}) => ({ listResources: async () => [], listAssets: async () => ({ data: [] }), ...overrides }) as TemplateRepository
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
let root: Root, container: HTMLDivElement
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)!
async function openPicker(label: string) {
  const trigger = container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!
  await act(async () => trigger.click())
  const list = document.getElementById(trigger.getAttribute('aria-controls') ?? '')
  expect(list).not.toBeNull()
  return list!
}
async function choose(label: string, optionLabel: string) {
  const list = await openPicker(label)
  const option = [...list.querySelectorAll<HTMLElement>('[role="option"]')].find(node => node.textContent === optionLabel)
  expect(option).toBeDefined()
  await act(async () => option!.click())
}
async function options(label = 'Retained image') {
  const list = await openPicker(label)
  const values = [...list.querySelectorAll<HTMLElement>('[role="option"]')].map(node => node.textContent)
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  return values
}
async function upload(file: File) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="Upload retained image"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}

it('retries scoped resources without losing the selected image mapping or reloading media', async () => {
  const listResources = vi.fn().mockRejectedValueOnce(new Error('Resources unavailable')).mockResolvedValue([])
  const listAssets = vi.fn(async () => ({ data: [png('chosen')] }))
  const replaceSource = vi.fn()
  await act(async () => root.render(<TemplateResourceTools id="a" source={source()} repository={repository({ listResources, listAssets })} replaceSource={replaceSource} refreshPreviewAssets={() => {}} />))
  await choose('Template image', 'Logo'); await choose('Retained image', 'Image chosen')
  expect(button('Retry resources')).toBeDefined()
  await act(async () => button('Retry resources').click())
  expect(listResources).toHaveBeenCalledTimes(2)
  expect(listAssets).toHaveBeenCalledTimes(1)
  expect(container.textContent).not.toContain('Resources unavailable')
  await act(async () => button('Map image').click())
  expect(replaceSource.mock.lastCall?.[0]).toMatchObject({ managedAssets: { logo: 'chosen' } })
})

it('navigates beyond the first thirty images and maps a later selection after returning pages', async () => {
  const replaceSource = vi.fn(), refreshPreviewAssets = vi.fn()
  const repo = repository({ listAssets: async query => query?.page === 2 ? { data: [png('31')], currentPage: 2, lastPage: 2 } : { data: Array.from({ length: 30 }, (_, n) => png(String(n + 1))), currentPage: 1, lastPage: 2 } })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source()} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={refreshPreviewAssets} />))
  await choose('Template image', 'Logo')
  await act(async () => button('Next images').click())
  await choose('Retained image', 'Image 31')
  expect(container.querySelector('[aria-label="Retained image"]')!.textContent).toContain('Image 31')
  await act(async () => button('Previous images').click())
  await act(async () => button('Map image').click())
  expect(replaceSource.mock.lastCall?.[0]).toMatchObject({ managedAssets: { logo: '31' } })
  expect(refreshPreviewAssets.mock.lastCall?.[0]).toEqual({ logo: '/images/31' })
})

it('preserves a usable first-page selection while browsing another page', async () => {
  const replaceSource = vi.fn()
  const repo = repository({ listAssets: async query => ({ data: [png(query?.page === 2 ? 'second' : 'first')], currentPage: query?.page ?? 1, lastPage: 2 }) })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source()} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={() => {}} />))
  await choose('Template image', 'Logo'); await choose('Retained image', 'Image first')
  await act(async () => button('Next images').click())
  expect(container.querySelector('[aria-label="Retained image"]')!.textContent).toContain('Image first')
  await act(async () => button('Map image').click())
  expect(replaceSource.mock.lastCall?.[0]).toMatchObject({ managedAssets: { logo: 'first' } })
})

it('replaces an off-page selection with an image on the current page', async () => {
  const replaceSource = vi.fn()
  const repo = repository({ listAssets: async query => ({ data: [png(query?.page === 2 ? 'second' : 'first')], currentPage: query?.page ?? 1, lastPage: 2 }) })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source()} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={() => {}} />))
  await choose('Template image', 'Logo'); await choose('Retained image', 'Image first')
  await act(async () => button('Next images').click())
  await choose('Retained image', 'Image second')
  expect(container.querySelector('[aria-label="Retained image"]')!.textContent).toContain('Image second')
  await act(async () => button('Previous images').click())
  await act(async () => button('Map image').click())
  expect(replaceSource.mock.lastCall?.[0]).toMatchObject({ managedAssets: { logo: 'second' } })
})

it('keeps next-page navigation available on an empty filtered page', async () => {
  const repo = repository({ listAssets: async query => query?.page === 2 ? { data: [png('later')], currentPage: 2, lastPage: 2 } : { data: [], currentPage: 1, lastPage: 2, nextPageUrl: '/assets?page=2' } })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source('email')} repository={repo} replaceSource={() => {}} refreshPreviewAssets={() => {}} />))
  expect(button('Next images').disabled).toBe(false)
  await act(async () => button('Next images').click())
  expect(await options()).toContain('Image later')
})

it('ignores a superseded page response even when transport ignores cancellation', async () => {
  const pending = deferred<AssetPage>()
  let signal: AbortSignal | undefined
  const repo = repository({ listAssets: async (query, options) => { if (query?.page === 2) { signal = options?.signal; return pending.promise } return { data: [png('first')], currentPage: 1, lastPage: 2 } } })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source()} repository={repo} replaceSource={() => {}} refreshPreviewAssets={() => {}} />))
  await act(async () => button('Next images').click())
  await act(async () => button('Previous images').click())
  expect(signal?.aborted).toBe(true)
  await act(async () => pending.resolve({ data: [png('stale')], currentPage: 2, lastPage: 2 }))
  expect(await options()).toContain('Image first')
  expect(await options()).not.toContain('Image stale')
})

it('resets pagination and ignores old template and target responses', async () => {
  const oldTemplate = deferred<AssetPage>(), oldTarget = deferred<AssetPage>()
  const queries: unknown[] = []; let call = 0
  const repo = repository({ listAssets: async query => { queries.push(query); if (++call === 1) return oldTemplate.promise; if (call === 2) return oldTarget.promise; return { data: [png('email')], currentPage: 1, lastPage: 1 } } })
  const render = (id: string, target: 'document' | 'email') => root.render(<TemplateResourceTools id={id} source={source(target)} repository={repo} replaceSource={() => {}} refreshPreviewAssets={() => {}} />)
  await act(async () => render('a', 'document'))
  await act(async () => render('b', 'document'))
  await act(async () => render('b', 'email'))
  await act(async () => { oldTemplate.resolve({ data: [png('old-template')] }); oldTarget.resolve({ data: [webp] }) })
  expect(queries).toEqual([{ target: 'document', page: 1 }, { target: 'document', page: 1 }, { target: 'email', page: 1 }])
  expect(await options()).toEqual(['Choose a retained image', 'Image email'])
})

it('uses target MIME metadata for selection and file accept while legacy email excludes WebP', async () => {
  const repo = repository({ listAssets: async () => ({ data: [png('png'), webp, { ...png('gif'), mimeType: 'image/gif' }] }) })
  const render = (meta: EditorBootstrap) => root.render(<TemplateResourceTools id="a" source={source('email')} bootstrap={meta} repository={repo} replaceSource={() => {}} refreshPreviewAssets={() => {}} />)
  await act(async () => render(bootstrap('email', { email: ['image/gif'], document: ['image/webp'] })))
  expect(container.querySelector('input[type="file"]')!.getAttribute('accept')).toBe('image/gif')
  expect(await options()).toEqual(['Choose a retained image', 'Image gif'])
  await act(async () => render(bootstrap('email')))
  expect(container.querySelector('input[type="file"]')!.getAttribute('accept')).toBe('image/png,image/jpeg,image/gif')
  expect(await options()).not.toContain('Image webp')
})

it('clears an unsupported selection when switching from document to email', async () => {
  const replaceSource = vi.fn()
  const repo = repository({ listAssets: async () => ({ data: [webp] }) })
  const render = (target: 'document' | 'email') => root.render(<TemplateResourceTools id="a" source={source(target)} bootstrap={bootstrap(target)} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={() => {}} />)
  await act(async () => render('document'))
  await choose('Template image', 'Logo'); await choose('Retained image', 'Image webp')
  await act(async () => render('email'))
  expect(button('Map image').disabled).toBe(true)
  expect(await options()).not.toContain('Image webp')
  expect(replaceSource).not.toHaveBeenCalled()
})

it('rejects unsupported email files and unsupported upload results before mapping', async () => {
  let uploads = 0
  const replaceSource = vi.fn(), refreshPreviewAssets = vi.fn()
  const repo = repository({ uploadAsset: async () => { uploads++; return webp } })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source('email')} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={refreshPreviewAssets} />))
  await choose('Template image', 'Logo')
  await upload(new File(['bytes'], 'logo.webp', { type: 'image/webp' }))
  expect(uploads).toBe(0)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  await upload(new File(['bytes'], 'logo.png', { type: 'image/png' }))
  expect(uploads).toBe(1)
  expect(replaceSource).not.toHaveBeenCalled(); expect(refreshPreviewAssets).not.toHaveBeenCalled()
})

it('uploads an image with unknown browser MIME and validates the returned MIME before mapping', async () => {
  const replaceSource = vi.fn(), refreshPreviewAssets = vi.fn()
  let uploads = 0
  const repo = repository({ uploadAsset: async () => ++uploads === 1 ? webp : png('verified') })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source('email')} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={refreshPreviewAssets} />))
  await choose('Template image', 'Logo')
  await upload(new File(['unknown browser metadata'], 'logo.webp'))
  expect(uploads).toBe(1)
  expect(replaceSource).not.toHaveBeenCalled()
  await upload(new File(['unknown browser metadata'], 'logo.png'))
  expect(replaceSource.mock.lastCall?.[0]).toMatchObject({ managedAssets: { logo: 'verified' } })
  expect(refreshPreviewAssets.mock.lastCall?.[0]).toEqual({ logo: '/images/verified' })
})

it('respects an explicitly empty target MIME list instead of falling back to global types', async () => {
  const repo = repository({ listAssets: async () => ({ data: [png('png')] }) })
  const meta = bootstrap('email', { email: [], document: ['image/png'] })
  await act(async () => root.render(<TemplateResourceTools id="a" source={source('email')} bootstrap={meta} repository={repo} replaceSource={() => {}} refreshPreviewAssets={() => {}} />))
  await choose('Template image', 'Logo')
  expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true)
  expect(await options()).toEqual(['Choose a retained image'])
})

it('ignores an upload completing after a target switch', async () => {
  const pending = deferred<ManagedTemplateAsset>(), replaceSource = vi.fn()
  const repo = repository({ uploadAsset: () => pending.promise })
  const render = (target: 'document' | 'email') => root.render(<TemplateResourceTools id="a" source={source(target)} repository={repo} replaceSource={replaceSource} refreshPreviewAssets={() => {}} />)
  await act(async () => render('document')); await choose('Template image', 'Logo')
  await upload(new File(['bytes'], 'logo.webp', { type: 'image/webp' }))
  await act(async () => render('email'))
  await act(async () => pending.resolve(webp))
  expect(replaceSource).not.toHaveBeenCalled()
  expect(await options()).not.toContain('Image webp')
})

it('derives variant asset requests from the effective bootstrap document without a raw target', async () => {
  const targets: unknown[] = []
  const repo = repository({ listAssets: async query => { targets.push(query?.target); return { data: [] } } })
  const variant = { format: 'template-document', schemaVersion: 1, source: { mode: 'group-variant', group: { id: 'family', revision: 1 }, overrides: {} } } as unknown as TemplateSourceDocument
  await act(async () => root.render(<TemplateResourceTools id="a" source={variant} bootstrap={bootstrap('email')} repository={repo} replaceSource={() => {}} refreshPreviewAssets={() => {}} />))
  expect(targets).toEqual(['email'])
})
