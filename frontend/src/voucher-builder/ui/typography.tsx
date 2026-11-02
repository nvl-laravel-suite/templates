import { Heading as UIHeading, Text as UIText, type HeadingTag } from 'themelia-react-ui/typography'
import type { HTMLAttributes } from 'react'
type Props = HTMLAttributes<HTMLElement> & { as?: string }
export function Heading({ as = 'h3', ...props }: Props) {
  return <UIHeading tag={as as HeadingTag} size="sm" {...props} />
}
export function Label({ as = 'span', ...props }: Props) {
  return <UIText tag={as as 'span'} weight="medium" {...props} />
}
export function GroupLabel({ as = 'span', ...props }: Props) {
  return <UIText tag={as as 'span'} weight="semibold" {...props} />
}
export function Secondary({ as = 'span', ...props }: Props) {
  return <UIText tag={as as 'span'} type="secondary" {...props} />
}
export function Hint({ as = 'span', ...props }: Props) {
  return <UIText tag={as as 'span'} type="secondary" size="xs" {...props} />
}
export function Micro({ as = 'span', ...props }: Props) {
  return <UIText tag={as as 'span'} type="secondary" size="xs" {...props} />
}
export function Text({ as = 'span', ...props }: Props) {
  return <UIText tag={as as 'span'} {...props} />
}
export function Caption({ as = 'p', ...props }: Props) {
  return <UIText tag={as as 'p'} type="secondary" size="xs" {...props} />
}
