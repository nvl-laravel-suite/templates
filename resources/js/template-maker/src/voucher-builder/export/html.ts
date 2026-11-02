import type { Block, Project } from '../schema'
import { getFontFamily, fontRegistry } from '../lib/fonts'
import { sanitizeRichTextHtml } from '../lib/rich-text'
import { PRIMARY_CONTENT_FIELD, resolveBlockValue } from '../lib/preview'
import { getBlockSettings } from '../blocks/settings-accessor'
import { resolveDateBlockValue, type DateDisplayFormat, type DateSourceMode } from '../lib/date-block'
import { renderQrCodeSvg } from '../lib/qr-code'
import { getBlockListChildIds, getDirectChildIds, getSectionRootIds } from '../engine/graph'
import { getDirection } from '../i18n/core'
import { resolveFontSize } from '../lib/font-sizes'
import {
  FONT_WEIGHT_NUMERIC_MAP,
  IMAGE_FILTER_CSS,
  SHADOW_PRESET_CSS,
  commonWrapperCss,
  typographyCss,
} from './html-helpers'

// ── HTML escaping ────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Apply payload-driven substitutions to a single block. Pure — returns a
 * new block (typed loosely as `Block`) when changes are needed.
 *
 * Order:
 *  1. dataPlaceholder.valueKey      → emits resolved text/image (tracked in resolvedDataPlaceholder set)
 *  2. qrCode.allowOverwrite + key   → content.value
 *  3. commonSettings.dynamicKey     → primary content field for the block type
 */
function applyDataSubstitutions(
  block: Block,
  data: Record<string, string>,
  resolvedPlaceholders: Map<string, string>,
): Block {
  const content = block.content as Record<string, unknown>
  const settings = getBlockSettings(block)
  let nextContent: Record<string, unknown> | null = null

  if (block.type === 'dataPlaceholder') {
    const key = (content.valueKey as string) || ''
    const value = key ? data[key] : undefined
    if (value !== undefined) {
      resolvedPlaceholders.set(block.id, value)
    }
  }

  if (block.type === 'qrCode' && (settings as Record<string, unknown>).allowOverwrite) {
    const key = (settings as Record<string, unknown>).overwriteKey as string
    const value = key ? data[key] : undefined
    if (value !== undefined) {
      nextContent = { ...(nextContent ?? content), value }
    }
  }

  const dynamicKey = block.commonSettings?.dynamicKey
  if (dynamicKey) {
    const primary = PRIMARY_CONTENT_FIELD[block.type]
    const value = resolveBlockValue(dynamicKey, data, block.commonSettings?.previewValue)
    if (primary && value !== undefined) {
      nextContent = { ...(nextContent ?? content), [primary]: value }
    }
  }

  if (!nextContent) return block
  return { ...block, content: nextContent } as unknown as Block
}

// Heading size fallbacks when user picks 'auto' for font-size.
const HEADING_LEVEL_FONT_SIZES: Record<string, string> = {
  h1: '2.25rem',
  h2: '1.875rem',
  h3: '1.5rem',
  h4: '1.25rem',
  h5: '1.125rem',
  h6: '1rem',
}

/**
 * Options for `exportToHTML`. All fields are optional; passing none yields
 * the same output as before plus the project's own `global.previewData`
 * applied as the substitution payload.
 */
export interface ExportToHTMLOptions {
  /**
   * Key/value payload that overrides the project's `global.previewData`.
   * Used for:
   *  - dataPlaceholder blocks (matched by `content.valueKey`)
   *  - any block with `commonSettings.dynamicKey` set (replaces the block's
   *    primary content field — heading text, image url, metric value, etc.)
   *  - QR-code blocks with `settings.allowOverwrite + settings.overwriteKey`
   *    (replaces `content.value`)
   */
  data?: Record<string, string | number | null | undefined>
  /** Override the project's frame (image + opacity) at render time. */
  frame?: { imageUrl?: string | null; opacity?: number }
  /** Override the `<title>` tag in the emitted HTML. */
  documentTitle?: string
}

/**
 * Render a project to a standalone HTML string with inlined styles.
 * Creates a static document that can be opened in any browser.
 *
 * @param project The project (use `parseVoucherImport` to load from JSON).
 * @param options Optional render-time payload (data substitutions, frame, title).
 */
export function exportToHTML(project: Project, options: ExportToHTMLOptions = {}): string {
  const { global: g, blocks: rawBlocks, sections, columnBlocks, frame: rawFrame } = project
  const data: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...(g.previewData || {}), ...(options.data || {}) })) {
    if (v !== null && v !== undefined && v !== '') data[k] = String(v)
  }
  const frame = {
    imageUrl: options.frame?.imageUrl !== undefined ? options.frame.imageUrl : rawFrame?.imageUrl,
    opacity: options.frame?.opacity !== undefined ? options.frame.opacity : (rawFrame?.opacity ?? 1),
  }
  // Apply dynamic-key substitutions block-by-block before rendering.
  const resolvedPlaceholders = new Map<string, string>()
  const blocks: typeof rawBlocks = {}
  for (const [id, block] of Object.entries(rawBlocks)) {
    blocks[id] = applyDataSubstitutions(block, data, resolvedPlaceholders)
  }
  const language = g.metadata.language || 'en'
  const direction = getDirection(language)
  const graph = { blocks, sections, columnBlocks }
  const getChildren = (blockId: string) => getBlockListChildIds(graph, blockId)
  const getStructuralChildren = (blockId: string) => getDirectChildIds(graph, blockId)

  const layout = g.layout
  const margin = layout?.margin ?? 10

  // Collect Google Fonts used
  const usedFonts = new Set<string>()
  usedFonts.add(g.typography.headingFont)
  usedFonts.add(g.typography.bodyFont)

  const fontLinks = Array.from(usedFonts)
    .map((name) => {
      const entry = fontRegistry.find((f) => f.name === name)
      if (!entry || name === 'Inter') return ''
      const weights = entry.weights.join(';')
      return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${entry.googleId}:wght@${weights}&display=swap">`
    })
    .filter(Boolean)
    .join('\n    ')

  // Render a single block (recursive for containers) to HTML.
  function renderBlock(blockId: string, depth = 0): string {
    const block = blocks[blockId]
    if (!block) return ''

    const content = block.content as Record<string, unknown>
    const settings = getBlockSettings(block)
    const cs = block.commonSettings
    const textColor = (settings.textColor as string) || 'var(--nc-text)'
    let wrapperCss = commonWrapperCss(cs)
    // Animation (screen-media): emit as inline CSS animation-* properties.
    if (cs && cs.animation && cs.animation !== 'none') {
      const delay = cs.animationDelay || 0
      const extra = `animation-name:nc-${cs.animation};animation-duration:600ms;animation-fill-mode:both;animation-delay:${delay}ms`
      wrapperCss = wrapperCss ? `${wrapperCss};${extra}` : extra
    }
    const wrapperClasses: string[] = []
    if (cs?.visibility === 'print-only') wrapperClasses.push('nc-print-only')
    else if (cs?.visibility === 'screen-only') wrapperClasses.push('nc-screen-only')
    const classAttr = wrapperClasses.length > 0 ? ` class="${wrapperClasses.join(' ')}"` : ''
    const idAttr = cs?.anchor ? ` id="${escapeHtml(cs.anchor)}"` : ''
    const wrapperAttr = `${idAttr}${classAttr}${wrapperCss ? ` style="${wrapperCss}"` : ''}`

    let inner = ''

    switch (block.type) {
      case 'heading': {
        const level = (settings.level as string) || 'h2'
        const fontSize = settings.fontSize as string | undefined
        const fontSizeOverride = !fontSize || fontSize === 'auto' ? HEADING_LEVEL_FONT_SIZES[level] : undefined
        const css = typographyCss(
          {
            fontSize: fontSizeOverride ? undefined : fontSize,
            fontWeight: (settings.fontWeight as string) || 'bold',
            letterSpacing: settings.letterSpacing as string,
            textTransform: settings.textTransform as string,
            alignment: (settings.alignment as string) || 'left',
            lineHeight: settings.lineHeight as number,
            maxWidth: settings.maxWidth as number,
            textColor: settings.textColor as string,
          },
          { fallbackColor: textColor, fontSizeOverride },
        )
        // Replace double-quotes in font stack with single so the inline style attr isn't broken.
        const headingFont = getFontFamily(g.typography.headingFont).replace(/"/g, "'")
        inner = `<${level} style="${css};font-family:${headingFont}">${sanitizeRichTextHtml((content.text as string) || 'Heading', { multiline: false })}</${level}>`
        break
      }

      case 'text': {
        const css = typographyCss(
          {
            fontSize: settings.fontSize as string,
            fontWeight: settings.fontWeight as string,
            letterSpacing: settings.letterSpacing as string,
            textTransform: settings.textTransform as string,
            alignment: (settings.alignment as string) || 'left',
            lineHeight: settings.lineHeight as number,
            maxWidth: settings.maxWidth as number,
            textColor: settings.textColor as string,
          },
          { fallbackColor: textColor },
        )
        inner = `<p style="${css}">${sanitizeRichTextHtml((content.body as string) || '', { multiline: true })}</p>`
        break
      }

      case 'image': {
        if (content.url) {
          const width = settings.width as number
          const widthUnit = (settings.widthUnit as string) || '%'
          const height = settings.height as number
          const heightUnit = (settings.heightUnit as string) || 'auto'
          const alignment = (settings.alignment as string) || 'center'
          const borderRadius = (settings.borderRadius as number) || 0
          const objectFit = (settings.objectFit as string) || 'cover'
          const aspectRatio = settings.aspectRatio as string
          const shadow = settings.shadow as string
          const filter = settings.filter as string

          const imgWidth = widthUnit === '%' ? `${width}%` : width > 0 ? `${width}px` : '100%'
          const imgHeight = heightUnit === 'auto' || !height ? 'auto' : `${height}px`
          const imgAlign =
            alignment === 'left' ? 'margin-right:auto;margin-left:0' :
            alignment === 'right' ? 'margin-left:auto;margin-right:0' :
            'margin-inline:auto'
          const aspectCss = aspectRatio && aspectRatio !== 'auto' ? `;aspect-ratio:${aspectRatio}` : ''
          const shadowCss = shadow && shadow !== 'none' && SHADOW_PRESET_CSS[shadow]
            ? `;box-shadow:${SHADOW_PRESET_CSS[shadow]}` : ''
          const filterCss = filter && filter !== 'none' && IMAGE_FILTER_CSS[filter]
            ? `;filter:${IMAGE_FILTER_CSS[filter]}` : ''

          inner = `<figure style="text-align:center;${imgAlign};width:${imgWidth}"><img src="${escapeHtml(content.url as string)}" alt="${escapeHtml((content.alt as string) || '')}" style="width:100%;height:${imgHeight};border-radius:${borderRadius}px;object-fit:${objectFit};display:block${aspectCss}${shadowCss}${filterCss}" />`
          if (content.caption) {
            inner += `<figcaption style="font-size:0.875rem;opacity:0.7;margin-top:0.5rem">${escapeHtml(content.caption as string)}</figcaption>`
          }
          inner += `</figure>`
        }
        break
      }

      case 'divider': {
        const width = (settings.width as string) || '100%'
        const color = (settings.color as string) || 'var(--nc-border, #e5e7eb)'
        const alignment = settings.alignment as string
        const weight = (settings.weight as number) || 1
        const style = (settings.style as string) || 'solid'
        const align =
          alignment === 'left' ? 'margin-right:auto;margin-left:0' :
          alignment === 'right' ? 'margin-left:auto;margin-right:0' :
          'margin-inline:auto'
        inner = `<hr style="border:none;border-top:${weight}px ${style} ${color};max-width:${width};${align}" />`
        break
      }

      case 'spacer': {
        const height = (settings.height as number) || 40
        inner = `<div style="height:${height}px"></div>`
        break
      }

      case 'date': {
        const value = resolveDateBlockValue({
          mode: ((settings.mode as DateSourceMode) || 'auto'),
          format: ((settings.format as DateDisplayFormat) || 'long'),
          staticValue: (content.value as string) || '',
        })
        const css = typographyCss(
          {
            fontSize: settings.fontSize as string,
            fontWeight: (settings.fontWeight as string) || 'medium',
            alignment: (settings.alignment as string) || 'left',
            textColor: settings.textColor as string,
          },
          { fallbackColor: textColor },
        )
        inner = `<p style="${css}">${escapeHtml(value)}</p>`
        break
      }

      case 'qrCode': {
        const align = (settings.alignment as string) || 'center'
        const svg = renderQrCodeSvg({
          value: (content.value as string) || '',
          size: (settings.size as number) || 160,
          foreground: (settings.foreground as string) || '#111827',
          background: (settings.background as string) || '#ffffff',
          errorCorrectionLevel: (settings.errorCorrectionLevel as 'L' | 'M' | 'Q' | 'H') || 'M',
        })
        if (!svg) break
        const label = settings.showLabel && content.label
          ? `<figcaption style="font-size:0.75rem;opacity:0.7;margin-top:0.5rem">${escapeHtml(content.label as string)}</figcaption>`
          : ''
        inner = `<figure style="text-align:${align}">${svg}${label}</figure>`
        break
      }

      case 'list': {
        const tag = settings.listType === 'ordered' ? 'ol' : 'ul'
        const items = ((content.items as string[]) || []).map((item: string) => `<li>${sanitizeRichTextHtml(item, { multiline: false })}</li>`).join('')
        const css = typographyCss(
          {
            fontSize: (settings.fontSize as string) || 'sm',
            fontWeight: settings.fontWeight as string,
            lineHeight: settings.lineHeight as number,
            textColor: settings.textColor as string,
          },
          { fallbackColor: textColor },
        )
        inner = `<${tag} style="${css};padding-left:1.5rem">${items}</${tag}>`
        break
      }

      case 'badge': {
        const fw = FONT_WEIGHT_NUMERIC_MAP[(settings.fontWeight as string) || 'medium']
        const fs = resolveFontSize((settings.fontSize as string) || 'sm')
        const color = (settings.color as string) || '#3b82f6'
        const transform = (settings.textTransform as string) && settings.textTransform !== 'none'
          ? `text-transform:${settings.textTransform};`
          : ''
        const tracking = (settings.letterSpacing as string) && settings.letterSpacing !== 'normal'
          ? `letter-spacing:${settings.letterSpacing};`
          : ''
        inner = `<span style="display:inline-block;padding:0.25rem 0.75rem;border-radius:9999px;font-size:${fs};font-weight:${fw};background:${color};color:#fff;${transform}${tracking}">${escapeHtml((content.text as string) || '')}</span>`
        break
      }

      case 'contactInfo': {
        const items = (content.items as Array<{ label?: string; type: string; value?: string }>) || []
        const isInline = settings.layout === 'inline'
        if (isInline) {
          const parts = items.map((item) => {
            const label = item.label || item.type
            return `<span>${escapeHtml(label)}: ${escapeHtml(item.value || '')}</span>`
          }).join('<span style="margin:0 0.5rem;opacity:0.3">|</span>')
          inner = `<address style="font-style:normal;text-align:center;font-size:0.875rem;color:${textColor}">${parts}</address>`
        } else {
          const parts = items.map((item) => {
            const label = item.label || item.type
            return `<div style="margin-bottom:0.25rem;font-size:0.875rem;color:${textColor}"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(item.value || '')}</div>`
          }).join('')
          inner = `<address style="font-style:normal">${parts}</address>`
        }
        break
      }

      case 'grid': {
        const cellIds = getStructuralChildren(block.id)
        const rowHeights = (content.rowHeights as number[]) || []
        const columns = (content.columns as number) || 2
        const gap = (settings.gap as number) || 16
        const cells = cellIds.map((cellId: string) => {
          const cell = blocks[cellId]
          if (!cell) return ''
          const cellSettings = getBlockSettings(cell)
          const childIds = getChildren(cellId)
          const childrenHtml = childIds.map((id) => renderBlock(id, depth + 1)).join('\n')
          const parts = [
            `padding:${(cellSettings.padding as number) ?? 16}px`,
            `grid-column:span ${Math.max((cellSettings.gridColumnSpan as number) || 1, 1)} / span ${Math.max((cellSettings.gridColumnSpan as number) || 1, 1)}`,
            `grid-row:span ${Math.max((cellSettings.gridRowSpan as number) || 1, 1)} / span ${Math.max((cellSettings.gridRowSpan as number) || 1, 1)}`,
          ]
          if (cellSettings.backgroundColor && cellSettings.backgroundColor !== 'transparent') {
            parts.push(`background:${cellSettings.backgroundColor}`)
          }
          if (cellSettings.borderRadius) parts.push(`border-radius:${cellSettings.borderRadius}px`)
          if (cellSettings.borderWidth) parts.push(`border:${cellSettings.borderWidth}px solid ${(cellSettings.borderColor as string) || 'var(--nc-border, #e5e7eb)'}`)
          return `<div style="${parts.join(';')}">${childrenHtml}</div>`
        }).join('\n')
        inner = `<div style="display:grid;gap:${gap}px;grid-template-columns:repeat(${columns}, minmax(0,1fr));grid-template-rows:${rowHeights.map((h: number) => `minmax(${h}px,auto)`).join(' ')}">${cells}</div>`
        break
      }

      case 'metric': {
        const valueCss = typographyCss(
          {
            fontSize: ((settings.fontSize as string) || (settings.valueSize as string) || 'xl'),
            fontWeight: ((settings.fontWeight as string) || 'bold'),
            textColor: settings.valueColor as string,
          },
          { fallbackColor: textColor },
        )
        const labelCss = typographyCss(
          {
            fontSize: ((settings.labelFontSize as string) || 'sm'),
            fontWeight: ((settings.labelFontWeight as string) || 'normal'),
            textColor: settings.textColor as string,
          },
          { fallbackColor: textColor },
        )
        const alignment = (settings.alignment as string) || 'center'
        inner = `<div style="text-align:${alignment};color:${textColor}"><div style="${valueCss}">${escapeHtml((content.prefix as string) || '')}${escapeHtml((content.value as string) || '')}${escapeHtml((content.suffix as string) || '')}</div><div style="${labelCss};opacity:0.7">${escapeHtml((content.label as string) || '')}</div></div>`
        break
      }

      case 'button': {
        const variant = (settings.variant as string) || 'primary'
        const variantStyles: Record<string, string> = {
          primary: `background:var(--nc-accent,#3b82f6);color:#fff;border:none`,
          secondary: `background:var(--nc-surface,#f3f4f6);color:var(--nc-text,#374151);border:none`,
          outline: `background:transparent;color:var(--nc-accent,#3b82f6);border:1px solid var(--nc-accent,#3b82f6)`,
          ghost: `background:transparent;color:var(--nc-accent,#3b82f6);border:none`,
        }
        const alignment = (settings.alignment as string) || 'center'
        inner = `<div style="text-align:${alignment}"><a href="${escapeHtml((content.url as string) || '#')}" style="display:inline-block;padding:0.5rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:500;${variantStyles[variant] || variantStyles.primary}">${escapeHtml((content.text as string) || '')}</a></div>`
        break
      }

      case 'hero': {
        const childIds = getChildren(block.id)
        const childrenHtml = childIds.map((id) => renderBlock(id, depth + 1)).join('\n')
        const bgStyle = settings.backgroundStyle === 'gradient'
          ? `background:linear-gradient(${(settings.gradientDirection as string) || '135deg'}, ${(settings.backgroundColor as string) || '#ffffff'}, ${(settings.gradientEndColor as string) || 'var(--nc-accent, #3b82f6)'})`
          : settings.backgroundColor ? `background:${settings.backgroundColor}` : ''
        const minH = settings.minHeight ? `min-height:${settings.minHeight}px` : ''
        const align = settings.alignment ? `text-align:${settings.alignment}` : ''
        const heroColor = (settings.textColor as string) ? `color:${settings.textColor}` : ''
        inner = `<div style="${[bgStyle, minH, align, heroColor, 'padding:2rem'].filter(Boolean).join(';')}">${childrenHtml}</div>`
        break
      }

      case 'quote': {
        const childIds = getChildren(block.id)
        const childrenHtml = childIds.map((id) => renderBlock(id, depth + 1)).join('\n')
        const borderColor = (settings.borderColor as string) || 'var(--nc-accent, #3b82f6)'
        const variant = (settings.variant as string) || 'bordered'
        const borderStyle = variant === 'heavy' ? `border-left:4px solid ${borderColor}` :
          variant === 'bordered' ? `border-left:2px solid ${borderColor}` : ''
        const quoteColor = (settings.textColor as string) ? `color:${settings.textColor};` : ''
        inner = `<blockquote style="${borderStyle};padding-left:1rem;margin:0;${quoteColor}">${childrenHtml}</blockquote>`
        break
      }

      case 'section': {
        const title = (content.title as string) || ''
        const titleColor = (settings.titleColor as string) || textColor
        const dividerColor = (settings.dividerColor as string) || 'var(--nc-accent, #3b82f6)'
        const headerStyle = (settings.headerStyle as string) || 'default'
        const titleSizeMap: Record<string, string> = { sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem' }
        const titleFontSize = titleSizeMap[(settings.titleSize as string) || 'md'] || '1rem'
        const titleFontWeight = FONT_WEIGHT_NUMERIC_MAP[(settings.titleFontWeight as string) || 'bold']
        const childIds = getChildren(block.id)
        const childrenHtml = childIds.map((id) => renderBlock(id, depth + 1)).join('\n')
        let headerHtml: string
        if (headerStyle === 'underline') {
          headerHtml = `<div style="margin-bottom:12px"><h3 style="font-weight:${titleFontWeight};color:${titleColor};font-size:${titleFontSize};line-height:1.2;margin:0">${escapeHtml(title)}</h3><div style="height:1px;background:${dividerColor};margin-top:6px"></div></div>`
        } else if (headerStyle === 'accent-bar') {
          headerHtml = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="width:4px;align-self:stretch;border-radius:9999px;background:${dividerColor}"></div><h3 style="font-weight:${titleFontWeight};color:${titleColor};font-size:${titleFontSize};line-height:1.2;margin:0">${escapeHtml(title)}</h3></div>`
        } else {
          const showDivider = settings.showDivider !== false
          const divider = showDivider ? `<div style="height:2px;background:${dividerColor};margin-top:6px"></div>` : ''
          headerHtml = `<div style="margin-bottom:12px"><h3 style="font-weight:${titleFontWeight};color:${titleColor};font-size:${titleFontSize};line-height:1.2;margin:0">${escapeHtml(title)}</h3>${divider}</div>`
        }
        inner = `<section style="margin-bottom:1rem">${headerHtml}${childrenHtml}</section>`
        break
      }

      case 'separator': {
        const patterns: Record<string, string> = { dots: '• • •', diamond: '◆', wave: '〰〰〰', fade: '—', stars: '✦ ✦ ✦' }
        const style = (settings.style as string) || 'dots'
        const color = (settings.color as string) || textColor
        inner = `<div style="text-align:center;opacity:0.4;margin:0.5rem 0;color:${color}">${patterns[style] || patterns.dots}</div>`
        break
      }

      case 'avatar': {
        const sizes: Record<string, string> = { sm: '48px', md: '64px', lg: '96px', xl: '128px' }
        const size = sizes[(settings.size as string)] || '64px'
        const shape = settings.shape as string
        const radius = shape === 'circle' ? '50%' : shape === 'squircle' ? '28%' : '8px'
        const borderWidth = (settings.borderWidth as number) || 0
        const borderColor = (settings.borderColor as string) || 'var(--nc-border, #e5e7eb)'
        if (content.url) {
          inner = `<div style="width:${size};height:${size};border-radius:${radius};overflow:hidden;border:${borderWidth}px solid ${borderColor}"><img src="${escapeHtml(content.url as string)}" alt="${escapeHtml((content.alt as string) || '')}" style="width:100%;height:100%;object-fit:cover" /></div>`
        } else {
          const initials = (content.initials as string) || '?'
          inner = `<div style="width:${size};height:${size};border-radius:${radius};background:var(--nc-surface,#f3f4f6);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--nc-secondary,#6b7280);border:${borderWidth}px solid ${borderColor}">${escapeHtml(initials)}</div>`
        }
        break
      }

      case 'socials': {
        const links = (content.links as Array<{ platform: string; url: string; label: string }>) || []
        if (links.length === 0) break
        const isIcons = settings.variant === 'icons-only'
        if (isIcons) {
          inner = `<div style="display:flex;gap:8px;flex-wrap:wrap">${links.map((link) => `<a href="${escapeHtml(link.url || '#')}" style="color:var(--nc-link,#2563eb);text-decoration:none;font-size:0.875rem">${escapeHtml(link.label || link.platform)}</a>`).join('')}</div>`
        } else {
          inner = `<div style="display:flex;gap:8px;flex-wrap:wrap">${links.map((link) => `<a href="${escapeHtml(link.url || '#')}" style="display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:9999px;border:1px solid var(--nc-border,#e5e7eb);text-decoration:none;font-size:0.875rem;color:${textColor}">${escapeHtml(link.label || link.platform)}</a>`).join('')}</div>`
        }
        break
      }

      case 'table': {
        const headers = (content.headers as string[]) || []
        const rows = (content.rows as string[][]) || []
        const striped = !!settings.striped
        const headerBg = (settings.headerBackground as string) || 'var(--nc-surface, #f9fafb)'
        const fs = resolveFontSize((settings.fontSize as string) || 'sm')
        const fw = FONT_WEIGHT_NUMERIC_MAP[(settings.fontWeight as string) || 'normal']
        const headerFw = FONT_WEIGHT_NUMERIC_MAP[(settings.headerFontWeight as string) || 'semibold']
        let html = `<table style="width:100%;border-collapse:collapse;font-size:${fs};font-weight:${fw}">`
        html += `<thead><tr style="background:${headerBg};border-bottom:2px solid var(--nc-accent,#3b82f6)">`
        for (const h of headers) {
          html += `<th style="padding:8px 12px;text-align:left;font-weight:${headerFw}">${escapeHtml(h)}</th>`
        }
        html += `</tr></thead><tbody>`
        for (let ri = 0; ri < rows.length; ri++) {
          const rowBg = striped && ri % 2 === 1 ? 'background:var(--nc-surface,#f9fafb)' : ''
          html += `<tr style="border-bottom:1px solid var(--nc-border,#e5e7eb);${rowBg}">`
          for (const cell of rows[ri]) {
            html += `<td style="padding:8px 12px">${escapeHtml(cell || '')}</td>`
          }
          html += `</tr>`
        }
        html += `</tbody></table>`
        inner = html
        break
      }

      case 'row': {
        const colIds = getStructuralChildren(block.id)
        const widths = (content.columnWidths as number[]) || []
        const gap = (settings.gap as number) || 16
        let html = `<div style="display:flex;gap:${gap}px">`
        for (let i = 0; i < colIds.length; i++) {
          const colChildIds = getChildren(colIds[i])
          html += `<div style="flex:${widths[i] || 1}">`
          html += colChildIds.map((id) => renderBlock(id, depth + 1)).join('\n')
          html += `</div>`
        }
        html += `</div>`
        inner = html
        break
      }

      case 'sticker': {
        if (content.imageUrl) {
          const left = (settings.posX as number) ?? 0
          const top = (settings.posY as number) ?? 0
          const width = (settings.width as number) || 30
          const height = (settings.height as number) || 30
          const rotate = (settings.rotate as number) || 0
          const opacity = (settings.opacity as number) ?? 1
          inner = `<img src="${escapeHtml(content.imageUrl as string)}" alt="${escapeHtml((content.alt as string) || '')}" style="position:absolute;left:${left}mm;top:${top}mm;width:${width}mm;height:${height}mm;transform:rotate(${rotate}deg);opacity:${opacity};object-fit:contain;z-index:10" />`
        }
        break
      }

      case 'dataPlaceholder': {
        const css = typographyCss({
          fontSize: settings.fontSize as string,
          fontWeight: settings.fontWeight as string,
          alignment: (settings.alignment as string) || 'left',
        })
        const resolved = resolvedPlaceholders.get(block.id)
        const placeholderType = (content.placeholderType as string) || 'text'
        if (resolved !== undefined) {
          if (placeholderType === 'image') {
            inner = `<div style="${css}"><img src="${escapeHtml(resolved)}" alt="${escapeHtml((content.placeholderText as string) || '')}" style="max-width:100%;display:block" /></div>`
          } else {
            inner = `<div style="${css}">${escapeHtml(resolved)}</div>`
          }
        } else {
          const key = escapeHtml((content.valueKey as string) || '')
          const label = escapeHtml((content.placeholderText as string) || 'Placeholder')
          inner = `<div style="${css}">${key}${key && label ? ' ' : ''}${label}</div>`
        }
        break
      }

      case 'metadata': {
        const sep = settings.separator === 'none' ? '' : ((settings.separator as string) || ':')
        const isVert = settings.layout === 'vertical'
        const fieldCss = typographyCss(
          {
            fontSize: settings.fieldFontSize as string,
            fontWeight: (settings.fieldFontWeight as string) || 'normal',
            textColor: (settings.fieldColor as string) || (settings.fieldTextColor as string),
          },
          { fallbackColor: textColor },
        )
        const labelCss = typographyCss(
          {
            fontSize: settings.labelFontSize as string,
            fontWeight: (settings.labelFontWeight as string) || 'bold',
            textColor: (settings.labelColor as string) || (settings.labelTextColor as string),
          },
          { fallbackColor: textColor },
        )
        const minWidth = (settings.fieldMinWidth as number) || 0
        const fieldExtra = minWidth > 0 ? `;min-width:${minWidth}px;display:inline-block` : ''
        const alignment = (settings.alignment as string) || 'left'
        const spacing = (settings.spacing as number) || 8
        const fieldHtml = `<span style="${fieldCss}${fieldExtra}">${escapeHtml((content.field as string) || '')}</span>`
        const labelHtml = `<span style="${labelCss}">${escapeHtml((content.label as string) || '')}</span>`
        const sepHtml = sep && !isVert ? `<span style="opacity:0.5;color:${textColor}"> ${escapeHtml(sep)} </span>` : ''
        inner = `<div style="text-align:${alignment}"><div style="display:${isVert ? 'flex' : 'inline-flex'};flex-direction:${isVert ? 'column' : 'row'};align-items:baseline;gap:${spacing}px">${fieldHtml}${sepHtml}${labelHtml}</div></div>`
        break
      }

      default: {
        // For composables/other blocks, render children
        const childIds = getChildren(block.id)
        if (childIds && childIds.length > 0) {
          inner = childIds.map((id) => renderBlock(id, depth + 1)).join('\n')
        }
        break
      }
    }

    return `<div${wrapperAttr}>${inner}</div>`
  }

  // Render all sections as positioned elements within the A4 page
  const radiusMm = 8
  const sectionsHTML = sections.map((section, index) => {
    const allIds = getSectionRootIds(section)
    const flowIds = allIds.filter((id: string) => blocks[id]?.type !== 'sticker')
    const stickerIds = allIds.filter((id: string) => blocks[id]?.type === 'sticker')

    const flowHTML = flowIds.map((id: string) => renderBlock(id)).join('\n')
    const stickerHTML = stickerIds.map((id: string) => renderBlock(id)).join('\n')

    const bgStyle = section.backgroundColor && section.backgroundColor !== 'transparent'
      ? `background-color:${section.backgroundColor};`
      : ''
    const bgOpacity = (section.backgroundOpacity ?? 1) < 1 ? `opacity:${section.backgroundOpacity};` : ''
    const hPadMm = section.widthMode === 'tight' ? 25 : section.widthMode === 'narrow' ? 20 : 8
    const vPadMm = Math.min(section.padding, 4)
    const vAlign = section.verticalAlign === 'start' ? 'flex-start' : section.verticalAlign === 'end' ? 'flex-end' : 'center'
    const borderRadius = index === 0
      ? `border-radius:${radiusMm}mm ${radiusMm}mm 0 0;`
      : index === 2
      ? `border-radius:0 0 ${radiusMm}mm ${radiusMm}mm;`
      : ''

    return `<div style="height:${section.height}mm;${bgStyle}${bgOpacity}${borderRadius}overflow:hidden;">
<div style="position:relative;width:100%;height:100%;">
${stickerHTML}
<div style="padding:${vPadMm}mm ${hPadMm}mm;display:flex;flex-direction:column;justify-content:${vAlign};height:100%;">
${flowHTML}
</div>
</div>
</div>`
  }).join('\n')

  const frameOverlay = frame?.imageUrl
    ? `<div style="position:absolute;inset:0;z-index:0;background-image:url('${escapeHtml(frame.imageUrl)}');background-size:cover;background-position:center;background-repeat:no-repeat;opacity:${frame.opacity ?? 1};pointer-events:none;"></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="${escapeHtml(language)}" dir="${direction}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.documentTitle || g.metadata.title || 'Document')}</title>
    ${g.metadata.author ? `<meta name="author" content="${escapeHtml(g.metadata.author)}">` : ''}
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
    ${fontLinks}
    <style>
      :root {
        --nc-primary: ${g.colors.primary};
        --nc-accent: ${g.colors.accent};
        --nc-background: ${g.colors.background};
        --nc-text: ${g.colors.text};
        --nc-secondary: ${(g.colors as Record<string, string>).secondary || '#6b7280'};
        --nc-border: ${(g.colors as Record<string, string>).border || '#e5e7eb'};
        --nc-surface: ${(g.colors as Record<string, string>).surface || '#f9fafb'};
        --nc-link: ${(g.colors as Record<string, string>).link || '#2563eb'};
      }
      * { box-sizing: border-box; margin: 0; }
      body {
        font-family: ${getFontFamily(g.typography.bodyFont)};
        font-size: ${g.typography.baseSize}px;
        line-height: ${g.typography.lineHeight};
        color: ${g.colors.text};
        background: ${g.colors.background};
        direction: ${direction};
        display: flex;
        justify-content: center;
        padding: 0;
      }
      .page {
        position: relative;
        width: 210mm;
        height: 297mm;
        overflow: hidden;
        background: white;
        padding: ${margin}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: ${getFontFamily(g.typography.headingFont)};
        margin: 0;
      }
      p { margin: 0; }
      img { display: block; }
      @keyframes nc-fade-in { from { opacity: 0 } to { opacity: 1 } }
      @keyframes nc-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes nc-zoom-in { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      .nc-print-only { display: none; }
      @media print {
        body { padding: 0; }
        .page { width: 210mm; height: 297mm; }
        [style*="animation-name"] { animation: none !important }
        .nc-print-only { display: block; }
        .nc-screen-only { display: none !important; }
      }
    </style>
</head>
<body>
<div class="page">
${frameOverlay}
<div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%">
${sectionsHTML}
</div>
</div>
</body>
</html>`
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
