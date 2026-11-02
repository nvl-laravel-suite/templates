/**
 * Dynamic preview system — single resolution path used by every consumer
 * (editor canvas, HTML export substitution, manifest extraction).
 *
 * A "block value" is the runtime substitution applied to a block's primary
 * content field when it carries a `commonSettings.dynamicKey`. The fallback
 * chain is:
 *
 *   payload[key]  >  block.commonSettings.previewValue  >  undefined
 *
 * Note: project-level `global.previewData` is folded into the payload before
 * this is called (see `renderFromPayload` and the editor's `showPreviewData`
 * toggle), so this function deliberately does NOT consult it. Keeping the
 * resolver narrow makes the precedence rules unambiguous from one place.
 */

/** Map from block type to the content field that gets replaced by dynamicKey preview. */
export const PRIMARY_CONTENT_FIELD: Record<string, string> = {
  heading: 'text',
  text: 'body',
  image: 'url',
  metric: 'value',
  badge: 'text',
  button: 'text',
  date: 'value',
  metadata: 'label',
}

/**
 * Resolve a single key against a payload + per-block fallback.
 *
 * @param key                Lookup key (typically `block.commonSettings.dynamicKey`).
 * @param payload            Already-merged payload (data > project previewData).
 * @param blockPreviewValue  Per-block fallback (`block.commonSettings.previewValue`).
 */
export function resolveBlockValue(
  key: string | undefined,
  payload: Record<string, string>,
  blockPreviewValue?: string,
): string | undefined {
  if (!key) return undefined
  const fromPayload = payload[key]
  if (fromPayload !== undefined && fromPayload !== '') return fromPayload
  if (blockPreviewValue !== undefined && blockPreviewValue !== '') return blockPreviewValue
  return undefined
}

/** @deprecated Use `resolveBlockValue` — kept for backward compat. */
export const resolvePreviewValue = resolveBlockValue
