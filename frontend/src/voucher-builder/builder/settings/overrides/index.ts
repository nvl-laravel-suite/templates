import type { ReactNode } from 'react'
import { ContactInfoOverride } from './contact-info-override'
import { GridOverride } from './grid-override'
import { RowOverride } from './row-override'
import { SectionOverride } from './section-override'
import { SocialsOverride } from './socials-override'
import { TableOverride } from './table-override'
import type { BlockOverrideProps } from './types'

export { type BlockOverrideProps } from './types'

export const customOverrides: Record<string, (props: BlockOverrideProps) => ReactNode> = {
  row: RowOverride,
  grid: GridOverride,
  socials: SocialsOverride,
  table: TableOverride,
  contactInfo: ContactInfoOverride,
  section: SectionOverride,
}
