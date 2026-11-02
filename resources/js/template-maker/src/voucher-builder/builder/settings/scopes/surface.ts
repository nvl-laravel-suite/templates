import { Palette } from 'lucide-react'
import type { CommonBlockSettings } from '../../../schema'
import { defineScope } from './registry'

export const surfaceScope = defineScope<'common'>({
  id: 'surface',
  title: 'Surface',
  icon: Palette,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'backgroundColor',
      label: 'Background',
      type: 'color',
      read: (s: CommonBlockSettings) => s.backgroundColor,
      write: (v): Partial<CommonBlockSettings> => ({ backgroundColor: (v as string) || 'transparent' }),
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'opacity',
      read: (s: CommonBlockSettings) => s.opacity,
      write: (v): Partial<CommonBlockSettings> => ({ opacity: v as number }),
    },
  ],
})
