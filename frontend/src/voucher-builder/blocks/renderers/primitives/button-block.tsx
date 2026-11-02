import { cn } from '#/voucher-builder/lib/utils'
import type { ButtonBlock as ButtonBlockType } from '#/voucher-builder/schema'
import { getIcon } from '#/voucher-builder/lib/icons'
import {
  BUTTON_SIZE_CLASSES,
  BUTTON_VARIANT_CLASSES,
  FLEX_JUSTIFY_ALIGN,
  resolveLink,
} from '#/voucher-builder/blocks/primitives'

export function ButtonBlockRenderer({ block }: { block: ButtonBlockType }) {
  const s = block.settings as Record<string, unknown>
  const link = resolveLink({
    url: block.content.url,
    openInNew: s.openInNew as boolean,
    rel: s.rel as string,
  })
  const iconKey = (s.icon as string) || ''
  const iconPosition = (s.iconPosition as string) || 'left'
  const iconSize = (s.iconSize as number) || 16
  const IconComponent = iconKey ? getIcon(iconKey) : null
  const iconEl = IconComponent
    ? <IconComponent style={{ width: iconSize, height: iconSize }} />
    : null

  return (
    <div className={cn('flex', FLEX_JUSTIFY_ALIGN[block.settings.alignment])}>
      <a
        href={link.href ?? '#'}
        target={link.target}
        rel={link.rel}
        onClick={(e) => { if (!link.href) e.preventDefault() }}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-lg font-medium transition-colors no-underline select-none',
          BUTTON_VARIANT_CLASSES[block.settings.variant],
          BUTTON_SIZE_CLASSES[block.settings.size],
          block.settings.fullWidth && 'w-full justify-center',
        )}
      >
        {iconPosition === 'left' && iconEl}
        {block.content.text || 'Button'}
        {iconPosition === 'right' && iconEl}
      </a>
    </div>
  )
}
