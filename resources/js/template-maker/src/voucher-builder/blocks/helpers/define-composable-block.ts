import type { LucideIcon } from 'lucide-react'
import type { FieldSchema, ChildTemplate, SettingsGroupDef, BlockCategory, BlockTraitRef } from '../types'
import { defineBlock } from '../registry'
import { colorsGroup, layoutGroup } from './settings-factories'

/**
 * Helper for defining composable blocks.
 *
 * Composables are blocks composed of child primitives (heading, text, image, etc.).
 * The parent controls layout and visual cascade; children control content.
 *
 * Auto-generates:
 * - `textColor` setting (cascades to children via CSS inheritance)
 * - Layout group from `layoutFields`
 * - Colors group with `textColor` + any extra color fields
 *
 * Children are marked `contentOnlyWhenChild: true` by convention —
 * their style settings are hidden when selected inside the composable.
 */

interface ComposableBlockConfig {
  type: string
  name: string
  description: string
  icon: LucideIcon
  category?: BlockCategory
  allowedIn?: ('page' | 'column')[]

  childTemplates: ChildTemplate[]

  /** Content fields on the composable itself (rare — most content is in children) */
  content?: Record<string, FieldSchema>
  /** Settings fields beyond the auto-generated textColor */
  settings?: Record<string, FieldSchema>

  /** Fields to show in the Layout group (e.g. ['layout', 'gap', 'alignment']) */
  layoutFields?: string[]
  /** Extra color fields beyond textColor (e.g. ['accentColor', 'iconColor']) */
  extraColorFields?: string[]
  /** Extra settingsLayout groups appended after the standard ones */
  extraSettingsLayout?: (SettingsGroupDef | string)[]
  /** Completely override settingsLayout */
  settingsLayout?: (SettingsGroupDef | string)[]

  /** Traits to compose into this block (see registry docs) */
  traits?: BlockTraitRef[]

  /** React component that renders this block */
  render: React.ComponentType<{ block: any }>
}

export function defineComposableBlock(config: ComposableBlockConfig) {
  const {
    type, name, description, icon, render,
    category = 'content',
    allowedIn = ['page', 'column'],
    childTemplates,
    content = {},
    settings: extraSettings = {},
    layoutFields = [],
    extraColorFields = [],
    extraSettingsLayout = [],
    settingsLayout: settingsLayoutOverride,
    traits,
  } = config

  // Auto-add textColor to settings
  const settings: Record<string, FieldSchema> = {
    ...extraSettings,
    textColor: { type: 'color', default: '' },
  }

  // Build settingsLayout
  const settingsLayout: (SettingsGroupDef | string)[] = settingsLayoutOverride ?? [
    ...(layoutFields.length > 0 ? [layoutGroup(layoutFields)] : []),
    ...extraSettingsLayout,
    colorsGroup(['textColor', ...extraColorFields]),
  ]

  return defineBlock({
    type,
    name,
    description,
    icon,
    category,
    allowedIn,
    canContain: false,
    childTemplates,
    content,
    settings,
    settingsLayout,
    traits,
    render,
  })
}
