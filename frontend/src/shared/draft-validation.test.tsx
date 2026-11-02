// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { InspectorSection } from '../template-creator/inspector-section'
import { revealDraftField, useInvalidDrafts } from './draft-validation'

it('counts retained invalid controls once and opens their disclosure before focusing', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  function Probe() { const drafts = useInvalidDrafts(host); return <><output>{drafts.count}</output><InspectorSection title="Advanced"><div aria-invalid="true"><input aria-label="Buffered value" aria-invalid="true" defaultValue="Unfinished" /></div></InspectorSection></> }
  try {
    await act(async () => root.render(<Probe />))
    expect(host.querySelector('output')?.textContent).toBe('1')
    const field = host.querySelector<HTMLInputElement>('input')!
    expect(host.querySelector('[aria-label="Advanced"]')?.getAttribute('aria-expanded')).toBe('false')
    await act(async () => revealDraftField(field))
    await vi.waitFor(() => expect(document.activeElement).toBe(field))
    expect(host.querySelector('[aria-label="Advanced"]')?.getAttribute('aria-expanded')).toBe('true')
    expect(field.value).toBe('Unfinished')
    await act(async () => { field.removeAttribute('aria-invalid'); field.parentElement!.removeAttribute('aria-invalid') })
    await vi.waitFor(() => expect(host.querySelector('output')?.textContent).toBe('0'))
  } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() }
})

it('focuses an editable descendant when invalid state belongs to a field group', async () => {
  const group = document.createElement('div'); group.setAttribute('aria-invalid', 'true')
  const field = document.createElement('input'); field.setAttribute('aria-label', 'Rejected choice value'); group.append(field); document.body.append(group)
  try { revealDraftField(group); await vi.waitFor(() => expect(document.activeElement).toBe(field)) }
  finally { group.remove() }
})
