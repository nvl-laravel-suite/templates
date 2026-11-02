import { Share2 } from 'lucide-react'
import { defineBlock } from '../../registry'
import { appearanceGroup } from '../../helpers/settings-factories'
import { SocialsBlockRenderer } from '../../renderers/composables/socials-block'

export const socialsBlock = defineBlock({
  type: 'socials',
  name: 'Socials',
  description: 'Social media link icons and pills',
  icon: Share2,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,

  // Note: socials has a complex content structure (array of objects).
  // The `list` field type handles string arrays. For structured arrays,
  // the block settings component handles it with custom UI.
  content: {},

  settings: {
    variant:    { type: 'enum', default: 'pills', options: [
      { value: 'icons-only', label: 'Icons' }, { value: 'pills', label: 'Pills' }, { value: 'full-width', label: 'Full' },
    ]},
    alignment:  { type: 'alignment', default: 'center' },
    iconColor:  { type: 'color', default: '#111827' },
    iconBgColor: { type: 'color', default: '#f3f4f6' },
    textColor: { type: 'color', default: '' },
  },

  settingsLayout: [
    appearanceGroup(['variant', 'alignment', 'iconColor', 'iconBgColor', 'textColor']),
  ],

  render: SocialsBlockRenderer,
})
