import { cn } from '../../../lib/utils'
import { iconMap } from '../../../lib/icons'

/** @deprecated Use iconMap from '#/voucher-builder/lib/icons' instead */
export const sectionIconMap = iconMap

/** @deprecated Use IconPicker component instead */
export const sectionIconOptions = [
  { value: 'none', label: 'None' },
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'graduationCap', label: 'Education' },
  { value: 'award', label: 'Award' },
  { value: 'star', label: 'Star' },
  { value: 'heart', label: 'Heart' },
  { value: 'lightbulb', label: 'Lightbulb' },
  { value: 'code', label: 'Code' },
  { value: 'phone', label: 'Phone' },
  { value: 'mail', label: 'Mail' },
  { value: 'user', label: 'User' },
  { value: 'folder', label: 'Folder' },
  { value: 'globe', label: 'Globe' },
  { value: 'zap', label: 'Zap' },
  { value: 'target', label: 'Target' },
  { value: 'trophy', label: 'Trophy' },
]

interface SectionHeaderInlineProps {
  title: string
  icon: string
  description?: string
  showIcon: boolean
  showDivider: boolean
  showDescription?: boolean
  titleColor: string
  dividerColor: string
  iconColor: string
  iconBgColor: string
  titleSize?: string
  titleFontWeight?: string
  headerStyle?: string
}

const fontWeightClasses: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
}

const titleSizeClasses: Record<string, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
}

export function SectionHeaderInline({
  title, icon, description, showIcon, showDivider, showDescription,
  titleColor, dividerColor, iconColor, iconBgColor, titleSize = 'md',
  titleFontWeight = 'bold', headerStyle = 'default',
}: SectionHeaderInlineProps) {
  const weightClass = fontWeightClasses[titleFontWeight] || 'font-bold'
  const Icon = icon !== 'none' ? iconMap[icon] : null
  const color = titleColor || 'var(--nc-text, #111827)'
  const accentColor = iconColor || 'var(--nc-accent, #3b82f6)'
  const bgColor = iconBgColor || accentColor

  // Underline style: title + thin underline, no icon
  if (headerStyle === 'underline') {
    return (
      <div className="mb-3">
        <h3
          className={cn(weightClass, 'leading-tight', titleSizeClasses[titleSize] || 'text-lg')}
          style={{ color }}
        >
          {title || 'Section Title'}
        </h3>
        <div className="h-[1px] w-full mt-1.5" style={{ backgroundColor: dividerColor || accentColor }} />
        {showDescription && description && (
          <p className="text-sm opacity-70 mt-1" style={{ color }}>{description}</p>
        )}
      </div>
    )
  }

  // Accent-bar style: vertical colored bar left of title
  if (headerStyle === 'accent-bar') {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: dividerColor || accentColor }} />
          <h3
            className={cn(weightClass, 'leading-tight', titleSizeClasses[titleSize] || 'text-lg')}
            style={{ color }}
          >
            {title || 'Section Title'}
          </h3>
        </div>
        {showDescription && description && (
          <p className="text-sm opacity-70 mt-1 ml-3.5" style={{ color }}>{description}</p>
        )}
      </div>
    )
  }

  // Default style
  return (
    <div className="space-y-1.5 mb-3">
      <div className="flex items-center gap-2.5">
        {showIcon && Icon && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: bgColor, color: '#fff' }}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <h3
          className={cn(weightClass, 'leading-tight', titleSizeClasses[titleSize] || 'text-lg')}
          style={{ color }}
        >
          {title || 'Section Title'}
        </h3>
      </div>
      {showDivider && (
        <div className="h-[2px] w-full" style={{ backgroundColor: dividerColor || accentColor }} />
      )}
      {showDescription && description && (
        <p className="text-sm opacity-70 mt-1" style={{ color }}>{description}</p>
      )}
    </div>
  )
}
