/**
 * Renderer entry point.
 *
 * Importing from this subpath gives you the HTML render API and the
 * substitution layer. These are pure functions for composing the final
 * document from supplied JSON, independently of the editing UI.
 *
 * Excludes the React editor, the block library UI, and DOM-bound editor
 * infrastructure. Bundle stays small.
 *
 * ```ts
 * import { renderFromPayload, exportToHTML } from '@nicolasvlachos/voucher-builder/renderer'
 * ```
 */

export { exportToHTML } from './voucher-builder/export/html'
export type { ExportToHTMLOptions } from './voucher-builder/export/html'

export { exportToJSON } from './voucher-builder/export/json'
export type {
	VoucherExport,
	VoucherSectionExport,
	ExportBlock,
} from './voucher-builder/export/json'

export { renderFromPayload } from './voucher-builder/export/render-from-payload'
export type {
	RenderPayload,
	RenderResult,
} from './voucher-builder/export/render-from-payload'

// Schema + manifest are also available alongside the rendering functions.
export { ProjectSchema, BlockSchema } from './voucher-builder/schema'
export type {
	Project,
	Block,
	BlockType,
	VoucherSection,
	GlobalSettings,
	Frame,
	CommonBlockSettings,
} from './voucher-builder/schema'

export {
	getProjectDynamicKeys,
	validateRenderPayload,
} from './voucher-builder/export/dynamic-keys'
export type {
	DynamicKeyManifest,
	DynamicKeyOccurrence,
	DynamicKeyMechanism,
	DynamicKeyKind,
	DynamicKeyBucket,
	PayloadValidationResult,
} from './voucher-builder/export/dynamic-keys'

export { parseVoucherImport } from './voucher-builder/export/import'
export type { ImportResult } from './voucher-builder/export/import'
