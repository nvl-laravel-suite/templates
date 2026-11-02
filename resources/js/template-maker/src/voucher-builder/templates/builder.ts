import type { Project, BlockType } from '../schema'
import { nanoid } from 'nanoid'

export interface TemplateBlockTree {
  rootId: string
  blocks: Record<string, any>
  columnBlocks: Record<string, string[]>
}

export interface TemplateDraft {
  blocks: Record<string, any>
  columnBlocks: Record<string, string[]>
  mainRootIds: string[]
  sidebarRootIds: string[]
}

export function createTemplateDraft(): TemplateDraft {
  return {
    blocks: {},
    columnBlocks: {},
    mainRootIds: [],
    sidebarRootIds: [],
  }
}

export function addTemplateTree(
  draft: TemplateDraft,
  tree: TemplateBlockTree,
  placement: 'main' | 'sidebar' = 'main',
) {
  Object.assign(draft.blocks, tree.blocks)
  Object.assign(draft.columnBlocks, tree.columnBlocks)
  if (placement === 'sidebar') {
    draft.sidebarRootIds.push(tree.rootId)
  } else {
    draft.mainRootIds.push(tree.rootId)
  }
}

export function addTemplateLeaf(
  draft: TemplateDraft,
  blockId: string,
  block: any,
  placement: 'main' | 'sidebar' = 'main',
) {
  draft.blocks[blockId] = block
  if (placement === 'sidebar') {
    draft.sidebarRootIds.push(blockId)
  } else {
    draft.mainRootIds.push(blockId)
  }
}

export function buildTemplateProject(args: {
  draft: TemplateDraft
  global: Project['global']
  sectionId?: string
  title?: string
}): Project {
  const { draft, global } = args

  return {
    global,
    blocks: draft.blocks,
    sections: [
      { id: nanoid(8), height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: draft.mainRootIds },
      { id: nanoid(8), height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
      { id: nanoid(8), height: 90, padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center' as const, blockIds: [] },
    ],
    columnBlocks: draft.columnBlocks,
    frame: { imageUrl: null, opacity: 1 },
  }
}

export function createTemplateTree(
  rootId: string,
  blocks: Record<string, any>,
  columnBlocks: Record<string, string[]>,
): TemplateBlockTree {
  return { rootId, blocks, columnBlocks }
}

export type TemplateTreeFactory = (
  type: BlockType,
  id: string,
  contentOverrides?: Record<string, unknown>,
  settingsOverrides?: Record<string, unknown>,
) => TemplateBlockTree
