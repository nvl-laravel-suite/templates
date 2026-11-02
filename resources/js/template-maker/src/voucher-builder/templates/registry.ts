import type { VoucherTemplate } from './types'
import type { Project } from '../schema'
import { createDefaultBlock, defaultCommonSettings } from '../schema'
import { getComposableTemplates } from '../blocks'
import { getBlockSettings, patchBlockSettings } from '../blocks/settings-accessor'
import { createEmptyProject } from '../lib/empty-project'
import { nanoid } from 'nanoid'
import '../blocks/definitions'

export interface AddVoucherTemplateInput {
  name: string
  description?: string
  icon?: string
  category?: string
  thumbnail?: string
  project: Project
}

export interface ImportTemplatesResult {
  imported: number
  skipped: number
  errors: string[]
}

export function instantiateTemplate(template: VoucherTemplate): Project {
  if (template.mode === 'full' && template.project) {
    const cloned = structuredClone(template.project)
    const oldToNew = new Map<string, string>()

    const newBlocks: Record<string, any> = {}
    for (const [oldId, block] of Object.entries(cloned.blocks)) {
      const newId = nanoid(8)
      oldToNew.set(oldId, newId)
      newBlocks[newId] = { ...block, id: newId }
    }
    cloned.blocks = newBlocks

    const newColBlocks: Record<string, string[]> = {}
    for (const [oldKey, childIds] of Object.entries(cloned.columnBlocks)) {
      const newKey = oldToNew.get(oldKey) || oldKey
      newColBlocks[newKey] = childIds.map((id) => oldToNew.get(id) || id)
    }
    cloned.columnBlocks = newColBlocks

    for (const section of cloned.sections) {
      section.blockIds = section.blockIds.map((id: string) => oldToNew.get(id) || id)
    }

    for (const block of Object.values(cloned.blocks) as any[]) {
      if (block.content?.childIds) {
        block.content.childIds = block.content.childIds.map((id: string) => oldToNew.get(id) || id)
      }
      if (block.content?.columnIds) {
        block.content.columnIds = block.content.columnIds.map((id: string) => oldToNew.get(id) || id)
      }
      if (block.content?.cellIds) {
        block.content.cellIds = block.content.cellIds.map((id: string) => oldToNew.get(id) || id)
      }
    }

    return cloned
  }

  if (template.mode === 'partial' && template.partial) {
    return instantiatePartial(template.partial)
  }

  return createEmptyProject()
}

function instantiatePartial(partial: import('./types').PartialTemplate): Project {
  const project = createEmptyProject()

  if (partial.global) {
    project.global = {
      ...project.global,
      ...partial.global,
      layout: { ...project.global.layout, ...(partial.global.layout || {}) },
      typography: { ...project.global.typography, ...(partial.global.typography || {}) },
      colors: { ...project.global.colors, ...(partial.global.colors || {}) },
      metadata: { ...project.global.metadata, ...(partial.global.metadata || {}) },
    }
  }

  if (partial.frame) {
    project.frame = { ...project.frame, ...partial.frame }
  }

  if (partial.sections) {
    for (const sectionDef of partial.sections) {
      const section = project.sections[sectionDef.index]
      if (!section) continue

      if (sectionDef.height !== undefined) section.height = sectionDef.height
      if (sectionDef.backgroundColor) section.backgroundColor = sectionDef.backgroundColor
      if (sectionDef.backgroundOpacity !== undefined) section.backgroundOpacity = sectionDef.backgroundOpacity
      if (sectionDef.widthMode) section.widthMode = sectionDef.widthMode
      if (sectionDef.verticalAlign) section.verticalAlign = sectionDef.verticalAlign

      for (const blockDef of sectionDef.blocks) {
        const { block, children, colBlocks } = instantiateBlockDef(blockDef)
        project.blocks[block.id] = block
        section.blockIds.push(block.id)
        Object.assign(project.blocks, children)
        Object.assign(project.columnBlocks, colBlocks)
      }
    }
  }

  return project
}

function instantiateBlockDef(def: import('./types').PartialTemplateBlock): {
  block: import('../schema').Block
  children: Record<string, import('../schema').Block>
  colBlocks: Record<string, string[]>
} {
  const id = nanoid(8)
  let block = createDefaultBlock(def.type, id)

  if (def.content) (block as { content: unknown }).content = { ...(block.content as object), ...def.content }
  if (def.settings) block = patchBlockSettings(block, { ...getBlockSettings(block), ...def.settings })
  if (def.commonSettings) block.commonSettings = { ...(block.commonSettings || defaultCommonSettings), ...def.commonSettings }

  const children: Record<string, any> = {}
  const colBlocks: Record<string, string[]> = {}

  const composableTemplates = getComposableTemplates(def.type)
  if (composableTemplates && composableTemplates.length > 0 && !def.children) {
    const childIds: string[] = []
    for (const tmpl of composableTemplates) {
      const childId = nanoid(8)
      childIds.push(childId)
      const child = createDefaultBlock(tmpl.type as any, childId)
      ;(child as any).commonSettings = { ...(child.commonSettings || defaultCommonSettings), alias: tmpl.alias }
      if (tmpl.contentOverrides) (child as any).content = { ...child.content, ...tmpl.contentOverrides }
      if (tmpl.settingsOverrides) (child as any).settings = { ...(child as any).settings, ...tmpl.settingsOverrides }
      children[childId] = child
    }
    ;(block as any).content.childIds = childIds
    colBlocks[id] = childIds
  }

  if (def.children) {
    const childIds: string[] = []
    for (const childDef of def.children) {
      const result = instantiateBlockDef(childDef)
      childIds.push(result.block.id)
      children[result.block.id] = result.block
      Object.assign(children, result.children)
      Object.assign(colBlocks, result.colBlocks)
    }
    ;(block as any).content.childIds = childIds
    colBlocks[id] = childIds
  }

  return { block, children, colBlocks }
}
