import type { VoucherTemplate } from './types'

export const builtinTemplates: VoucherTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, minimal voucher with heading and text',
    icon: 'file',
    category: 'general',
    mode: 'partial',
    source: 'builtin',
    partial: {
      sections: [
        {
          index: 0,
          blocks: [
            { type: 'heading', content: { text: 'Voucher Title' }, settings: { level: 'h1', fontWeight: 'bold' } },
            { type: 'divider' },
            { type: 'text', content: { body: 'Start building your voucher here...' } },
          ],
        },
      ],
    },
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Hero section with social links and contact info',
    icon: 'layout',
    category: 'general',
    mode: 'partial',
    source: 'builtin',
    partial: {
      sections: [
        {
          index: 0,
          blocks: [
            { type: 'hero' },
            { type: 'divider' },
            { type: 'socials' },
            { type: 'contactInfo' },
          ],
        },
      ],
    },
  },
]
