// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateCreator } from './TemplateCreator'
import { TemplateEditor } from './TemplateEditor'
import { TemplateCreatorProvider, useTemplateActions, useTemplateDocument } from './hooks'
import { createTemplateCreator, createTemplateEditor } from '../template-core/editing'
import { createInvoiceTemplate } from '../template-core/defaults'
import { createTemplateRevision } from '../template-core/render'
import { resolveTemplateData } from '../template-core/contracts'
import { VoucherBuilder } from '../voucher-builder/VoucherBuilder'

describe('template authoring and personalization surfaces', () => {
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
  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === label || button.getAttribute('aria-label') === label,
    )!
  it('renders the creator and returns HTML through its output event once in Strict Mode', async () => {
    const onExport = vi.fn()
    await act(async () =>
      root.render(
        <StrictMode>
          <TemplateCreator initialTemplate={createInvoiceTemplate()} onExport={onExport} />
        </StrictMode>,
      ),
    )
    expect(container.querySelector('h1')?.textContent).toBe('Studio invoice')
    expect(button('Export HTML').disabled).toBe(false)
    await act(async () => button('Export HTML').click())
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport.mock.calls[0][0]).toMatchObject({ format: 'html', mimeType: 'text/html' })
    expect(onExport.mock.calls[0][0].data).toContain('<!DOCTYPE html>')
    expect(container.querySelector('iframe[title="Template document"]')).not.toBeNull()
  })
  it('exposes data contracts and field authoring without changing the canvas document', async () => {
    const instance = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    const before = instance.getTemplate()
    const frame = container.querySelector<HTMLIFrameElement>('iframe[title="Template document"]')!
    const srcDoc = frame.srcdoc
    act(() => instance.actions.select(before.roots[1]))
    expect(container.querySelector('iframe[title="Template document"]')).toBe(frame)
    expect(frame.srcdoc).toBe(srcDoc)
    act(() => button('Fields').click())
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Insert element"]')?.disabled).toBe(true)
    expect(container.querySelector('[aria-label="Data path"]')?.getAttribute('value')).toBe('invoice.number')
    await act(async () => {
      button('Data contract').click()
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Draft 2020-12')
    expect(document.querySelector('[role=dialog] .code-block--component')?.textContent).toContain(
      'additionalProperties',
    )
    expect(instance.getTemplate()).toEqual(before)
    instance.destroy()
  })
  it('retains authored edits and history when an application output handler throws', async () => {
    const onExport = vi.fn().mockImplementationOnce(() => { throw new Error('Host output failed') })
    const instance = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    await act(async () => root.render(<TemplateCreator instance={instance} onExport={onExport} />))
    const name = container.querySelector<HTMLInputElement>('[aria-label="Element name"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        name,
        'Edited before export',
      )
      name.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    await act(async () => button('Export JSON').click())
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Host output failed')
    expect(name.value).toBe('Edited before export')
    await act(async () => button('Export JSON').click())
    expect(onExport).toHaveBeenCalledTimes(2)
    const draft = JSON.parse(onExport.mock.calls[1][0].data)
    expect(draft.nodes[draft.roots[0]].name).toBe('Edited before export')
    act(() => instance.actions.undo())
    expect(instance.getTemplate().nodes[draft.roots[0]].name).not.toBe('Edited before export')
    instance.destroy()
  })
  it('prevents exporting while a visible page setting has an invalid draft', async () => {
    const onExport = vi.fn()
    await act(async () => root.render(<TemplateCreator initialTemplate={createInvoiceTemplate()} onExport={onExport} />))
    act(() => button('Document settings').click())
    const input = container.querySelector<HTMLInputElement>('[aria-label="Width (mm)"]')!
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setValue.call(input, '12')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    await act(async () => button('Export HTML').click())
    expect(onExport).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Fix the highlighted fields')
    act(() => {
      setValue.call(input, '210')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(input.getAttribute('aria-invalid')).toBe('false')
    await act(async () => button('Export HTML').click())
    expect(onExport).toHaveBeenCalledTimes(1)
  })
  it('keeps provider-scoped documents and commands isolated', () => {
    const a = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const b = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    function Probe({ name }: { name: string }) {
      const title = useTemplateDocument((template) => template.name)
      const actions = useTemplateActions()
      return (
        <button
          onClick={() =>
            actions.edit((draft) => {
              draft.name = name
            })
          }
        >
          {title}
        </button>
      )
    }
    act(() =>
      root.render(
        <>
          <TemplateCreatorProvider instance={a}>
            <Probe name="First" />
          </TemplateCreatorProvider>
          <TemplateCreatorProvider instance={b}>
            <Probe name="Second" />
          </TemplateCreatorProvider>
        </>,
      ),
    )
    act(() => container.querySelector('button')!.click())
    expect(a.getTemplate().name).toBe('First')
    expect(b.getTemplate().name).toBe('Studio invoice')
    a.destroy()
    b.destroy()
  })
  it('blocks exporting incomplete data and enables it when the runtime contract is satisfied', async () => {
    const template = createTemplateRevision(createInvoiceTemplate())
    const editor = createTemplateEditor({ template })
    await act(async () => root.render(<TemplateEditor template={template} instance={editor} />))
    expect(button('Export HTML').disabled).toBe(true)
    expect(container.textContent).toContain('Complete the required values')
    const values = resolveTemplateData(template.template, {}, 'preview').data
    act(() => {
      for (const field of template.template.fields) {
        const path = field.path.split('.')
        const value = path.reduce<unknown>((object, key) => (object as Record<string, unknown>)[key], values)
        editor.actions.setField(field.id, value as never)
      }
    })
    expect(button('Export HTML').disabled).toBe(false)
    expect(container.textContent).toContain('Ready to export')
    expect(container.querySelector('[aria-label="Creator panels"]')).toBeNull()
    editor.destroy()
  })
  it('edits structured array fields through typed rows with undo and contract validation', async () => {
    const template = createTemplateRevision(createInvoiceTemplate())
    const editor = createTemplateEditor({
      template,
      initialData: resolveTemplateData(template.template, {}, 'preview').data,
    })
    await act(async () => root.render(<TemplateEditor template={template} instance={editor} />))
    expect(container.querySelector('textarea[aria-label="Line items *"]')).toBeNull()
    expect(container.querySelectorAll('input[aria-label="Amount *"]')).toHaveLength(2)
    act(() => button('Remove Line items item 1').click())
    act(() => button('Remove Line items item 1').click())
    expect(button('Export HTML').disabled).toBe(true)
    act(() => button('Undo personalization').click())
    expect(button('Export HTML').disabled).toBe(false)
    act(() => button('+ Add item').click())
    expect(container.querySelectorAll('input[aria-label="Amount *"]')).toHaveLength(2)
    editor.destroy()
  })
  it('lets the existing VoucherBuilder consume a plain template through personalization mode', async () => {
    const template = createInvoiceTemplate()
    await act(async () =>
      root.render(
        <VoucherBuilder
          personalization={{
            template,
            initialData: resolveTemplateData(template, {}, 'preview').data,
          }}
        />,
      ),
    )
    expect(container.textContent).toContain('Document editor')
    expect(container.textContent).toContain('Layout protected')
    expect(container.querySelector('[aria-label="Document values"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Library panels"]')).toBeNull()
  })
})
