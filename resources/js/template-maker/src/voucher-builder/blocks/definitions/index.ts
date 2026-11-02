// Import all block definitions — importing them registers them in the registry
//
// Register traits FIRST so they're available during block defineBlock calls.
import '../traits'

// Primitives
export { headingBlock } from './primitives/heading'
export { textBlock } from './primitives/text'
export { imageBlock } from './primitives/image'
export { buttonBlock } from './primitives/button'
export { spacerBlock } from './primitives/spacer'
export { dateBlock } from './primitives/date'
export { qrCodeBlock } from './primitives/qr-code'
export { dividerBlock } from './primitives/divider'
export { listBlock } from './primitives/list'
export { badgeBlock } from './primitives/badge'
export { metricBlock } from './primitives/metric'
export { separatorBlock } from './primitives/separator'
export { avatarBlock } from './primitives/avatar'
export { stickerBlock } from './primitives/sticker'
export { dataPlaceholderBlock } from './primitives/data-placeholder'
export { metadataBlock } from './primitives/metadata'

// Composables
export { heroBlock } from './composables/hero'
export { quoteBlock } from './composables/quote'
export { socialsBlock } from './composables/socials'
export { contactInfoBlock } from './composables/contact-info'
export { tableBlock } from './composables/table'

// Sections (generic only)
export { sectionBlock } from './sections/section'

// Layout
export { rowBlock } from './layout/row'
export { gridBlock } from './layout/grid'
export { columnBlock } from './layout/column'
