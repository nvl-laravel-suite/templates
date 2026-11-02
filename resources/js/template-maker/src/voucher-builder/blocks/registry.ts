import type {
  BlockDefinition,
  BlockInstance,
  FieldSchema,
  BlockCategory,
  ChildTemplate,
  BlockCapabilities,
  BlockChildKind,
  SettingsGroupDef,
} from './types'
import { DEFAULT_COMMON_SETTINGS } from './types'
import { nanoid } from 'nanoid'
import {
  getTrait,
  normalizeTraitRef,
  prefixField,
  type TraitInstance,
} from './traits/registry'

// ═══════════════════════════════════════════════════════════════
// Block Registry — single source of truth for all block types
// ═══════════════════════════════════════════════════════════════

const registry = new Map<string, BlockDefinition>()

function resolveBlockCapabilities(def: BlockDefinition): Required<BlockCapabilities> {
  const childKind: BlockChildKind = def.capabilities?.childKind
    ?? (def.childTemplates !== undefined
      ? 'block-list'
      : def.canContain !== false
      ? 'block-list'
      : 'none')

  return { childKind }
}

/** Register a block definition */
export function defineBlock<
  C extends Record<string, FieldSchema>,
  S extends Record<string, FieldSchema>,
>(def: BlockDefinition<C, S>): BlockDefinition<C, S> {
  if (registry.has(def.type)) {
    throw new Error(`Block type "${def.type}" already registered`)
  }
  const merged = def.traits && def.traits.length > 0
    ? mergeTraitsIntoDefinition(def as BlockDefinition)
    : (def as BlockDefinition)
  registry.set(merged.type, merged)
  return def
}

// ── Trait merge ───────────────────────────────────────────────
//
// Runs at registration. Each trait's fields flow into content/settings
// (respecting the source), and each trait's settings group is inserted
// into settingsLayout — either at an explicit `'trait:<id>'` marker
// position or appended after existing groups.
//
function mergeTraitsIntoDefinition(def: BlockDefinition): BlockDefinition {
  const content: Record<string, FieldSchema> = { ...def.content }
  const settings: Record<string, FieldSchema> = { ...def.settings }
  const traitGroups = new Map<string, SettingsGroupDef>()

  for (const ref of def.traits ?? []) {
    const inst = normalizeTraitRef(ref)
    const trait = getTrait(inst.trait)
    if (!trait) {
      console.warn(`[defineBlock] unknown trait "${inst.trait}" on block "${def.type}"`)
      continue
    }

    const groupKey = traitGroupKey(inst)
    const order = trait.fieldOrder ?? Object.keys(trait.fields)
    const hidden = new Set(inst.hideFields ?? [])
    const groupFieldKeys: string[] = []

    for (const localKey of order) {
      if (hidden.has(localKey)) continue
      const field = trait.fields[localKey]
      if (!field) continue

      const mergedKey = prefixField(inst.as, localKey)
      const blockOwns = (field.source === 'content' && mergedKey in content)
        || (field.source === 'settings' && mergedKey in settings)

      if (!blockOwns) {
        const schema = applyFieldDefaults(field.schema, inst.defaults?.[localKey])
        const schemaWithWhen = field.when
          ? { ...schema, when: prefixWhen(field.when, inst.as) }
          : schema

        if (field.source === 'content') {
          content[mergedKey] = schemaWithWhen
        } else {
          settings[mergedKey] = schemaWithWhen
        }
      }
      // Always include in the group's field list — block-owned fields
      // still render with the block's schema.
      groupFieldKeys.push(mergedKey)
    }

    if (groupFieldKeys.length > 0) {
      traitGroups.set(groupKey, {
        title: inst.title ?? (inst.as ? `${titleCase(inst.as)} ${trait.title}` : trait.title),
        description: trait.description,
        display: inst.display ?? trait.display,
        defaultOpen: inst.defaultOpen ?? trait.defaultOpen,
        fields: groupFieldKeys,
      })
    }
  }

  // Resolve settingsLayout: replace `'trait:<key>'` markers with the
  // matching group; append any remaining unmatched trait groups.
  const layout: SettingsGroupDef[] = []
  const consumed = new Set<string>()
  for (const entry of def.settingsLayout) {
    if (typeof entry === 'string') {
      // Marker shape: 'trait:<id>' or 'trait:<id>:<as>'
      if (!entry.startsWith('trait:')) continue
      const key = entry.slice('trait:'.length)
      const group = traitGroups.get(key)
      if (group) {
        layout.push(group)
        consumed.add(key)
      }
      continue
    }
    layout.push(entry)
  }
  for (const [key, group] of traitGroups) {
    if (!consumed.has(key)) layout.push(group)
  }

  return { ...def, content, settings, settingsLayout: layout }
}

function traitGroupKey(inst: TraitInstance): string {
  return inst.as ? `${inst.trait}:${inst.as}` : inst.trait
}

function applyFieldDefaults(schema: FieldSchema, override: unknown): FieldSchema {
  if (override === undefined) return schema
  // Narrow the override to match each schema shape — the override is
  // trusted (authored by the block definition).
  return { ...schema, default: override as never } as FieldSchema
}

function prefixWhen(when: { field: string; value: unknown }, as?: string): { field: string; value: unknown } {
  if (!as) return when
  return { field: prefixField(as, when.field), value: when.value }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Get a block definition by type */
export function getBlockDef(type: string): BlockDefinition | undefined {
  return registry.get(type)
}

/** Get all registered block definitions */
export function getAllBlockDefs(): BlockDefinition[] {
  return Array.from(registry.values())
}

export function getBlockCapabilities(type: string): Required<BlockCapabilities> | undefined {
  const def = registry.get(type)
  if (!def) return undefined
  return resolveBlockCapabilities(def)
}

/** Get block definitions by category */
export function getBlockDefsByCategory(category: BlockCategory): BlockDefinition[] {
  return getAllBlockDefs().filter((d) => d.category === category)
}

/** Get all registered block type keys */
export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys())
}

/** Check if a block type can be placed in a context */
export function canPlaceIn(blockType: string, context: 'page' | 'column'): boolean {
  const def = registry.get(blockType)
  if (!def) return false
  return def.allowedIn.includes(context)
}

/** Check if a container block can hold a specific child block type */
export function canContainBlock(containerType: string, childType: string): boolean {
  const containerDef = registry.get(containerType)
  const childDef = registry.get(childType)
  if (!containerDef || !childDef) return false
  if (containerDef.canContain === false) return false
  if (containerDef.canContain === true) return true
  return (containerDef.canContain as BlockCategory[]).includes(childDef.category)
}

export function getBlockChildKind(type: string): BlockChildKind {
  return getBlockCapabilities(type)?.childKind || 'none'
}

/**
 * A "container block" owns nested children — either via block-list
 * (column, section, composables) or structural (row, grid).
 * Lightweight helper so UI code doesn't hardcode `['row','grid',…]`.
 */
export function isContainerBlockType(type: string): boolean {
  const kind = getBlockChildKind(type)
  return kind !== 'none'
}

// ── Block label resolution ───────────────────────────────────────
// Single source of truth for "what label should this block show in
// the elements tree / outline / breadcrumb?"
//
// Priority: explicit alias → block-specific derived label → definition name

interface LabelOfOptions {
  /** Optional index (used by `column` to emit "Col N"). */
  index?: number
  /** Max chars for derived text-based labels. Default 24. */
  maxChars?: number
}

function stripTagsAndTruncate(raw: string | undefined, max: number, fallback: string): string {
  const text = (raw || '').replace(/<[^>]*>/g, '')
  if (!text) return fallback
  return text.length > max ? text.slice(0, max) + '…' : text
}

function titleCaseFromKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

/**
 * Compute a display label for any block instance.
 * Used by the outline, element tree, block context menu, and mixed-selection badges.
 */
export function labelOf(
  block: { type: string; commonSettings?: { alias?: string }; content?: Record<string, unknown> },
  opts: LabelOfOptions = {},
): string {
  const alias = block.commonSettings?.alias
  if (alias) return alias

  const content = block.content ?? {}
  const max = opts.maxChars ?? 24
  const def = registry.get(block.type)

  switch (block.type) {
    case 'heading':
      return stripTagsAndTruncate(content.text as string, max, 'Heading')
    case 'text':
      return stripTagsAndTruncate(content.body as string, max, 'Text')
    case 'button':
      return (content.text as string) || 'Button'
    case 'list':
      return `List (${(content.items as string[] | undefined)?.length || 0})`
    case 'image':
      return (content.alt as string) || 'Image'
    case 'row':
      return `${content.columnCount ?? '?'}-Col Row`
    case 'grid':
      return `${content.columns ?? '?'}×${content.rows ?? '?'} Grid`
    case 'column':
      return opts.index !== undefined ? `Col ${opts.index + 1}` : (def?.name || 'Column')
    default:
      return def?.name || titleCaseFromKey(block.type)
  }
}

export function hasBlockListChildren(type: string): boolean {
  return getBlockChildKind(type) === 'block-list'
}

export function hasManagedChildren(type: string): boolean {
  return getBlockChildKind(type) !== 'none'
}

export function isStructuralType(type: string): boolean {
  const childKind = getBlockChildKind(type)
  return childKind === 'row-columns' || childKind === 'grid-cells'
}

export function getStructuralChildField(type: string): 'columnIds' | 'cellIds' | null {
  const childKind = getBlockChildKind(type)
  if (childKind === 'row-columns') return 'columnIds'
  if (childKind === 'grid-cells') return 'cellIds'
  return null
}

export function getStructuralChildIds(block: { type: string; content?: Record<string, unknown> }): string[] {
  const field = getStructuralChildField(block.type)
  if (!field) return []
  const value = block.content?.[field]
  return Array.isArray(value) ? value.map(String) : []
}

// ── Defaults ─────────────────────────────────────────────────────

/** Extract default value from a field schema */
function getFieldDefault(field: FieldSchema): unknown {
  return field.default
}

/** Extract all defaults from a field map */
function getFieldMapDefaults(fields: Record<string, FieldSchema>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    result[key] = getFieldDefault(field)
  }
  return result
}

/** Create a new block instance with defaults */
export function createBlock(type: string, id?: string): BlockInstance {
  const def = registry.get(type)
  if (!def) throw new Error(`Unknown block type: ${type}`)

  return {
    id: id || nanoid(8),
    type,
    commonSettings: { ...DEFAULT_COMMON_SETTINGS },
    content: getFieldMapDefaults(def.content),
    settings: getFieldMapDefaults(def.settings),
  }
}

/** Get child templates for a composable block type */
export function getComposableTemplates(type: string): ChildTemplate[] | undefined {
  return registry.get(type)?.childTemplates
}

/** Check if a block type is composable (has child templates) */
export function isComposableType(type: string): boolean {
  const templates = registry.get(type)?.childTemplates
  return !!templates && templates.length > 0
}

// ── Categories for UI ────────────────────────────────────────────

export const BLOCK_CATEGORIES: { key: BlockCategory; label: string }[] = [
  { key: 'content', label: 'Text & Content' },
  { key: 'media', label: 'Media & Data' },
  { key: 'layout', label: 'Layout' },
]
