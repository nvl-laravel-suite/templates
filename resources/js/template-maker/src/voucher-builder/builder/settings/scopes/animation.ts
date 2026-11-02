import { Zap } from 'lucide-react'
import type { CommonBlockSettings } from '../../../schema'
import { defineScope } from './registry'

export const animationScope = defineScope<'common'>({
  id: 'animation',
  title: 'Animation',
  icon: Zap,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'animation',
      label: 'Entrance',
      description: 'Applied when the block enters the viewport (screen preview / web export).',
      type: 'pills',
      config: {
        options: [
          { value: 'none', label: 'None' },
          { value: 'fade-in', label: 'Fade' },
          { value: 'slide-up', label: 'Slide' },
          { value: 'zoom-in', label: 'Zoom' },
        ],
      },
      read: (s: CommonBlockSettings) => s.animation,
      write: (v): Partial<CommonBlockSettings> => ({ animation: v as CommonBlockSettings['animation'] }),
    },
    {
      key: 'animationDelay',
      label: 'Delay',
      type: 'slider',
      config: { min: 0, max: 2000, step: 50, suffix: 'ms' },
      read: (s: CommonBlockSettings) => s.animationDelay,
      write: (v): Partial<CommonBlockSettings> => ({ animationDelay: v as number }),
      when: (s) => s.animation !== 'none',
    },
  ],
})
