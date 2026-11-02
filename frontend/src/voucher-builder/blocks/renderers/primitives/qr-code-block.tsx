import type { CSSProperties } from 'react'
import type { QrCodeBlock as QrCodeBlockType } from '#/voucher-builder/schema'
import { renderQrCodeSvg } from '#/voucher-builder/lib/qr-code'

export function QrCodeBlockRenderer({ block }: { block: QrCodeBlockType }) {
  const settings = block.settings as QrCodeBlockType['settings'] & {
    allowOverwrite?: boolean
    overwriteKey?: string
  }

  const alignmentStyle: CSSProperties =
    settings.alignment === 'left' ? { marginRight: 'auto' } :
    settings.alignment === 'right' ? { marginLeft: 'auto' } :
    { marginInline: 'auto' }

  const svgMarkup = renderQrCodeSvg({
    value: block.content.value,
    size: settings.size,
    foreground: settings.foreground,
    background: settings.background,
    errorCorrectionLevel: settings.errorCorrectionLevel,
  })

  return (
    <div style={alignmentStyle} className="w-fit relative">
      {svgMarkup ? (
        <div
          className="overflow-hidden"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/25 text-[11px] text-muted-foreground"
          style={{ width: settings.size, height: settings.size }}
        >
          Add a URL
        </div>
      )}
      {settings.showLabel && block.content.label && (
        <p
          className="mt-2 text-center text-xs text-muted-foreground"
          style={{ maxWidth: settings.size, overflowWrap: 'break-word', wordWrap: 'break-word' }}
        >
          {block.content.label}
        </p>
      )}
      {settings.allowOverwrite && settings.overwriteKey && (
        <span className="absolute top-1 right-1 rounded bg-warning px-1.5 py-0.5 font-mono text-[9px] text-warning-foreground leading-none">
          API: {settings.overwriteKey}
        </span>
      )}
    </div>
  )
}
