import QRCode from 'qrcode'

export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H'

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderQrCodeSvg({
  value,
  size = 160,
  foreground = '#111827',
  background = '#ffffff',
  errorCorrectionLevel = 'M',
  margin = 0,
}: {
  value: string
  size?: number
  foreground?: string
  background?: string
  errorCorrectionLevel?: QrErrorLevel
  margin?: number
}): string {
  if (!value.trim()) return ''

  try {
    const qr = QRCode.create(value, { errorCorrectionLevel })
    const moduleSize = qr.modules.size
    const totalSize = moduleSize + margin * 2
    const cell = size / totalSize
    const path: string[] = []

    for (let row = 0; row < moduleSize; row += 1) {
      for (let col = 0; col < moduleSize; col += 1) {
        if (!qr.modules.get(row, col)) continue

        const x = (col + margin) * cell
        const y = (row + margin) * cell
        path.push(`M${x} ${y}h${cell}v${cell}h-${cell}z`)
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code">
  <rect width="${size}" height="${size}" fill="${escapeAttribute(background)}" />
  <path d="${path.join('')}" fill="${escapeAttribute(foreground)}" />
</svg>`
  } catch {
    return ''
  }
}
