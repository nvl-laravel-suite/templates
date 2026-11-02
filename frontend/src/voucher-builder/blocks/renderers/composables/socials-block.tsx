import { cn } from '#/voucher-builder/lib/utils'
import { Github, Twitter, Linkedin, Globe, type LucideIcon, AtSign, PenLine, Dribbble, PenTool, Youtube, Layers } from 'lucide-react'
import type { SocialsBlock as SocialsBlockType } from '#/voucher-builder/schema'
import { FLEX_JUSTIFY_ALIGN } from '#/voucher-builder/blocks/primitives'

interface SocialsSettings {
  alignment: string
  iconColor?: string
  iconBgColor?: string
  textColor?: string
  variant?: 'default' | 'icons-only' | 'pills'
}

const platformIcons: Record<string, LucideIcon> = {
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  web: Globe,
  mastodon: AtSign,
  medium: PenLine,
  dribbble: Dribbble,
  behance: PenTool,
  youtube: Youtube,
  stackoverflow: Layers,
}

export function SocialsBlockRenderer({ block }: { block: SocialsBlockType }) {
  const s = block.settings as SocialsSettings
  const textColor = s.textColor || ''
  const align = FLEX_JUSTIFY_ALIGN[s.alignment] || 'justify-start'
  const iconColor = s.iconColor || 'var(--nc-text, #111827)'
  const iconBgColor = s.iconBgColor || 'var(--nc-surface, #f3f4f6)'
  const variant = s.variant || 'default'

  return (
    <div className={cn('flex flex-wrap gap-2', align)} style={textColor ? { color: textColor } : undefined}>
      {block.content.links.map((link, i) => {
        const Icon = platformIcons[link.platform] || Globe
        if (variant === 'icons-only') {
          return (
            <a key={i} href={link.url || '#'} onClick={(e) => e.preventDefault()}
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-80"
              style={{ backgroundColor: iconBgColor, color: iconColor }}>
              <Icon className="h-5 w-5" />
            </a>
          )
        }
        if (variant === 'pills') {
          return (
            <a key={i} href={link.url || '#'} onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ backgroundColor: iconBgColor, color: iconColor }}>
              <Icon className="h-4 w-4" />
              {link.label || link.platform}
            </a>
          )
        }
        return (
          <a key={i} href={link.url || '#'} onClick={(e) => e.preventDefault()}
            className="flex w-full items-center gap-3 rounded-lg border p-3 text-sm transition hover:opacity-80"
            style={{ backgroundColor: iconBgColor, color: iconColor }}>
            <Icon className="h-5 w-5" />
            <span className="font-medium">{link.label || link.platform}</span>
            <span className="ml-auto truncate text-xs opacity-60">{link.url}</span>
          </a>
        )
      })}
      {block.content.links.length === 0 && (
        <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-border/50 py-8 text-sm text-muted-foreground/50">
          No social links
        </div>
      )}
    </div>
  )
}
