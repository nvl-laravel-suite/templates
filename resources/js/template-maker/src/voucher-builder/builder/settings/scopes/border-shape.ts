import { Square } from 'lucide-react'
import type { CommonBlockSettings } from '../../../schema'
import type { BorderValues } from '../primitives/types'
import { defineScope } from './registry'

export const borderShapeScope = defineScope<'common'>({
  id: 'border-shape',
  title: 'Border & Shape',
  icon: Square,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'border',
      label: 'Border',
      type: 'border',
      read: (s: CommonBlockSettings): BorderValues => ({
        radius: s.borderRadius,
        width: s.borderWidth,
        color: s.borderColor,
        style: s.borderStyle ?? 'solid',
      }),
      write: (v): Partial<CommonBlockSettings> => {
        const bv = v as BorderValues
        return {
          borderRadius: bv.radius,
          borderWidth: bv.width,
          borderColor: bv.color,
          borderStyle: (bv.style ?? 'solid') as CommonBlockSettings['borderStyle'],
        }
      },
    },
  ],
})
