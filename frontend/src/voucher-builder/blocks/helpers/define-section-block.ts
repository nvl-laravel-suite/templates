import type { LucideIcon } from 'lucide-react'
import type { FieldSchema, ChildTemplate, SettingsGroupDef, BlockCategory, BlockTraitRef } from '../types'
import { defineBlock } from '../registry'
import { appearanceGroup, colorsGroup, headerGroup } from './settings-factories'

interface SectionBlockConfig {
  type: string
  name: string
  description: string
  icon: LucideIcon
  category?: BlockCategory
  allowedIn?: ('page' | 'column')[]
  childTemplates?: ChildTemplate[]
  hidden?: boolean
  /** Whether this block can contain child blocks (default: false) */
  canContain?: boolean | BlockCategory[]

  /** Default title (omit for headerless sections like skills) */
  defaultTitle?: string
  /** Default icon key (omit for headerless sections) */
  defaultIcon?: string
  /** Whether to include the standard header fields (title, icon, showIcon, etc.). Default: true */
  includeHeader?: boolean

  /** Extra content fields beyond title/icon */
  extraContent?: Record<string, FieldSchema>
  /** Extra settings fields beyond the standard section settings */
  extraSettings?: Record<string, FieldSchema>
  /** Extra settingsLayout groups appended after the standard ones */
  extraSettingsLayout?: (SettingsGroupDef | string)[]
  /** Override the Appearance group fields */
  appearanceFields?: string[]
  /** Override the Colors group fields */
  colorsFields?: string[]
  /** Completely override settingsLayout (skips auto-generated groups) */
  settingsLayout?: (SettingsGroupDef | string)[]

  /** Traits to compose into this block (see registry docs) */
  traits?: BlockTraitRef[]

  /** React component that renders this block */
  render: React.ComponentType<{ block: any }>
}

const headerContentFields: Record<string, FieldSchema> = {
  title: { type: 'string', default: 'Section Title' },
  icon: { type: 'icon', default: 'briefcase' },
}

const headerSettingsFields: Record<string, FieldSchema> = {
  showIcon: { type: 'boolean', default: true },
  showDivider: { type: 'boolean', default: true },
  titleSize: { type: 'enum', default: 'md', options: [{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }] },
  headerStyle: { type: 'enum', default: 'default', options: [{ value: 'default', label: 'Default' }, { value: 'underline', label: 'Underline' }, { value: 'accent-bar', label: 'Accent Bar' }] },
  titleColor: { type: 'color', default: '' },
  dividerColor: { type: 'color', default: '' },
  iconColor: { type: 'color', default: '' },
  iconBgColor: { type: 'color', default: '' },
}

export function defineSectionBlock(config: SectionBlockConfig) {
  const {
    type, name, description, icon, render,
    category = 'content',
    allowedIn = ['page', 'column'],
    childTemplates,
    hidden,
    canContain: canContainProp = false,
    includeHeader = true,
    defaultTitle = 'Section Title',
    defaultIcon = 'briefcase',
    extraContent = {},
    extraSettings = {},
    extraSettingsLayout = [],
    appearanceFields = ['showIcon', 'showDivider', 'titleSize', 'headerStyle'],
    colorsFields = ['titleColor', 'dividerColor', 'iconColor', 'iconBgColor'],
    settingsLayout: settingsLayoutOverride,
    traits,
  } = config

  // Build content fields
  const content: Record<string, FieldSchema> = includeHeader
    ? {
        title: { ...headerContentFields.title, default: defaultTitle } as FieldSchema,
        icon: { ...headerContentFields.icon, default: defaultIcon } as FieldSchema,
        ...extraContent,
      }
    : { ...extraContent }

  // Build settings fields
  const settings: Record<string, FieldSchema> = includeHeader
    ? { ...headerSettingsFields, ...extraSettings }
    : { ...extraSettings }

  // Build settingsLayout
  const settingsLayout: (SettingsGroupDef | string)[] = settingsLayoutOverride
    ?? (includeHeader
      ? [
          headerGroup(['title', 'icon', ...Object.keys(extraContent)]),
          appearanceGroup(appearanceFields),
          colorsGroup(colorsFields),
          ...extraSettingsLayout,
        ]
      : [...extraSettingsLayout])

  return defineBlock({
    type,
    name,
    description,
    icon,
    category,
    allowedIn,
    canContain: canContainProp,
    childTemplates,
    hidden,
    content,
    settings,
    settingsLayout,
    traits,
    render,
  })
}
