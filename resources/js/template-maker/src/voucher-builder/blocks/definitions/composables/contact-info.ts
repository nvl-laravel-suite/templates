import { Mail } from 'lucide-react'
import { defineBlock } from '../../registry'
import { appearanceGroup } from '../../helpers/settings-factories'
import { ContactInfoBlockRenderer } from '../../renderers/composables/contact-info-block'

export const contactInfoBlock = defineBlock({
  type: 'contactInfo',
  name: 'Contact Info',
  description: 'Contact details with icons for email, phone, location, and more',
  icon: Mail,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,
  content: {},
  settings: {
    variant:   { type: 'enum', default: 'default', options: [{ value: 'default', label: 'Default' }, { value: 'card', label: 'Card' }, { value: 'compact', label: 'Compact' }] },
    layout:    { type: 'enum', default: 'stacked', options: [{ value: 'inline', label: 'Inline' }, { value: 'stacked', label: 'Stacked' }] },
    showIcons: { type: 'boolean', default: true },
    iconColor: { type: 'color', default: '#3b82f6' },
    textColor: { type: 'color', default: '' },
  },
  settingsLayout: [
    appearanceGroup(['variant', 'layout', 'showIcons', 'iconColor', 'textColor']),
  ],
  render: ContactInfoBlockRenderer,
})
