import {
  useDocumentState,
  useFrameState,
  useGlobalSettingsState,
  useVisualToolingState,
  useSectionState,
  useSectionActions,
  useSelectionActions,
} from '../store/hooks'
import { mmToPx, A4_WIDTH_MM, A4_HEIGHT_MM } from '../lib/voucher'
import { SortableBlock } from './layout-grid'
import { VoucherSectionContainer } from './voucher-section'
import { RulerWrapper } from './ruler-overlay'
import { GridOverlay } from './grid-overlay'
import { getFontFamily } from '../lib/fonts'
import { getDirection } from '../i18n/core'
import type { Block, VoucherSection } from '../schema'
import { useBlockSelection } from '../hooks/use-block-selection'

function CanvasInner({ onSectionSelect }: { onSectionSelect?: () => void }) {
  const { sections, activeSectionId } = useSectionState()
  const { setActiveSectionId } = useSectionActions()
  const blocks = useDocumentState((state) => state.blocks)
  const globalSettings = useGlobalSettingsState()
  const frame = useFrameState()
  const { showGrid, gridSize, debugMode } = useVisualToolingState()
  const { clearActiveSelection } = useSelectionActions()
  const { activeBlockIds } = useBlockSelection()

  const pagePadding = globalSettings.layout?.pagePadding ?? 0
  const direction = getDirection(globalSettings.metadata.language)
  const marginMm = globalSettings.layout?.margin ?? 10

  const canvasWidthPx = mmToPx(A4_WIDTH_MM)
  const canvasHeightPx = mmToPx(A4_HEIGHT_MM)
  const marginPx = mmToPx(marginMm)

  const cssVars: React.CSSProperties = {
    '--nc-primary': globalSettings.colors.primary,
    '--nc-accent': globalSettings.colors.accent,
    '--nc-background': globalSettings.colors.background,
    '--nc-text': globalSettings.colors.text,
    '--nc-secondary': (globalSettings.colors as any).secondary || '#6b7280',
    '--nc-border': (globalSettings.colors as any).border || '#e5e7eb',
    '--nc-surface': (globalSettings.colors as any).surface || '#f9fafb',
    '--nc-link': (globalSettings.colors as any).link || '#2563eb',
    '--nc-page-padding': `${pagePadding}px`,
    fontFamily: getFontFamily(globalSettings.typography.bodyFont),
    fontSize: globalSettings.typography.baseSize,
    lineHeight: globalSettings.typography.lineHeight,
    backgroundColor: globalSettings.colors.background,
    color: globalSettings.colors.text,
    direction,
  } as React.CSSProperties

  return (
    <div
      className="relative nc-paper print:m-0 print:shadow-none"
      style={{
        width: canvasWidthPx,
        height: canvasHeightPx,
        ...cssVars,
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('[data-block-id]')) {
          clearActiveSelection()
        }
      }}
    >
      {/* Frame image behind everything */}
      {frame.imageUrl && (
        <img
          src={frame.imageUrl}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: frame.opacity,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Grid overlay — lines */}
      {showGrid && <GridOverlay gridSizeMm={gridSize} />}

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: marginPx,
        }}
      >
        {sections.map((section: VoucherSection, index: number) => {
          const sectionBlocks = section.blockIds.map((id: string) => blocks[id]).filter(Boolean) as Block[]
          const flowBlocks = sectionBlocks.filter((b) => b.type !== 'sticker')
          const stickerBlocks = sectionBlocks.filter((b) => b.type === 'sticker')

          return (
            <VoucherSectionContainer
              key={section.id}
              section={section}
              blocks={flowBlocks}
              debugMode={debugMode}
              selected={activeSectionId === section.id && !activeBlockIds.length}
              sectionIndex={index}
              onSelect={(id) => {
                setActiveSectionId(id)
                clearActiveSelection()
                onSectionSelect?.()
              }}
              stickerBlocks={stickerBlocks}
            >
              {flowBlocks.map((block: Block) => (
                <SortableBlock key={block.id} block={block} sectionId={section.id} />
              ))}
            </VoucherSectionContainer>
          )
        })}
      </div>
    </div>
  )
}

export function VoucherCanvas({ onSectionSelect }: { onSectionSelect?: () => void }) {
  const { showRulers } = useVisualToolingState()

  if (showRulers) {
    return (
      <div className="mx-auto my-8 w-fit">
        <RulerWrapper>
          <CanvasInner onSectionSelect={onSectionSelect} />
        </RulerWrapper>
      </div>
    )
  }

  return (
    <div className="mx-auto my-8 w-fit">
      <CanvasInner onSectionSelect={onSectionSelect} />
    </div>
  )
}
