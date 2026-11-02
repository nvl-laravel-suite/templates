// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTemplateDefinition } from '../template-core/defaults'
import { createTemplateCreator } from '../template-core/editing'
import { TemplateDefinitionSchema } from '../template-core/schema'
import { exportBindingDocument } from './bindings'
import { TemplateWorkspace } from './workspace'
import familyFixture from '../../scripts/fixtures/family-structure.v1.json'
import type { BindingDocument } from './types'

function fixture() {
  return exportBindingDocument(TemplateDefinitionSchema.parse({ ...createTemplateDefinition('Family'), id: 'family', roots: ['section'], nodes: {
    section: { id: 'section', name: 'Section', kind: 'element', tag: 'section', children: ['copy'] },
    copy: { id: 'copy', name: 'Copy', kind: 'text', parts: [{ value: { source: 'literal', value: 'Family preview' } }] },
  } }), { target: 'document' })
}

describe('family declarations in the complete workspace', () => {
  let root: Root; let container: HTMLDivElement
  beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label)

  it('keeps existing declaration schemas secondary and retains invalid work when a rule is collapsed', async () => {
    const document = fixture(); document.variationPoints = [{ id: 'copy-name', label: 'Copy name', kind: 'node-property', nodeId: 'copy', property: 'name', schema: { type: 'string' } }]
    const onExport = vi.fn()
    await act(async () => root.render(<TemplateWorkspace familyAuthoring initialDocument={document} onExport={onExport} />))
    await act(async () => button('Setup')!.click())
    await act(async () => button('Family variations')!.click())
    expect(container.querySelector('[aria-label="Value schema copy-name"]')).toBeNull()
    await act(async () => button('Expand Copy name')!.click())
    const schema = container.querySelector<HTMLTextAreaElement>('[aria-label="Value schema copy-name"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(schema, '{broken'); schema.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => schema.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(schema.getAttribute('aria-invalid')).toBe('true')
    await act(async () => button('Collapse Copy name')!.click())
    await act(async () => button('Export template')!.click())
    expect(onExport).not.toHaveBeenCalled()
    await act(async () => button('Expand Copy name')!.click())
    expect(container.querySelector('[aria-label="Value schema copy-name"]')).toBe(schema)
    expect(schema.value).toBe('{broken')
    expect(schema.getAttribute('aria-invalid')).toBe('true')
  })

  it('declares and removes selected properties in emitted raw metadata while preserving existing points and preview', async () => {
    const document = fixture(); document.variationPoints = [{ id: 'copy-name', label: 'Copy name', kind: 'node-property', nodeId: 'copy', property: 'name', schema: { type: 'string' } }]
    const creator = createTemplateCreator({ initialTemplate: document.source.definition }); const onDraftChange = vi.fn(); const onExport = vi.fn()
    await act(async () => root.render(<TemplateWorkspace {...{ familyAuthoring: true }} initialDocument={document} creator={creator} onDraftChange={onDraftChange} onExport={onExport} />))
    act(() => creator.actions.select('section'))
    expect(button('Allow name changes')).toBeDefined()
    await act(async () => button('Allow name changes')!.click())
    const points = onDraftChange.mock.lastCall![0].variationPoints
    expect(points).toHaveLength(2)
    expect(points[0]).toEqual(document.variationPoints[0])
    expect(points[1]).toMatchObject({ kind: 'node-property', nodeId: 'section', property: 'name', schema: { type: 'string' } })
    expect(onDraftChange.mock.lastCall![0]).not.toHaveProperty('artifacts')
    expect(container.querySelector<HTMLIFrameElement>('iframe[title="Template document"]')!.srcdoc).toContain('Family preview')
    await act(async () => button('Library')!.click())
    expect(button('Reusable blocks')).toBeDefined()
    await act(async () => button('Build')!.click())
    expect(button('Add section')).toBeDefined()
    await act(async () => button('Export template')!.click())
    expect(onExport.mock.lastCall![0].variationPoints).toEqual(points)
    await act(async () => button('Setup')!.click())
    await act(async () => button('Family variations')!.click())
    await act(async () => button(`Remove variation ${points[1].id}`)!.click())
    expect(onDraftChange.mock.lastCall![0].variationPoints).toEqual(document.variationPoints)
    creator.destroy()
  })

  it('declares children and edits bounds and required placements through the existing policy panel', async () => {
    const document = fixture(); const creator = createTemplateCreator({ initialTemplate: document.source.definition }); const onDraftChange = vi.fn()
    await act(async () => root.render(<TemplateWorkspace familyAuthoring initialDocument={document} creator={creator} onDraftChange={onDraftChange} />))
    act(() => creator.actions.select('section'))
    await act(async () => button('Allow child changes')!.click())
    expect(onDraftChange.mock.lastCall![0].variationPoints).toHaveLength(1)
    const point = onDraftChange.mock.lastCall![0].variationPoints[0]
    expect(point).toMatchObject({ kind: 'children', target: { kind: 'children', nodeId: 'section' }, minItems: 0 })
    await act(async () => button('Setup')!.click())
    await act(async () => button('Family variations')!.click())
    await act(async () => button(`Expand ${point.label}`)!.click())
    const max = container.querySelector<HTMLInputElement>(`[aria-label="Maximum items ${point.id}"]`)!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(max, '5')
      max.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => max.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onDraftChange.mock.lastCall![0].variationPoints[0].maxItems).toBe(5)
    await act(async () => container.querySelector<HTMLElement>('[aria-label="Require Copy"]')!.click())
    expect(onDraftChange.mock.lastCall![0].variationPoints[0].requiredIds).toEqual(['copy'])
    await act(async () => button('Reset declaration')!.click())
    expect(onDraftChange.mock.lastCall![0].variationPoints[0]).toEqual(point)
    creator.destroy()
  })

  it('blocks family export when a source edit removes a declared target and allows removing the broken declaration', async () => {
    const document = fixture(); document.variationPoints = [{ id: 'copy-name', label: 'Copy name', kind: 'node-property', nodeId: 'copy', property: 'name', schema: { type: 'string' } }]
    const creator = createTemplateCreator({ initialTemplate: document.source.definition }); const onExport = vi.fn()
    await act(async () => root.render(<TemplateWorkspace familyAuthoring initialDocument={document} creator={creator} onExport={onExport} />))
    act(() => creator.actions.remove('copy'))
    await act(async () => button('Export template')!.click())
    expect(onExport).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/unknown.*copy/i)
    await act(async () => button('Setup')!.click())
    await act(async () => button('Family variations')!.click())
    await act(async () => button('Remove variation copy-name')!.click())
    await act(async () => button('Export template')!.click())
    expect(onExport).toHaveBeenCalledTimes(1)
    creator.destroy()
  })

  it('uses selected text, element and block controls to declare each point kind', async () => {
    const document = structuredClone(familyFixture.base) as BindingDocument; document.variationPoints = []
    const creator = createTemplateCreator({ initialTemplate: document.source.definition }); const onDraftChange = vi.fn()
    await act(async () => root.render(<TemplateWorkspace familyAuthoring initialDocument={document} creator={creator} onDraftChange={onDraftChange} />))
    const declare = async (id: string, label: string) => {
      act(() => creator.actions.select(id))
      expect(button(label)).toBeDefined()
      await act(async () => button(label)!.click())
      expect(container.querySelector('[role="alert"]')).toBeNull()
    }
    await declare('title', 'Allow parts changes')
    await declare('heading', 'Allow classes changes')
    await declare('heading', 'Allow tag changes')
    await declare('heading', 'Allow color style changes')
    await declare('footer', 'Allow placement replacement')
    await declare('card', 'Allow caption property changes')
    await declare('card', 'Allow body slot changes')
    const points = onDraftChange.mock.lastCall![0].variationPoints
    expect(points.map((point: { kind: string }) => point.kind)).toEqual(['node-property', 'node-property', 'node-property', 'node-style', 'placement', 'block-property', 'children'])
    expect(points[4].allowedBlocks).toEqual([])
    expect(points[6].target).toEqual({ kind: 'block-slot', nodeId: 'card', slot: 'body' })
    creator.destroy()
  })

  it('declares the root sequence through the existing workspace panel', async () => {
    const onDraftChange = vi.fn()
    await act(async () => root.render(<TemplateWorkspace familyAuthoring initialDocument={fixture()} onDraftChange={onDraftChange} />))
    await act(async () => button('Setup')!.click())
    await act(async () => button('Family variations')!.click())
    await act(async () => button('Allow root changes')!.click())
    expect(onDraftChange.mock.lastCall![0].variationPoints[0]).toMatchObject({ kind: 'children', target: { kind: 'roots' }, minItems: 1 })
    expect(onDraftChange.mock.lastCall![0].variationPoints[0].allowedKinds).not.toContain('slot')
  })

  it('rejects a region declaration that would own an already declared descendant without altering metadata', async () => {
    const document = fixture(); document.variationPoints = [{ id: 'copy-name', label: 'Copy name', kind: 'node-property', nodeId: 'copy', property: 'name', schema: { type: 'string' } }]
    const creator = createTemplateCreator({ initialTemplate: document.source.definition }); const onDraftChange = vi.fn()
    await act(async () => root.render(<TemplateWorkspace {...{ familyAuthoring: true }} initialDocument={document} creator={creator} onDraftChange={onDraftChange} />))
    act(() => creator.actions.select('section'))
    expect(button('Allow child changes')).toBeDefined()
    const calls = onDraftChange.mock.calls.length
    await act(async () => button('Allow child changes')!.click())
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/overlap|own|declared/i)
    expect(onDraftChange).toHaveBeenCalledTimes(calls)
    expect(onDraftChange.mock.lastCall![0].variationPoints).toEqual(document.variationPoints)
    creator.destroy()
  })
})
