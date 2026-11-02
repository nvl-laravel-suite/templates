// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateCreator } from './TemplateCreator'
import { TemplateEditor } from './TemplateEditor'
import { TemplateStudioDemo } from './demo'
import { TemplateCanvas } from './canvas'
import { CommitInput, DataInput } from './controls'
import { createInvoiceTemplate } from '../template-core/defaults'
import { createTemplateRevision } from '../template-core/render'
import { resolveTemplateData } from '../template-core/contracts'
import { createTemplateCreator } from '../template-core/editing'
import { WorkspaceGrid } from './workspace-panel'

describe('workspace interaction regressions', () => {
  let root: Root
  let container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    localStorage.clear()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const button = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.getAttribute('aria-label') === label || button.textContent?.trim() === label,
    )!
  const input = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
  const change = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(
        element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value',
      )!.set!.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => element.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  }
  it('keeps responsive controls in reading order without remounting their unfinished drafts', async () => {
    const observers = new Map<Element, () => void>()
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: () => void) {}
      observe(element: Element) { observers.set(element, this.callback) }
      disconnect() {}
    })
    await act(async () => root.render(<div className="tc-shell"><WorkspaceGrid prioritizeInspector>
      <section key="navigation" aria-label="Navigation"><button>Choose variation</button></section>
      <section key="preview" aria-label="Preview"><button>Preview action</button></section>
      <section key="controls" aria-label="Controls"><CommitInput label="Variation draft" value="Original" onCommit={() => {}} /></section>
    </WorkspaceGrid></div>))
    const shell = container.querySelector<HTMLElement>('.tc-shell')!
    let width = 900
    shell.getBoundingClientRect = () => ({ width }) as DOMRect
    const resize = observers.get(shell)!
    expect(resize).toBeDefined()
    const draft = input('Variation draft')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(draft, 'Unfinished')
      draft.dispatchEvent(new Event('input', { bubbles: true }))
      resize()
    })
    const order = () => [...container.querySelectorAll('.tc-body > section')].map(element => element.getAttribute('aria-label'))
    expect(order()).toEqual(['Navigation', 'Controls', 'Preview'])
    width = 1280
    act(resize)
    expect(order()).toEqual(['Navigation', 'Preview', 'Controls'])
    expect(input('Variation draft')).toBe(draft)
    expect(draft.value).toBe('Unfinished')
  })
  it.each([false, true])(
    'cancels a field draft before the parent handles Escape (multiline=%s)',
    async (multiline) => {
      const commit = vi.fn(),
        parentKey = vi.fn()
      await act(async () =>
        root.render(
          <div onKeyDown={parentKey}>
            <CommitInput label="Draft" value="Committed" onCommit={commit} multiline={multiline} />
          </div>,
        ),
      )
      const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>('[aria-label="Draft"]')!
      await act(async () => {
        field.focus()
        Object.getOwnPropertyDescriptor(
          multiline ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value',
        )!.set!.call(field, 'Uncommitted')
        field.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () =>
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
      )
      expect(field.value).toBe('Committed')
      expect(document.activeElement).not.toBe(field)
      expect(commit).not.toHaveBeenCalled()
      expect(parentKey).not.toHaveBeenCalled()
    },
  )
  it('retains an invalid JSON draft while advanced settings are collapsed', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    creator.actions.select(creator.getTemplate().roots[0])
    await act(async () => root.render(<TemplateCreator instance={creator} />))
    const toggle = button('Advanced settings')
    await act(async () => toggle.click())
    const attributes = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="HTML attributes"]')!
    await act(async () => change(attributes, '{unfinished'))
    expect(attributes.getAttribute('aria-invalid')).toBe('true')
    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).toContain('Needs attention')
    await act(async () => toggle.click())
    expect(
      container.querySelector<HTMLTextAreaElement>('textarea[aria-label="HTML attributes"]')?.value,
    ).toBe('{unfinished')
    expect(attributes.getAttribute('aria-invalid')).toBe('true')
    await act(async () => change(attributes, '{}'))
    expect(attributes.getAttribute('aria-invalid')).toBe('false')
    expect(container.textContent).not.toContain('Needs attention')
    creator.destroy()
  })
  it('uses multiline controls for bounded prose while keeping formatted values on one line', () => {
    const onChange = vi.fn()
    const base = { id: 'message', path: 'inputs.message', label: 'Gift message', description: '', required: true, editable: true }
    act(() => root.render(<>
      <DataInput field={{ ...base, schema: { type: 'string', maxLength: 500 } }} value="Enjoy your experience" onChange={onChange} />
      <DataInput field={{ ...base, id: 'email', path: 'inputs.email', label: 'Contact email', schema: { type: 'string', format: 'email', maxLength: 500 } }} value="hello@example.com" onChange={() => {}} />
    </>))
    const message = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Gift message *"]')!
    expect(message).not.toBeNull()
    change(message, 'A gift for you.\nEnjoy every moment.')
    expect(onChange).toHaveBeenCalledWith('A gift for you.\nEnjoy every moment.')
    expect(container.querySelector('input[aria-label="Contact email *"]')?.getAttribute('type')).toBe('email')
  })
  it('keeps page settings open through successive dimension edits', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    await act(async () => root.render(<TemplateCreator instance={creator} />))
    act(() => button('Document settings').click())
    change(input('Width (mm)'), '215.9')
    change(input('Height (mm)'), '279.4')
    expect(container.querySelector('[aria-label="Paper size"]')).not.toBeNull()
    expect(creator.getTemplate().page).toMatchObject({ widthMm: 215.9, heightMm: 279.4 })
    creator.destroy()
  })
  it('preserves in-memory personalization while switching workspaces in Strict Mode', async () => {
    await act(async () =>
      root.render(
        <StrictMode>
          <TemplateStudioDemo />
        </StrictMode>,
      ),
    )
    await act(async () => button('Personalize').click())
    change(input('Customer name *'), 'Local customer')
    act(() => button('Template creator').click())
    await act(async () => button('Personalize').click())
    expect(input('Customer name *').value).toBe('Local customer')
  })
  it('represents false and an empty enum value without treating them as missing', async () => {
    const onBoolean = vi.fn()
    const onEnum = vi.fn()
    const base = {
      id: 'value',
      path: 'value',
      label: 'Value',
      description: '',
      required: true,
      editable: true,
    }
    act(() =>
      root.render(
        <>
          <DataInput
            field={{ ...base, label: 'Confirmed', schema: { type: 'boolean' } }}
            value={undefined}
            onChange={onBoolean}
          />
          <DataInput
            field={{ ...base, label: 'Choice', schema: { type: 'string', enum: ['', 'Other'] } }}
            value={undefined}
            onChange={onEnum}
          />
        </>,
      ),
    )
    const select = async (label: string, text: string) => {
      await act(async () =>
        container.querySelector<HTMLButtonElement>(`[role="combobox"][aria-label="${label}"]`)!.click(),
      )
      const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (option) => option.textContent?.trim() === text,
      )!
      await act(async () => option.click())
    }
    await select('Confirmed *', 'No')
    await select('Choice *', '(Empty value)')
    expect(onBoolean).toHaveBeenCalledWith(false)
    expect(onEnum).toHaveBeenCalledWith('')
  })
  it('retains a required empty string when its contract allows it', () => {
    const onChange = vi.fn()
    act(() =>
      root.render(
        <DataInput
          field={{
            id: 'note',
            path: 'note',
            label: 'Note',
            description: '',
            required: true,
            editable: true,
            schema: { type: 'string' },
          }}
          value="Before"
          onChange={onChange}
        />,
      ),
    )
    change(input('Note *'), '')
    expect(onChange).toHaveBeenCalledWith('')
  })
  it('automatically applies valid stylesheet edits before changing panels', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    await act(async () => root.render(<TemplateCreator instance={creator} />))
    act(() => button('Setup').click())
    act(() => button('Styles').click())
    change(
      container.querySelector<HTMLTextAreaElement>('[aria-label="Stylesheet"]')!,
      '.example { color: red }',
    )
    act(() => button('Build').click())
    act(() => button('Fields').click())
    expect(creator.getTemplate().styles.css).toBe('.example { color: red }')
    creator.destroy()
  })
  const menuAction = async (label: string) => {
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === label,
    )!
    expect(item).toBeDefined()
    await act(async () => item.click())
  }
  it('saves a new reusable-block version and inserts the explicitly selected version', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    const id = creator.actions.insert('p')
    creator.actions.select(id)
    const blockId = creator.actions.saveBlock(id, 'Reusable paragraph')
    try {
      await act(async () => root.render(<TemplateCreator instance={creator} />))
      await act(async () => button('Library').click())
      await act(async () => button('Reusable blocks').click())
      await act(async () => button('Actions for block Reusable paragraph').click())
      await menuAction('Save new version')
      expect(
        creator
          .getTemplate()
          .blocks.filter((block) => block.id === blockId)
          .map((block) => block.version),
      ).toEqual([1, 2])
      await act(async () => button('Insert block').click())
      expect(
        Object.values(creator.getTemplate().nodes).some(
          (node) => node.kind === 'block' && node.blockId === blockId && node.version === 1,
        ),
      ).toBe(true)
    } finally {
      creator.destroy()
    }
  })
  it('inserts an image asset, protects its binding, and allows removal after Undo', async () => {
    const creator = createTemplateCreator({ initialTemplate: createInvoiceTemplate() })
    creator.actions.edit((draft) => {
      draft.assets.push({
        id: 'asset_logo',
        name: 'Logo',
        kind: 'image',
        url: 'https://example.com/logo.png',
        mimeType: 'image/png',
      })
    })
    try {
      await act(async () => root.render(<TemplateCreator instance={creator} />))
      await act(async () => button('Library').click())
      await act(async () => button('Assets').click())
      await act(async () => button('Insert image').click())
      await act(async () => button('Actions for asset Logo').click())
      await menuAction('Remove asset')
      expect(creator.getTemplate().assets).toHaveLength(1)
      expect(container.textContent).toContain('Remove this asset’s bindings before deleting it.')
      await act(async () => button('Undo').click())
      await act(async () => button('Actions for asset Logo').click())
      await menuAction('Remove asset')
      expect(creator.getTemplate().assets).toHaveLength(0)
      expect(container.textContent).toContain('No assets yet')
    } finally {
      creator.destroy()
    }
  })
  it('shows a provided field as a named fact without an editable input', async () => {
    const template = createInvoiceTemplate()
    template.fields[0].editable = false
    const data = resolveTemplateData(template, {}, 'preview').data
    await act(async () =>
      root.render(<TemplateEditor template={createTemplateRevision(template)} initialData={data} />),
    )
    expect(container.querySelector('.tc-data-field')?.textContent).toContain(template.fields[0].label)
    expect(
      container.querySelector('.tc-data-field')?.querySelector('input,textarea,[role=combobox]'),
    ).toBeNull()
  })
  it('keeps iframe selection callbacks current and shrinks the preview after content removal', async () => {
    const observers: Array<() => void> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback)
        }
        observe() {}
        disconnect() {}
      },
    )
    const first = vi.fn()
    const second = vi.fn()
    const template = createInvoiceTemplate()
    await act(async () =>
      root.render(<TemplateCanvas template={template} selectedId={null} onSelect={first} />),
    )
    const frame = container.querySelector('iframe')!
    const doc = frame.contentDocument!
    doc.body.innerHTML =
      '<main class="template-document"><span data-template-node-id="selected">Text</span></main>'
    const page = doc.querySelector('main')!
    let height = 2400
    Object.defineProperty(page, 'scrollHeight', { get: () => height })
    act(() => frame.dispatchEvent(new Event('load')))
    expect(parseFloat(frame.style.height)).toBe(2400)
    await act(async () =>
      root.render(<TemplateCanvas template={template} selectedId={null} onSelect={second} />),
    )
    act(() => doc.querySelector('span')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('selected')
    height = 1200
    act(() => observers.at(-1)!())
    await act(async () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    expect(parseFloat(frame.style.height)).toBe(1200)
  })
  it('fits the whole rendered wrapper and rounds up to avoid an internal preview scrollbar', async () => {
    await act(async () => root.render(<TemplateCanvas template={createInvoiceTemplate()} selectedId={null} onSelect={() => {}} />))
    const frame = container.querySelector('iframe')!, doc = frame.contentDocument!
    doc.body.innerHTML = '<table><tbody><tr><td><div class="template-document">Email content</div></td></tr></tbody></table>'
    const page = doc.querySelector<HTMLElement>('.template-document')!, outer = doc.querySelector('table')!
    Object.defineProperty(page, 'scrollHeight', { value: 1400 })
    outer.getBoundingClientRect = () => ({ bottom: 1432.25, height: 1432.25 }) as DOMRect
    act(() => frame.dispatchEvent(new Event('load')))
    expect(parseFloat(frame.style.height)).toBe(1433)
  })
  it('keeps scrolling keyboard-accessible and scrollbar suppression inside the live preview only', async () => {
    await act(async () => root.render(<TemplateCanvas template={createInvoiceTemplate()} selectedId={null} onSelect={() => {}} />))
    const frame = container.querySelector('iframe')!, doc = frame.contentDocument!
    doc.body.innerHTML = '<main class="template-document">Preview</main>'
    act(() => frame.dispatchEvent(new Event('load')))
    expect(container.querySelector<HTMLElement>('[aria-label="Template canvas"]')!.tabIndex).toBe(0)
    expect(doc.querySelector('style[data-template-preview-chrome]')?.textContent).toContain('scrollbar-width:none')
    expect(frame.srcdoc).not.toContain('data-template-preview-chrome')
    act(() => frame.dispatchEvent(new Event('load')))
    expect(doc.querySelectorAll('style[data-template-preview-chrome]')).toHaveLength(1)
  })
  it('returns the complete HTML output to the host without creating a download or PDF dialog', async () => {
    const createObjectURL = vi.fn()
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL })
    const template = createInvoiceTemplate()
    const onExport = vi.fn()
    await act(async () =>
      root.render(
        <TemplateEditor
          template={createTemplateRevision(template)}
          initialData={resolveTemplateData(template, {}, 'preview').data}
          onExport={onExport}
        />,
      ),
    )
    await act(async () => button('Export HTML').click())
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport.mock.calls[0][0]).toMatchObject({ format: 'html', mimeType: 'text/html' })
    expect(onExport.mock.calls[0][0].data).toContain('<!DOCTYPE html>')
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
