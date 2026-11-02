import type { TemplateEditorOptions } from '../template-core/editing'
import type { Project } from './schema'
import type { VoucherTemplate } from './templates/types'
import type { BuilderActionEvent } from './store/events'
import type { VoucherBuilderError, VoucherExportResult, VoucherSelectionSnapshot } from './api-types'
import type { VoucherBuilderInstance } from './instance'

export interface VoucherBuilderConfig {
  /**
   * Preloaded templates supplied by the host application.
   * The component never fetches or persists this library.
   */
  templates?: VoucherTemplate[]
}

export interface VoucherBuilderFeatures {
  templates: boolean
  blockLibrary: boolean
  elementsPanel: boolean
  globalSettings: boolean
  blockSettings: boolean
  validation: boolean
  export: boolean
  importJson: boolean
  preview: boolean
  previewData: boolean
  debugTools: boolean
  commandPalette: boolean
  contextMenu: boolean
  clipboard: boolean
  undoRedo: boolean
  security: boolean
}

export interface VoucherBuilderCallbacks {
  onChange?: (project: Project) => void
  onExport?: (format: 'html' | 'json', data: string) => void
  /** Observe locally generated output. The host decides what to do with it. */
  onExportComplete?: (result: VoucherExportResult) => void
  onSelectionChange?: (selection: VoucherSelectionSnapshot) => void
  /** Validation, export, and observer failures are reported here. */
  onError?: (error: VoucherBuilderError) => void
  /** Fires after a template is added to this in-memory library. */
  onTemplateAdd?: (template: VoucherTemplate) => void
  /** Fires after a user template is updated. */
  onTemplateUpdate?: (template: VoucherTemplate) => void
  /** Fires after a user template is deleted. */
  onTemplateDelete?: (template: VoucherTemplate) => void
  /**
   * Fires for every meaningful builder action (block add/remove/update,
   * undo/redo, project load/reset, template load, clipboard, section
   * changes, global / frame updates). Use this to integrate with host
   * analytics, replicate state, or trigger downstream workflows.
   *
   * The event union is exported as `BuilderActionEvent`.
   */
  onAction?: (event: BuilderActionEvent) => void
}

export type VoucherBuilderMode = 'admin' | 'editor' | 'viewer'

export interface VoucherWorkspaceProps extends VoucherBuilderCallbacks {
  /** Share local document state and commands with custom controls. */
  instance?: VoucherBuilderInstance
  config?: VoucherBuilderConfig
  features?: Partial<VoucherBuilderFeatures>
  mode?: VoucherBuilderMode
  initialProject?: Project
  /** Debounce for onChange, in milliseconds. Defaults to 100. */
  changeDebounceMs?: number
  locale?: string
  theme?: 'light' | 'dark' | 'system'
  className?: string
}

/** The compatibility bridge accepts template callbacks inside personalization only. */
export type VoucherPersonalizationProps = {
  personalization: TemplateEditorOptions
  className?: string
  theme?: 'light' | 'dark'
} & { [K in Exclude<keyof VoucherWorkspaceProps, 'className' | 'theme'>]?: never }

export type VoucherBuilderProps =
  | (VoucherWorkspaceProps & { personalization?: never })
  | VoucherPersonalizationProps

const ALL_ENABLED: VoucherBuilderFeatures = {
  templates: true,
  blockLibrary: true,
  elementsPanel: true,
  globalSettings: true,
  blockSettings: true,
  validation: true,
  export: true,
  importJson: true,
  preview: true,
  previewData: true,
  debugTools: true,
  commandPalette: true,
  contextMenu: true,
  clipboard: true,
  undoRedo: true,
  security: false,
}

export const MODE_PRESETS: Readonly<Record<VoucherBuilderMode, Readonly<VoucherBuilderFeatures>>> = Object.freeze({
  admin: Object.freeze({ ...ALL_ENABLED, security: false }),
  editor: Object.freeze({ ...ALL_ENABLED, importJson: false, debugTools: false, security: true }),
  viewer: Object.freeze({
    templates: false, blockLibrary: false, elementsPanel: false,
    globalSettings: false, blockSettings: false, validation: false,
    export: true, importJson: false, preview: true, previewData: true,
    debugTools: false, commandPalette: false, contextMenu: false,
    clipboard: false, undoRedo: false, security: true,
  }),
})

export function resolveFeatures(mode?: VoucherBuilderMode, overrides?: Partial<VoucherBuilderFeatures>): VoucherBuilderFeatures {
  const base = mode && MODE_PRESETS[mode] ? MODE_PRESETS[mode] : ALL_ENABLED
  return { ...base, ...overrides }
}
