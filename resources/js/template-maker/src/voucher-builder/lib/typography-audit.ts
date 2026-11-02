import type { Project, Block } from '../schema'

// ── Block type → family classification ──────────────────────────
// A "family" is a group of blocks that should visually match one another.
// Headings form one family, body text another, buttons another, etc.
// Metric + metadata contribute two families each — one for the primary
// text, one for the secondary label text (via prefixed settings keys).

export type TypographyFamily =
  | 'heading'
  | 'text'
  | 'button'
  | 'badge'
  | 'metric-value'
  | 'metric-label'
  | 'list'
  | 'date'
  | 'metadata-field'
  | 'metadata-label'
  | 'dataPlaceholder'

const FAMILY_LABELS: Record<TypographyFamily, string> = {
  heading: 'Headings',
  text: 'Paragraph text',
  button: 'Buttons',
  badge: 'Badges',
  'metric-value': 'Metric values',
  'metric-label': 'Metric labels',
  list: 'Lists',
  date: 'Dates',
  'metadata-field': 'Metadata fields',
  'metadata-label': 'Metadata labels',
  dataPlaceholder: 'Placeholders',
}

/**
 * List of families a block type contributes to. Most contribute one;
 * metric + metadata contribute two (primary/secondary via prefixed keys).
 */
function familiesOf(type: string): TypographyFamily[] {
  switch (type) {
    case 'heading': return ['heading']
    case 'text': return ['text']
    case 'button': return ['button']
    case 'badge': return ['badge']
    case 'list': return ['list']
    case 'date': return ['date']
    case 'dataPlaceholder': return ['dataPlaceholder']
    case 'metric': return ['metric-value', 'metric-label']
    case 'metadata': return ['metadata-field', 'metadata-label']
    default: return []
  }
}

/** Prefix used when reading settings attributes for a family. */
function prefixForFamily(family: TypographyFamily): string | null {
  switch (family) {
    case 'metric-label': return 'label'
    case 'metadata-field': return 'field'
    case 'metadata-label': return 'label'
    default: return null
  }
}

// ── Attributes we audit ────────────────────────────────────────

export type TypographyAttr =
  | 'fontSize'
  | 'fontWeight'
  | 'alignment'
  | 'letterSpacing'
  | 'textTransform'
  | 'lineHeight'
  | 'textColor'

export const TYPOGRAPHY_ATTR_LABELS: Record<TypographyAttr, string> = {
  fontSize: 'Font size',
  fontWeight: 'Font weight',
  alignment: 'Alignment',
  letterSpacing: 'Letter spacing',
  textTransform: 'Transform',
  lineHeight: 'Line height',
  textColor: 'Text color',
}

const ATTR_ORDER: TypographyAttr[] = [
  'fontSize',
  'fontWeight',
  'alignment',
  'textColor',
  'letterSpacing',
  'textTransform',
  'lineHeight',
]

// ── Report shapes ──────────────────────────────────────────────

export interface AttributeVariance {
  attr: TypographyAttr
  values: Array<{ value: string; count: number; blockIds: string[] }>
  majority: string
  total: number
}

export interface FamilyReport {
  family: TypographyFamily
  familyLabel: string
  blockIds: string[]
  variances: AttributeVariance[]
}

/** A hint across two families — e.g. headings and buttons use different weights. */
export interface CrossFamilyHint {
  attr: TypographyAttr
  /** The families involved in the divergence, each with their dominant value. */
  families: Array<{ family: TypographyFamily; familyLabel: string; value: string; count: number }>
}

export interface TypographyCohesionReport {
  families: FamilyReport[]
  totalVariances: number
  crossFamily: CrossFamilyHint[]
}

// ── Value formatting ────────────────────────────────────────────

export function formatAttrValue(attr: TypographyAttr, value: string): string {
  if (value === '' || value === '0' || value == null) return '(default)'
  switch (attr) {
    case 'fontSize':
      return value.toUpperCase()
    case 'fontWeight':
    case 'alignment':
    case 'letterSpacing':
    case 'textTransform':
      return value.charAt(0).toUpperCase() + value.slice(1)
    case 'lineHeight':
      return Number(value).toFixed(1)
    case 'textColor':
      return value
    default:
      return value
  }
}

// ── Walker ──────────────────────────────────────────────────────

function walkAllBlocks(project: Project): Block[] {
  const { blocks, sections, columnBlocks } = project
  const seen = new Set<string>()
  const out: Block[] = []

  const visit = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const block = blocks[id]
    if (!block) return
    out.push(block)
    const children = columnBlocks[id]
    if (children) for (const c of children) visit(c)
    const structural = (block.content as Record<string, unknown>).columnIds as string[] | undefined
    if (structural) for (const c of structural) visit(c)
    const cells = (block.content as Record<string, unknown>).cellIds as string[] | undefined
    if (cells) for (const c of cells) visit(c)
  }

  for (const section of sections) {
    for (const id of section.blockIds) visit(id)
  }
  return out
}

// ── Attribute read/write with prefix ────────────────────────────

function prefixedKey(prefix: string | null, attr: TypographyAttr): string {
  if (!prefix) return attr
  return `${prefix}${attr.charAt(0).toUpperCase()}${attr.slice(1)}`
}

function readAttr(family: TypographyFamily, settings: Record<string, unknown>, attr: TypographyAttr): string | null {
  const key = prefixedKey(prefixForFamily(family), attr)
  const v = settings[key]
  if (v === undefined || v === null) return null
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  return null
}

function writeAttrPatch(family: TypographyFamily, attr: TypographyAttr, value: string): Record<string, unknown> {
  const key = prefixedKey(prefixForFamily(family), attr)
  const cast: unknown = attr === 'lineHeight' ? Number(value) : value
  return { [key]: cast }
}

// ── Main analyze ────────────────────────────────────────────────

export function analyzeTypography(project: Project): TypographyCohesionReport {
  const grouped = new Map<TypographyFamily, Block[]>()

  for (const block of walkAllBlocks(project)) {
    for (const fam of familiesOf(block.type)) {
      const arr = grouped.get(fam) ?? []
      arr.push(block)
      grouped.set(fam, arr)
    }
  }

  const families: FamilyReport[] = []
  let totalVariances = 0

  for (const [family, blocks] of grouped) {
    if (blocks.length < 2) continue

    const variances: AttributeVariance[] = []

    for (const attr of ATTR_ORDER) {
      const counts = new Map<string, { count: number; blockIds: string[] }>()
      let total = 0

      for (const block of blocks) {
        const s = (block.settings as Record<string, unknown>) || {}
        const raw = readAttr(family, s, attr)
        if (raw === null) continue
        total += 1
        const entry = counts.get(raw) ?? { count: 0, blockIds: [] }
        entry.count += 1
        entry.blockIds.push(block.id)
        counts.set(raw, entry)
      }

      if (counts.size <= 1) continue

      const values = [...counts.entries()]
        .map(([value, { count, blockIds }]) => ({ value, count, blockIds }))
        .sort((a, b) => b.count - a.count)

      variances.push({ attr, values, majority: values[0].value, total })
      totalVariances += 1
    }

    if (variances.length === 0) continue

    families.push({
      family,
      familyLabel: FAMILY_LABELS[family],
      blockIds: blocks.map((b) => b.id),
      variances,
    })
  }

  // Cross-family hints: when two or more families have an internally-consistent
  // value for an attribute but disagree between each other.
  const crossFamily: CrossFamilyHint[] = []
  for (const attr of ATTR_ORDER) {
    const consistent: Array<{ family: TypographyFamily; familyLabel: string; value: string; count: number }> = []
    for (const [family, blocks] of grouped) {
      if (blocks.length < 1) continue
      const counts = new Map<string, number>()
      for (const block of blocks) {
        const s = (block.settings as Record<string, unknown>) || {}
        const raw = readAttr(family, s, attr)
        if (raw === null) continue
        counts.set(raw, (counts.get(raw) ?? 0) + 1)
      }
      if (counts.size !== 1) continue // family itself must be consistent
      const [[value, count]] = [...counts.entries()]
      consistent.push({ family, familyLabel: FAMILY_LABELS[family], value, count })
    }
    const uniqueValues = new Set(consistent.map((c) => c.value))
    if (uniqueValues.size >= 2 && consistent.length >= 2) {
      crossFamily.push({ attr, families: consistent })
    }
  }

  return { families, totalVariances, crossFamily }
}

// ── Normalization ───────────────────────────────────────────────

export interface NormalizePatch {
  blockId: string
  patch: Record<string, unknown>
}

/**
 * Build the set of block-setting patches that would normalize all blocks
 * in a family to a single value for a given attribute.
 */
export function buildNormalizationPatches(
  project: Project,
  family: TypographyFamily,
  attr: TypographyAttr,
  value: string,
): NormalizePatch[] {
  const patches: NormalizePatch[] = []
  for (const block of walkAllBlocks(project)) {
    if (!familiesOf(block.type).includes(family)) continue
    const s = (block.settings as Record<string, unknown>) || {}
    const current = readAttr(family, s, attr)
    if (current === value) continue
    patches.push({
      blockId: block.id,
      patch: writeAttrPatch(family, attr, value),
    })
  }
  return patches
}
