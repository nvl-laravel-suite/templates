import { nanoid } from 'nanoid'
import type { Block, BlockType, Project, VoucherSection } from '../schema'
import { createDefaultBlock, defaultCommonSettings } from '../schema'
import type { BlockTreeSnapshot } from '../lib/block-tree'
import { captureBlockTree, instantiateBlockTree } from '../lib/block-tree'
import { getComposableTemplates } from '../blocks'
import { getStructuralChildIds, isStructuralType } from '../blocks'
import { localizeGeneratedContent } from '../i18n/core'

interface InstantiatedBlockTree {
  rootId: string
  blocks: Record<string, Block>
  columnBlocks: Record<string, string[]>
}

interface EngineResult {
  project: Project
  activeBlockId: string | null
  activeBlockIds: string[]
}

function cloneProject(project: Project): Project {
  return {
    global: project.global,
    blocks: { ...project.blocks },
    sections: project.sections.map((section) => ({ ...section, blockIds: [...section.blockIds] })) as [VoucherSection, VoucherSection, VoucherSection],
    columnBlocks: Object.fromEntries(
      Object.entries(project.columnBlocks).map(([key, value]) => [key, [...value]])
    ),
    frame: project.frame,
  }
}

function instantiateBlockTreeForType(type: BlockType, locale: string): InstantiatedBlockTree {
  const id = nanoid(8)

  if (type === 'row') {
    const col1Id = nanoid(8)
    const col2Id = nanoid(8)
    const rowBlock = createDefaultBlock('row', id, locale)
    ;(rowBlock as any).content.columnIds = [col1Id, col2Id]

    const col1 = createDefaultBlock('column', col1Id, locale)
    const col2 = createDefaultBlock('column', col2Id, locale)

    return {
      rootId: id,
      blocks: { [id]: rowBlock, [col1Id]: col1, [col2Id]: col2 },
      columnBlocks: { [col1Id]: [], [col2Id]: [] },
    }
  }

  if (type === 'grid') {
    const columns = 2
    const rows = 2
    const cellIds = Array.from({ length: columns * rows }, () => nanoid(8))
    const gridBlock = createDefaultBlock('grid', id, locale)
    ;(gridBlock as any).content.cellIds = cellIds

    const nextBlocks: Record<string, Block> = { [id]: gridBlock }
    const nextColumnBlocks: Record<string, string[]> = {}

    for (const [index, cellId] of cellIds.entries()) {
      const cell = createDefaultBlock('column', cellId, locale)
      ;(cell as any).commonSettings.alias = `Cell ${index + 1}`
      nextBlocks[cellId] = cell
      nextColumnBlocks[cellId] = []
    }

    return {
      rootId: id,
      blocks: nextBlocks,
      columnBlocks: nextColumnBlocks,
    }
  }

  const templates = getComposableTemplates(type)
  if (templates) {
    const parentBlock = createDefaultBlock(type, id, locale)
    const newBlocks: Record<string, Block> = { [id]: parentBlock }
    const childIds: string[] = []

    for (const tmpl of templates) {
      const childId = nanoid(8)
      childIds.push(childId)
      const child = createDefaultBlock(tmpl.type as BlockType, childId, locale)
      ;(child as any).commonSettings = { ...(child.commonSettings || defaultCommonSettings), alias: tmpl.alias }
      if (tmpl.contentOverrides) {
        ;(child as any).content = {
          ...child.content,
          ...localizeGeneratedContent(tmpl.type as BlockType, tmpl.contentOverrides as Record<string, any>, locale),
        }
      }
      if (tmpl.settingsOverrides) {
        ;(child as any).settings = { ...(child as any).settings, ...tmpl.settingsOverrides }
      }
      newBlocks[childId] = child
    }

    ;(parentBlock as any).content.childIds = childIds

    return {
      rootId: id,
      blocks: newBlocks,
      columnBlocks: { [id]: childIds },
    }
  }

  const block = createDefaultBlock(type, id, locale)
  return {
    rootId: id,
    blocks: { [id]: block },
    columnBlocks: {},
  }
}

export function removeBlockTree(
  blockId: string,
  blocks: Record<string, Block>,
  columnBlocks: Record<string, string[]>,
) {
  const block = blocks[blockId]
  if (!block) return

  const childIds = columnBlocks[blockId] || []
  for (const childId of childIds) {
    removeBlockTree(childId, blocks, columnBlocks)
  }
  delete columnBlocks[blockId]

  if (isStructuralType(block.type)) {
    for (const containerId of getStructuralChildIds(block as any)) {
      removeBlockTree(containerId, blocks, columnBlocks)
    }
  }

  delete blocks[blockId]

  for (const key of Object.keys(columnBlocks)) {
    columnBlocks[key] = columnBlocks[key].filter((id) => id !== blockId)
  }
}

function filterMissingSectionBlockIds(section: VoucherSection, blocks: Record<string, Block>): VoucherSection {
  return {
    ...section,
    blockIds: section.blockIds.filter((blockId) => Boolean(blocks[blockId])),
  }
}

export function addBlockToSectionProject(
  project: Project,
  sectionId: string,
  type: BlockType,
  locale: string,
): EngineResult {
  const next = cloneProject(project)
  const instantiated = instantiateBlockTreeForType(type, locale)

  Object.assign(next.blocks, instantiated.blocks)
  Object.assign(next.columnBlocks, instantiated.columnBlocks)

  next.sections = next.sections.map((section) => {
    if (section.id !== sectionId) return section
    return { ...section, blockIds: [...section.blockIds, instantiated.rootId] }
  }) as [VoucherSection, VoucherSection, VoucherSection]

  return {
    project: next,
    activeBlockId: instantiated.rootId,
    activeBlockIds: [instantiated.rootId],
  }
}

export function addBlockToColumnProject(
  project: Project,
  columnId: string,
  type: BlockType,
  locale: string,
): EngineResult {
  const next = cloneProject(project)
  const instantiated = instantiateBlockTreeForType(type, locale)

  Object.assign(next.blocks, instantiated.blocks)
  Object.assign(next.columnBlocks, instantiated.columnBlocks)
  next.columnBlocks[columnId] = [...(next.columnBlocks[columnId] || []), instantiated.rootId]

  return {
    project: next,
    activeBlockId: instantiated.rootId,
    activeBlockIds: [instantiated.rootId],
  }
}

export function removeBlocksFromProject(project: Project, blockIds: string[], activeBlockIds: string[]): EngineResult {
  const idsToRemove = Array.from(new Set(blockIds))
  const next = cloneProject(project)

  for (const blockId of idsToRemove) {
    removeBlockTree(blockId, next.blocks, next.columnBlocks)
  }

  next.sections = next.sections.map((section) => filterMissingSectionBlockIds(section, next.blocks)) as [VoucherSection, VoucherSection, VoucherSection]
  const remainingSelection = activeBlockIds.filter((blockId) => Boolean(next.blocks[blockId]))

  return {
    project: next,
    activeBlockId: remainingSelection[remainingSelection.length - 1] ?? null,
    activeBlockIds: remainingSelection,
  }
}

export function removeBlockFromColumnProject(
  project: Project,
  columnId: string,
  blockId: string,
  activeBlockIds: string[],
): EngineResult {
  const result = removeBlocksFromProject(project, [blockId], activeBlockIds)
  result.project.columnBlocks[columnId] = (result.project.columnBlocks[columnId] || []).filter((id) => id !== blockId)
  return result
}

export function duplicateBlocksInSectionProject(
  project: Project,
  sectionId: string,
  blockIds: string[],
): EngineResult {
  const idsToDuplicate = Array.from(new Set(blockIds))
  const next = cloneProject(project)
  const section = next.sections.find((entry) => entry.id === sectionId)
  if (!section) {
    return { project: next, activeBlockId: null, activeBlockIds: [] }
  }

  const orderedIds = section.blockIds.filter((blockId) => idsToDuplicate.includes(blockId))
  if (orderedIds.length === 0) {
    return { project: next, activeBlockId: null, activeBlockIds: [] }
  }

  const duplicatedIds: string[] = []

  for (const blockId of orderedIds) {
    const snapshot = captureBlockTree(blockId, project.blocks, project.columnBlocks)
    if (!snapshot) continue

    const instantiated = instantiateBlockTree(snapshot)
    Object.assign(next.blocks, instantiated.blocks)
    Object.assign(next.columnBlocks, instantiated.columnBlocks)
    duplicatedIds.push(instantiated.rootId)
  }

  if (duplicatedIds.length === 0) {
    return { project: next, activeBlockId: null, activeBlockIds: [] }
  }

  const lastSelectedIndex = Math.max(...orderedIds.map((blockId) => section.blockIds.indexOf(blockId)))
  section.blockIds.splice(lastSelectedIndex + 1, 0, ...duplicatedIds)

  return {
    project: next,
    activeBlockId: duplicatedIds[duplicatedIds.length - 1] ?? null,
    activeBlockIds: duplicatedIds,
  }
}

export function pasteBlockTreeToSectionProject(
  project: Project,
  sectionId: string,
  snapshot: BlockTreeSnapshot,
): EngineResult {
  const next = cloneProject(project)
  const section = next.sections.find((entry) => entry.id === sectionId)
  if (!section) {
    return {
      project: next,
      activeBlockId: null,
      activeBlockIds: [],
    }
  }

  const instantiated = instantiateBlockTree(snapshot)
  Object.assign(next.blocks, instantiated.blocks)
  Object.assign(next.columnBlocks, instantiated.columnBlocks)
  section.blockIds.push(instantiated.rootId)

  return {
    project: next,
    activeBlockId: instantiated.rootId,
    activeBlockIds: [instantiated.rootId],
  }
}

export function duplicateBlockInColumnProject(
  project: Project,
  columnId: string,
  blockId: string,
): EngineResult {
  const next = cloneProject(project)
  const snapshot = captureBlockTree(blockId, project.blocks, project.columnBlocks)
  if (!snapshot) {
    return { project: next, activeBlockId: null, activeBlockIds: [] }
  }

  const instantiated = instantiateBlockTree(snapshot)
  Object.assign(next.blocks, instantiated.blocks)
  Object.assign(next.columnBlocks, instantiated.columnBlocks)

  const colList = [...(next.columnBlocks[columnId] || [])]
  const index = colList.indexOf(blockId)
  if (index !== -1) {
    colList.splice(index + 1, 0, instantiated.rootId)
  } else {
    colList.push(instantiated.rootId)
  }
  next.columnBlocks[columnId] = colList

  return {
    project: next,
    activeBlockId: instantiated.rootId,
    activeBlockIds: [instantiated.rootId],
  }
}
