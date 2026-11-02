import type { DataSchema, JsonObject, JsonValue, TemplateDefinition, TemplateNode, TemplateValue } from '../template-core/schema'

export interface PresentationSetting {
  id: string
  label: string
  description?: string
  control?: 'text' | 'number' | 'slider' | 'color' | 'select' | 'alignment' | 'toggle'
  schema: DataSchema
  defaultValue: JsonValue
  exposed: boolean
  unit?: '' | 'px' | 'mm' | 'pt' | '%' | 'rem'
  targets: { nodeId: string; property: string }[]
}
export interface TemplateTheme {
  colors: { primary: string; primaryForeground: string; background: string; foreground: string; muted: string; mutedForeground: string }
  typography: { fontFamily: string; text: number; small: number; h1: number; h2: number; lineHeight: number }
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number }
  actions: { height: number; paddingInline: number; radius: number }
}
export type TemplateThemeInput = { [K in keyof TemplateTheme]?: Partial<TemplateTheme[K]> }
export interface RuntimeBinding {
  id: string
  path: string
  kind: 'text' | 'attribute' | 'link' | 'image' | 'style'
  property?: string
  unit?: PresentationSetting['unit']
}
export type TextRuntimeBinding = Pick<RuntimeBinding, 'id' | 'path'> & { kind: 'text' }
export type FamilyVariationPoint =
  | { id: string; label: string; kind: 'node-property'; nodeId: string; property: 'name' | 'tag' | 'classes' | 'parts'; schema: DataSchema }
  | { id: string; label: string; kind: 'node-style'; nodeId: string; property: string; schema: DataSchema }
  | { id: string; label: string; kind: 'block-property'; nodeId: string; property: string; allowedSources: TemplateValue['source'][] }
  | { id: string; label: string; kind: 'placement'; nodeId: string; allowedKinds: TemplateNode['kind'][]; allowedBlocks?: { id: string; version: number }[] }
  | { id: string; label: string; kind: 'children'; target: { kind: 'roots' } | { kind: 'children'; nodeId: string } | { kind: 'block-slot'; nodeId: string; slot: string }; minItems: number; maxItems: number; allowedKinds: TemplateNode['kind'][]; requiredIds?: string[] }

export type FamilyVariationOverride =
  | { kind: 'node-property'; value: JsonValue }
  | { kind: 'node-style'; value: string | null }
  | { kind: 'block-property'; value: TemplateValue }
  | { kind: 'placement'; node: TemplateNode; nodes?: Record<string, TemplateNode> }
  | { kind: 'children'; order: string[]; nodes?: Record<string, TemplateNode> }

export interface FamilyOverrides {
  content?: JsonObject
  settingsDefaults?: JsonObject
  exposedInputs?: string[]
  exposedSettings?: string[]
  variations?: Record<string, FamilyVariationOverride>
}

export interface BindingDocument {
  format: 'template-document'
  schemaVersion: 1
  target: 'email' | 'document'
  source: { mode: 'standalone'; definition: TemplateDefinition }
  variationPoints?: FamilyVariationPoint[]
  dataSchema: Extract<DataSchema, { type: 'object' }>
  content: JsonObject
  inputDefaults: JsonObject
  settingsDefaults: JsonObject
  exposedInputs: string[]
  exposedSettings: string[]
  settingsSpec: PresentationSetting[]
  theme: TemplateTheme
  dependencies: { resourceId: string; revision: number }[]
  managedAssets?: Record<string, string>
  compilerVersion?: 'template-platform/1'
  /** Authored sidecars and their authoritative text token declarations survive artifact-free drafts. */
  rendering?: { engine: 'bindings' | 'shared'; subject?: string; text?: string; bindings?: TextRuntimeBinding[] }
  artifacts: { engine: 'bindings' | 'shared'; html: string; css: string; bindings: RuntimeBinding[]; subject?: string; text?: string }
}
export interface ScopedTemplateResource {
  id: string
  key: string
  scope: 'tenant' | 'group' | 'template'
  groupId?: string
  templateId?: string
}

export type StandaloneTemplateDraft = Omit<BindingDocument, 'artifacts'> & { artifacts?: BindingDocument['artifacts'] }
export interface GroupVariantDocument {
  compiled?: { sourceKey: string; artifacts: BindingDocument['artifacts'] }
  format: 'template-document'
  schemaVersion: 1
  target: BindingDocument['target']
  source: { mode: 'group-variant'; group: { id: string; revision: number }; overrides: FamilyOverrides }
}
export type TemplateSourceDocument = StandaloneTemplateDraft | GroupVariantDocument
