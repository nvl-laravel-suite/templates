import { z } from 'zod'
import type { TemplateDefinition } from '../template-core/schema'
import type { TemplateTheme, TemplateThemeInput } from './types'

const color = z.string().regex(/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i)
const size = z.number().finite().min(0).max(1000)
const defaults: TemplateTheme = {
  colors: { primary: '#275B49', primaryForeground: '#FFFFFF', background: '#FFFFFF', foreground: '#202722', muted: '#EFF3EF', mutedForeground: '#637067' },
  typography: { fontFamily: 'Arial, sans-serif', text: 14, small: 12, h1: 28, h2: 22, lineHeight: 1.5 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  actions: { height: 40, paddingInline: 16, radius: 6 },
}
export const TemplateThemeSchema = z.object({
  colors: z.object({ primary: color, primaryForeground: color, background: color, foreground: color, muted: color, mutedForeground: color }).strict(),
  typography: z.object({ fontFamily: z.string().regex(/^[a-zA-Z][a-zA-Z0-9 ,_-]{0,119}$/), text: size.min(1), small: size.min(1), h1: size.min(1), h2: size.min(1), lineHeight: z.number().min(1).max(3) }).strict(),
  spacing: z.object({ xs: size, sm: size, md: size, lg: size, xl: size }).strict(),
  actions: z.object({ height: size.min(1), paddingInline: size, radius: size }).strict(),
}).strict()

export function createTemplateTheme(input: TemplateThemeInput = {}): TemplateTheme {
  return TemplateThemeSchema.parse({
    colors: { ...defaults.colors, ...input.colors }, typography: { ...defaults.typography, ...input.typography },
    spacing: { ...defaults.spacing, ...input.spacing }, actions: { ...defaults.actions, ...input.actions },
  })
}
export function themeStyles(theme: TemplateTheme, target: 'document' | 'email' = 'document'): string {
  const t = TemplateThemeSchema.parse(theme)
  const css = `:root{color:${t.colors.foreground};background-color:${t.colors.background};font-family:${t.typography.fontFamily};font-size:${t.typography.text}px;line-height:${t.typography.lineHeight}}p{font-size:${t.typography.text}px}small,.text-small{font-size:${t.typography.small}px;color:${t.colors.mutedForeground}}h1{font-size:${t.typography.h1}px}h2{font-size:${t.typography.h2}px}a{color:${t.colors.primary}}.action{display:inline-block;background-color:${t.colors.primary};color:${t.colors.primaryForeground};min-height:${t.actions.height}px;padding:0 ${t.actions.paddingInline}px;border-radius:${t.actions.radius}px}.muted{background-color:${t.colors.muted};color:${t.colors.mutedForeground}}`
  return target === 'email' ? css.replace('min-height:', 'line-height:') + `td{font-family:${t.typography.fontFamily};font-size:${t.typography.text}px;line-height:${t.typography.lineHeight}}.email-button-cell{background-color:${t.colors.primary};border-radius:${t.actions.radius}px;padding:0 ${t.actions.paddingInline}px;text-align:center}.action{text-decoration:none}` : css
}
export function applyTemplateTheme(template: TemplateDefinition, theme: TemplateTheme, target: 'document' | 'email' = 'document'): TemplateDefinition {
  const result = structuredClone(template)
  result.styles.theme = `${themeStyles(theme, target)}\n${template.styles.theme}`
  return result
}
