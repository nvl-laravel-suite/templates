import { Badge } from 'themelia-react-ui/base/badge'
import { EmptyState as WorkspaceEmptyState } from 'themelia-react-ui/blocks/data-display'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { cn } from '../lib/utils'
import { BlockRenderer } from '../blocks/renderers/block-renderer'
import { BlockErrorBoundary } from '../blocks/renderers/block-error-boundary'
import { useBlockSelection } from '../hooks/use-block-selection'
import {
  useDocumentState,
  useFocusedBlocks,
  useGlobalSettingsState,
  useSelectionActions,
  useVisualToolingState,
} from '../store/hooks'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { resolveBlockValue, PRIMARY_CONTENT_FIELD } from '../lib/preview'
import type { Block, CommonBlockSettings, VoucherSection } from '../schema'
import { defaultCommonSettings } from '../schema'
import { getFontFamily } from '../lib/fonts'
import { getSectionRootIds } from '../engine/graph'
import { getDirection } from '../i18n/core'
import { useReadOnly } from '../context'

/**
 * Golden Block pattern: each block wrapper provides its own padding.
 * - Normal blocks: wrapper gets pagePadding on left/right
 * - Full-width blocks: wrapper gets 0 padding (stretches edge-to-edge)
 * - Custom padding on the block overrides the default
 */
/** Styles for the inner wrapper (padding, bg, border — NOT margin) */
export function getWrapperStyles(cs: CommonBlockSettings | undefined): React.CSSProperties {
  const s = cs || defaultCommonSettings
  const r: React.CSSProperties = {}

  if (s.paddingTop > 0) r.paddingTop = s.paddingTop
  if (s.paddingBottom > 0) r.paddingBottom = s.paddingBottom
  if (s.paddingLeft > 0) r.paddingLeft = s.paddingLeft
  if (s.paddingRight > 0) r.paddingRight = s.paddingRight
  if (s.backgroundColor && s.backgroundColor !== 'transparent') r.backgroundColor = s.backgroundColor
  if (s.borderWidth > 0) {
    r.borderWidth = s.borderWidth
    r.borderColor = s.borderColor
    r.borderStyle = 'solid'
  }
  if (s.borderRadius > 0) r.borderRadius = s.borderRadius
  if (s.opacity < 1) r.opacity = s.opacity
  if (s.boxShadow) r.boxShadow = s.boxShadow
  if (s.minHeight > 0) r.minHeight = s.minHeight

  return r
}

/** Styles for the outer block container (margin on all sides) */
export function getOuterStyles(cs: CommonBlockSettings | undefined): React.CSSProperties {
  const s = cs || defaultCommonSettings
  const r: React.CSSProperties = {}

  if (s.marginTop > 0) r.marginTop = s.marginTop
  if (s.marginBottom > 0) r.marginBottom = s.marginBottom
  if (s.marginLeft > 0) r.marginLeft = s.marginLeft
  if (s.marginRight > 0) r.marginRight = s.marginRight

  return r
}

export function SortableBlock({ block }: { block: Block; sectionId: string }) {
  const readOnly = useReadOnly()
  const { activeBlockIds, selectBlock } = useBlockSelection()
  const focusedBlockIds = useFocusedBlocks()
  const { showPreviewData } = useVisualToolingState()
  const globalSettings = useGlobalSettingsState()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: readOnly,
  })
  const isSelected = activeBlockIds.includes(block.id)
  const isFocused = focusedBlockIds.includes(block.id)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cs = block.commonSettings || defaultCommonSettings

  const previewData = globalSettings.previewData || {}
  const dynamicKey = block.commonSettings?.dynamicKey
  const primaryField = PRIMARY_CONTENT_FIELD[block.type]
  const resolvedDynamic =
    dynamicKey && primaryField && showPreviewData
      ? resolveBlockValue(dynamicKey, previewData, block.commonSettings?.previewValue)
      : undefined

  const renderBlock =
    resolvedDynamic && primaryField
      ? ({ ...block, content: { ...block.content, [primaryField]: resolvedDynamic } } as Block)
      : block

  const visibilityClass =
    (block.commonSettings as any)?.visibility === 'print-only'
      ? 'hidden print:block'
      : (block.commonSettings as any)?.visibility === 'screen-only'
        ? 'print:hidden'
        : ''

  const handleClick = (e: React.MouseEvent) => {
    // Don't deselect when clicking inside contentEditable
    const target = e.target as HTMLElement
    if (target.closest('[data-inline-editing]')) return
    if (!readOnly) selectBlock(block.id, e.shiftKey)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        margin: `${cs.marginTop}px ${cs.marginRight}px ${cs.marginBottom}px ${cs.marginLeft}px`,
      }}
      id={(block.commonSettings as any)?.anchor || undefined}
      data-block-id={block.id}
      className={cn(
        'group relative cursor-pointer transition-all duration-150',
        isSelected ? 'nc-selected' : 'nc-selectable',
        isFocused && !isSelected && 'ring-2 ring-ring ring-offset-1',
        visibilityClass,
      )}
      onClick={handleClick}
    >
      {!readOnly && (
        <UIStack
          direction="vertical"
          gap="xs"
          wrap={false}
          className="absolute top-2 z-10 opacity-0 transition group-hover:opacity-100"
          style={{ left: Math.max(cs.paddingLeft - 20, 4) }}
        >
          <UIAction
            buttonStyle="ghost"
            iconOnly
            size="sm"
            {...attributes}
            {...listeners}
            className="cursor-grab"
            aria-label="Drag block to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </UIAction>
        </UIStack>
      )}

      {block.commonSettings?.dynamicKey && (
        <div className="nc-dynamic-annotation bg-background rounded-radius">
          <Badge size="sm" tone={showPreviewData ? 'info' : undefined}>
            {showPreviewData ? 'Preview data' : <code>{block.commonSettings.dynamicKey}</code>}
          </Badge>
        </div>
      )}

      {/* The wrapper — padding, bg, border */}
      <div
        style={{
          padding: `${cs.paddingTop}px ${cs.paddingRight}px ${cs.paddingBottom}px ${cs.paddingLeft}px`,
          backgroundColor: cs.backgroundColor !== 'transparent' ? cs.backgroundColor : undefined,
          borderWidth: cs.borderWidth > 0 ? cs.borderWidth : undefined,
          borderColor: cs.borderWidth > 0 ? cs.borderColor : undefined,
          borderStyle: cs.borderWidth > 0 ? (cs as any).borderStyle || 'solid' : undefined,
          borderRadius: cs.borderRadius > 0 ? cs.borderRadius : undefined,
          opacity: cs.opacity < 1 ? cs.opacity : undefined,
          boxShadow: cs.boxShadow || undefined,
          minHeight: cs.minHeight > 0 ? cs.minHeight : undefined,
        }}
      >
        <BlockErrorBoundary blockType={renderBlock.type}>
          <BlockRenderer block={renderBlock} />
        </BlockErrorBoundary>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <WorkspaceEmptyState
      title="Start building your voucher"
      description="Open Blocks to add content, or Templates to start from a complete design."
      padding="md"
    />
  )
}

export function LayoutGrid({ sectionId }: { sectionId: string }) {
  const sections = useDocumentState((state) => state.sections)
  const blocks = useDocumentState((state) => state.blocks)
  const globalSettings = useGlobalSettingsState()
  const { clearActiveSelection } = useSelectionActions()

  const section = sections.find((s: VoucherSection) => s.id === sectionId)
  if (!section) return null

  const rootIds = getSectionRootIds(section)
  const sectionBlocks = rootIds.map((id: string) => blocks[id]).filter(Boolean)
  const pagePadding = globalSettings.layout?.pagePadding ?? 40
  const direction = getDirection(globalSettings.metadata.language)

  return (
    <div
      className="relative mx-auto my-8 min-h-[1123px] w-full nc-paper print:m-0 print:shadow-none"
      style={
        {
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
          overflow: 'hidden',
          paddingTop: (globalSettings.layout as any)?.pageMarginTop || undefined,
          paddingBottom: (globalSettings.layout as any)?.pageMarginBottom || undefined,
          // NO horizontal padding on page container — each block wrapper provides its own
        } as React.CSSProperties
      }
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          clearActiveSelection()
        }
      }}
    >
      {sectionBlocks.length === 0 ? (
        <div className="flex h-full items-center justify-center" style={{ padding: pagePadding }}>
          <EmptyState />
        </div>
      ) : (
        <div className="grid grid-cols-1">
          {sectionBlocks.map((block: Block) => (
            <SortableBlock key={block.id} block={block} sectionId={sectionId} />
          ))}
        </div>
      )}
    </div>
  )
}
