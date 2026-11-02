// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeScope } from 'themelia-react-ui/ui-provider'
import { VoucherBuilderProvider } from '../provider'
import { createVoucherBuilder, type VoucherBuilderInstance } from '../instance'
import { GlobalSettings } from './global-settings'

describe('document settings tasks', () => {
  let root: Root, container: HTMLDivElement, instance: VoucherBuilderInstance
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    instance = createVoucherBuilder()
  })
  afterEach(async () => { await act(async () => root.unmount()); instance.destroy(); container.remove(); vi.unstubAllGlobals() })
  const choose = async (label: string) => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Document settings area"]')!
    expect(trigger).not.toBeNull()
    await act(async () => trigger.click())
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.trim() === label)!
    expect(option).toBeDefined()
    await act(async () => option.click())
  }

  it('groups settings by task and keeps an edited field mounted when the task changes', async () => {
    await act(async () => root.render(<ThemeScope><VoucherBuilderProvider instance={instance}><GlobalSettings /></VoucherBuilderProvider></ThemeScope>))
    expect(container.querySelector('[data-settings-area="layout"]')?.hasAttribute('hidden')).toBe(false)
    await choose('Document details')
    const field = container.querySelector<HTMLInputElement>('[data-settings-area="details"] input[aria-label="Title"]')!
    expect(field).not.toBeNull()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'Birthday voucher')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await choose('Appearance')
    expect(field.closest('[hidden]')).not.toBeNull()
    await choose('Document details')
    expect(container.querySelector('[data-settings-area="details"] input[aria-label="Title"]')).toBe(field)
    expect(field.value).toBe('Birthday voucher')
    expect(instance.actions.getProject().global.metadata.title).toBe('Birthday voucher')
  })

  it('omits sample values when preview data is disabled', async () => {
    await act(async () => root.render(<ThemeScope><VoucherBuilderProvider instance={instance} features={{ previewData: false }}><GlobalSettings /></VoucherBuilderProvider></ThemeScope>))
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Document settings area"]')!
    expect(trigger).not.toBeNull()
    await act(async () => trigger.click())
    expect([...document.querySelectorAll('[role="option"]')].map(item => item.textContent)).not.toContain('Sample values')
    expect(container.querySelector('[data-settings-area="samples"]')).toBeNull()
  })
})
