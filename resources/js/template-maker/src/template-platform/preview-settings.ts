import type { JsonObject } from '../template-core/schema'
import type { PresentationSetting } from './types'
import { presentationStyle, resolvePresentationSettings } from './settings'

export const EMPTY_PREVIEW_SETTINGS: JsonObject = Object.freeze({})

/** Preview baselines never become local overrides or authored defaults. */
export function resolvePreviewSettings(spec: PresentationSetting[], defaults: JsonObject, values: JsonObject) {
  try {
    resolvePresentationSettings(spec.map(field => ({ ...field, defaultValue: Object.hasOwn(defaults, field.id) ? defaults[field.id] : field.defaultValue })), values)
    for (const field of spec) if (Object.hasOwn(values, field.id)) presentationStyle(field, values[field.id])
    return { defaults: { ...defaults, ...values }, error: '' }
  } catch (cause) {
    return { defaults, error: `Preview settings: ${cause instanceof Error ? cause.message : 'Check the supplied values.'}` }
  }
}
