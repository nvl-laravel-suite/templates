// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ColorPicker, useRecentColors } from './color-picker'
import { TemplateWorkspace } from '../../template-platform/workspace'
import { createExperienceDocument } from '../../template-platform/demo-documents'

describe('document color context', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); useRecentColors.setState({ colors: [] }); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter(item => !item.closest('[hidden]'))
  it('does not call an unrelated fallback voucher palette the current document palette', async () => {
    await act(async () => root.render(<ColorPicker value="#123456" onChange={() => {}} />))
    expect(buttons().find(item => item.textContent?.trim() === 'Document palette')).toBeUndefined()
  })
  it('shows the actual template theme colors when editing a template theme', async () => {
    const document = createExperienceDocument()
    await act(async () => root.render(<TemplateWorkspace layout="compact" initialDocument={document} />))
    await act(async () => buttons().find(item => item.getAttribute('aria-label') === 'Editor tool')!.click())
    await act(async () => [...window.document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === 'Theme')!.click())
    const palette = buttons().find(item => item.getAttribute('aria-label')?.startsWith('Document palette') || item.textContent?.trim() === 'Document palette')!
    expect(palette).toBeDefined()
    await act(async () => palette.click())
    expect(buttons().find(item => item.getAttribute('aria-label') === `Use ${document.theme.colors.primary}`)).toBeDefined()
  })
})
