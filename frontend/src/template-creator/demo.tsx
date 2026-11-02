import { Button } from 'themelia-react-ui/base/buttons'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { useMemo, useState, type CSSProperties } from 'react'
import { createInvoiceTemplate } from '../template-core/defaults'
import { getTemplateIssues } from '../template-core/validation'
import { resolveTemplateData, stableJSONStringify } from '../template-core/contracts'
import { TemplateCreator } from './TemplateCreator'
import { TemplateEditor } from './TemplateEditor'

/** Local composition demo. Applications supply their own loading and output handling. */
export function TemplateStudioDemo({ theme = 'light', layout = 'default' }: { theme?: 'light' | 'dark'; layout?: 'default' | 'compact' }) {
  const [initial] = useState(createInvoiceTemplate)
  const [draft, setDraft] = useState(initial)
  const [mode, setMode] = useState<'creator' | 'editor'>('creator')
  const [preview, setPreview] = useState({ template: initial, key: 0 })
  const issues = useMemo(() => getTemplateIssues(draft), [draft])
  const personalize = () => {
    setPreview(current => stableJSONStringify(current.template) === stableJSONStringify(draft)
      ? current : { template: draft, key: current.key + 1 })
    setMode('editor')
  }
  return (
    <div style={{ '--template-workspace-height': 'calc(100dvh - 64px)' } as CSSProperties}>
      <Stack render={<nav />} direction="horizontal" align="center" justify="between" gap="md"
        className="tc-demo-nav" aria-label="Document workspaces">
        <Text weight="semibold">GCT / Document tools</Text>
        <Stack direction="horizontal" align="center" gap="sm">
          <Button buttonStyle={mode === 'creator' ? 'solid' : 'outline'} aria-pressed={mode === 'creator'} onClick={() => setMode('creator')}>
            Template creator
          </Button>
          <Button buttonStyle={mode === 'editor' ? 'solid' : 'outline'} aria-pressed={mode === 'editor'} disabled={issues.length > 0}
            title={issues.length ? 'Resolve template checks before personalizing' : undefined}
            onClick={personalize}>
            Personalize
          </Button>
          <Button href={'?workspace=platform&theme=' + theme} buttonStyle="ghost">Module integration</Button>
          <Button href={'?workspace=voucher&theme=' + theme} buttonStyle="ghost">Voucher workspace</Button>
        </Stack>
      </Stack>
      <div hidden={mode !== 'creator'}>
        <TemplateCreator initialTemplate={initial} onChange={setDraft} theme={theme} layout={layout} />
      </div>
      <div hidden={mode !== 'editor'}>
        <TemplateEditor key={preview.key} theme={theme} template={preview.template} layout={layout}
          initialData={resolveTemplateData(preview.template, {}, 'preview').data} />
      </div>
    </div>
  )
}
