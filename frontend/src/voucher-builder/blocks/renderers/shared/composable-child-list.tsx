import { cn } from '#/voucher-builder/lib/utils'
import { useComposableChildren } from '#/voucher-builder/hooks/use-composable-children'
import { BlockRenderer } from '../block-renderer'
import type { Block } from '#/voucher-builder/schema'
import { defaultCommonSettings } from '#/voucher-builder/schema'
import React from 'react'

interface ComposableChildListProps {
  blockId: string
  className?: string
  emptyMessage?: string
  renderChild?: (child: Block, defaultEl: React.ReactNode) => React.ReactNode
  /** Separator between children (e.g. for inline variant). Only rendered between items. */
  separator?: React.ReactNode
}

export function ComposableChildList({ blockId, className, emptyMessage, renderChild, separator }: ComposableChildListProps) {
  const { children, setActiveBlock, activeBlockIds } = useComposableChildren(blockId)

  if (children.length === 0 && emptyMessage) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 py-6 text-[11px] text-muted-foreground/40">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={className || 'space-y-0'}>
      {children.map((child, index) => {
        const cs = child.commonSettings || defaultCommonSettings
        const defaultEl = (
          <div
            style={{
              marginTop: cs.marginTop > 0 ? cs.marginTop : undefined,
              marginRight: (cs.marginRight ?? 0) > 0 ? cs.marginRight : undefined,
              marginBottom: cs.marginBottom > 0 ? cs.marginBottom : undefined,
              marginLeft: (cs.marginLeft ?? 0) > 0 ? cs.marginLeft : undefined,
            }}
          >
            <div
              className={cn(
                'relative cursor-pointer',
                activeBlockIds.includes(child.id) ? 'nc-selected' : 'nc-selectable'
              )}
              style={{
                paddingTop: cs.paddingTop > 0 ? cs.paddingTop : undefined,
                paddingRight: cs.paddingRight > 0 ? cs.paddingRight : undefined,
                paddingBottom: cs.paddingBottom > 0 ? cs.paddingBottom : undefined,
                paddingLeft: cs.paddingLeft > 0 ? cs.paddingLeft : undefined,
                backgroundColor: cs.backgroundColor !== 'transparent' ? cs.backgroundColor : undefined,
                borderWidth: cs.borderWidth > 0 ? cs.borderWidth : undefined,
                borderColor: cs.borderWidth > 0 ? cs.borderColor : undefined,
                borderStyle: cs.borderWidth > 0 ? 'solid' : undefined,
                borderRadius: cs.borderRadius > 0 ? cs.borderRadius : undefined,
                opacity: cs.opacity < 1 ? cs.opacity : undefined,
              }}
              onClick={(e) => { e.stopPropagation(); setActiveBlock(child.id, e.shiftKey) }}
            >
              <BlockRenderer block={child} />
            </div>
          </div>
        )

        const el = renderChild
          ? renderChild(child, defaultEl)
          : defaultEl

        return (
          <React.Fragment key={child.id}>
            {el}
            {separator && index < children.length - 1 && separator}
          </React.Fragment>
        )
      })}
    </div>
  )
}
