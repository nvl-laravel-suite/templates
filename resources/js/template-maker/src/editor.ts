/**
 * Editor entry point.
 *
 * Importing from this subpath gives you the full React block editor —
 * the `<VoucherBuilder />` component, the block library UI, settings panels,
 * scope system, traits, and all editor-only infrastructure.
 *
 * Suitable for any host that wants to mount the visual authoring/editing
 * surface (Laravel Inertia frontend, an admin app, etc.).
 *
 * Pure HTML generation is available from `/renderer` without the React UI.
 *
 * ```tsx
 * import { VoucherBuilder } from '@nicolasvlachos/voucher-builder/editor'
 * import '@nicolasvlachos/voucher-builder/styles.css'
 *
 * <VoucherBuilder initialProject={project} onChange={handleProjectChange} />
 * ```
 */

export { VoucherBuilder, VoucherBuilderEditor } from './voucher-builder/VoucherBuilder'
export type { VoucherBuilderEditorProps } from './voucher-builder/VoucherBuilder'
export * from './hooks'
export type {
	VoucherBuilderProps,
	VoucherBuilderConfig,
	VoucherBuilderFeatures,
} from './voucher-builder/types'

export { resolveFeatures, MODE_PRESETS } from './voucher-builder/types'

// Schema + types re-exported for editor consumers' typed callbacks.
export type {
	Project,
	Block,
	BlockType,
	VoucherSection,
	GlobalSettings,
	Frame,
	CommonBlockSettings,
} from './voucher-builder/schema'

// Action event bus — host apps subscribe via the `onAction` prop, but the
// types are useful for typed event handlers.
export type {
	BuilderActionEvent,
	BuilderActionType,
} from './voucher-builder/store/events'

// Templates surface — for hosts that want to programmatically interact
// with the editor's template registry.
export type { VoucherTemplate } from './voucher-builder/templates'

export * from './template-creator'
