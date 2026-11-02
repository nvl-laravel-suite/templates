import type { StickerBlock as StickerBlockType } from '../../../schema'
import { mmToPx } from '../../../lib/voucher'

export function StickerBlockRenderer({ block }: { block: StickerBlockType }) {
  const { content, settings } = block

  return (
    <div
      style={{
        position: 'absolute',
        left: mmToPx(settings.posX),
        top: mmToPx(settings.posY),
        width: mmToPx(settings.width),
        height: mmToPx(settings.height),
        transform: `rotate(${settings.rotate}deg)`,
        opacity: settings.opacity,
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      {content.imageUrl ? (
        <img
          src={content.imageUrl}
          alt={content.alt}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground/40 text-xs">
          Sticker
        </div>
      )}
    </div>
  )
}
