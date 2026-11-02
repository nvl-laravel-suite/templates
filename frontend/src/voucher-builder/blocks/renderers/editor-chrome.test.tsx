// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from 'themelia-react-ui/base/buttons'
import { createVoucherBuilder } from '../../instance'
import { VoucherBuilderProvider } from '../../provider'
import type { Block } from '../../schema'
import { BlockRenderer } from './block-renderer'

describe('nested canvas editing chrome', () => {
  let root: Root, container: HTMLDivElement
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div'); document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it.each(['row', 'grid', 'section'] as const)('uses native insertion controls for %s without exporting editor chrome', async (type) => {
    const editor = createVoucherBuilder()
    try {
      editor.actions.addBlock(editor.actions.getProject().sections[0].id, type)
      let project = editor.actions.getProject()
      const block = Object.values(project.blocks).find(block => block.type === type)!
      const parent = type === 'row' ? (block.content as { columnIds: string[] }).columnIds[0]
        : type === 'grid' ? (block.content as { cellIds: string[] }).cellIds[0] : block.id
      editor.actions.addBlockToColumn(parent, 'text')
      project = editor.actions.getProject()
      const child = project.columnBlocks[parent][0]
      editor.actions.setActiveBlock(type === 'section' ? block.id : child)
      await act(async () => root.render(<VoucherBuilderProvider instance={editor}>
        <Button size="sm" buttonStyle="ghost" aria-label="Native insertion reference">Add block</Button>
        <BlockRenderer block={project.blocks[block.id] as Block} />
      </VoucherBuilderProvider>))
      const insertion = container.querySelector<HTMLButtonElement>('[aria-label^="Add block to"]')!
      expect(insertion).not.toBeNull()
      expect(insertion.className).toBe(container.querySelector('[aria-label="Native insertion reference"]')!.className)
      if (type !== 'section') expect(container.querySelector('.nc-selected')).not.toBeNull()
      expect(container.querySelector('[class*="blue-"]')).toBeNull()
      const html = editor.exportProject({ format: 'html' }).data
      expect(html).not.toMatch(/nc-selected|data-slot=|Add block to|Resize columns|Drop blocks here/)
      expect(html).toContain('<!DOCTYPE html>')
    } finally { editor.destroy() }
  })
})
