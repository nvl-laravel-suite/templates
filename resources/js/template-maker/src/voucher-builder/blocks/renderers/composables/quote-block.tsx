import { cn } from '../../../lib/utils'
import { useComposableChildren } from '../../../hooks/use-composable-children'
import { BlockRenderer } from '../block-renderer'
import { ComposableChildWrapper } from './composable-child-wrapper'
import type { QuoteBlock as QuoteBlockType } from '../../../schema'

interface QuoteSettings {
  variant: 'minimal' | 'bordered' | 'heavy'
  textColor?: string
  borderColor?: string
}

export function QuoteBlockRenderer({ block }: { block: QuoteBlockType }) {
  const { children, setActiveBlock, activeBlockIds } = useComposableChildren(block.id)
  const s = block.settings as QuoteSettings
  const textColor = s.textColor || ''
  const variant = s.variant

  return (
    <div style={textColor ? { color: textColor } : undefined}>
      <blockquote
        className={cn(
          'italic',
          variant === 'bordered' && 'border-l-4 pl-4',
          variant === 'heavy' && 'border-l-[6px] bg-muted/50 p-4 pl-6 rounded-r-lg',
          variant === 'minimal' && 'pl-2',
        )}
        style={{
          borderColor: variant !== 'minimal' ? (s.borderColor || 'var(--nc-accent, #3b82f6)') : undefined,
        }}
      >
        {children.map((child) => (
          <ComposableChildWrapper
            key={child.id}
            child={child}
            isActive={activeBlockIds.includes(child.id)}
            onActivate={setActiveBlock}
          >
            <BlockRenderer block={child} />
          </ComposableChildWrapper>
        ))}
      </blockquote>
    </div>
  )
}
