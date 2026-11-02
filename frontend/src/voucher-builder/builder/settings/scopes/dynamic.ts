import { KeyRound } from 'lucide-react'
import type { CommonBlockSettings } from '#/voucher-builder/schema'
import { defineScope } from './registry'

export const dynamicScope = defineScope<'common'>({
  id: 'dynamic',
  title: 'Dynamic',
  icon: KeyRound,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',
  fields: [
    {
      key: 'enabled',
      label: 'Dynamic field',
      description: 'Bind this block to a template key',
      type: 'switch',
      read: (s: CommonBlockSettings) => !!s.dynamicKey,
      write: (v): Partial<CommonBlockSettings> => ({
        dynamicKey: v ? ':key' : '',
        previewValue: v ? '' : '',
      }),
    },
    {
      key: 'dynamicKey',
      label: 'Template key',
      type: 'input',
      config: { placeholder: ':key_name', mono: true },
      read: (s: CommonBlockSettings) => s.dynamicKey,
      write: (v): Partial<CommonBlockSettings> => ({ dynamicKey: v as string }),
      when: (s) => !!s.dynamicKey,
    },
    {
      key: 'previewValue',
      label: 'Preview value',
      type: 'input',
      config: { placeholder: 'Preview…' },
      read: (s: CommonBlockSettings) => s.previewValue,
      write: (v): Partial<CommonBlockSettings> => ({ previewValue: v as string }),
      when: (s) => !!s.dynamicKey,
    },
  ],
})
