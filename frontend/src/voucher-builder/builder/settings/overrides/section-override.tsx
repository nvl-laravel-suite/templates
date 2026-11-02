import type { BlockType } from '#/voucher-builder/schema'
import { createChildManagerOverride } from './shared'

const SECTION_CHILD_TYPES: BlockType[] = [
  'heading', 'text', 'list', 'image', 'divider', 'separator', 'spacer',
  'badge', 'metric',
  'avatar',
  'contactInfo', 'button',
]

export const SectionOverride = createChildManagerOverride({
  childType: SECTION_CHILD_TYPES,
  labelField: 'text',
  aliasPrefix: 'Child',
  addButtonLabel: 'Add Block',
  title: 'Children',
})
