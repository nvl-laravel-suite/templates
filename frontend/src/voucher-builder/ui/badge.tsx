import { Badge as ThemeliaBadge, type BadgeProps } from 'themelia-react-ui/base/badge'
export function Badge({
  variant,
  ...props
}: BadgeProps & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' }) {
  return (
    <ThemeliaBadge {...props} tone={props.tone ?? (variant === 'destructive' ? 'destructive' : undefined)} />
  )
}
