import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { Badge } from 'themelia-react-ui/base/badge'
import { EMAIL_PROFILE, type EmailCompatibilityIssue } from './profile'
export function EmailChecksPanel({ issues }: { issues: EmailCompatibilityIssue[] }) {
  const errors = issues.filter(issue => issue.severity === 'error')
  const warnings = issues.filter(issue => issue.severity !== 'error')
  return <Stack gap="lg">
    {!issues.length && <Text size="sm">No compatibility issues found in the authored content.</Text>}
    {([{ title: 'Needs attention', tone: 'destructive', items: errors }, { title: 'Check fallbacks', tone: 'warning', items: warnings }] as const).filter(group => group.items.length).map(group => <Stack key={group.title} gap="md" role="region" aria-label={group.title}>
      <Badge size="sm" tone={group.tone}>{group.title} · {group.items.length}</Badge>
      {group.items.map((issue, index) => <Stack key={`${issue.path}:${index}`} gap="xs"><Text size="sm">{issue.message}</Text><Text size="sm" type="secondary">{issue.path}</Text></Stack>)}
    </Stack>)}
    <Stack gap="sm">
      <Text size="sm" weight="medium">Email profile · {EMAIL_PROFILE.id}</Text>
      <Text type="secondary" size="sm">Use email sections and columns, simple inline styles, image alternatives and absolute links.</Text>
      <Text type="secondary" size="sm">Baseline: {EMAIL_PROFILE.clients.join(', ')}. Rounded corners and dark-mode colors can differ. Preview approximates browser layout; test final messages in these clients before sending.</Text>
    </Stack>
  </Stack>
}
