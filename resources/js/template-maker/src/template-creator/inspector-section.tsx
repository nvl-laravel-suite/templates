import { useEffect, useId, useState, type ReactNode } from 'react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from 'themelia-react-ui/base/accordion'
import { Stack } from 'themelia-react-ui/base/structure'
import { useDraftReveal } from '../shared/draft-validation'
import { Badge } from 'themelia-react-ui/base/badge'

/** Collapsing a section keeps unfinished fields mounted and available to export validation. */
export function InspectorSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [body, setBody] = useState<HTMLDivElement | null>(null)
  const [invalid, setInvalid] = useState(false)
  const statusId = useId()
  useDraftReveal(body, () => setOpen(true))
  useEffect(() => {
    if (!body) return
    const inspect = () => setInvalid(Boolean(body.querySelector('[aria-invalid="true"]')))
    inspect()
    const observer = new MutationObserver(inspect)
    observer.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] })
    return () => observer.disconnect()
  }, [body])
  return <Accordion value={open ? ['section'] : []} onValueChange={values => setOpen(values.includes('section'))}>
    <AccordionItem value="section">
      <AccordionTrigger aria-label={title} aria-describedby={invalid ? statusId : undefined}>
        <Stack render={<span />} direction="horizontal" align="center" gap="sm" wrap>
          <span>{title}</span>
          {invalid && <Badge id={statusId} tone="destructive" size="sm">Needs attention</Badge>}
        </Stack>
      </AccordionTrigger>
      <AccordionContent keepMounted><Stack ref={setBody} gap="lg">{children}</Stack></AccordionContent>
    </AccordionItem>
  </Accordion>
}
