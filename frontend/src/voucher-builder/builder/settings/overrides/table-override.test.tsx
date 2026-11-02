// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { TableOverride } from './table-override'

it('names every table field by its position and updates only the addressed cell', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container), update = vi.fn()
  const block = { type: 'table', content: { headers: ['Experience', 'Price'], rows: [['Dinner', '50'], ['Spa', '75']] } }
  try {
    await act(async () => root.render(<TableOverride block={block} update={update} />))
    const inputs = [...container.querySelectorAll('input')]
    expect(new Set(inputs.map(input => input.id)).size).toBe(6)
    expect(inputs.map(input => input.getAttribute('aria-label'))).toEqual([
      'Column 1 heading', 'Column 2 heading', 'Row 1, Experience', 'Row 1, Price', 'Row 2, Experience', 'Row 2, Price',
    ])
    const field = inputs[5]
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '90')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(update).toHaveBeenLastCalledWith({ content: { headers: ['Experience', 'Price'], rows: [['Dinner', '50'], ['Spa', '90']] } })
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() }
})
