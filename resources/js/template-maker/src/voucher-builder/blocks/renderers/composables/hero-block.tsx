import { cn } from '../../../lib/utils'
import { useComposableChildren } from '../../../hooks/use-composable-children'
import { BlockRenderer } from '../block-renderer'
import { ComposableChildWrapper } from './composable-child-wrapper'
import type { HeroBlock as HeroBlockType } from '../../../schema'

interface HeroSettings {
  alignment: string
  minHeight: number
  backgroundStyle: 'solid' | 'gradient'
  backgroundColor: string
  gradientDirection?: string
  gradientEndColor?: string
  backgroundImageUrl?: string
  textShadow?: boolean
  textColor?: string
  variant?: 'default' | 'magazine' | 'split-tone'
}

const ALIGN_TEXT_CLASSES: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function HeroBlockRenderer({ block }: { block: HeroBlockType }) {
  const { children, setActiveBlock, activeBlockIds } = useComposableChildren(block.id)
  const s = block.settings as HeroSettings
  const textColor = s.textColor || ''
  const align = ALIGN_TEXT_CLASSES[s.alignment] || 'text-center'

  const bgStyle: React.CSSProperties = {}

  if (s.backgroundImageUrl) {
    bgStyle.backgroundImage = `url(${s.backgroundImageUrl})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
  } else if (s.backgroundStyle === 'gradient') {
    bgStyle.background = `linear-gradient(${s.gradientDirection || '135deg'}, ${s.backgroundColor}, ${s.gradientEndColor || 'var(--nc-accent, #3b82f6)'})`
  } else {
    bgStyle.backgroundColor = s.backgroundColor
  }

  const variant = s.variant || 'default'

  if (variant === 'magazine' && bgStyle.backgroundImage) {
    bgStyle.backgroundImage = `linear-gradient(to top, rgba(0,0,0,0.6), transparent), ${bgStyle.backgroundImage}`
  }
  if (variant === 'split-tone' && !s.backgroundImageUrl && s.backgroundStyle !== 'gradient') {
    bgStyle.background = `linear-gradient(135deg, var(--nc-background, #ffffff) 50%, var(--nc-surface, #f9fafb) 50%)`
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-center gap-2',
        align,
        variant === 'magazine' && 'rounded-xl overflow-hidden',
        variant === 'split-tone' && 'rounded-xl',
      )}
      style={{ ...(textColor ? { color: textColor } : {}), ...bgStyle, minHeight: s.minHeight || 200 }}
    >
      {children.map((child) => (
        <ComposableChildWrapper
          key={child.id}
          child={child}
          isActive={activeBlockIds.includes(child.id)}
          onActivate={setActiveBlock}
          extraInnerClass={s.textShadow ? '[&_*]:drop-shadow-md' : undefined}
        >
          <BlockRenderer block={child} />
        </ComposableChildWrapper>
      ))}
    </div>
  )
}
