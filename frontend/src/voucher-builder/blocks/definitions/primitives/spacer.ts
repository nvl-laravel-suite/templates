import { Space } from 'lucide-react'
import { defineBlock } from '../../registry'
import { SpacerBlockRenderer } from '#/voucher-builder/blocks/renderers/primitives/spacer-block'
import { layoutGroup } from '../../helpers/settings-factories'

export const spacerBlock = defineBlock({
  type: 'spacer',
  name: 'Spacer',
  description: 'Empty vertical space with optional line',
  icon: Space,
  category: 'layout',
  allowedIn: ['page', 'column'],
  canContain: false,
  content: {},
  settings: {
    height:   { type: 'slider', default: 40, min: 8, max: 200, step: 4, suffix: 'px' },
    showLine: { type: 'boolean', default: false },
  },
  settingsLayout: [
    layoutGroup(['height', 'showLine']),
  ],
  render: SpacerBlockRenderer,
})
