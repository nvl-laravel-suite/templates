// @vitest-environment jsdom

import { act, StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useVoucherActions,
  useVoucherBlock,
  useVoucherChange,
  useVoucherEvent,
  useVoucherHistory,
  useVoucherProject,
  useVoucherSelection,
  useVoucherExport,
  useVoucherTemplates,
} from './use-voucher-builder'
import { VoucherBuilderProvider, type VoucherBuilderProviderProps } from '../provider'
import { createVoucherBuilder, type VoucherBuilderInstance } from '../instance'
import { createEmptyProject } from '../lib/empty-project'

function Probe({ children }: { children: () => ReactNode }) {
  return children()
}

describe('public voucher hooks', () => {
  let root: Root
  let container: HTMLDivElement
  let instance: VoucherBuilderInstance
  function render(children: ReactNode, props: Omit<VoucherBuilderProviderProps, 'children'> = {}) {
    root.render(
      <VoucherBuilderProvider instance={instance} {...props}>
        {children}
      </VoucherBuilderProvider>,
    )
  }
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('fetch', vi.fn())
    instance = createVoucherBuilder()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    instance.destroy()
    container.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('requires a provider with a useful integration error', () => {
    expect(() =>
      act(() =>
        root.render(
          <Probe>
            {() => {
              useVoucherActions()
              return null
            }}
          </Probe>,
        ),
      ),
    ).toThrow('VoucherBuilderProvider')
  })

  it('does not rerender object selectors for unrelated document changes', () => {
    let renders = 0
    act(() =>
      render(
        <Probe>
          {() => {
            const { title } = useVoucherProject((p) => ({ title: p.global.metadata.title }))
            renders++
            return title
          }}
        </Probe>,
      ),
    )
    act(() => instance.actions.updateFrame({ imageUrl: null, opacity: 0.5 }))
    expect(renders).toBe(1)
    act(() => instance.actions.updateMetadata({ title: 'New title' }))
    expect(container.textContent).toBe('New title')
    expect(renders).toBe(2)
  })

  it('exposes stable commands with automatic Undo, selection, and focused block updates', () => {
    let actions!: ReturnType<typeof useVoucherActions>
    let selection!: ReturnType<typeof useVoucherSelection>
    let history!: ReturnType<typeof useVoucherHistory>
    let block!: ReturnType<typeof useVoucherBlock>
    act(() =>
      render(
        <Probe>
          {() => {
            actions = useVoucherActions()
            selection = useVoucherSelection()
            history = useVoucherHistory()
            block = useVoucherBlock(selection.activeBlockId)
            return null
          }}
        </Probe>,
      ),
    )
    const original = actions
    act(() => actions.addBlock(instance.getProject().sections[0].id, 'heading'))
    expect(actions).toBe(original)
    expect(selection.activeBlock?.type).toBe('heading')
    expect(selection.selectedBlocks).toHaveLength(1)
    expect(history.canUndo).toBe(true)
    act(() => block.updateContent({ text: 'Edited through a hook' }))
    expect(block.block?.content).toMatchObject({ text: 'Edited through a hook' })
    act(() => history.undo())
    expect(block.block?.content).not.toMatchObject({ text: 'Edited through a hook' })
    act(() => history.undo())
    expect(history.canRedo).toBe(true)
    expect(Object.keys(instance.getProject().blocks)).toHaveLength(0)
  })

  it('filters typed events, uses the latest handler, and cleans up', () => {
    const first = vi.fn()
    const latest = vi.fn()
    function Listener({ handler }: { handler: typeof first }) {
      useVoucherEvent('project.reset', handler)
      return null
    }
    act(() => render(<Listener handler={first} />))
    act(() => instance.actions.updateMetadata({ title: 'Unrelated' }))
    act(() => instance.actions.resetProject())
    expect(first).toHaveBeenCalledTimes(1)
    act(() => render(<Listener handler={latest} />))
    act(() => instance.actions.resetProject())
    expect(first).toHaveBeenCalledTimes(1)
    expect(latest).toHaveBeenCalledTimes(1)
    act(() => root.render(null))
    instance.actions.resetProject()
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it('debounces changes with the latest callback and cancels on unmount', () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const latest = vi.fn()
    function Listener({ handler }: { handler: typeof first }) {
      useVoucherChange(handler, 50)
      return null
    }
    act(() => render(<Listener handler={first} />))
    act(() => instance.actions.updateFrame({ imageUrl: 'one.png', opacity: 1 }))
    act(() => instance.actions.updateFrame({ imageUrl: 'two.png', opacity: 1 }))
    act(() => render(<Listener handler={latest} />))
    act(() => vi.advanceTimersByTime(50))
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
    expect(latest.mock.calls[0][0].frame.imageUrl).toBe('two.png')
    act(() => instance.actions.updateFrame({ imageUrl: 'three.png', opacity: 1 }))
    act(() => root.render(null))
    act(() => vi.runAllTimers())
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it('renders initial data synchronously in Strict Mode without echoing hydration', async () => {
    const onAction = vi.fn()
    const onChange = vi.fn()
    const project = createEmptyProject()
    project.global.metadata.title = 'Initial project'
    const renderInitial = (initialProject: typeof project) =>
      root.render(
        <StrictMode>
          <VoucherBuilderProvider initialProject={initialProject} onAction={onAction} onChange={onChange}>
            <Probe>{() => useVoucherProject((p) => p.global.metadata.title)}</Probe>
          </VoucherBuilderProvider>
        </StrictMode>,
      )
    await act(async () => renderInitial(project))
    expect(container.textContent).toBe('Initial project')
    expect(onAction).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => renderInitial(createEmptyProject()))
    expect(container.textContent).toBe('Initial project')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('isolates sibling providers and keeps constructor callbacks for supplied instances', () => {
    const onAction = vi.fn()
    const other = createVoucherBuilder({ onAction })
    let first!: ReturnType<typeof useVoucherActions>
    let second!: ReturnType<typeof useVoucherActions>
    act(() =>
      root.render(
        <>
          <VoucherBuilderProvider instance={instance}>
            <Probe>
              {() => {
                first = useVoucherActions()
                return useVoucherProject((p) => p.global.metadata.title)
              }}
            </Probe>
          </VoucherBuilderProvider>
          <VoucherBuilderProvider instance={other}>
            <Probe>
              {() => {
                second = useVoucherActions()
                return useVoucherProject((p) => p.global.metadata.title)
              }}
            </Probe>
          </VoucherBuilderProvider>
        </>,
      ),
    )
    act(() => first.updateMetadata({ title: 'First' }))
    expect(onAction).not.toHaveBeenCalled()
    act(() => second.updateMetadata({ title: 'Second' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(instance.getProject().global.metadata.title).toBe('First')
    expect(other.getProject().global.metadata.title).toBe('Second')
    act(() => root.render(null))
    other.destroy()
  })

  it('shares template CRUD and export results without duplicate host callbacks', async () => {
    const onExport = vi.fn()
    const onExportComplete = vi.fn()
    const onTemplateAdd = vi.fn()
    let exports!: ReturnType<typeof useVoucherExport>
    let templates!: ReturnType<typeof useVoucherTemplates>
    let second!: ReturnType<typeof useVoucherTemplates>
    await act(async () =>
      render(
        <>
          <Probe>
            {() => {
              exports = useVoucherExport()
              templates = useVoucherTemplates()
              return null
            }}
          </Probe>
          <Probe>
            {() => {
              second = useVoucherTemplates()
              return null
            }}
          </Probe>
        </>,
        { onExport, onExportComplete, onTemplateAdd },
      ),
    )
    let id = ''
    act(() => {
      id = templates.add({ name: 'My template' }).id
    })
    expect(second.templates.some((t) => t.id === id)).toBe(true)
    expect(onTemplateAdd).toHaveBeenCalledTimes(1)
    let result!: Awaited<ReturnType<typeof exports.exportProject>>
    await act(async () => {
      result = await exports.exportProject({ format: 'html', documentTitle: 'Custom export' })
    })
    expect(result.data).toContain('<title>Custom export</title>')
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExportComplete).toHaveBeenCalledWith(result)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('creates an owned editor when a previously supplied instance is removed', () => {
    act(() => render(<Probe>{() => useVoucherProject((project) => project.global.metadata.title)}</Probe>))
    const project = createEmptyProject()
    project.global.metadata.title = 'Owned editor'
    act(() =>
      root.render(
        <VoucherBuilderProvider initialProject={project}>
          <Probe>{() => useVoucherProject((project) => project.global.metadata.title)}</Probe>
        </VoucherBuilderProvider>,
      ),
    )
    expect(container.textContent).toBe('Owned editor')
    act(() => instance.actions.updateMetadata({ title: 'Old supplied editor' }))
    expect(container.textContent).toBe('Owned editor')
  })
})
