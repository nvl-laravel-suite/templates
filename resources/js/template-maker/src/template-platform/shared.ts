import { assertManagedMedia } from './media'
import { getValue, validateJSONData } from '../template-core/contracts'
import { renderTemplate } from '../template-core/render'
import type { JsonObject, JsonValue } from '../template-core/schema'
import { applyTemplateTheme } from './theme'
import { applyPresentationSettings } from './settings'
import { finalizeTemplateOutput } from './output'
import type { BindingDocument } from './types'
import { assertEmailTemplate } from '../template-email/profile'
import { getEmailSettingIssues } from '../template-email/settings'

export function renderSharedTemplateDocument(document: BindingDocument, data: JsonObject, assets: Record<string, string> = {}): { html: string; css: string; subject?: string; text?: string } {
  if (document.target === 'email') {
    assertEmailTemplate(document.source.definition)
    const issue = getEmailSettingIssues(document.settingsSpec ?? [], data.settings as JsonObject ?? {})[0]; if (issue) throw new Error(issue.message)
  }
  assertManagedMedia(document.source.definition, 'shared')
  const errors = validateJSONData(document.dataSchema, data)
  if (errors.length) throw new Error(errors[0].message)
  const definition = applyPresentationSettings(applyTemplateTheme(document.source.definition, document.theme, document.target), document.settingsSpec ?? [], data.settings as JsonObject ?? {})
  const projected: JsonObject = {}
  for (const field of definition.fields) {
    const value = getValue(data, field.path)
    if (value === undefined) continue
    const parts = field.path.split('.')
    let parent: Record<string, JsonValue> = projected
    for (const part of parts.slice(0, -1)) {
      if (['__proto__', 'constructor', 'prototype'].includes(part)) throw new Error('Invalid field path.')
      parent[part] ??= {}
      parent = parent[part] as JsonObject
    }
    const last = parts[parts.length - 1]
    if (['__proto__', 'constructor', 'prototype'].includes(last)) throw new Error('Invalid field path.')
    parent[last] = value
  }
  const result = renderTemplate(definition, { data: projected, resolveAsset: asset => {
    if (!assets[asset.id]) throw new Error(`Managed asset was not prepared: ${asset.id}`)
    return assets[asset.id]
  } })
  if (result.issues.length || !result.html) throw new Error(result.issues[0]?.message ?? 'Shared compilation failed.')
  const plain = (value: string | undefined): string | undefined => value?.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_, id: string) => {
    const binding = document.artifacts.bindings.find(item => item.id === id && item.kind === 'text')
    const resolved = binding && getValue(data, binding.path)
    if (!binding || resolved === undefined || (resolved !== null && typeof resolved === 'object')) throw new Error('A plain-text binding is undeclared or missing.')
    return String(resolved ?? '')
  })
  const subject = plain(document.artifacts.subject)
  if (subject !== undefined && (/[\r\n]/.test(subject) || [...subject].length > 998)) throw new Error('Subject must be a bounded single line.')
  return { html: finalizeTemplateOutput(result.html, document.target), css: document.target === 'email' ? '' : result.css, ...(subject !== undefined ? { subject } : {}), ...(document.artifacts.text !== undefined ? { text: plain(document.artifacts.text) } : {}) }
}
