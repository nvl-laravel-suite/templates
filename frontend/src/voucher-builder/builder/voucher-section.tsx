import { Badge } from 'themelia-react-ui/base/badge'
import { cn } from '#/voucher-builder/lib/utils'
import { mmToPx } from '#/voucher-builder/lib/voucher'
import { BlockRenderer } from '#/voucher-builder/blocks/renderers/block-renderer'
import { useBlockSelection } from '#/voucher-builder/hooks/use-block-selection'
import type { VoucherSection } from '#/voucher-builder/schema'
import type { Block } from '#/voucher-builder/schema'

const DEBUG_COLORS = [
  '#DBEAFE', // blue-100 for section 1
  '#D1FAE5', // green-100 for section 2
  '#FEE2E2', // red-100 for section 3
]

const DEBUG_LABEL_COLORS = [
  '#93C5FD', // blue-300
  '#6EE7B7', // green-300
  '#FCA5A5', // red-300
]

interface VoucherSectionProps {
  section: VoucherSection
  blocks: Block[]
  stickerBlocks?: Block[]
  debugMode: boolean
  selected: boolean
  sectionIndex: number
  onSelect: (sectionId: string) => void
  children: React.ReactNode
}

export function VoucherSectionContainer({
  section,
  blocks,
  stickerBlocks,
  debugMode,
  selected,
  sectionIndex,
  onSelect,
  children,
}: VoucherSectionProps) {
  const heightPx = mmToPx(section.height)
  const verticalPadMm = Math.min(section.padding, 4)
  const verticalPadPx = mmToPx(verticalPadMm)
  const horizontalPadMm = section.widthMode === 'tight' ? 25 : section.widthMode === 'narrow' ? 20 : 8
  const horizontalPadPx = mmToPx(horizontalPadMm)

  const isEmpty = blocks.length === 0

  const radiusPx = mmToPx(8)
  const borderRadius =
    sectionIndex === 0
      ? `${radiusPx}px ${radiusPx}px 0 0`
      : sectionIndex === 2
        ? `0 0 ${radiusPx}px ${radiusPx}px`
        : undefined

  // Authored section clip: keep document corners separate from editor selection.
  // Debug mode is a non-destructive overlay — never alters the document's visual output
  const sectionStyle: React.CSSProperties = {
    height: heightPx,
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: section.backgroundColor !== 'transparent' ? section.backgroundColor : undefined,
    opacity: section.backgroundOpacity < 1 ? section.backgroundOpacity : undefined,
    borderRadius,
    position: 'relative',
  }

  return (
    <div
      style={{ height: heightPx, flexShrink: 0, position: 'relative' }}
      data-section-id={section.id}
      data-section-index={sectionIndex}
      data-selected={selected || undefined}
      className="nc-document-section"
      role="group"
      aria-label={`Section ${sectionIndex + 1} canvas`}
      tabIndex={0}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('[data-block-id]')) onSelect(section.id)
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(section.id)
      }}
    >
      <div className="nc-section-annotation" aria-hidden>
        <div className="nc-section-caption bg-background rounded-radius">
          <Badge>Section {sectionIndex + 1}</Badge>
        </div>
      </div>
      {/* Inner wrapper: position:relative, full size, no padding — sticker anchor */}
      <div style={{ ...sectionStyle, width: '100%', height: '100%' }}>
        {/* Debug overlay — non-destructive tint + label on top of real styles */}
        {debugMode && (
          <>
            {/* Color tint overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: DEBUG_COLORS[sectionIndex % DEBUG_COLORS.length],
                opacity: 0.15,
                pointerEvents: 'none',
                zIndex: 25,
                borderRadius: 'inherit',
              }}
            />
            {/* Section label */}
            <div className="nc-dynamic-annotation bg-background rounded-radius" style={{ zIndex: 30 }}>
              <Badge size="sm" tone="info">
                S{sectionIndex + 1} · {section.height}mm
              </Badge>
            </div>
            {/* Bottom separator line */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 1,
                background: DEBUG_LABEL_COLORS[sectionIndex % DEBUG_LABEL_COLORS.length],
                pointerEvents: 'none',
                zIndex: 30,
              }}
            />
          </>
        )}

        {/* Stickers — absolute, positioned relative to the full section bounds */}
        {stickerBlocks &&
          stickerBlocks.length > 0 &&
          stickerBlocks.map((sticker) => <StickerWrapper key={sticker.id} block={sticker} />)}

        {/* Padded content area */}
        <div
          style={{
            paddingTop: verticalPadPx,
            paddingBottom: verticalPadPx,
            paddingLeft: horizontalPadPx,
            paddingRight: horizontalPadPx,
            height: '100%',
          }}
        >
          {isEmpty ? (
            <div className="nc-section-empty" aria-hidden />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent:
                  section.verticalAlign === 'start'
                    ? 'flex-start'
                    : section.verticalAlign === 'end'
                      ? 'flex-end'
                      : 'center',
                height: '100%',
              }}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StickerWrapper({ block }: { block: Block }) {
  const { activeBlockIds, selectBlock } = useBlockSelection()
  const isSelected = activeBlockIds.includes(block.id)

  return (
    <div
      data-block-id={block.id}
      className={cn('cursor-pointer', isSelected && 'nc-selected')}
      style={{ position: 'absolute', zIndex: 20 }}
      onClick={(e) => {
        e.stopPropagation()
        selectBlock(block.id, e.shiftKey)
      }}
    >
      <BlockRenderer block={block} />
    </div>
  )
}
