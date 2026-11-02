import { Move } from 'lucide-react'
import type { CommonBlockSettings } from '#/voucher-builder/schema'
import type { SpacingValues } from '../primitives/types'
import { defineScope } from './registry'

export const spacingScope = defineScope<'common'>({
  id: 'spacing',
  title: 'Spacing',
  icon: Move,
  display: 'collapsible',
  defaultOpen: true,
  source: 'common',
  fields: [
    {
      key: 'padding',
      label: 'Padding',
      type: 'spacing',
      read: (s: CommonBlockSettings): SpacingValues => ({
        top: s.paddingTop, right: s.paddingRight, bottom: s.paddingBottom, left: s.paddingLeft,
      }),
      write: (v): Partial<CommonBlockSettings> => {
        const sv = v as SpacingValues
        return {
          paddingTop: sv.top, paddingRight: sv.right, paddingBottom: sv.bottom, paddingLeft: sv.left,
        }
      },
    },
    {
      key: 'margin',
      label: 'Margin',
      type: 'spacing',
      config: { max: 60 },
      read: (s: CommonBlockSettings): SpacingValues => ({
        top: s.marginTop, right: s.marginRight ?? 0, bottom: s.marginBottom, left: s.marginLeft ?? 0,
      }),
      write: (v): Partial<CommonBlockSettings> => {
        const sv = v as SpacingValues
        return {
          marginTop: sv.top, marginRight: sv.right, marginBottom: sv.bottom, marginLeft: sv.left,
        }
      },
    },
  ],
})
