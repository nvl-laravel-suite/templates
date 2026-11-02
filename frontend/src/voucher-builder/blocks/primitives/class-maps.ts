// ── Shared renderer className / numeric maps ──────────────────
// Single source of truth for every block renderer. Keep literal-string
// maps here so Tailwind's content scanner picks them up at build time.

// Button variants (used by button + could be used by socials/contact-info)
export const BUTTON_VARIANT_CLASSES: Record<string, string> = {
  primary: 'bg-[var(--nc-accent,#3b82f6)] text-white hover:opacity-90',
  secondary: 'bg-[var(--nc-surface,#f3f4f6)] text-[var(--nc-text,#111827)] hover:opacity-80',
  outline: 'border-2 border-[var(--nc-accent,#3b82f6)] text-[var(--nc-accent,#3b82f6)] hover:bg-[var(--nc-accent,#3b82f6)]/10',
  ghost: 'text-[var(--nc-accent,#3b82f6)] hover:bg-[var(--nc-accent,#3b82f6)]/10',
}

export const BUTTON_SIZE_CLASSES: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
}

// Alignment maps (flex-style vs text-style — expose both)
export const FLEX_JUSTIFY_ALIGN: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

// Avatar
export const AVATAR_SIZE_CLASSES: Record<string, string> = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  xl: 'h-32 w-32',
}

export const AVATAR_TEXT_SIZE_CLASSES: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

export const AVATAR_SHAPE_CLASSES: Record<string, string> = {
  circle: 'rounded-full',
  square: 'rounded-lg',
  squircle: 'rounded-[28%]',
}

// Font weight enum key → numeric CSS value (for contexts that need numbers,
// e.g. inline style on SVG text or tables)
export const FONT_WEIGHT_NUMERIC_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
}
