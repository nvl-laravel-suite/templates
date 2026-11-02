import { Type } from 'lucide-react'
import { defineComposableBlock } from '../../helpers/define-composable-block'
import { styleGroup } from '../../helpers/settings-factories'
import { HeroBlockRenderer } from '../../renderers/composables/hero-block'

export const heroBlock = defineComposableBlock({
  type: 'hero',
  name: 'Hero',
  description: 'Composable hero section with background controls',
  icon: Type,
  category: 'media',
  childTemplates: [
    { type: 'heading', alias: 'Title', contentOverrides: { text: 'Your Title' }, settingsOverrides: { level: 'h1', alignment: 'center', fontWeight: 'bold' } },
    { type: 'text', alias: 'Subtitle', contentOverrides: { body: '' }, settingsOverrides: { alignment: 'center' } },
  ],
  layoutFields: ['variant', 'alignment', 'minHeight'],
  extraColorFields: ['backgroundColor'],
  settings: {
    variant:            { type: 'enum', default: 'default', options: [{ value: 'default', label: 'Default' }, { value: 'magazine', label: 'Magazine' }, { value: 'split-tone', label: 'Split Tone' }] },
    alignment:          { type: 'alignment', default: 'center' },
    minHeight:          { type: 'slider', default: 200, min: 100, max: 600, step: 10, suffix: 'px' },
    backgroundStyle:    { type: 'enum', default: 'solid', options: [{ value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }] },
    backgroundColor:    { type: 'color', default: '#ffffff' },
    gradientDirection:  { type: 'enum', default: '135deg', options: [
      { value: '0deg', label: 'Top → Bottom' }, { value: '90deg', label: 'Left → Right' },
      { value: '135deg', label: 'Diagonal ↘' }, { value: '180deg', label: 'Bottom → Top' }, { value: '45deg', label: 'Diagonal ↗' },
    ]},
    gradientEndColor:   { type: 'color', default: '' },
    backgroundImageUrl: { type: 'string', default: '', placeholder: 'https://...' },
    textShadow:         { type: 'boolean', default: false },
  },
  extraSettingsLayout: [
    styleGroup(['backgroundStyle']),
    styleGroup(['gradientDirection', 'gradientEndColor'], { title: 'Gradient', defaultOpen: false, when: { field: 'backgroundStyle', value: 'gradient' } }),
    styleGroup(['backgroundImageUrl', 'textShadow'], { title: 'Background Media', defaultOpen: false }),
  ],
  render: HeroBlockRenderer,
})
