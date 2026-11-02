import { cn } from '#/voucher-builder/lib/utils'
import { Mail, Phone, MapPin, Globe, Linkedin, Github, Twitter, Palette, Hash, BookOpen, Dribbble, Figma, HelpCircle, Youtube } from 'lucide-react'

interface ContactItem {
  type: 'email' | 'phone' | 'location' | 'website' | 'linkedin' | 'github' | 'twitter' | 'portfolio' | 'mastodon' | 'medium' | 'dribbble' | 'behance' | 'stackoverflow' | 'youtube'
  value: string
  label?: string
}

interface ContactInfoSettings {
  layout: string
  showIcons: boolean
  iconColor: string
  textColor: string
  variant?: 'default' | 'card' | 'compact'
}

interface ContactInfoBlockData {
  id: string
  type: 'contactInfo'
  content: { items: ContactItem[] }
  settings: ContactInfoSettings
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  email: Mail,
  phone: Phone,
  location: MapPin,
  website: Globe,
  linkedin: Linkedin,
  github: Github,
  twitter: Twitter,
  portfolio: Palette,
  mastodon: Hash,
  medium: BookOpen,
  dribbble: Dribbble,
  behance: Figma,
  stackoverflow: HelpCircle,
  youtube: Youtube,
}

export function ContactInfoBlockRenderer({ block }: { block: ContactInfoBlockData }) {
  const items: ContactItem[] = block.content.items || []
  const s = block.settings
  const { layout, showIcons, iconColor, textColor } = s
  const variant = s.variant || 'default'

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 py-8 text-sm text-muted-foreground/50">
        No contact items
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex gap-3',
        layout === 'inline' ? 'flex-wrap' : 'flex-col',
        variant === 'card' && 'rounded-xl border border-border/60 shadow-sm p-4',
        variant === 'compact' && 'gap-1',
      )}
      style={textColor ? { color: textColor } : undefined}
    >
      {items.map((item, i) => {
        const Icon = iconMap[item.type] || Mail
        return (
          <div key={i} className={cn('flex items-center gap-2 text-sm', variant === 'compact' && 'gap-1.5 text-xs')}>
            {showIcons && <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor || 'var(--nc-accent, #3b82f6)' }} />}
            <span style={{ color: textColor || 'var(--nc-text, #111827)' }}>
              {layout === 'inline' && item.label && item.value
                ? `${item.label}: ${item.value}`
                : item.label || item.value || '\u2014'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
