import { Printer } from 'lucide-react'
import type { CommonBlockSettings } from '../../../schema'
import { defineScope } from './registry'

export const printScope = defineScope<'common'>({
  id: 'print',
  title: 'Print',
  icon: Printer,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'pageBreakBefore',
      label: 'Break before',
      description: 'Start this block on a new printed page.',
      type: 'switch',
      read: (s: CommonBlockSettings) => s.pageBreakBefore,
      write: (v): Partial<CommonBlockSettings> => ({ pageBreakBefore: v as boolean }),
    },
    {
      key: 'pageBreakAfter',
      label: 'Break after',
      description: 'Force a page break after this block.',
      type: 'switch',
      read: (s: CommonBlockSettings) => s.pageBreakAfter,
      write: (v): Partial<CommonBlockSettings> => ({ pageBreakAfter: v as boolean }),
    },
  ],
})
