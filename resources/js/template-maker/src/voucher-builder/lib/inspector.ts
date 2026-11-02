export type InspectorTab = 'content' | 'style' | 'data'

const DATA_FIELDS = /^(valueKey|placeholderType|allowOverwrite|overwriteKey|dynamicKey|dynamicKeySource|previewValue)$/
const CONTENT_SETTINGS = new Set(['level', 'mode', 'format', 'locale', 'errorCorrectionLevel'])

/** Every registered field has one home; grouping never removes the underlying capability. */
export function getFieldInspectorTab(key: string, source: 'content' | 'settings'): InspectorTab {
  if (DATA_FIELDS.test(key)) return 'data'
  if (source === 'content' || CONTENT_SETTINGS.has(key)) return 'content'
  return 'style'
}

export const ADVANCED_SCOPE_IDS = new Set(['animation', 'visibility', 'print'])
