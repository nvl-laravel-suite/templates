// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as controls from './settings-panel'
import { TemplateEditor } from '../template-creator/TemplateEditor'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { createTemplateDefinition } from '../template-core/defaults'
import type { PresentationSetting } from './types'

const spec: PresentationSetting[] = [
  { id: 'fontSize', label: 'Font size', schema: { type: 'number', minimum: 12, maximum: 24 }, defaultValue: 16, exposed: true, unit: 'px', targets: [] },
  { id: 'hidden', label: 'Protected colour', schema: { type: 'string' }, defaultValue: '#000000', exposed: false, targets: [] },
]

describe('selected settings and fields', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('shows only explicitly exposed settings and emits reset as removal', async () => {
    expect(controls).toHaveProperty('TemplateSettingsPanel')
    const onChange = vi.fn()
    await act(async () => root.render(<controls.TemplateSettingsPanel spec={spec} values={{ fontSize: 20 }} onChange={onChange} />))
    expect(container.querySelector('[aria-label="Font size"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Protected colour')
    const reset = container.querySelector<HTMLButtonElement>('[aria-label="Reset Font size"]')!
    act(() => reset.click())
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('uses a clear empty state when a template exposes no appearance settings', async () => {
    expect(controls).toHaveProperty('TemplateSettingsPanel')
    await act(async () => root.render(<controls.TemplateSettingsPanel spec={[]} values={{}} onChange={() => {}} />))
    expect(container.textContent).toContain('No appearance settings')
  })

  it('keeps unselected protected fields and raw node controls out of the restricted editor', async () => {
    const template = TemplateDefinitionSchema.parse({ ...createTemplateDefinition('Voucher'), fields: [
      { id: 'message', path: 'inputs.message', label: 'Personal message', schema: { type: 'string' }, defaultValue: 'Enjoy', editable: true },
      { id: 'code', path: 'facts.code', label: 'Secret voucher code', schema: { type: 'string' }, editable: false },
    ] })
    await act(async () => root.render(<TemplateEditor template={template} initialData={{ facts: { code: 'ABC' } }} fieldIds={['message']} allowNodeOverrides={false} />))
    expect(container.textContent).toContain('Personal message')
    expect(container.textContent).not.toContain('Secret voucher code')
    expect(container.querySelector('[aria-label="Customization target"]')).toBeNull()
  })
})
