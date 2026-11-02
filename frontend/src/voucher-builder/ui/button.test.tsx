// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { Button as NativeButton } from 'themelia-react-ui/base/buttons'
import { Button } from './button'

it('preserves explicit native presentation and disabled behavior through the legacy adapter', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const click = vi.fn()
  try {
    await act(async () =>
      root.render(
        <>
          <NativeButton tone="warning" buttonStyle="ghost" disabled>
            Native
          </NativeButton>
          <Button tone="warning" buttonStyle="ghost" disabled onClick={click}>
            Adapted
          </Button>
        </>,
      ),
    )
    const [native, adapted] = container.querySelectorAll('button')
    expect(adapted.className).toBe(native.className)
    expect(adapted.disabled).toBe(true)
    await act(async () => adapted.click())
    expect(click).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
