// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { TemplateFieldSchema, TemplateNodeSchema } from '../template-core/schema'
import { createTemplateCreator, createTemplateEditor } from '../template-core/editing'
import { exportTemplateBlock, parseTemplateBlockLibrary } from '../template-core/blocks'
import { TemplateCreator } from './TemplateCreator'
import { TemplateEditor } from './TemplateEditor'
import { downloadText } from './downloads'
import { VoucherBuilder } from '../voucher-builder/VoucherBuilder'
import { createVoucherBuilder } from '../voucher-builder/instance'
import { createEmptyProject } from '../voucher-builder/lib/empty-project'

vi.mock('./downloads', () => ({ downloadJSON: vi.fn(), downloadText: vi.fn() }))

const definition = () => {
  const draft = createTemplateDefinition('Portable document')
  draft.fields.push(TemplateFieldSchema.parse({ id: 'caption', path: 'caption', label: 'Caption', schema: { type: 'string' } }))
  draft.nodes.note = TemplateNodeSchema.parse({ id: 'note', kind: 'text', name: 'Note',
    parts: [{ value: { source: 'field', fieldId: 'caption' } }] })
  draft.roots = ['note']
  return draft
}

describe('backend-independent template components', () => {
  let root: Root, container: HTMLDivElement
  const network = vi.fn(() => { throw new Error('No transport supplied') })
  const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('fetch', network)
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const expectNoBackend = () => {
    expect(network).not.toHaveBeenCalled()
    for (const method of Object.values(storage)) expect(method).not.toHaveBeenCalled()
  }
  const button = (label: string) => [...container.querySelectorAll('button')]
    .find(item => item.textContent?.trim() === label)!

  it('edits, validates, exchanges blocks and renders with no storage or network', () => {
    const change = vi.fn(), creator = createTemplateCreator({ initialTemplate: definition(), onChange: change })
    creator.actions.updateNode('note', { name: 'Caption' })
    const blockId = creator.actions.saveBlock('note', 'Caption block')
    const library = parseTemplateBlockLibrary(JSON.parse(JSON.stringify(exportTemplateBlock(creator.getTemplate(), blockId, 1))))
    const receiver = createTemplateCreator({ initialTemplate: createTemplateDefinition() })
    expect(receiver.actions.importBlockLibrary(library)).toEqual(library.entry)
    const editor = createTemplateEditor({ template: creator.getTemplate(), initialData: { caption: 'First' } })
    editor.actions.setField('caption', 'Second')
    expect(editor.render().issues).toEqual([])
    expect(editor.render().html).toContain('Second')
    expect(JSON.parse(editor.exportDocument('json').data).data).toEqual({ caption: 'Second' })
    expect(change).toHaveBeenCalled()
    expectNoBackend()
    creator.destroy(); receiver.destroy(); editor.destroy()
  })

  it('offers local exports without presenting save, publish or PDF as required services', async () => {
    await act(async () => root.render(<TemplateCreator initialTemplate={definition()} />))
    expect(button('Export HTML')).toBeDefined()
    expect(container.textContent).not.toContain('Publish template')
    expect(container.textContent).not.toContain('Save draft')
    await act(async () => button('Export JSON').click())
    expect(JSON.parse(vi.mocked(downloadText).mock.calls[0][0])).toMatchObject({ format: 'gct-template', name: 'Portable document' })
    await act(async () => root.render(<TemplateEditor template={definition()} initialData={{ caption: 'Hello' }} />))
    expect(container.textContent).not.toContain('Save document')
    expect(container.textContent).not.toContain('PDF preview')
    await act(async () => button('Export JSON').click())
    expect(downloadText).toHaveBeenCalledWith(expect.stringContaining('Hello'), expect.stringMatching(/\.json$/), 'application/json')
    expectNoBackend()
  })

  it('preloads voucher data and returns synchronous HTML and JSON without transport or storage', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const project = createEmptyProject()
    project.global.metadata.title = 'Host-owned voucher'
    const instance = createVoucherBuilder({ initialProject: project })
    await act(async () => root.render(<VoucherBuilder instance={instance} theme="light" />))
    const html = instance.exportProject({ format: 'html' })
    const json = instance.exportProject({ format: 'json' })
    expect(html).toMatchObject({ format: 'html', mimeType: 'text/html' })
    expect(html.data).toContain('Host-owned voucher')
    expect(JSON.parse(json.data)).toMatchObject({ project: { global: { metadata: { title: 'Host-owned voucher' } } } })
    expectNoBackend()
    instance.destroy()
  })
})
