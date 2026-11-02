import { Button as ThemeliaButton, type ButtonProps } from 'themelia-react-ui/base/buttons'

type LegacyVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
type LegacySize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
/** Internal voucher adapter. New workspaces use Themelia Button directly. */
export function Button({
  variant = 'outline',
  size = 'default',
  ...props
}: Omit<ButtonProps, 'size'> & {
  variant?: LegacyVariant | null
  size?: LegacySize | null
}) {
  return (
    <ThemeliaButton
      {...props}
      size={size?.includes('xs') || size?.includes('sm') ? 'sm' : size?.includes('lg') ? 'lg' : undefined}
      iconOnly={size?.startsWith('icon') || props.iconOnly}
      tone={
        props.tone ??
        (variant === 'default' ? 'primary' : variant === 'destructive' ? 'destructive' : undefined)
      }
      buttonStyle={
        props.buttonStyle ??
        (variant === 'ghost' || variant === 'link'
          ? 'ghost'
          : variant === 'default' || variant === 'destructive' || variant === 'secondary'
            ? 'solid'
            : 'outline')
      }
    />
  )
}
