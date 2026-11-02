import { cn } from '#/voucher-builder/lib/utils'
import { getIcon } from '#/voucher-builder/lib/icons'
import { resolveTypography } from '#/voucher-builder/blocks/primitives'

interface BadgeBlockData {
  id: string
  type: 'badge'
  content: { text: string }
  settings: Record<string, unknown>
}

export function BadgeBlockRenderer({ block }: { block: BadgeBlockData }) {
  const s = block.settings
  const variant = (s.variant as string) || 'filled'
  const color = (s.color as string) || '#3b82f6'
  const size = (s.size as string) || 'md'
  const borderRadius = (s.borderRadius as string) || 'full'
  const iconKey = (s.icon as string) || ''
  const iconPosition = (s.iconPosition as string) || 'left'
  const radiusClass = borderRadius === 'full' ? 'rounded-full' : 'rounded'
  const sizeClass = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1'

  const typo = resolveTypography({
    fontSize: s.fontSize as string,
    fontWeight: s.fontWeight as string,
    textTransform: s.textTransform as string,
  })
  const style: React.CSSProperties = { ...typo.style }

  if (variant === 'filled') {
    style.backgroundColor = color
    style.color = '#fff'
  } else if (variant === 'outline') {
    style.borderColor = color
    style.color = color
    style.borderWidth = 1
    style.borderStyle = 'solid'
  } else {
    style.backgroundColor = `color-mix(in srgb, ${color} 12%, transparent)`
    style.color = color
  }

  const IconComponent = iconKey ? getIcon(iconKey) : null
  const iconEl = IconComponent ? <IconComponent className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> : null

  return (
    <span className={cn('inline-flex items-center gap-1', radiusClass, sizeClass, ...typo.classes)} style={style}>
      {iconPosition === 'left' && iconEl}
      {block.content.text || 'Badge'}
      {iconPosition === 'right' && iconEl}
    </span>
  )
}
