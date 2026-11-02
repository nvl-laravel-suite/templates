import { Sparkles } from 'lucide-react'
import { defineBlock } from '../../registry'
import { SeparatorBlockRenderer } from '../../renderers/primitives/separator-block'
import { colorsGroup, styleGroup } from '../../helpers/settings-factories'

export const separatorBlock = defineBlock({
  type: 'separator',
  name: 'Separator',
  description: 'Decorative separator with patterns',
  icon: Sparkles,
  category: 'content',
  allowedIn: ['page', 'column'],
  canContain: false,
  content: {},
  settings: {
    style: { type: 'enum', default: 'dots', options: [{ value: 'dots', label: 'Dots' }, { value: 'diamond', label: 'Diamond' }, { value: 'wave', label: 'Wave' }, { value: 'fade', label: 'Fade' }, { value: 'stars', label: 'Stars' }] },
    color: { type: 'color', default: '' },
    size: { type: 'enum', default: 'md', options: [{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }] },
    spacing: { type: 'enum', default: 'md', options: [{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }] },
  },
  settingsLayout: [
    styleGroup(['style', 'size', 'spacing'], { display: 'flat' }),
    colorsGroup(['color'], { title: 'Color' }),
  ],
  render: SeparatorBlockRenderer,
})
