import type { ReactNode } from 'react'
import { Card } from 'themelia-react-ui/base/cards'
import { Badge } from 'themelia-react-ui/base/badge'
import { cn } from '../../lib/utils'

interface SettingsPanelProps {
  label: string
  badges?: string[]
  description?: string
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  hideHeader?: boolean
}
export function SettingsPanel({
  label,
  badges,
  description,
  headerExtra,
  children,
  className,
  hideHeader,
}: SettingsPanelProps) {
  return (
    <Card
      surface="flat"
      padding="md"
      contentGap="2xl"
      title={hideHeader ? undefined : label}
      titleSuffix={!hideHeader && badges?.map((badge) => <Badge key={badge}>{badge}</Badge>)}
      description={hideHeader ? undefined : description}
      headerAction={hideHeader ? undefined : headerExtra}
      className={cn('nc-settings-panel', className)}
    >
      {children}
    </Card>
  )
}
