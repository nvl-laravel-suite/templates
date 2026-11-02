import { applyFamilyVariations } from './family-structure'
import type { BindingDocument, FamilyOverrides, ScopedTemplateResource } from './types'

export function visibleTemplateResources<T extends ScopedTemplateResource>(resources: T[], owner: { templateId: string; groupId?: string }): T[] {
  return resources.filter(resource => resource.scope === 'tenant' || (resource.scope === 'group' && resource.groupId === owner.groupId) || (resource.scope === 'template' && resource.templateId === owner.templateId))
}
export function materializeFamilyDocument(base: BindingDocument, overrides: FamilyOverrides): BindingDocument {
  const allowed = ['content', 'settingsDefaults', 'exposedInputs', 'exposedSettings', 'variations']
  for (const key of Object.keys(overrides)) if (!allowed.includes(key)) throw new Error(`Unsupported family override: ${key}`)
  for (const key of ['content', 'settingsDefaults'] as const) {
    if (Object.hasOwn(overrides, key) && (!overrides[key] || typeof overrides[key] !== 'object' || Array.isArray(overrides[key]))) throw new Error('Family value overrides must be objects.')
  }
  for (const key of ['exposedInputs', 'exposedSettings'] as const) {
    if (Object.hasOwn(overrides, key) && (!Array.isArray(overrides[key]) || overrides[key]!.some(id => typeof id !== 'string') || new Set(overrides[key]).size !== overrides[key]!.length)) throw new Error('Family permissions must be distinct ordered strings.')
    if (overrides[key]?.some(id => !base[key].includes(id))) throw new Error('A template cannot widen its family editing capabilities.')
  }
  return { ...applyFamilyVariations(base, overrides.variations), content: { ...base.content, ...overrides.content }, settingsDefaults: { ...base.settingsDefaults, ...overrides.settingsDefaults }, exposedInputs: overrides.exposedInputs ? [...overrides.exposedInputs] : [...base.exposedInputs], exposedSettings: overrides.exposedSettings ? [...overrides.exposedSettings] : [...base.exposedSettings] }
}
