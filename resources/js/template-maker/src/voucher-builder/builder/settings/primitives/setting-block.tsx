import { useId, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from 'themelia-react-ui/base/cards'
import { Stack } from 'themelia-react-ui/base/structure'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from 'themelia-react-ui/base/accordion'
import { useDraftReveal } from '../../../../shared/draft-validation'
import { Text } from 'themelia-react-ui/typography'

export type SettingBlockDisplay = 'collapsible' | 'inline' | 'card'
export interface SettingBlockProps {
  label: string
  description?: string
  hint?: ReactNode
  icon?: LucideIcon
  display?: SettingBlockDisplay
  defaultOpen?: boolean
  action?: ReactNode
  children: ReactNode
  className?: string
}
export function SettingBlock({
  label,
  description,
  hint,
  display = 'collapsible',
  defaultOpen = true,
  action,
  children,
  className,
}: SettingBlockProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [visited, setVisited] = useState(defaultOpen)
  const contentId = useId()
  const [body, setBody] = useState<HTMLDivElement | null>(null)
  useDraftReveal(body, () => { setVisited(true); setOpen(true) })
  const collapsible = display === 'collapsible'
  if (collapsible) return <Accordion className={className} value={open ? ['section'] : []} onValueChange={values => {
    const expanded = values.includes('section')
    setOpen(expanded)
    if (expanded) setVisited(true)
  }}>
    <AccordionItem value="section">
      <Stack direction="horizontal" align="center" gap="sm">
        <div className="min-w-0 flex-1">
          <AccordionTrigger aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} aria-describedby={description ? contentId : undefined}>
            {description ? <Stack render={<span />} gap="normal">
              <span>{label}</span>
              <Text tag="span" id={contentId} size="sm" type="secondary" weight="normal">{description}</Text>
            </Stack> : label}
          </AccordionTrigger>
        </div>
        {hint}
        {action}
      </Stack>
      <AccordionContent keepMounted>{visited && <Stack ref={setBody} gap="lg">{children}</Stack>}</AccordionContent>
    </AccordionItem>
  </Accordion>
  return (
    <Card
      surface="flat"
      padding="none"
      gap="lg"
      title={label}
      description={description}
      titleSuffix={hint}
      headerAction={action}
      className={className}
    >
      <Stack gap="lg">{children}</Stack>
    </Card>
  )
}
