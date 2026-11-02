// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoucherBuilder } from '../VoucherBuilder'
import { createVoucherBuilder, type VoucherBuilderInstance } from '../instance'
import type { VoucherActions } from '../api-types'
import { getParentContext } from '../engine/graph'

describe('docked editor', () => {
  let instance: VoucherBuilderInstance
  let actions: VoucherActions
  let root: Root
  let container: HTMLDivElement
  let width: number
  let observers: Array<() => void>
  beforeEach(() => {
    width = 1280
    observers = []
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        callback: () => void
        constructor(callback: ResizeObserverCallback) {
          this.callback = () =>
            callback(
              [{ contentRect: { width, height: 700 } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            )
          observers.push(this.callback)
        }
        observe() {
          this.callback()
        }
        unobserve() {}
        disconnect() {}
      },
    )
    instance = createVoucherBuilder()
    actions = instance.actions
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    instance.destroy()
    vi.unstubAllGlobals()
  })
  it('lists all sections and moves the inspector into a drawer when space is limited', async () => {
    await act(async () => root.render(<VoucherBuilder instance={instance} theme="dark" />))
    expect(container.querySelectorAll('[aria-label="Document sections"] input[type="radio"]')).toHaveLength(3)
    expect(container.querySelectorAll('.nc-library-dock .nc-layer-section')).toHaveLength(1)
    expect(container.querySelector('.nc-inspector-dock')).not.toBeNull()
    expect(container.querySelector('.nc-canvas .nc-toolbar')).toBeNull()
    await act(async () => {
      width = 1000
      observers.forEach((notify) => notify())
    })
    expect(container.querySelector('.nc-inspector-dock')?.hasAttribute('hidden')).toBe(true)
    const open = container.querySelector<HTMLButtonElement>('[aria-label="Open inspector"]')!
    expect(open).not.toBeNull()
    await act(async () => open.click())
    expect(container.querySelector('[data-slot="sheet-content"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="sheet-content"]')?.closest('.dark')).not.toBeNull()
    expect(container.querySelector('[data-slot="sheet-title"]')?.textContent).toBe('Inspector')
    await act(async () => {
      width = 390
      observers.forEach((notify) => notify())
    })
    expect(container.querySelector('.nc-library-dock')?.hasAttribute('hidden')).toBe(true)
    expect(container.querySelector('[aria-label="Open library"]')).not.toBeNull()
  }, 15_000)
  it('offers one first-use action that inserts into the selected section and respects viewer eligibility', async () => {
    const section = actions.getProject().sections[1].id
    actions.setActiveSectionId(section)
    await act(async () => root.render(<VoucherBuilder instance={instance} features={{ security: false }} />))
    const start = container.querySelector('.nc-empty-canvas-guide')!
    expect(start.textContent).toContain('Add content to Section 2')
    expect(container.querySelectorAll('.nc-section-empty')).toHaveLength(3)
    await act(async () => [...start.querySelectorAll('button')].find(button => button.textContent?.includes('Add a block'))!.click())
    const heading = [...container.querySelectorAll<HTMLButtonElement>('.nc-library-item')].find(button => button.textContent?.startsWith('Heading'))!
    await act(async () => heading.click())
    expect(actions.getProject().sections[1].blockIds).toHaveLength(1)
    expect(container.querySelector('.nc-empty-canvas-guide')).toBeNull()
    await act(async () => actions.undo())
    expect(container.querySelector('.nc-empty-canvas-guide')).not.toBeNull()
    await act(async () => root.render(<VoucherBuilder instance={instance} mode="viewer" features={{ security: false }} />))
    expect(container.querySelector('.nc-empty-canvas-guide')).toBeNull()
    expect(container.querySelector('[aria-label="Open library"]')).toBeNull()
  })
  it('keeps section navigation, canvas selection and block insertion in the same scope', async () => {
    await act(async () => root.render(<VoucherBuilder instance={instance} />))
    const section2 = container.querySelectorAll<HTMLInputElement>(
      '[aria-label="Document sections"] input[type="radio"]',
    )[1]
    await act(async () => section2.click())
    const sections = actions.getProject().sections
    expect(
      container.querySelector('.nc-document-section[data-selected]')?.getAttribute('data-section-id'),
    ).toBe(sections[1].id)
    expect(container.querySelector('[aria-label="Design inspector"] h2')?.textContent).toBe('Section 2')
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Add block to Section 2"]')!.click(),
    )
    const heading = [...container.querySelectorAll<HTMLButtonElement>('.nc-library-item')].find((button) =>
      button.textContent?.startsWith('Heading'),
    )!
    await act(async () => heading.click())
    expect(actions.getProject().sections[1].blockIds).toHaveLength(1)
    expect(actions.getProject().sections[0].blockIds).toHaveLength(0)
    expect(container.querySelector('.nc-document-section[data-selected]')).toBeNull()
    const section3 = container.querySelector<HTMLElement>('[aria-label="Section 3 canvas"]')!
    await act(async () =>
      section3.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    )
    expect(
      container.querySelector('.nc-document-section[data-selected]')?.getAttribute('data-section-id'),
    ).toBe(sections[2].id)
    expect(container.querySelector('[aria-label="Design inspector"] h2')?.textContent).toBe('Section 3')
  })
  it('duplicates a nested selection from the dock without losing its parent', async () => {
    actions.addBlock(actions.getProject().sections[0].id, 'row')
    const row = Object.values(actions.getProject().blocks).find((b) => b.type === 'row')!
    const columnId = (row.content as { columnIds: string[] }).columnIds[0]
    actions.addBlockToColumn(columnId, 'text')
    const childId = actions.getProject().columnBlocks[columnId][0]
    actions.setActiveBlock(childId)
    await act(async () => root.render(<VoucherBuilder instance={instance} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Block actions"]')!.click())
    const duplicate = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) =>
      item.textContent?.includes('Duplicate'),
    )!
    expect(duplicate).not.toBeUndefined()
    await act(async () => duplicate.click())
    expect(actions.getProject().columnBlocks[columnId]).toHaveLength(2)
    const newId = actions.getProject().columnBlocks[columnId][1]
    expect(getParentContext(actions.getProject(), newId)).toEqual({
      kind: 'container',
      parentId: columnId,
      index: 1,
    })
    await act(async () => actions.undo())
    expect(actions.getProject().columnBlocks[columnId]).toEqual([childId])
  })
  it('renders a read-only document in viewer mode and ignores editing shortcuts', async () => {
    actions.addBlock(actions.getProject().sections[0].id, 'list')
    const original = actions.getProject()
    await act(async () =>
      root.render(<VoucherBuilder instance={instance} mode="viewer" features={{ security: false }} />),
    )
    expect(container.querySelector('iframe[title="Voucher document"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Drag block to reorder"]')).toBeNull()
    await act(async () =>
      container
        .querySelector('[aria-label="Voucher canvas"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })),
    )
    expect(actions.getProject()).toEqual(original)
  })
  it.each(['keyboard', 'menu'])('confirms %s deletion and restores the blocks with Undo', async (source) => {
    const section = actions.getProject().sections[0].id
    actions.addBlock(section, 'text')
    const id = actions.getProject().sections[0].blockIds[0]
    actions.setActiveBlock(id)
    await act(async () => root.render(<VoucherBuilder instance={instance} features={{ security: false }} />))
    if (source === 'keyboard') {
      await act(async () =>
        container
          .querySelector('[aria-label="Voucher canvas"]')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })),
      )
    } else {
      await act(async () =>
        container.querySelector<HTMLButtonElement>('[aria-label="Block actions"]')!.click(),
      )
      const remove = [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent?.trim() === 'Delete',
      )!
      await act(async () => remove.click())
    }
    expect(actions.getProject().blocks[id]).toBeDefined()
    const dialog = container.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Delete selected block?')
    const confirm = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Delete blocks',
    )!
    await act(async () => confirm.click())
    expect(actions.getProject().blocks[id]).toBeUndefined()
    await act(async () => actions.undo())
    expect(actions.getProject().sections[0].blockIds).toEqual([id])
  })
  it('cancels keyboard deletion without changing the document or selection', async () => {
    actions.addBlock(actions.getProject().sections[0].id, 'text')
    const id = actions.getProject().sections[0].blockIds[0]
    actions.setActiveBlock(id)
    const before = actions.getProject()
    await act(async () => root.render(<VoucherBuilder instance={instance} features={{ security: false }} />))
    await act(async () =>
      container
        .querySelector('[aria-label="Voucher canvas"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })),
    )
    const dialog = container.querySelector('[role="alertdialog"]')!
    const cancel = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Cancel',
    )!
    await act(async () => cancel.click())
    expect(actions.getProject()).toEqual(before)
    expect(container.querySelector('.nc-selected')?.getAttribute('data-block-id')).toBe(id)
  })
  it.each(['admin', 'viewer'] as const)('shows only available shortcut help in %s mode', async (mode) => {
    await act(async () =>
      root.render(
        <VoucherBuilder
          instance={instance}
          mode={mode}
          features={{ commandPalette: false, clipboard: false, undoRedo: false, security: false }}
        />,
      ),
    )
    await act(async () =>
      container
        .querySelector('[aria-label="Voucher canvas"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true, cancelable: true }),
        ),
    )
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Keyboard shortcuts')
    expect(dialog.textContent).not.toContain('Save project')
    expect(dialog.textContent).not.toContain('Command palette')
    expect(dialog.textContent).not.toContain('Undo')
    expect(dialog.textContent).not.toContain('Redo')
    expect(dialog.textContent).not.toContain('Copy block')
    expect(dialog.textContent?.includes('Duplicate block')).toBe(mode === 'admin')
    expect(dialog.textContent?.includes('Edit text inline')).toBe(mode === 'admin')
  })
  it('warns before a clipped export while keeping a JSON backup available', async () => {
    actions.addBlock(actions.getProject().sections[0].id, 'heading')
    actions.updateSection(actions.getProject().sections[1].id, { height: 100 })
    await act(async () => root.render(<VoucherBuilder instance={instance} />))
    const exportButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === 'Export',
    )!
    await act(async () => exportButton.click())
    const dialog = container.querySelector('[data-slot="dialog-content"]')!
    const before = actions.getProject()
    await act(async () =>
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })),
    )
    expect(actions.getProject()).toEqual(before)
    expect(dialog.textContent).toContain('Sections exceed the page by 3 mm')
    const exportHTML = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Export HTML'),
    )!
    expect(exportHTML.disabled).toBe(true)
    const json = dialog.querySelector<HTMLInputElement>('input[value="json"]')!
    await act(async () => json.click())
    const exportJSON = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Export JSON'),
    )!
    expect(exportJSON.disabled).toBe(false)
  })
})
