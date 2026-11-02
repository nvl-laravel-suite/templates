// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { VoucherBuilderProvider } from '../provider'
import { RichTextField } from './rich-text-editor'

it('keeps an edit active while keyboard focus enters formatting and commits when focus leaves', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onChange = vi.fn()
  try {
    await act(async () =>
      root.render(
        <VoucherBuilderProvider>
          <RichTextField label="Text" value="Original" onChange={onChange} />
          <button>Outside</button>
        </VoucherBuilderProvider>,
      ),
    )
    const editor = container.querySelector<HTMLElement>('[role=textbox]')!
    await act(async () => editor.click())
    const bold = container.querySelector<HTMLButtonElement>('[aria-label=Bold]')!
    expect(bold.closest('[role=toolbar]')).not.toBeNull()
    editor.textContent = 'Draft'
    await act(async () => bold.focus())
    expect(editor.getAttribute('data-inline-editing')).toBe('true')
    expect(onChange).not.toHaveBeenCalled()
    const outside = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Outside',
    )!
    await act(async () => outside.focus())
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Draft')
    expect(editor.getAttribute('data-inline-editing')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('preserves the uncommitted draft and selected range when a link dialog opens', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onChange = vi.fn()
  try {
    await act(async () =>
      root.render(
        <VoucherBuilderProvider>
          <RichTextField label="Text" value="Original" onChange={onChange} />
        </VoucherBuilderProvider>,
      ),
    )
    const editor = container.querySelector<HTMLElement>('[role=textbox]')!
    await act(async () => editor.click())
    editor.textContent = 'Uncommitted draft'
    const range = document.createRange()
    range.selectNodeContents(editor)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add Link"]')!.click())
    expect(editor.textContent).toBe('Uncommitted draft')
    expect(range.toString()).toBe('Uncommitted draft')
    expect(onChange).not.toHaveBeenCalled()
    expect(document.querySelector('[role=dialog]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
