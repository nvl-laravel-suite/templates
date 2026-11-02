// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from 'themelia-react-ui/base/buttons'
import { InspectorSection } from './inspector-section'
import { SettingBlock } from '../voucher-builder/builder/settings/primitives/setting-block'

describe('native accordion settings sections', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('makes the inspector heading the disclosure control and retains invalid drafts when closed', async () => {
    await act(async () => root.render(<InspectorSection title="Advanced settings" defaultOpen><textarea aria-label="Draft" defaultValue="Original" /></InspectorSection>))
    const heading = container.querySelector('h2, h3')!
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Advanced settings"]')!
    expect(heading?.contains(trigger)).toBe(true)
    expect(trigger.textContent).toContain('Advanced settings')
    const draft = container.querySelector<HTMLTextAreaElement>('[aria-label="Draft"]')!
    expect(trigger.getAttribute('aria-controls')).toBe(draft.closest('[role="region"]')?.id)
    draft.value = '{unfinished'
    await act(async () => draft.setAttribute('aria-invalid', 'true'))
    await act(async () => trigger.click())
    await vi.waitFor(() => expect(draft.closest('[hidden]')).not.toBeNull())
    expect(container.querySelector('[aria-label="Draft"]')).toBe(draft)
    expect(trigger.textContent).toContain('Needs attention')
    expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe('Needs attention')
    await act(async () => trigger.click())
    expect(draft.value).toBe('{unfinished')
    expect(draft.closest('[hidden]')).toBeNull()
  })

  it('retains setting drafts and keeps sibling actions independent of disclosure', async () => {
    const reset = vi.fn()
    await act(async () => root.render(<SettingBlock label="Colors" defaultOpen={false} description="Document colors" action={<Button onClick={reset}>Reset colors</Button>}><input aria-label="Primary" defaultValue="#ffffff" /></SettingBlock>))
    expect(container.querySelector('[aria-label="Primary"]')).toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Expand Colors"]')!.click())
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Collapse Colors"]')!
    expect(container.querySelector('h2, h3')?.contains(trigger)).toBe(true)
    const draft = container.querySelector<HTMLInputElement>('[aria-label="Primary"]')!
    draft.value = '#unfinished'
    draft.setAttribute('aria-invalid', 'true')
    await act(async () => trigger.click())
    expect(container.querySelector('[aria-label="Primary"]')).toBe(draft)
    await vi.waitFor(() => expect(draft.closest('[hidden]')).not.toBeNull())
    const action = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Reset colors')!
    expect(trigger.contains(action)).toBe(false)
    await act(async () => action.click())
    expect(reset).toHaveBeenCalledTimes(1)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await act(async () => trigger.click())
    expect(draft.value).toBe('#unfinished')
    expect(draft.getAttribute('aria-invalid')).toBe('true')
    expect(container.textContent).toContain('Document colors')
  })
})
