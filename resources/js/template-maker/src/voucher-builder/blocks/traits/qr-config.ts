import { QR_EC_OPTIONS } from '../primitives/options'
import { defineTrait } from './registry'

export const qrConfigTrait = defineTrait({
  id: 'qr-config',
  title: 'QR',
  defaultOpen: true,
  fields: {
    value: {
      source: 'content',
      schema: { type: 'string', default: 'https://example.com', placeholder: 'https://example.com' },
    },
    errorCorrectionLevel: {
      source: 'settings',
      schema: { type: 'enum', default: 'M', options: [...QR_EC_OPTIONS] },
    },
    allowOverwrite: {
      source: 'settings',
      schema: { type: 'boolean', default: false },
    },
    overwriteKey: {
      source: 'settings',
      schema: {
        type: 'string',
        default: '',
        placeholder: ':qr_code_key',
        when: { field: 'allowOverwrite', value: true },
      },
    },
  },
  fieldOrder: ['value', 'errorCorrectionLevel', 'allowOverwrite', 'overwriteKey'],
})
