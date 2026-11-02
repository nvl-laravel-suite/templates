import type { SettingsGroupDef } from '../types'

type GroupOptions = Omit<SettingsGroupDef, 'fields' | 'title'>
type NamedGroupOptions = GroupOptions & { title?: string }

function group(title: string, fields: string[], options?: GroupOptions): SettingsGroupDef {
  return {
    title,
    fields,
    ...options,
  }
}

export function contentGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Content', fields, { ...options, display: options?.display || 'flat' })
}

export function headerGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Header', fields, { display: 'flat', ...options })
}

export function typographyGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Typography', fields, options)
}

export function appearanceGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Appearance', fields, options)
}

export function styleGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Style', fields, options)
}

export function colorsGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Colors', fields, { defaultOpen: false, ...options })
}

export function sizeGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Size', fields, options)
}

export function layoutGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Layout', fields, { display: 'flat', ...options })
}

export function spacingGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Spacing', fields, options)
}

export function effectsGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Effects', fields, { defaultOpen: false, ...options })
}

export function borderGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Border', fields, { defaultOpen: false, ...options })
}

export function dynamicGroup(fields: string[], options?: NamedGroupOptions): SettingsGroupDef {
  return group(options?.title || 'Dynamic', fields, { defaultOpen: false, ...options })
}
