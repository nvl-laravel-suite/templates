/**
 * Typed accessors for block.settings.
 *
 * `Block` is a discriminated union (25 variants) where each variant carries
 * its own `settings` shape. Reading `block.settings.fontSize` directly works
 * only after narrowing on `block.type`, which most callers cannot do because
 * they iterate over the union (export, manifest, settings panel).
 *
 * These helpers provide the one canonical pattern:
 *   - `getBlockSettings(block)` for a loose `Record<string, unknown>` view
 *   - `getBlockSettingsTyped<T>(block)` for a typed view when caller knows the variant
 *
 * Callers should never write `(block as any).settings` or
 * `(block as unknown as { settings?: ... }).settings` again.
 */

import type { Block, BlockType } from '#/voucher-builder/schema'

/**
 * Loose view of `block.settings` as a plain record. Use when the caller
 * iterates over a union of block types and needs string-indexed access.
 * Returns an empty record when settings are absent.
 */
export function getBlockSettings(block: Block): Record<string, unknown> {
  const s = (block as { settings?: Record<string, unknown> }).settings
  return s ?? {}
}

/**
 * Typed view of `block.settings` for a known variant. The caller asserts
 * the variant; TypeScript infers the corresponding settings shape.
 *
 * @example
 *   if (block.type === 'heading') {
 *     const s = getBlockSettingsTyped(block) // typed as HeadingBlock['settings']
 *   }
 */
export function getBlockSettingsTyped<T extends BlockType>(
  block: Extract<Block, { type: T }>,
): Extract<Block, { type: T }> extends { settings: infer S } ? S : never {
  return (block as { settings: unknown }).settings as never
}

/**
 * Merge a settings patch into a block in a type-safe way. Returns a new
 * Block; does not mutate. The patch is loosely typed because settings shape
 * is per-variant; for type-safe writes inside a narrowed branch, spread
 * directly.
 */
export function patchBlockSettings(block: Block, patch: Record<string, unknown>): Block {
  const existing = getBlockSettings(block)
  return { ...block, settings: { ...existing, ...patch } } as Block
}
