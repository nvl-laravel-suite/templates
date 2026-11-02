import type { Project, Block } from './schema'
import type { ExportToHTMLOptions } from './export/html'
import type { VoucherBuilderCallbacks, VoucherBuilderConfig } from './types'
import type { ComposerActions } from './store/types'
import type { VoucherTemplate } from './templates/types'
import type { AddVoucherTemplateInput, ImportTemplatesResult } from './templates/registry'

export type VoucherOperation = 'export' | 'import' | 'templates' | 'callback' | 'configuration'

export class VoucherBuilderError extends Error {
  readonly operation: VoucherOperation
  constructor(operation: VoucherOperation, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'VoucherBuilderError'
    this.operation = operation
  }
}

export type VoucherExportResult =
  | { format: 'html'; data: string; filename: string; mimeType: 'text/html' }
  | { format: 'json'; data: string; filename: string; mimeType: 'application/json' }

export interface VoucherExportOptions extends ExportToHTMLOptions {
  format: 'html' | 'json'
  filename?: string
}

export interface VoucherSelectionSnapshot {
  activeBlockId: string | null
  activeBlockIds: string[]
  activeSectionId: string | null
}

export interface VoucherLoadOptions {
  /** `record` makes replacing the document a single undoable edit. */
  history?: 'reset' | 'record'
  /** @deprecated Use `history: 'record'` for an automatic undo snapshot. */
  preserveHistory?: boolean
}

export interface CreateVoucherBuilderOptions extends VoucherBuilderCallbacks {
  initialProject?: Project
  config?: VoucherBuilderConfig
  changeDebounceMs?: number
}

export type VoucherBlockPatch = Omit<Partial<Block>, 'id' | 'type'>

export interface VoucherActions extends ComposerActions {
  updateBlock: (blockId: string, patch: VoucherBlockPatch) => void
  /** @deprecated Public mutations record Undo automatically. Use transaction() to group writes. */
  pushHistory: () => void
  /** Group related writes into one Undo entry and one document notification. */
  transaction: <T>(edit: (actions: VoucherActions) => T) => T
}

export interface VoucherTemplateActions {
  list: () => VoucherTemplate[]
  /** Replace preloaded host templates without fetching or storing anything. */
  replace: (templates: VoucherTemplate[]) => void
  load: (template: VoucherTemplate | string) => Project
  add: (input: Omit<AddVoucherTemplateInput, 'project'> & { project?: Project }) => VoucherTemplate
  update: (id: string, patch: Partial<AddVoucherTemplateInput>) => VoucherTemplate | null
  remove: (id: string) => VoucherTemplate | null
  exportJSON: () => string
  importJSON: (input: string) => ImportTemplatesResult
}
