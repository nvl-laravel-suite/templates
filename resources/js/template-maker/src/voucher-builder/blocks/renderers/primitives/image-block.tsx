import { useCallback, useEffect, useRef } from 'react'
import type { ImageBlock as ImageBlockType } from '../../../schema'
import { ImageIcon, MoveHorizontal } from 'lucide-react'
import { useBlockActions, useHistoryActions, useSelectionState } from '../../../store/hooks'
import {
  IMAGE_FILTER_CSS,
  SHADOW_PRESET_CSS,
  resolveImage,
} from '../../primitives'

const MIN_IMAGE_WIDTH_PERCENT = 15
const MIN_IMAGE_WIDTH_PX = 80

export function ImageBlockRenderer({ block }: { block: ImageBlockType }) {
  const { activeBlockId, activeBlockIds } = useSelectionState()
  const { updateBlock } = useBlockActions()
  const { pushHistory } = useHistoryActions()
  const frameRef = useRef<HTMLDivElement>(null)
  const resizeMoveListenerRef = useRef<((event: PointerEvent) => void) | null>(null)
  const resizeStateRef = useRef<{ frameLeft: number; parentWidth: number; widthUnit: 'px' | '%' } | null>(null)

  const s = block.settings as Record<string, unknown>
  const width = s.width as number
  const height = s.height as number
  const borderRadius = s.borderRadius as number
  const borderWidth = s.borderWidth as number
  const widthUnit = (s.widthUnit as string) || '%'
  const heightUnit = (s.heightUnit as string) || 'auto'
  const alignment = (s.alignment as string) || 'center'
  const shadow = (s.shadow as string) || 'none'
  const filter = (s.filter as string) || 'none'
  const showResizeHandle = activeBlockId === block.id && activeBlockIds.length === 1

  const img = resolveImage({
    src: block.content.url,
    alt: block.content.alt,
    objectFit: s.objectFit as string,
    aspectRatio: s.aspectRatio as string,
  })

  const cssWidth = widthUnit === 'px' ? `${width}px` : `${width}%`
  const needsCentering = !(widthUnit === '%' && width === 100)

  const alignmentMargin: React.CSSProperties =
    alignment === 'left' ? { marginRight: 'auto', marginLeft: 0 } :
    alignment === 'right' ? { marginLeft: 'auto', marginRight: 0 } :
    needsCentering ? { marginInline: 'auto' } : {}

  const containerStyle: React.CSSProperties = {
    width: cssWidth,
    ...alignmentMargin,
    ...(heightUnit !== 'auto' && height > 0 && { height: `${height}px` }),
    ...img.style,
    borderRadius,
    borderWidth,
    borderColor: 'var(--nc-accent, #3b82f6)',
    borderStyle: borderWidth > 0 ? 'solid' : 'none',
    overflow: 'hidden',
    ...(shadow !== 'none' && SHADOW_PRESET_CSS[shadow] && { boxShadow: SHADOW_PRESET_CSS[shadow] }),
  }

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: img.style.objectFit,
    display: 'block',
    ...(filter !== 'none' && IMAGE_FILTER_CSS[filter] && { filter: IMAGE_FILTER_CSS[filter] }),
  }

  const handleResizeMove = useCallback((event: PointerEvent) => {
    const state = resizeStateRef.current
    if (!state) return

    const rawWidthPx = event.clientX - state.frameLeft

    if (state.widthUnit === '%') {
      const nextWidth = Math.max(
        MIN_IMAGE_WIDTH_PERCENT,
        Math.min(100, Math.round((rawWidthPx / Math.max(state.parentWidth, 1)) * 100))
      )
      updateBlock(block.id, {
        settings: {
          ...block.settings,
          width: nextWidth,
          widthUnit: '%',
        },
      } as Partial<ImageBlockType>)
      return
    }

    const nextWidth = Math.max(MIN_IMAGE_WIDTH_PX, Math.round(rawWidthPx))
    updateBlock(block.id, {
      settings: {
        ...block.settings,
        width: nextWidth,
        widthUnit: 'px',
      },
    } as Partial<ImageBlockType>)
  }, [block.id, block.settings, updateBlock])

  const stopResize = useCallback(() => {
    const moveListener = resizeMoveListenerRef.current
    if (moveListener) {
      window.removeEventListener('pointermove', moveListener)
    }
    window.removeEventListener('pointerup', stopResize)
    resizeMoveListenerRef.current = null
    resizeStateRef.current = null
  }, [])

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const frame = frameRef.current
    const parent = frame?.parentElement
    if (!frame || !parent) return

    event.preventDefault()
    event.stopPropagation()
    pushHistory()

    const frameRect = frame.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    resizeStateRef.current = {
      frameLeft: frameRect.left,
      parentWidth: parentRect.width,
      widthUnit: widthUnit as 'px' | '%',
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    resizeMoveListenerRef.current = handleResizeMove
    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', stopResize)
  }, [handleResizeMove, pushHistory, stopResize, widthUnit])

  useEffect(() => () => {
    if (resizeStateRef.current) {
      stopResize()
    }
  }, [stopResize])

  return (
    <div>
      <div ref={frameRef} className="relative" style={containerStyle}>
        {img.src ? (
          <img src={img.src} alt={img.alt} style={imgStyle} />
        ) : (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 opacity-30" />
          </div>
        )}
        {showResizeHandle && (
          <button
            type="button"
            aria-label="Resize image"
            className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:scale-105 hover:text-foreground"
            style={{ touchAction: 'none' }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handleResizeStart}
          >
            <MoveHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {block.content.caption && (
        <p className="mt-2 text-center text-xs text-muted-foreground">{block.content.caption}</p>
      )}
    </div>
  )
}
