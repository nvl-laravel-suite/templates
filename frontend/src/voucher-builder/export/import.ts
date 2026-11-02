import { nanoid } from 'nanoid'
import type { Block, BlockType, Project, VoucherSection } from '#/voucher-builder/schema'
import { ProjectSchema } from '#/voucher-builder/schema'
import { defaultGlobal, createEmptyProject } from '#/voucher-builder/lib/empty-project'
import { DEFAULT_COMMON_SETTINGS } from '#/voucher-builder/blocks/types'
import { hasBlockListChildren } from '#/voucher-builder/blocks'
import { SECTION_IDS, DEFAULT_SECTION_HEIGHTS } from '#/voucher-builder/lib/voucher'
import type { ExportBlock, VoucherExport, VoucherExportV1, VoucherSectionExport } from './json'

export interface ImportResult {
  project: Project | null
  errors: string[]
  warnings: string[]
}

export interface ParseImportOptions {
  /**
   * When true, run the resulting Project through `ProjectSchema.safeParse`
   * and reject on any zod failure. Catches malformed envelopes that pass
   * the shape sniffer but violate enum / required-field constraints.
   * Defaults to `false` so legacy callers see no behaviour change.
   */
  strict?: boolean
}

function isVoucherExportV2(raw: unknown): raw is VoucherExport {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return r.format === 'gct-voucher' && r.version === 2 && !!r.project && typeof r.project === 'object'
}

function isVoucherExportV1(raw: unknown): raw is VoucherExportV1 {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return r.format === 'gct-voucher' && Array.isArray(r.sections)
}

function isRawProject(raw: unknown): raw is Project {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    !!r.global &&
    !!r.blocks &&
    typeof r.blocks === 'object' &&
    Array.isArray(r.sections)
  )
}

function buildBlockFromExport(
  exported: ExportBlock,
  warnings: string[],
): { block: Block; descendants: Record<string, Block>; columnBlocks: Record<string, string[]> } {
  const id = nanoid(8)
  const descendants: Record<string, Block> = {}
  const columnBlocks: Record<string, string[]> = {}

  const childIds: string[] = []
  if (exported.children && exported.children.length > 0) {
    if (!hasBlockListChildren(exported.type)) {
      warnings.push(
        `Block type "${exported.type}" has children in the export but is not a composable; children dropped.`,
      )
    } else {
      for (const child of exported.children) {
        const sub = buildBlockFromExport(child, warnings)
        childIds.push(sub.block.id)
        descendants[sub.block.id] = sub.block
        Object.assign(descendants, sub.descendants)
        Object.assign(columnBlocks, sub.columnBlocks)
      }
      columnBlocks[id] = childIds
    }
  }

  const content = { ...(exported.content || {}) } as Record<string, unknown>
  // Composable parents mirror their child id list under content.childIds
  if (childIds.length > 0 && hasBlockListChildren(exported.type)) {
    content.childIds = childIds
  }

  const block: Block = {
    id,
    type: exported.type as BlockType,
    commonSettings: { ...DEFAULT_COMMON_SETTINGS, ...(exported.commonSettings || {}) },
    content: content as Block['content'],
    settings: { ...(exported.settings || {}) } as Block['settings'],
  } as Block

  return { block, descendants, columnBlocks }
}

function projectFromVoucherExportV1(raw: VoucherExportV1, warnings: string[]): Project {
  const empty = createEmptyProject()
  const blocks: Record<string, Block> = {}
  const columnBlocks: Record<string, string[]> = {}

  // Build sections, preserving the canonical 3-section layout.
  const exportSections = raw.sections as VoucherSectionExport[]
  const sections = SECTION_IDS.map((id, i): VoucherSection => {
    const incoming = exportSections[i]
    const fallback = empty.sections[i]
    const blockIds: string[] = []

    if (incoming?.blocks) {
      for (const exportedBlock of incoming.blocks) {
        const { block, descendants, columnBlocks: nestedCols } = buildBlockFromExport(exportedBlock, warnings)
        blocks[block.id] = block
        Object.assign(blocks, descendants)
        Object.assign(columnBlocks, nestedCols)
        blockIds.push(block.id)
      }
    } else if (incoming) {
      warnings.push(`Section ${i + 1} was exported in HTML mode; blocks not recoverable.`)
    }

    return {
      id,
      height: incoming?.height ?? DEFAULT_SECTION_HEIGHTS[i],
      padding: incoming?.padding ?? fallback.padding,
      backgroundColor: incoming?.backgroundColor ?? fallback.backgroundColor,
      backgroundOpacity: fallback.backgroundOpacity,
      widthMode: fallback.widthMode,
      verticalAlign: fallback.verticalAlign,
      blockIds,
    }
  })

  if (exportSections.length > 3) {
    warnings.push(`Import truncated extra sections (${exportSections.length - 3} dropped).`)
  }

  const margin = raw.margins?.top ?? defaultGlobal.layout.margin

  const global = {
    ...defaultGlobal,
    layout: { ...defaultGlobal.layout, margin },
    typography: {
      ...defaultGlobal.typography,
      headingFont: raw.global?.fonts?.heading ?? defaultGlobal.typography.headingFont,
      bodyFont: raw.global?.fonts?.body ?? defaultGlobal.typography.bodyFont,
      baseSize: raw.global?.baseSize ?? defaultGlobal.typography.baseSize,
    },
    colors: { ...defaultGlobal.colors, ...(raw.global?.colors || {}) },
  }

  return {
    global,
    blocks,
    sections: sections as Project['sections'],
    columnBlocks,
    frame: raw.frame ?? empty.frame,
  }
}

/**
 * Parse a raw imported value (already JSON.parsed) into a Project, accepting
 * either the gct-voucher export shape or a raw Project snapshot.
 *
 * Pass `{ strict: true }` to additionally run the result through Zod for
 * schema-level validation (catches malformed enums, missing required fields,
 * etc. that the shape sniffer accepts).
 */
export function parseVoucherImport(raw: unknown, options: ParseImportOptions = {}): ImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (raw == null || typeof raw !== 'object') {
    errors.push('File is not a JSON object.')
    return { project: null, errors, warnings }
  }

  const finalize = (project: Project): ImportResult => {
    if (!options.strict) return { project, errors, warnings }
    const parsed = ProjectSchema.safeParse(project)
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      errors.push(`Strict validation failed: ${issues.join('; ')}`)
      return { project: null, errors, warnings }
    }
    return { project: parsed.data, errors, warnings }
  }

  if (isVoucherExportV2(raw)) {
    const empty = createEmptyProject()
    const p = raw.project
    return finalize({
      global: p.global,
      blocks: p.blocks,
      sections: p.sections,
      columnBlocks: p.columnBlocks ?? {},
      frame: p.frame ?? empty.frame,
    })
  }

  if (isVoucherExportV1(raw)) {
    try {
      warnings.push('Imported a v1 export — structural blocks (rows, grids, tables) and some metadata may be incomplete.')
      const project = projectFromVoucherExportV1(raw, warnings)
      return finalize(project)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Failed to parse export.')
      return { project: null, errors, warnings }
    }
  }

  if (isRawProject(raw)) {
    const r = raw as Project
    return finalize({
      global: r.global,
      blocks: r.blocks,
      sections: r.sections,
      columnBlocks: r.columnBlocks ?? {},
      frame: r.frame ?? createEmptyProject().frame,
    })
  }

  errors.push('Unrecognized format. Expected a gct-voucher export or a project snapshot.')
  return { project: null, errors, warnings }
}
