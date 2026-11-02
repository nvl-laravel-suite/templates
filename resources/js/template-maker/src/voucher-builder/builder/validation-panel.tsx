import { Card } from 'themelia-react-ui/base/cards'
import { Badge } from 'themelia-react-ui/base/badge'
import { Alert, AlertTitle, AlertDescription, AlertAction } from 'themelia-react-ui/base/feedback'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { Button } from 'themelia-react-ui/base/buttons'
import { useVoucherActions, useVoucherProject } from '../hooks/use-voucher-builder'
import { validateProject } from '../lib/validation'
import { TypographyCohesionSection } from './typography-cohesion'
export function ValidationPanel({ onDocument }: { onDocument?: () => void }) {
  const project = useVoucherProject()
  const { setActiveBlock } = useVoucherActions()
  const results = validateProject(project)
  const issues = results.filter((result) => result.severity !== 'info')
  return (
    <Stack gap="2xl" className="nc-panel-inset">
      <Text type="secondary">
        {issues.length
          ? `${issues.length} ${issues.length === 1 ? 'item needs' : 'items need'} attention before export.`
          : 'No layout or content issues found.'}{' '}
        Review the preview before printing.
      </Text>
      {!issues.length && (
        <Alert tone="success">
          <AlertTitle>Checks passed</AlertTitle>
        </Alert>
      )}
      {(['error', 'warning', 'info'] as const).map((severity) => {
        const items = results.filter((result) => result.severity === severity)
        const tone = severity === 'error' ? 'destructive' : severity === 'warning' ? 'warning' : 'info'
        return items.length ? (
          <Card
            key={severity}
            surface="flat"
            padding="none"
            title={severity === 'error' ? 'Issues' : severity === 'warning' ? 'Warnings' : 'Suggestions'}
            titleSuffix={<Badge>{items.length}</Badge>}
            contentGap="lg"
          >
            {items.map((item, index) => (
              <Alert key={index} tone={tone}>
                <AlertTitle>{item.message}</AlertTitle>
                {item.suggestion && <AlertDescription>{item.suggestion}</AlertDescription>}
                {(item.blockId || (severity === 'error' && onDocument)) && (
                  <AlertAction>
                    <Button onClick={() => (item.blockId ? setActiveBlock(item.blockId) : onDocument?.())}>
                      {item.blockId ? 'Open block' : 'Document settings'}
                    </Button>
                  </AlertAction>
                )}
              </Alert>
            ))}
          </Card>
        ) : null
      })}
      <TypographyCohesionSection />
    </Stack>
  )
}
