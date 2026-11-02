// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateCreator } from './TemplateCreator'
import { createTemplateCreator } from '../template-core/editing'
import { createTemplateDefinition } from '../template-core/defaults'
import { getTemplateColumns } from '../template-core/columns'
import { TemplateFieldSchema, TemplateNodeSchema } from '../template-core/schema'
import type { TemplateInsertPreset } from '../template-core/presets'

describe('building templates in the existing creator', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label)!
  const choose = async (label: string) => {
    await act(async () => button('Insert element').click())
    const item = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.trim() === label)!
    expect(item, `insertable ${label}`).toBeDefined()
    await act(async () => item.click())
  }
  const change = (label: string, value: string) => {
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`input[aria-label="${label}"],textarea[aria-label="${label}"]`)!
    expect(input, label).not.toBeNull()
    act(() => {
      Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  }

  it('inserts columns, edits proportions, and adds content inside the selected column rather than the document root', async () => {
    const instance = createTemplateCreator()
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await choose('Two columns')
    const layoutId = instance.getTemplate().roots[0]
    expect(getTemplateColumns(instance.getTemplate(), layoutId)?.widths).toEqual([50, 50])
    change('Column 1 width', '30')
    expect(getTemplateColumns(instance.getTemplate(), layoutId)?.widths).toEqual([30, 70])
    const column = getTemplateColumns(instance.getTemplate(), layoutId)!.columnIds[1]
    const node = instance.getTemplate().nodes[column]
    const textId = node.kind === 'element' ? node.children[0] : ''
    await act(async () => instance.actions.select(textId))
    await choose('Paragraph')
    const after = instance.getTemplate()
    expect(after.roots).toEqual([layoutId])
    expect(after.nodes[column].kind === 'element' && after.nodes[column].children).toHaveLength(2)
    await act(async () => button('Undo').click())
    const restored = instance.getTemplate().nodes[column]
    expect(restored.kind === 'element' && restored.children).toEqual([textId])
    instance.destroy()
  })

  it('accepts a backend-supplied preset and binds a link destination through existing field controls', async () => {
    const template = createTemplateDefinition()
    template.fields.push(TemplateFieldSchema.parse({ id: 'destination', label: 'Action link', path: 'inputs.action.link', schema: { type: 'string', format: 'uri' }, defaultValue: 'https://example.com/book' }))
    const preset: TemplateInsertPreset = { id: 'custom-action', name: 'Book experience', category: 'Customer blocks', description: 'Backend-defined action', fragment: { roots: ['action'], nodes: {
      action: TemplateNodeSchema.parse({ id: 'action', name: 'Book experience', kind: 'element', tag: 'a', attributes: { href: 'https://example.com' }, children: ['copy'] }),
      copy: TemplateNodeSchema.parse({ id: 'copy', name: 'Action value', kind: 'text', parts: [{ value: { source: 'literal', value: 'Book now' } }] }),
    } } }
    const instance = createTemplateCreator({ initialTemplate: template })
    // The host replaces the catalog deliberately; no backend endpoint enters the component.
    await act(async () => root.render(<TemplateCreator instance={instance} insertPresets={[preset]} />))
    await choose('Book experience')
    const section = [...container.querySelectorAll<HTMLElement>('[data-slot="card"]')].find(item => item.querySelector('[data-slot="card-title"]')?.textContent === 'Link destination')
    const sources = section?.querySelector<HTMLButtonElement>('[aria-label="Value source"]')
    expect(sources).toBeDefined()
    await act(async () => sources!.click())
    const field = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === 'Data field')!
    await act(async () => field.click())
    const action = instance.getTemplate().nodes[instance.getTemplate().roots[0]]
    expect(action.kind === 'element' && action.attributeBindings.href).toEqual({ source: 'field', fieldId: 'destination' })
    expect(instance.render().html).toContain('href="https://example.com/book"')
    expect(instance.render().html).toContain('Book now')
    instance.destroy()
  })

  it('creates a useful repeater and lets its current item be addressed with an empty property path', async () => {
    const instance = createTemplateCreator()
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await choose('Repeating content')
    expect(instance.render().html).toContain('First itemSecond item')
    const repeat = instance.getTemplate().nodes[instance.getTemplate().roots[0]]
    await act(async () => instance.actions.select(repeat.kind === 'repeat' ? repeat.children[0] : ''))
    expect(container.querySelector('[aria-label="Item property"]')?.getAttribute('placeholder')).toBe('Current item')
    instance.destroy()
  })

  it('edits a primitive’s text directly after insertion without requiring a second tree selection', async () => {
    const instance = createTemplateCreator()
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await choose('Heading')
    change('Static text', 'A gift for you')
    expect(instance.render().html).toContain('<h2>A gift for you</h2>')
    await act(async () => button('Undo').click())
    expect(instance.render().html).toContain('<h2>Your heading</h2>')
    instance.destroy()
  })

  it('offers array fields for repeaters and keeps static items as typed arrays', async () => {
    const template = createTemplateDefinition()
    template.fields = [
      TemplateFieldSchema.parse({ id: 'name', path: 'inputs.name', label: 'Name', schema: { type: 'string' }, defaultValue: 'Alex' }),
      TemplateFieldSchema.parse({ id: 'names', path: 'inputs.names', label: 'Names', schema: { type: 'array', items: { type: 'string' } }, defaultValue: ['Alex'] }),
    ]
    const instance = createTemplateCreator({ initialTemplate: template })
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await choose('Repeating content')
    await act(async () => button('Value source').click())
    await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === 'Data field')!.click())
    const repeat = instance.getTemplate().nodes[instance.getTemplate().roots[0]]
    expect(repeat.kind === 'repeat' && repeat.binding).toEqual({ source: 'field', fieldId: 'names' })
    await act(async () => button('Value source').click())
    await act(async () => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === 'Static value')!.click())
    change('Static items', '["One", "Two"]')
    expect(instance.render().issues).toEqual([])
    expect(instance.render().html).toContain('OneTwo')
    instance.destroy()
  })

  it.each(['Data table', 'Bulleted list'])('keeps added paragraphs outside structural %s markup', async label => {
    const instance = createTemplateCreator()
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await choose(label)
    await choose('Paragraph')
    expect(instance.getTemplate().roots).toHaveLength(2)
    const result = instance.render()
    expect(result.issues).toEqual([])
    const output = new DOMParser().parseFromString(result.html, 'text/html')
    expect([...output.querySelector('.template-document')!.children].map(node => node.tagName)).toEqual([label === 'Data table' ? 'TABLE' : 'UL', 'P'])
    instance.destroy()
  })

  it('inserts structural parts into their valid parent and disables them without one', async () => {
    const instance = createTemplateCreator()
    await act(async () => root.render(<TemplateCreator instance={instance} />))
    await act(async () => button('Insert element').click())
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.trim() === 'List item')!
    expect(option.getAttribute('aria-disabled')).toBe('true')
    await act(async () => button('Insert element').click())
    await choose('Bulleted list')
    await choose('List item')
    const listId = instance.getTemplate().roots[0]
    const list = instance.getTemplate().nodes[listId]
    expect(list.kind === 'element' && list.children).toHaveLength(3)
    expect(instance.render().issues).toEqual([])
    expect(instance.render().html).toContain('<li>New item</li>')
    instance.destroy()
  })
})
