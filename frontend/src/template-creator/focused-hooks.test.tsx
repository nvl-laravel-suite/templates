// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createTemplateCreator, createTemplateEditor } from '../template-core/editing'
import { createInvoiceTemplate } from '../template-core/defaults'
import { createTemplateRevision } from '../template-core/render'
import { resolveTemplateData } from '../template-core/contracts'
import {
  TemplateCreatorProvider,
  TemplateEditorProvider,
  useTemplateNode,
  useTemplateDataField,
  useTemplatePersonalization,
  useTemplateCreatorExport,
} from './hooks'
import { TemplateCreator } from './TemplateCreator'
import { TemplateEditor } from './TemplateEditor'

describe('focused template hooks and check navigation', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  it('does not rerender a node subscriber after an unrelated edit', () => {
    const instance = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const id = instance.getTemplate().roots[0]
    const render = vi.fn()
    function Probe() {
      const value = useTemplateNode(id)
      render(value)
      return <span>{value.node?.name}</span>
    }
    act(() =>
      root.render(
        <TemplateCreatorProvider instance={instance}>
          <Probe />
        </TemplateCreatorProvider>,
      ),
    )
    const update = render.mock.calls[0][0].update
    act(() =>
      instance.actions.edit((draft) => {
        draft.name = 'Unrelated'
      }),
    )
    expect(render).toHaveBeenCalledTimes(1)
    act(() => update({ name: 'Updated header' }))
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.calls[1][0].update).toBe(update)
    expect(container.textContent).toBe('Updated header')
  })
  it('keeps creator output commands stable while exporting the latest local document', () => {
    const instance = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const render = vi.fn()
    function Probe() { render(useTemplateCreatorExport()); return null }
    act(() => root.render(<TemplateCreatorProvider instance={instance}><Probe /></TemplateCreatorProvider>))
    const output = render.mock.calls[0][0] as ReturnType<typeof useTemplateCreatorExport>
    act(() => instance.actions.select(null))
    act(() => instance.actions.edit(draft => { draft.name = 'Latest authoring document' }))
    expect(render).toHaveBeenCalledTimes(1)
    expect(output.exportDocument).toBe(instance.exportDocument)
    expect(JSON.parse(output.exportDocument('json').data).name).toBe('Latest authoring document')
    instance.destroy()
  })
  it('subscribes to object values without rerendering for sibling edits or selection', () => {
    const template = createInvoiceTemplate()
    const instance = createTemplateEditor({
      template: createTemplateRevision(template),
      initialData: resolveTemplateData(template, {}, 'preview').data,
    })
    const render = vi.fn()
    function Probe() {
      const value = useTemplateDataField('items')
      render(value)
      return null
    }
    act(() =>
      root.render(
        <TemplateEditorProvider instance={instance}>
          <Probe />
        </TemplateEditorProvider>,
      ),
    )
    act(() => instance.actions.setField('customerName', 'Someone else'))
    act(() => instance.actions.select(template.roots[0]))
    expect(render).toHaveBeenCalledTimes(1)
    act(() => render.mock.calls[0][0].setValue([]))
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.calls[1][0].issues).toContainEqual(
      expect.objectContaining({ code: 'minItems', path: 'invoice.items' }),
    )
  })
  it('exposes a deliberate personalization snapshot and accepts an instance alone', async () => {
    const instance = createTemplateEditor({ template: createTemplateRevision(createInvoiceTemplate()) })
    let snapshot: ReturnType<typeof useTemplatePersonalization> | undefined
    function Probe() {
      snapshot = useTemplatePersonalization()
      return null
    }
    act(() =>
      root.render(
        <TemplateEditorProvider instance={instance}>
          <Probe />
        </TemplateEditorProvider>,
      ),
    )
    expect(snapshot).not.toHaveProperty('undo')
    expect(snapshot).not.toHaveProperty('redo')
    expect(snapshot?.exportDocument).toBe(instance.exportDocument)
    await act(async () => root.render(<TemplateEditor instance={instance} />))
    expect(container.textContent).toContain('Studio invoice')
  })
  it('opens the field inspector from a failed contract check', async () => {
    const template = createInvoiceTemplate()
    template.fields[0].schema = { type: 'string', minLength: 50, maxLength: 2 }
    const instance = createTemplateCreator({ initialTemplate: template })
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    const footer = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('checks to resolve'),
    )!
    await act(async () => {
      footer.click()
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    const review = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Resolve: Minimum length must not exceed maximum length."]',
    )!
    expect(review).not.toBeNull()
    await act(async () => {
      review.click()
      await new Promise((resolve) => setTimeout(resolve, 35))
    })
    expect(container.querySelector<HTMLInputElement>('[aria-label="Data path"]')!.value).toBe(
      'invoice.number',
    )
    expect(container.querySelector<HTMLInputElement>('[aria-label="Minimum length"]')!.value).toBe('50')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(container.querySelector('[aria-label="Field label"]')))
  })
  it('updates output handlers without adding persistence or PDF capabilities', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const first = vi.fn(), second = vi.fn()
    const exportJSON = () => [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Export JSON')!
    await act(async () => root.render(<TemplateCreator instance={creator} onExport={first} />))
    await act(async () => exportJSON().click())
    expect(first).toHaveBeenCalledTimes(1)
    await act(async () => root.render(<TemplateCreator instance={creator} onExport={second} />))
    await act(async () => exportJSON().click())
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    await act(async () => root.render(<TemplateCreator instance={creator} />))
    expect(container.textContent).toContain('Export HTML')
    expect(container.textContent).toContain('Export JSON')
    expect(container.textContent).not.toContain('Save draft')
    expect(container.textContent).not.toContain('Publish template')
    creator.destroy()
    const editor = createTemplateEditor({
      template: createTemplateRevision(createInvoiceTemplate()),
    })
    await act(async () => root.render(<TemplateEditor instance={editor} onExport={first} />))
    await act(async () => exportJSON().click())
    expect(first).toHaveBeenCalledTimes(2)
    expect(JSON.parse(first.mock.calls[1][0].data)).toMatchObject({ format: 'gct-personalization', data: {} })
    expect(container.textContent).not.toContain('Save document')
    expect(container.textContent).not.toContain('PDF preview')
    editor.destroy()
  })
})
