import { Eye } from 'lucide-react'
import type { CommonBlockSettings } from '#/voucher-builder/schema'
import { defineScope } from './registry'

export const visibilityScope = defineScope<'common'>({
  id: 'visibility',
  title: 'Visibility',
  icon: Eye,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'visibility',
      label: 'Show on',
      type: 'pills',
      config: {
        options: [
          { value: 'visible', label: 'Both' },
          { value: 'screen-only', label: 'Screen' },
          { value: 'print-only', label: 'Print' },
        ],
      },
      read: (s: CommonBlockSettings) => s.visibility,
      write: (v): Partial<CommonBlockSettings> => ({
        visibility: v as CommonBlockSettings['visibility'],
      }),
    },
  ],
})
