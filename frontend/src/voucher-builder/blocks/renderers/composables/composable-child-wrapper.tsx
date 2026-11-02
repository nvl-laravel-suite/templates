import type { ReactNode } from 'react'
import { cn } from '#/voucher-builder/lib/utils'
import { buildComposableChildStyles } from '#/voucher-builder/blocks/primitives'
import { defaultCommonSettings } from '#/voucher-builder/schema'
import type { Block } from '#/voucher-builder/schema'

export interface ComposableChildWrapperProps {
  child: Block
  isActive: boolean
  onActivate: (id: string, shiftKey: boolean) => void
  extraInnerClass?: string
  children: ReactNode
}

/**
 * Shared wrapper around a composable block's child renderer.
 * Two-level structure: outer gets margin, inner gets padding/bg/border +
 * click-to-select behavior. Used by hero, quote, and future composables.
 */
export function ComposableChildWrapper({
  child,
  isActive,
  onActivate,
  extraInnerClass,
  children,
}: ComposableChildWrapperProps) {
  const cs = child.commonSettings || defaultCommonSettings
  const { outer, inner } = buildComposableChildStyles(cs)
  return (
    <div style={outer}>
      <div
        className={cn(
          'relative cursor-pointer',
          isActive ? 'nc-selected' : 'nc-selectable',
          extraInnerClass,
        )}
        style={inner}
        onClick={(e) => {
          e.stopPropagation()
          onActivate(child.id, e.shiftKey)
        }}
      >
        {children}
      </div>
    </div>
  )
}
