import { LayoutPanelTop } from 'lucide-react'
import type { CommonBlockSettings } from '../../../schema'
import { defineScope } from './registry'

export const layoutScope = defineScope<'common'>({
  id: 'layout',
  title: 'Layout',
  icon: LayoutPanelTop,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'fullWidth',
      label: 'Full width',
      description: 'Expand block to fill its container',
      type: 'switch',
      read: (s: CommonBlockSettings) => s.fullWidth,
      write: (v): Partial<CommonBlockSettings> => ({ fullWidth: v as boolean }),
    },
    {
      key: 'minHeight',
      label: 'Min height',
      type: 'slider',
      config: { min: 0, max: 400, step: 4, suffix: 'px' },
      read: (s: CommonBlockSettings) => s.minHeight,
      write: (v): Partial<CommonBlockSettings> => ({ minHeight: v as number }),
    },
    {
      key: 'anchor',
      label: 'Anchor',
      description: 'HTML id for deep-linking',
      type: 'input',
      config: { placeholder: 'my-anchor', mono: true },
      read: (s: CommonBlockSettings) => s.anchor || '',
      write: (v): Partial<CommonBlockSettings> => ({ anchor: (v as string).trim() }),
    },
  ],
})
