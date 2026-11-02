import type { Block } from '#/voucher-builder/schema'

export interface BlockOverrideProps {
  block: any
  update: (updates: Partial<Block>) => void
}
