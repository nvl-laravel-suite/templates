import { z } from 'zod'
import { createBlockInstance } from '#/voucher-builder/blocks/factory'
import {
  ALIGNMENT_VALUES,
  ASPECT_RATIO_VALUES,
  BORDER_STYLE_VALUES,
  DATE_FORMAT_VALUES,
  DATE_MODE_VALUES,
  FONT_SIZE_VALUES,
  FONT_SIZE_WITH_AUTO_VALUES,
  FONT_WEIGHT_VALUES,
  FONT_WEIGHT_WITH_EXTRABOLD_VALUES,
  HEADING_LEVEL_VALUES,
  IMAGE_FILTER_VALUES,
  OBJECT_FIT_VALUES,
  QR_EC_VALUES,
  RESPONSIVE_VALUES,
  SHADOW_PRESET_VALUES,
  TRACKING_VALUES,
  TRANSFORM_VALUES,
  VISIBILITY_VALUES,
  ANIMATION_VALUES,
} from './enums'

// ── Common Block Settings (shared by ALL blocks) ─────────────────
export const CommonBlockSettingsSchema = z.object({
  alias: z.string().optional(),
  fullWidth: z.boolean().default(false),
  paddingTop: z.number().default(0),
  paddingBottom: z.number().default(0),
  paddingLeft: z.number().default(0),
  paddingRight: z.number().default(0),
  marginTop: z.number().default(0),
  marginBottom: z.number().default(0),
  marginLeft: z.number().default(0),
  marginRight: z.number().default(0),
  backgroundColor: z.string().default('transparent'),
  borderWidth: z.number().default(0),
  borderColor: z.string().default('#e5e7eb'),
  borderStyle: z.enum(BORDER_STYLE_VALUES).default('solid'),
  borderRadius: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  visibility: z.enum(VISIBILITY_VALUES).default('visible'),
  boxShadow: z.string().default(''),
  minHeight: z.number().default(0),
  anchor: z.string().default(''),
  dynamicKey: z.string().default(''),
  /**
   * Authoring-time tag for the BE: which resolver should populate this key
   * at render time. The shell does not consume this value (the renderer
   * uses a single flat substitution map regardless). Surfaced in the
   * dynamic-key manifest so a host BE knows which lookup path each key
   * belongs to.
   *
   *  - `data`    — per-recipient values (DTO / order record)
   *  - `content` — translatable strings (template_contents repository)
   *  - `asset`   — image/file references (template_assets repository)
   */
  dynamicKeySource: z.enum(['data', 'content', 'asset']).default('data'),
  previewValue: z.string().default(''),
  // Animation (screen preview / web output)
  animation: z.enum(ANIMATION_VALUES).default('none'),
  animationDelay: z.number().min(0).max(2000).default(0),
  // Print control
  pageBreakBefore: z.boolean().default(false),
  pageBreakAfter: z.boolean().default(false),
})

export type CommonBlockSettings = z.infer<typeof CommonBlockSettingsSchema>

export const defaultCommonSettings: CommonBlockSettings = {
  fullWidth: false,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderColor: '#e5e7eb',
  borderStyle: 'solid' as const,
  borderRadius: 0,
  opacity: 1,
  visibility: 'visible',
  boxShadow: '',
  minHeight: 0,
  anchor: '',
  dynamicKey: '',
  dynamicKeySource: 'data',
  previewValue: '',
  animation: 'none',
  animationDelay: 0,
  pageBreakBefore: false,
  pageBreakAfter: false,
}

// ── Global Settings ──────────────────────────────────────────────
export const GlobalSettingsSchema = z.object({
  layout: z.object({
    pagePadding: z.number().default(0),
    margin: z.number().default(10),
  }),
  typography: z.object({
    headingFont: z.string().default('Inter'),
    bodyFont: z.string().default('Inter'),
    baseSize: z.number().default(16),
    lineHeight: z.number().default(1.5),
    headingLineHeight: z.number().default(1.2),
    paragraphSpacing: z.number().default(0),
    headingSpacing: z.number().default(0),
  }),
  colors: z.object({
    primary: z.string().default('#111827'),
    accent: z.string().default('#3b82f6'),
    background: z.string().default('#ffffff'),
    text: z.string().default('#111827'),
    secondary: z.string().default('#6b7280'),
    border: z.string().default('#e5e7eb'),
    surface: z.string().default('#f9fafb'),
    link: z.string().default('#2563eb'),
  }),
  metadata: z.object({
    title: z.string().default('Untitled Document'),
    author: z.string().default(''),
    subject: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    language: z.string().default('en'),
  }),
  previewData: z.record(z.string(), z.string()).default({}),
})

// ── Block Schemas ────────────────────────────────────────────────

export const HeroBlockSchema = z.object({
  id: z.string(),
  type: z.literal('hero'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    childIds: z.array(z.string()).default([]),
  }),
  settings: z.object({
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
    backgroundStyle: z.enum(['solid', 'gradient']).default('solid'),
    backgroundColor: z.string().default('#ffffff'),
    textShadow: z.boolean().default(false),
    variant: z.enum(['default', 'magazine', 'split-tone']).default('default'),
    backgroundImageUrl: z.string().default(''),
    gradientDirection: z.enum(['135deg', '90deg', '180deg', '45deg', '0deg']).default('135deg'),
    gradientEndColor: z.string().default(''),
    minHeight: z.number().default(200),
    textColor: z.string().default(''),
  }),
})

export const SocialsBlockSchema = z.object({
  id: z.string(),
  type: z.literal('socials'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    links: z.array(z.object({
      platform: z.enum(['github', 'twitter', 'linkedin', 'web', 'mastodon', 'medium', 'dribbble', 'behance', 'youtube', 'stackoverflow']),
      url: z.string().default(''),
      label: z.string().default(''),
    })).default([]),
  }),
  settings: z.object({
    variant: z.enum(['icons-only', 'pills', 'full-width']).default('pills'),
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
    iconColor: z.string().default('#111827'),
    iconBgColor: z.string().default('#f3f4f6'),
    textColor: z.string().default(''),
  }),
})

export const QuoteBlockSchema = z.object({
  id: z.string(),
  type: z.literal('quote'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    childIds: z.array(z.string()).default([]),
  }),
  settings: z.object({
    variant: z.enum(['minimal', 'bordered', 'heavy']).default('bordered'),
    textColor: z.string().default(''),
    borderColor: z.string().default(''),
  }),
})

export const ImageBlockSchema = z.object({
  id: z.string(),
  type: z.literal('image'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    url: z.string().default(''),
    alt: z.string().default(''),
    caption: z.string().default(''),
  }),
  settings: z.object({
    width: z.number().default(100),
    widthUnit: z.enum(['%', 'px']).default('%'),
    height: z.number().default(0),
    heightUnit: z.enum(['px', 'auto']).default('auto'),
    borderRadius: z.number().default(8),
    objectFit: z.enum(OBJECT_FIT_VALUES).default('cover'),
    borderWidth: z.number().default(0),
    aspectRatio: z.enum(ASPECT_RATIO_VALUES).default('auto'),
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
    shadow: z.enum(SHADOW_PRESET_VALUES).default('none'),
    filter: z.enum(IMAGE_FILTER_VALUES).default('none'),
  }),
})

export const TableBlockSchema = z.object({
  id: z.string(),
  type: z.literal('table'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    headers: z.array(z.string()).default(['Column 1', 'Column 2', 'Column 3']),
    rows: z.array(z.array(z.string())).default([['', '', '']]),
  }),
  settings: z.object({
    striped: z.boolean().default(true),
    compact: z.boolean().default(false),
    showFooter: z.boolean().default(false),
    headerBackground: z.string().default('#f9fafb'),
    variant: z.enum(['none', 'horizontal', 'full', 'minimal']).default('horizontal'),
    fontSize: z.enum(FONT_SIZE_VALUES).default('sm'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('normal'),
    headerFontWeight: z.enum(FONT_WEIGHT_VALUES).default('semibold'),
  }),
})

export const DividerBlockSchema = z.object({
  id: z.string(),
  type: z.literal('divider'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({}),
  settings: z.object({
    style: z.enum(BORDER_STYLE_VALUES).default('solid'),
    weight: z.number().default(1),
    color: z.string().default('#e5e7eb'),
    width: z.enum(['100%', '75%', '50%', '25%']).default('100%'),
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
  }),
})

export const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    body: z.string().default('Start writing here...'),
  }),
  settings: z.object({
    fontSize: z.enum(FONT_SIZE_VALUES).default('md'),
    alignment: z.enum(ALIGNMENT_VALUES).default('left'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('normal'),
    letterSpacing: z.enum(TRACKING_VALUES).default('normal'),
    textTransform: z.enum(TRANSFORM_VALUES).default('none'),
    textColor: z.string().default(''),
    lineHeight: z.number().default(0),
    maxWidth: z.number().default(0),
  }),
})

// ── New Block Schemas ────────────────────────────────────────────

export const RowBlockSchema = z.object({
  id: z.string(),
  type: z.literal('row'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    columnCount: z.number().min(1).max(6).default(2),
    columnWidths: z.array(z.number()).default([50, 50]),
    columnIds: z.array(z.string()).default([]),
  }),
  settings: z.object({
    gap: z.number().default(0),
    verticalAlign: z.enum(['top', 'center', 'bottom', 'stretch']).default('top'),
    responsive: z.enum(RESPONSIVE_VALUES).default('stack'),
    reverseOnMobile: z.boolean().default(false),
  }),
})

export const GridBlockSchema = z.object({
  id: z.string(),
  type: z.literal('grid'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    columns: z.number().min(1).max(4).default(2),
    rows: z.number().min(1).max(4).default(2),
    rowHeights: z.array(z.number()).default([180, 180]),
    cellIds: z.array(z.string()).default([]),
  }),
  settings: z.object({
    gap: z.number().default(0),
    responsive: z.enum(RESPONSIVE_VALUES).default('stack'),
  }),
})

export const ColumnBlockSchema = z.object({
  id: z.string(),
  type: z.literal('column'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({}),
  settings: z.object({
    backgroundColor: z.string().default('transparent'),
    padding: z.number().default(0),
    borderRadius: z.number().default(0),
    borderWidth: z.number().default(0),
    borderColor: z.string().default('#e5e7eb'),
    gridColumnSpan: z.number().default(1),
    gridRowSpan: z.number().default(1),
  }),
})

export const HeadingBlockSchema = z.object({
  id: z.string(),
  type: z.literal('heading'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    text: z.string().default('Heading'),
  }),
  settings: z.object({
    level: z.enum(HEADING_LEVEL_VALUES).default('h2'),
    alignment: z.enum(ALIGNMENT_VALUES).default('left'),
    fontWeight: z.enum(FONT_WEIGHT_WITH_EXTRABOLD_VALUES).default('bold'),
    fontSize: z.enum(FONT_SIZE_WITH_AUTO_VALUES).default('auto'),
    letterSpacing: z.enum(TRACKING_VALUES).default('normal'),
    textTransform: z.enum(TRANSFORM_VALUES).default('none'),
    textColor: z.string().default(''),
    lineHeight: z.number().default(0),
    maxWidth: z.number().default(0),
  }),
})

export const SpacerBlockSchema = z.object({
  id: z.string(),
  type: z.literal('spacer'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({}),
  settings: z.object({
    height: z.number().default(40),
    showLine: z.boolean().default(false),
  }),
})

export const DateBlockSchema = z.object({
  id: z.string(),
  type: z.literal('date'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    value: z.string().default(''),
  }),
  settings: z.object({
    mode: z.enum(DATE_MODE_VALUES).default('auto'),
    format: z.enum(DATE_FORMAT_VALUES).default('long'),
    alignment: z.enum(ALIGNMENT_VALUES).default('left'),
    fontSize: z.enum(FONT_SIZE_VALUES).default('sm'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('medium'),
    textColor: z.string().default(''),
  }),
})

export const QrCodeBlockSchema = z.object({
  id: z.string(),
  type: z.literal('qrCode'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    value: z.string().default('https://example.com'),
    label: z.string().default(''),
    previewValue: z.string().default(''),
  }),
  settings: z.object({
    size: z.number().default(160),
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
    foreground: z.string().default('#111827'),
    background: z.string().default('#ffffff'),
    errorCorrectionLevel: z.enum(QR_EC_VALUES).default('M'),
    showLabel: z.boolean().default(false),
    allowOverwrite: z.boolean().default(false),
    overwriteKey: z.string().default(''),
  }),
})

export const ListBlockSchema = z.object({
  id: z.string(),
  type: z.literal('list'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    items: z.array(z.string()).default(['Item 1', 'Item 2', 'Item 3']),
  }),
  settings: z.object({
    listType: z.enum(['ordered', 'unordered', 'checklist']).default('unordered'),
    spacing: z.enum(['none', 'compact', 'normal', 'relaxed']).default('normal'),
    fontSize: z.enum(FONT_SIZE_VALUES).default('sm'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('normal'),
    lineHeight: z.number().default(1.4),
    textColor: z.string().default(''),
    columns: z.enum(['1', '2', '3']).default('1'),
    iconType: z.enum(['disc', 'circle', 'square', 'dash', 'check', 'arrow']).default('disc'),
  }),
})

export const ButtonBlockSchema = z.object({
  id: z.string(),
  type: z.literal('button'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    text: z.string().default('Click Me'),
    url: z.string().default('#'),
  }),
  settings: z.object({
    variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).default('primary'),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
    fullWidth: z.boolean().default(false),
  }),
})

export const BadgeBlockSchema = z.object({
  id: z.string(),
  type: z.literal('badge'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    text: z.string().default('Badge'),
  }),
  settings: z.object({
    variant: z.enum(['filled', 'outline', 'subtle']).default('filled'),
    color: z.string().default('#3b82f6'),
    size: z.enum(['sm', 'md']).default('md'),
    borderRadius: z.enum(['sm', 'full']).default('full'),
    textTransform: z.enum(TRANSFORM_VALUES).default('none'),
    icon: z.string().default(''),
    iconPosition: z.enum(['left', 'right']).default('left'),
    fontSize: z.enum(FONT_SIZE_VALUES).default('sm'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('medium'),
  }),
})

export const MetricBlockSchema = z.object({
  id: z.string(),
  type: z.literal('metric'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    value: z.string().default('42'),
    label: z.string().default('Projects Completed'),
    prefix: z.string().default(''),
    suffix: z.string().default(''),
  }),
  settings: z.object({
    alignment: z.enum(ALIGNMENT_VALUES).default('center'),
    fontSize: z.enum(FONT_SIZE_VALUES).default('xl'),
    labelFontSize: z.enum(FONT_SIZE_VALUES).default('sm'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('bold'),
    labelFontWeight: z.enum(FONT_WEIGHT_VALUES).default('normal'),
    valueColor: z.string().default(''),
    textColor: z.string().default(''),
  }),
})

export const ContactInfoBlockSchema = z.object({
  id: z.string(),
  type: z.literal('contactInfo'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    items: z.array(z.object({
      type: z.enum(['email', 'phone', 'location', 'website', 'linkedin', 'github', 'twitter', 'portfolio', 'mastodon', 'medium', 'dribbble', 'behance', 'stackoverflow', 'youtube']),
      value: z.string().default(''),
      label: z.string().default(''),
    })).default([]),
  }),
  settings: z.object({
    layout: z.enum(['inline', 'stacked']).default('stacked'),
    showIcons: z.boolean().default(true),
    iconColor: z.string().default('#3b82f6'),
    textColor: z.string().default(''),
    variant: z.enum(['default', 'card', 'compact']).default('default'),
  }),
})

export const SectionBlockSchema = z.object({
  id: z.string(),
  type: z.literal('section'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    title: z.string().default('Section Title'),
    icon: z.string().default('briefcase'),
    description: z.string().default(''),
    childIds: z.array(z.string()).default([]),
  }),
  settings: z.object({
    showTitle: z.boolean().default(true),
    showIcon: z.boolean().default(true),
    showDivider: z.boolean().default(true),
    showDescription: z.boolean().default(false),
    titleSize: z.enum(['sm', 'md', 'lg']).default('md'),
    titleFontWeight: z.enum(FONT_WEIGHT_WITH_EXTRABOLD_VALUES).default('bold'),
    titleColor: z.string().default(''),
    dividerColor: z.string().default(''),
    iconColor: z.string().default(''),
    iconBgColor: z.string().default(''),
    headerStyle: z.enum(['default', 'underline', 'accent-bar']).default('default'),
  }),
})

// ── New Content Blocks ──────────────────────────────────────────
export const SeparatorBlockSchema = z.object({
  id: z.string(),
  type: z.literal('separator'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({}),
  settings: z.object({
    style: z.enum(['dots', 'diamond', 'wave', 'fade', 'stars']).default('dots'),
    color: z.string().default(''),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
    spacing: z.enum(['sm', 'md', 'lg']).default('md'),
  }),
})

// ── Avatar (Primitives) ──────────────────────────────────────────
export const AvatarBlockSchema = z.object({
  id: z.string(),
  type: z.literal('avatar'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    url: z.string().default(''),
    alt: z.string().default(''),
    initials: z.string().default(''),
  }),
  settings: z.object({
    shape: z.enum(['circle', 'square', 'squircle']).default('circle'),
    size: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
    borderWidth: z.number().default(0),
    borderColor: z.string().default('#e5e7eb'),
    showInitials: z.boolean().default(true),
  }),
})

// ── Sticker Block ────────────────────────────────────────────────
export const StickerBlockSchema = z.object({
  id: z.string(),
  type: z.literal('sticker'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    imageUrl: z.string().default(''),
    alt: z.string().default(''),
  }),
  settings: z.object({
    posX: z.number().default(0),
    posY: z.number().default(0),
    width: z.number().default(30),
    height: z.number().default(30),
    rotate: z.number().default(0),
    opacity: z.number().min(0).max(1).default(1),
  }),
})

// ── Data Placeholder Block ───────────────────────────────────────
export const DataPlaceholderBlockSchema = z.object({
  id: z.string(),
  type: z.literal('dataPlaceholder'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    valueKey: z.string().default(''),
    placeholderText: z.string().default('Placeholder'),
    placeholderType: z.enum(['text', 'image']).default('text'),
    previewValue: z.string().default(''),
  }),
  settings: z.object({
    width: z.number().default(0),
    height: z.number().default(0),
    fontSize: z.enum(FONT_SIZE_VALUES).default('md'),
    alignment: z.enum(ALIGNMENT_VALUES).default('left'),
    fontWeight: z.enum(FONT_WEIGHT_VALUES).default('normal'),
  }),
})

// ── Metadata Block ───────────────────────────────────────────────
export const MetadataBlockSchema = z.object({
  id: z.string(),
  type: z.literal('metadata'),
  commonSettings: CommonBlockSettingsSchema.optional(),
  content: z.object({
    field: z.string().default('Field'),
    label: z.string().default('Value'),
  }),
  settings: z.object({
    separator: z.enum([':', '|', '-', '·', 'none']).default(':'),
    layout: z.enum(['horizontal', 'vertical']).default('horizontal'),
    fieldFontSize: z.enum(FONT_SIZE_VALUES).default('sm'),
    labelFontSize: z.enum(FONT_SIZE_VALUES).default('md'),
    fieldFontWeight: z.enum(FONT_WEIGHT_VALUES).default('normal'),
    labelFontWeight: z.enum(FONT_WEIGHT_VALUES).default('bold'),
    fieldMinWidth: z.number().default(0),
    spacing: z.number().default(8),
    alignment: z.enum(ALIGNMENT_VALUES).default('left'),
    fieldColor: z.string().default(''),
    labelColor: z.string().default(''),
  }),
})

// ── Union ────────────────────────────────────────────────────────
export const BlockSchema = z.discriminatedUnion('type', [
  HeroBlockSchema,
  SocialsBlockSchema,
  QuoteBlockSchema,
  ImageBlockSchema,
  TableBlockSchema,
  DividerBlockSchema,
  TextBlockSchema,
  RowBlockSchema,
  GridBlockSchema,
  ColumnBlockSchema,
  HeadingBlockSchema,
  SpacerBlockSchema,
  DateBlockSchema,
  QrCodeBlockSchema,
  ListBlockSchema,
  ButtonBlockSchema,
  BadgeBlockSchema,
  MetricBlockSchema,
  ContactInfoBlockSchema,
  SectionBlockSchema,
  SeparatorBlockSchema,
  AvatarBlockSchema,
  StickerBlockSchema,
  DataPlaceholderBlockSchema,
  MetadataBlockSchema,
])

export type Block = z.infer<typeof BlockSchema>
export type BlockType = Block['type']

export type HeroBlock = z.infer<typeof HeroBlockSchema>
export type SocialsBlock = z.infer<typeof SocialsBlockSchema>
export type QuoteBlock = z.infer<typeof QuoteBlockSchema>
export type ImageBlock = z.infer<typeof ImageBlockSchema>
export type TableBlock = z.infer<typeof TableBlockSchema>
export type DividerBlock = z.infer<typeof DividerBlockSchema>
export type TextBlock = z.infer<typeof TextBlockSchema>
export type RowBlock = z.infer<typeof RowBlockSchema>
export type GridBlock = z.infer<typeof GridBlockSchema>
export type ColumnBlock = z.infer<typeof ColumnBlockSchema>
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>
export type SpacerBlock = z.infer<typeof SpacerBlockSchema>
export type DateBlock = z.infer<typeof DateBlockSchema>
export type QrCodeBlock = z.infer<typeof QrCodeBlockSchema>
export type ListBlock = z.infer<typeof ListBlockSchema>
export type ButtonBlock = z.infer<typeof ButtonBlockSchema>
export type BadgeBlock = z.infer<typeof BadgeBlockSchema>
export type MetricBlock = z.infer<typeof MetricBlockSchema>
export type ContactInfoBlock = z.infer<typeof ContactInfoBlockSchema>
export type SectionBlock = z.infer<typeof SectionBlockSchema>
export type SeparatorBlock = z.infer<typeof SeparatorBlockSchema>
export type AvatarBlock = z.infer<typeof AvatarBlockSchema>
export type StickerBlock = z.infer<typeof StickerBlockSchema>
export type DataPlaceholderBlock = z.infer<typeof DataPlaceholderBlockSchema>
export type MetadataBlock = z.infer<typeof MetadataBlockSchema>

// ── Voucher Section ─────────────────────────────────────────────
export const VoucherSectionSchema = z.object({
  id: z.string(),
  height: z.number().default(90),
  padding: z.number().default(4),
  backgroundColor: z.string().default('#ffffff'),
  backgroundOpacity: z.number().min(0).max(1).default(1),
  widthMode: z.enum(['wide', 'narrow', 'tight']).default('wide'),
  verticalAlign: z.enum(['center', 'start', 'end']).default('center'),
  blockIds: z.array(z.string()).default([]),
})

export type VoucherSection = z.infer<typeof VoucherSectionSchema>

// ── Frame ───────────────────────────────────────────────────────
export const FrameSchema = z.object({
  imageUrl: z.string().nullable().default(null),
  opacity: z.number().min(0).max(1).default(1),
})

export type Frame = z.infer<typeof FrameSchema>

// ── Project ─────────────────────────────────────────────────────
export const ProjectSchema = z.object({
  global: GlobalSettingsSchema,
  blocks: z.record(z.string(), BlockSchema),
  sections: z.tuple([VoucherSectionSchema, VoucherSectionSchema, VoucherSectionSchema]),
  columnBlocks: z.record(z.string(), z.array(z.string())).default({}),
  frame: FrameSchema.default({ imageUrl: null, opacity: 1 }),
})

export type Project = z.infer<typeof ProjectSchema>
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>

// ── Block Defaults Factory ───────────────────────────────────────
export function createDefaultBlock(type: BlockType, id: string, locale = 'en'): Block {
  return createBlockInstance(type, id, locale)
}
