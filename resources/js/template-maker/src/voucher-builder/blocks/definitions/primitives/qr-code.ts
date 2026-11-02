import { ScanQrCode } from 'lucide-react'
import { defineBlock } from '../../registry'
import { QrCodeBlockRenderer } from '../../renderers/primitives/qr-code-block'
import { colorsGroup, contentGroup, sizeGroup } from '../../helpers/settings-factories'

export const qrCodeBlock = defineBlock({
  type: 'qrCode',
  name: 'QR Code',
  description: 'SVG QR code for portfolios, LinkedIn, or contact links',
  icon: ScanQrCode,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,

  content: {
    label: { type: 'string', default: '', placeholder: 'Optional caption' },
  },
  settings: {
    size: { type: 'slider', default: 160, min: 80, max: 320, step: 8, suffix: 'px' },
    alignment: { type: 'alignment', default: 'center' },
    foreground: { type: 'color', default: '#111827' },
    background: { type: 'color', default: '#ffffff' },
    showLabel: { type: 'boolean', default: false },
  },

  traits: ['qr-config'],

  settingsLayout: [
    'trait:qr-config',
    contentGroup(['label']),
    sizeGroup(['size', 'alignment']),
    colorsGroup(['foreground', 'background'], { title: 'Colors' }),
    contentGroup(['showLabel'], { title: 'Options' }),
  ],

  render: QrCodeBlockRenderer,
})
