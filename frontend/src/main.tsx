import './demo.css'
import { UIProvider, ThemeScope } from 'themelia-react-ui/ui-provider'
import { LoadingState } from 'themelia-react-ui/base/feedback'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { TemplatePlatformDemo } from './template-platform/demo'
import { TemplateStudioDemo } from './template-creator/demo'
const VoucherBuilder = lazy(() =>
  import('./voucher-builder').then((module) => ({ default: module.VoucherBuilder })),
)
// @ts-ignore — font package has no type declarations
import '@fontsource-variable/inter'

const parameters = new URLSearchParams(window.location.search)
const theme = parameters.get('theme') === 'dark' ? 'dark' : 'light'
const density = parameters.get('density') === 'sm' ? 'sm' : 'md'
// Demo favors the canvas-focused dock; public component defaults remain unchanged.
const layout = parameters.get('layout') === 'default' ? 'default' : 'compact'
// Demo-only stress profile: public theme roots, inherited by scoped portals too.
const geometry =
  parameters.get('geometry') === 'scaled'
    ? { '--radius': '24px', '--space-scale': 0.8, '--density-scale': 0.875 }
    : undefined

createRoot(document.getElementById('root')!).render(
  <UIProvider config={{ typography: { defaultTextSize: 'sm' }, density: { defaultScale: density } }}>
    <ThemeScope className={`gct-demo ${theme}`} style={geometry}>
      <Suspense fallback={<LoadingState label="Loading workspace…" />}>
        {parameters.get('workspace') === 'voucher' ? (
          <VoucherBuilder theme={theme} mode={parameters.get('mode') === 'viewer' ? 'viewer' : parameters.get('mode') === 'editor' ? 'editor' : 'admin'} />
        ) : parameters.get('workspace') === 'creator' ? (
          <TemplateStudioDemo theme={theme} layout={layout} />
        ) : (
          <TemplatePlatformDemo theme={theme} layout={layout} variant={parameters.get('workspace') === 'variant'} family={parameters.get('workspace') === 'family'} email={parameters.get('workspace') === 'email'} />
        )}
      </Suspense>
    </ThemeScope>
  </UIProvider>,
)
