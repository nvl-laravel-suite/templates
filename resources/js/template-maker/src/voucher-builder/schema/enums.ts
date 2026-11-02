// ── Shared enum value tuples for Zod schemas ──────────────────
// Keep these aligned with the `{ value, label }` option arrays in
// `src/voucher-builder/blocks/primitives/options.ts`. The tuples here
// are the raw values only; labels live with the UI layer.

export const ALIGNMENT_VALUES = ['left', 'center', 'right'] as const
export const ALIGNMENT_WITH_JUSTIFY_VALUES = ['left', 'center', 'right', 'justify'] as const
export const VERTICAL_ALIGN_VALUES = ['start', 'center', 'end'] as const
export const BORDER_STYLE_VALUES = ['solid', 'dashed', 'dotted'] as const
export const VISIBILITY_VALUES = ['visible', 'print-only', 'screen-only'] as const

export const FONT_SIZE_VALUES = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
export const FONT_SIZE_WITH_AUTO_VALUES = ['auto', 'xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
export const FONT_WEIGHT_VALUES = ['normal', 'medium', 'semibold', 'bold'] as const
export const FONT_WEIGHT_WITH_EXTRABOLD_VALUES = ['normal', 'medium', 'semibold', 'bold', 'extrabold'] as const
export const TRACKING_VALUES = ['tighter', 'tight', 'normal', 'wide', 'wider'] as const
export const TRANSFORM_VALUES = ['none', 'uppercase', 'lowercase', 'capitalize'] as const

export const HEADING_LEVEL_VALUES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

export const OBJECT_FIT_VALUES = ['cover', 'contain', 'fill', 'none'] as const
export const ASPECT_RATIO_VALUES = ['auto', '1/1', '4/3', '16/9', '3/2', '21/9'] as const
export const SHADOW_PRESET_VALUES = ['none', 'sm', 'md', 'lg'] as const
export const IMAGE_FILTER_VALUES = ['none', 'grayscale', 'sepia'] as const

export const DATE_FORMAT_VALUES = ['long', 'month-year', 'short', 'iso'] as const
export const DATE_MODE_VALUES = ['auto', 'static'] as const

export const QR_EC_VALUES = ['L', 'M', 'Q', 'H'] as const

export const ICON_POSITION_VALUES = ['left', 'right'] as const

export const RESPONSIVE_VALUES = ['stack', 'scroll', 'none'] as const

export const ANIMATION_VALUES = ['none', 'fade-in', 'slide-up', 'zoom-in'] as const
