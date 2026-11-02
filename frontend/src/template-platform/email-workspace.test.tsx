// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { TemplateWorkspace } from './workspace'
import { exportBindingDocument } from './bindings'
import { createEmailTemplate } from '../template-email/presets'
import { createTemplateCreator, createTemplateEditor } from '../template-core/editing'
import { TemplateCreator } from '../template-creator/TemplateCreator'
import { TemplateEditor } from '../template-creator/TemplateEditor'
const container = document.createElement('div'); document.body.append(container)
let root = createRoot(container)
afterEach(() => { act(() => root.unmount()); root = createRoot(container); vi.unstubAllGlobals() })
const button = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === name || button.textContent?.trim() === name)!
it('uses email blocks and exposes the compatibility report in the existing workspace', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const initialDocument = exportBindingDocument(createEmailTemplate(), { target: 'email' })
  await act(async () => root.render(<TemplateWorkspace initialDocument={initialDocument} />))
  await act(async () => button('Setup').click())
  expect(button('Email checks')).toBeDefined()
  await act(async () => button('Build').click())
  await act(async () => button('Insert element').click())
  expect(document.body.textContent).toContain('Header')
  expect(document.body.textContent).not.toContain('A free container for other blocks')
  expect(document.querySelector('[role="option"]')?.closest('[role="dialog"]')).not.toBeNull()
})
it('reports imported unsupported content and blocks export without blocking draft edits', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const initialDocument = exportBindingDocument(createEmailTemplate(), { target: 'email' }), onExport = vi.fn()
  const creator = createTemplateCreator({ initialTemplate: initialDocument.source.definition })
  await act(async () => root.render(<TemplateWorkspace initialDocument={initialDocument} creator={creator} onExport={onExport} />))
  const id = creator.getTemplate().roots[0]
  await act(async () => creator.actions.updateNode(id, { style: { display: 'grid' } }))
  expect(container.textContent).toContain('Email compatibility needs attention')
  await act(async () => button('Export template').click())
  expect(onExport).not.toHaveBeenCalled()
  expect(creator.getTemplate().nodes[id]).toMatchObject({ style: { display: 'grid' } })
  creator.destroy()
})
it('updates the email theme in preview immediately when switching targets', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const initialDocument = exportBindingDocument(createEmailTemplate(), { target: 'document' })
  await act(async () => root.render(<TemplateWorkspace initialDocument={initialDocument} />))
  await act(async () => container.querySelector<HTMLElement>('[aria-label="Output target"]')!.click())
  const email = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent?.trim() === 'Email')!
  await act(async () => email.click())
  const output = container.querySelector<HTMLIFrameElement>('iframe')!.getAttribute('srcdoc')!
  expect(output).toMatch(/class="email-button-cell"[^>]*style="[^"]*background-color:#275B49/)
})
it.each([false, true])('finalizes direct builder HTML exports for the email target (customer=%s)', async customer => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const source = createEmailTemplate(), onExport = vi.fn()
  await act(async () => root.render(customer ? <TemplateEditor template={source} previewTarget="email" onExport={onExport} /> : <TemplateCreator initialTemplate={source} previewTarget="email" onExport={onExport} />))
  await act(async () => button('Export HTML').click())
  expect(onExport.mock.lastCall?.[0].data).toContain('data-email-shell="1"')
  expect(onExport.mock.lastCall?.[0].data).not.toContain('@page')
})
it('blocks unsupported styles already present in a direct email personalization instance', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const source = createEmailTemplate(), onExport = vi.fn(), id = source.roots[0]
  source.nodes[id].permissions.style = true
  const editor = createTemplateEditor({ template: source })
  editor.actions.override(id, { style: { 'font-size': '1rem' } })
  await act(async () => root.render(<TemplateEditor instance={editor} previewTarget="email" onExport={onExport} />))
  await act(async () => button('Export HTML').click())
  expect(onExport).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Email:')
  editor.destroy()
})
