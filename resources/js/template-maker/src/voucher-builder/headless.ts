/**
 * Headless render entry point.
 *
 * Importing from this subpath gives you the render API and dynamic-key
 * contract without React, dnd-kit, shadcn, zustand, or any DOM-bound
 * dependencies. Composes voucher HTML from supplied JSON in any runtime.
 *
 * ```ts
 * import { renderFromPayload, getProjectDynamicKeys } from '@nicolasvlachos/voucher-builder/headless'
 * ```
 */

export { exportToHTML } from './export/html'
export type { ExportToHTMLOptions } from './export/html'
export { exportToJSON } from './export/json'
export type { VoucherExport, VoucherSectionExport, ExportBlock } from './export/json'
export { parseVoucherImport } from './export/import'
export type { ImportResult } from './export/import'
export { renderFromPayload } from './export/render-from-payload'
export type { RenderPayload, RenderResult } from './export/render-from-payload'
export {
  getProjectDynamicKeys,
  validateRenderPayload,
} from './export/dynamic-keys'
export type {
  DynamicKeyManifest,
  DynamicKeyOccurrence,
  DynamicKeySource,
  PayloadValidationResult,
} from './export/dynamic-keys'

export type {
  Project,
  Block,
  BlockType,
  VoucherSection,
  GlobalSettings,
  Frame,
  CommonBlockSettings,
} from './schema'
