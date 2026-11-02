/**
 * Schema-only entry point.
 *
 * Importing from this subpath gives you the Zod schemas and types — no React, no DOM, no editor UI, no rendering. Suitable
 * for any consumer that only needs to validate or type-narrow Project
 * envelopes independently of the editing UI.
 *
 * ```ts
 * import { ProjectSchema, type Project, type Block } from '@nicolasvlachos/voucher-builder/schema'
 * ```
 */

export {
	ProjectSchema,
	BlockSchema,
} from './voucher-builder/schema'
export { VoucherBuilderConfigSchema } from './voucher-builder/config-schema'

export type {
	Project,
	Block,
	BlockType,
	VoucherSection,
	GlobalSettings,
	Frame,
	CommonBlockSettings,
} from './voucher-builder/schema'
