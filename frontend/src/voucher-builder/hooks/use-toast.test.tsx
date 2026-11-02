// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ToastProvider, useToast, useToasts } from './use-toast'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('isolates notifications and keeps errors available while ordinary notices expire', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  function Probe({ label }: { label: string }) {
    const notify = useToast()
    const items = useToasts()
    return (
      <section aria-label={label}>
        <button
          onClick={() => {
            notify('Saved')
            notify('Save failed', 'error')
          }}
        >
          Notify
        </button>
        <output>{items.map((item) => item.message).join(', ')}</output>
      </section>
    )
  }
  try {
    await act(async () =>
      root.render(
        <>
          <ToastProvider>
            <Probe label="First" />
          </ToastProvider>
          <ToastProvider>
            <Probe label="Second" />
          </ToastProvider>
        </>,
      ),
    )
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
    expect(container.querySelector('[aria-label=First] output')?.textContent).toBe('Saved, Save failed')
    expect(container.querySelector('[aria-label=Second] output')?.textContent).toBe('')
    await act(async () => vi.advanceTimersByTime(4000))
    expect(container.querySelector('[aria-label=First] output')?.textContent).toBe('Save failed')
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
  expect(vi.getTimerCount()).toBe(0)
})
