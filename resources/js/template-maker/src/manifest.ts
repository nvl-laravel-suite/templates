/**
 * Manifest entry point.
 *
 * Importing from this subpath gives you the dynamic-key extractor and
 * payload validator — pure functions, no React, no DOM. Used by:
 *  - Laravel-side template editor (to compute and cache the bindings
 *    manifest at save time, alongside the Project)
 *  - The PDF service (to validate `values` payloads against a synced
 *    template's manifest before rendering)
 *  - Any host BE that wants to introspect a saved template
 *
 * ```ts
 * import { getProjectDynamicKeys, validateRenderPayload } from '@your-org/voucher-builder/manifest'
 * ```
 */

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

export {
	parseVoucherImport,
} from './voucher-builder/export/import'

export type { ImportResult } from './voucher-builder/export/import'
