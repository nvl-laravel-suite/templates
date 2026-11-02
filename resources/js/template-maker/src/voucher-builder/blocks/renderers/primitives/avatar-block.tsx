import { cn } from '../../../lib/utils'
import {
  AVATAR_SHAPE_CLASSES,
  AVATAR_SIZE_CLASSES,
  AVATAR_TEXT_SIZE_CLASSES,
} from '../../primitives'

interface AvatarBlockData {
  id: string
  type: 'avatar'
  content: { url: string; alt: string; initials: string }
  settings: { shape: string; size: string; borderWidth: number; borderColor: string; showInitials: boolean }
}

export function AvatarBlockRenderer({ block }: { block: AvatarBlockData }) {
  const { size, shape, borderWidth, borderColor, showInitials } = block.settings
  const sizeClass = AVATAR_SIZE_CLASSES[size] || AVATAR_SIZE_CLASSES.md
  const shapeClass = AVATAR_SHAPE_CLASSES[shape] || AVATAR_SHAPE_CLASSES.circle
  const textSizeClass = AVATAR_TEXT_SIZE_CLASSES[size] || AVATAR_TEXT_SIZE_CLASSES.md

  const hasImage = !!block.content.url
  const hasInitials = showInitials && !!block.content.initials
  const hasBorder = borderWidth > 0

  return (
    <div
      className={cn(
        'overflow-hidden flex items-center justify-center shrink-0',
        sizeClass,
        shapeClass,
        !hasImage && 'bg-muted',
      )}
      style={{
        borderWidth: hasBorder ? borderWidth : undefined,
        borderColor: hasBorder ? (borderColor || 'var(--nc-border, #e5e7eb)') : undefined,
        borderStyle: hasBorder ? 'solid' : undefined,
      }}
    >
      {hasImage ? (
        <img
          src={block.content.url}
          alt={block.content.alt || ''}
          className="h-full w-full object-cover"
        />
      ) : hasInitials ? (
        <span className={cn('font-semibold text-muted-foreground select-none', textSizeClass)}>
          {block.content.initials.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <svg className={cn(textSizeClass, 'text-muted-foreground/30')} width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      )}
    </div>
  )
}
