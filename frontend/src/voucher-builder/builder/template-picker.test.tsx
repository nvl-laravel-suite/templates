// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { VoucherBuilderProvider } from '../provider'
import { createVoucherBuilder } from '../instance'
import { TemplatePicker } from './template-picker'
import { ThemeScope } from 'themelia-react-ui/ui-provider'

it('updates a mounted picker from host-supplied templates without loading or transport', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const instance = createVoucherBuilder()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<VoucherBuilderProvider instance={instance}><TemplatePicker /></VoucherBuilderProvider>))
    expect(container.querySelector('button[aria-label="Use template Minimal"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Loading templates')
    await act(async () => instance.templates.replace([{
      id: 'host', name: 'Host design', description: 'Preloaded JSON', mode: 'full', source: 'host', project: instance.getProject(),
    }]))
    expect(container.querySelector('button[aria-label="Use template Host design"]')).not.toBeNull()
    await act(async () => instance.templates.replace([]))
    expect(container.querySelector('button[aria-label="Use template Host design"]')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
    instance.destroy()
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('confirms a reusable design before replacement and restores the previous document with Undo', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const instance = createVoucherBuilder()
  const section = instance.getProject().sections[0].id
  instance.actions.addBlock(section, 'text')
  const previous = instance.getProject()
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<ThemeScope><VoucherBuilderProvider instance={instance}><TemplatePicker /></VoucherBuilderProvider></ThemeScope>))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Use template Minimal"]')!.click())
    expect(instance.getProject()).toEqual(previous)
    const dialog = container.querySelector('[role="alertdialog"]')!
    expect(dialog.textContent).toContain('Use this template?')
    await act(async () => [...dialog.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Use template')!.click())
    expect(instance.getProject().sections[0].blockIds).toHaveLength(3)
    await act(async () => instance.actions.undo())
    expect(instance.getProject()).toEqual(previous)
  } finally {
    await act(async () => root.unmount()); instance.destroy(); container.remove(); vi.unstubAllGlobals()
  }
})
