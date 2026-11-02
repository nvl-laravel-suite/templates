import type { BlockType } from '#/voucher-builder/schema'
import { ChildManager } from '#/voucher-builder/builder/settings'
import type { BlockOverrideProps } from './types'

export function sliderValue(value: number | readonly number[]): number {
  if (typeof value === 'number') return value
  return value[0] ?? 0
}

export function createChildManagerOverride(config: {
  childType: BlockType | BlockType[]
  labelField: string
  aliasPrefix: string
  addButtonLabel: string
  title?: string
}) {
  return function ChildManagerOverride({ block, update }: BlockOverrideProps) {
    return (
      <ChildManager
        blockId={block.id}
        childType={config.childType}
        labelField={config.labelField}
        aliasPrefix={config.aliasPrefix}
        addButtonLabel={config.addButtonLabel}
        title={config.title}
        block={block}
        onUpdate={update}
      />
    )
  }
}
