import type { LucideIcon } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// Block Definition System — Types
// ═══════════════════════════════════════════════════════════════

// ── Child template (for composable blocks) ──────────────────────
export interface ChildTemplate {
  type: string
  alias: string
  contentOverrides?: Record<string, unknown>
  settingsOverrides?: Record<string, unknown>
}

export type BlockChildKind = 'none' | 'block-list' | 'row-columns' | 'grid-cells'

export interface BlockCapabilities {
  /**
   * How this block owns nested block relationships.
   * - `none`: leaf block
   * - `block-list`: children are stored under `columnBlocks[parentId]`
   * - `row-columns`: structural child containers are stored in `content.columnIds`
   * - `grid-cells`: structural child containers are stored in `content.cellIds`
   */
  childKind?: BlockChildKind
}

// ── Block categories ─────────────────────────────────────────────
export type BlockCategory = 'layout' | 'content' | 'media'

// ── Field schema types ───────────────────────────────────────────
// These define WHAT the data is, not HOW it renders.
// The settings system picks the right control based on type + constraints.

export interface FieldConditional {
  /** Only show this field when another field has a specific value */
  when?: { field: string; value: unknown }
}

export type FieldSchema =
  | ({ type: 'string'; default: string; placeholder?: string; multiline?: boolean; mono?: boolean; rows?: number; richText?: boolean } & FieldConditional)
  | ({ type: 'number'; default: number; min?: number; max?: number; step?: number; suffix?: string } & FieldConditional)
  | ({ type: 'boolean'; default: boolean } & FieldConditional)
  | ({ type: 'enum'; default: string; options: { value: string; label: string }[]; display?: 'pills' | 'select' } & FieldConditional)
  | ({ type: 'color'; default: string } & FieldConditional)
  | ({ type: 'alignment'; default: 'left' | 'center' | 'right'; withJustify?: boolean } & FieldConditional)
  | ({ type: 'dimension'; default: { value: number; unit: string }; units: string[] } & FieldConditional)
  | ({ type: 'image'; default: string } & FieldConditional)
  | ({ type: 'list'; default: string[]; placeholder?: string; addLabel?: string; maxItems?: number; richText?: boolean } & FieldConditional)
  | ({ type: 'slider'; default: number; min: number; max: number; step?: number; suffix?: string } & FieldConditional)
  | ({ type: 'stepper'; default: number; min?: number; max?: number; step?: number; suffix?: string } & FieldConditional)
  | ({ type: 'icon'; default: string } & FieldConditional)

// ── Settings group layout ────────────────────────────────────────
export interface SettingsGroupDef {
  title: string
  display?: 'collapsible' | 'flat'
  defaultOpen?: boolean
  description?: string
  /** Field keys from content + settings to show in this group */
  fields: string[]
  /** Conditional: only show this group when a field has a specific value */
  when?: { field: string; value: unknown }
}

// ── Trait reference (inline to avoid circular import) ────────────
export type BlockTraitRef =
  | string
  | {
      trait: string
      as?: string
      title?: string
      defaults?: Record<string, unknown>
      hideFields?: string[]
      defaultOpen?: boolean
      display?: SettingsGroupDef['display']
    }

// ── Block definition ─────────────────────────────────────────────
export interface BlockDefinition<
  TContent extends Record<string, FieldSchema> = Record<string, FieldSchema>,
  TSettings extends Record<string, FieldSchema> = Record<string, FieldSchema>,
> {
  /** Unique block type key */
  type: string
  /** Display name */
  name: string
  /** Short description for library/tooltips */
  description: string
  /** Lucide icon */
  icon: LucideIcon
  /** Category for grouping in library */
  category: BlockCategory

  /** Where this block can be placed */
  allowedIn: ('page' | 'column')[]
  /** Whether this block can contain child blocks */
  canContain: boolean | BlockCategory[]

  /** Child templates for composable blocks — auto-created when block is added */
  childTemplates?: ChildTemplate[]

  /** Runtime/editor capabilities for graph and engine logic */
  capabilities?: BlockCapabilities

  /** Content fields — what the user types (text, urls, data) */
  content: TContent
  /** Settings fields — how it looks/behaves (styles, options) */
  settings: TSettings

  /**
   * How settings are grouped in the panel.
   * Entries can be a group definition OR a `'trait:<id>'` marker that
   * injects the corresponding trait group at that position.
   */
  settingsLayout: (SettingsGroupDef | string)[]

  /** Hide from block library (child-only / internal blocks) */
  hidden?: boolean

  /**
   * When true, child settings (style/appearance groups) are hidden
   * when the block is selected inside a composable parent.
   * Only content groups are shown. Default: false.
   */
  contentOnlyWhenChild?: boolean

  /**
   * Which container settings groups to show. Default: all.
   * Use to opt out of irrelevant container sections.
   * @deprecated Use `scopes` instead — kept for backwards compatibility during migration.
   */
  containerGroups?: ('spacing' | 'surface' | 'border')[]

  /**
   * Ordered list of scope ids rendered after the block's `settingsLayout`.
   * Defaults to `DEFAULT_SCOPE_IDS` from the scope registry.
   * Use to add (e.g. 'visibility') or remove scopes for this block.
   */
  scopes?: string[]

  /** Per-scope overrides (hide fields, rename title, toggle default-open). */
  scopeOverrides?: Record<string, { hiddenFields?: string[]; defaultOpen?: boolean; title?: string }>

  /**
   * Traits to compose into this block. Each trait contributes fields
   * (merged into content/settings) and a settings group (appended to
   * settingsLayout unless placed explicitly via a 'trait:<id>' marker).
   */
  traits?: BlockTraitRef[]

  /** React component that renders this block */
  render: React.ComponentType<{ block: any }>
}

// ── Inferred types from field schemas ────────────────────────────

/** Extract the runtime value type from a FieldSchema */
export type FieldValue<F extends FieldSchema> =
  F extends { type: 'string' } ? string :
  F extends { type: 'number' } ? number :
  F extends { type: 'boolean' } ? boolean :
  F extends { type: 'enum' } ? string :
  F extends { type: 'color' } ? string :
  F extends { type: 'alignment' } ? string :
  F extends { type: 'dimension' } ? { value: number; unit: string } :
  F extends { type: 'image' } ? string :
  F extends { type: 'list' } ? string[] :
  F extends { type: 'slider' } ? number :
  F extends { type: 'stepper' } ? number :
  F extends { type: 'icon' } ? string :
  never

/** Extract defaults from a field map */
export type FieldDefaults<T extends Record<string, FieldSchema>> = {
  [K in keyof T]: FieldValue<T[K]>
}

// ── Block instance (runtime data) ────────────────────────────────

export interface CommonBlockSettings {
  alias?: string
  fullWidth: boolean
  paddingTop: number
  paddingBottom: number
  paddingLeft: number
  paddingRight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  backgroundColor: string
  borderWidth: number
  borderColor: string
  borderStyle: 'solid' | 'dashed' | 'dotted'
  borderRadius: number
  opacity: number
  visibility: 'visible' | 'print-only' | 'screen-only'
  boxShadow: string
  minHeight: number
  anchor: string
  dynamicKey: string
  dynamicKeySource: 'data' | 'content' | 'asset'
  previewValue: string
  animation: 'none' | 'fade-in' | 'slide-up' | 'zoom-in'
  animationDelay: number
  pageBreakBefore: boolean
  pageBreakAfter: boolean
}

export const DEFAULT_COMMON_SETTINGS: CommonBlockSettings = {
  fullWidth: false,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderColor: '#e5e7eb',
  borderStyle: 'solid' as const,
  borderRadius: 0,
  opacity: 1,
  visibility: 'visible' as const,
  boxShadow: '',
  minHeight: 0,
  anchor: '',
  dynamicKey: '',
  dynamicKeySource: 'data',
  previewValue: '',
  animation: 'none' as const,
  animationDelay: 0,
  pageBreakBefore: false,
  pageBreakAfter: false,
}

export interface BlockInstance {
  id: string
  type: string
  commonSettings: CommonBlockSettings
  content: Record<string, unknown>
  settings: Record<string, unknown>
}
