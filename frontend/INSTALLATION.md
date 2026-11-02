# Frontend installation

The `nvl/templates` Composer package includes the reusable builder source. Composer consumers do not install a Template Maker npm package. The npm name in this private maintainer workspace exists for source/test compatibility and is not a registry ownership claim.

Configure `nvl-templates.frontend.path`, then run `php artisan nvl:templates:frontend:publish --dry-run` to review publication. The published folder includes dependency requirements in `dependencies.json`; merge those React 19, Themelia and Tailwind requirements into your normal host build. See [published frontend integration](docs/published-frontend.md).

## Choose an entry point

| Subpath | Purpose | React? |
|---|---|---|
| `/template-creator` | Creator, Editor, providers, focused hooks and local controllers. | Yes |
| `/template-schema` | Template types, schemas and semantic validation. | No |
| `/template-renderer` | Pure HTML/CSS compilation, snapshot construction and explicit voucher conversion. | No |
| `/editor` | Original voucher workspace and provider. | Yes |
| `/hooks` | Voucher/template hooks, providers and controllers. | Yes |
| `/schema` | Original voucher types and schemas. | No |
| `/manifest` | Original voucher dynamic-field introspection and payload validation. | No |
| `/renderer` | Pure voucher HTML rendering and JSON import/export. | No |
| `/headless` | Alias for voucher renderer. | No |
| Package root | Combined component and utility surface. | Yes |

Use the matching relative entry from your published `template-maker` folder. The table lists the corresponding source workspace exports. Import the smallest relevant entry. Bundle size depends on the application's bundler and selected features; no particular host runtime or backend is required by the JSON contracts.

The published source rewrites imports to relative entries and includes a portable browser PostCSS parser and its license notices. Node rendering uses the bundled `resources/runtime/renderer.mjs`; no npm dependencies are required to execute that worker.

## Mount the workspace

```tsx
import { UIProvider } from 'themelia-react-ui/ui-provider'
import { TemplateCreator } from './template-maker/template-creator'
import type { TemplateDefinition } from './template-maker/template-schema'
import './template-maker/styles.css'

export function Compose({ definition, onChange }: {
  definition: TemplateDefinition
  onChange: (definition: TemplateDefinition) => void
}) {
  return <UIProvider><TemplateCreator initialTemplate={definition} onChange={onChange} /></UIProvider>
}
```

Mount one Themelia `UIProvider` at the application's root; reuse an existing one. Import `./template-maker/styles.css` once, including in hosts that already import Themelia styles: the builder stylesheet supplies the required workspace geometry as well as compiled Themelia styles, the neutral theme and Tailwind base/utilities. Keep host overrides after it and check reset/import order. See [UI integration](docs/UI.md).

Pass documents, blocks, styles, field contracts, asset URLs and values as JSON. Observe `onChange` or obtain snapshots/HTML/JSON through focused hooks and synchronous controller methods. Your application loads and handles the data. The package has no application sessions, storage, endpoint configuration, save callbacks or PDF service. See [host composition](docs/INTEGRATION.md).

When upgrading from Themelia 2.0.4, retain native sizing and migrate app-owned `rounded-inner` fields to `rounded-radius`, and outer shell `rounded-radius` corners to `rounded-surface`. The 2.0.5 action/control roots are 32px; do not restore the older dimensions with local overrides. Refresh project agent guidance with `npm run setup:ui` in a source checkout. This does not configure or publish a host theme. See [UI integration](docs/UI.md) for the complete ownership and verification policy.

For custom controls, mount a provider and use the focused hooks. Controllers hold local document state, selection and Undo/Redo. Multiple mounted documents are independent. See the [Template API](docs/TEMPLATE_API.md), [Voucher API](docs/API.md) and [typed consumer examples](examples/react-workspaces.tsx).

## Use the contracts and pure renderer

```ts
import { parseTemplateDefinition } from './template-maker/template-schema'
import { renderTemplate } from './template-maker/template-renderer'

const definition = parseTemplateDefinition(input)
const result = renderTemplate(definition, { data: suppliedValues })
if (result.issues.length) throw new Error(result.issues.map(issue => issue.message).join('; '))
const html = result.html
```

These functions compile locally without React or editor mounting. The generated Draft 2020-12 schemas under `/schemas/*.schema.json` are self-contained and usable by other contract consumers. Semantic rules supplement their structural checks; see [Contracts](docs/CONTRACTS.md).

The original voucher format uses `renderFromPayload()` from `/renderer`, `parseVoucherImport()` from `/manifest`, and Project types from `/schema`. Type-only imports do not require mounting UI.

## Troubleshooting

| Symptom | Check |
|---|---|
| Publication conflicts | Run the publisher with `--dry-run`, review modified files, then explicitly choose whether to use `--force`. |
| Missing styles | Import the published `styles.css` through Tailwind 4 and keep normal host overrides after it. |
| Types unresolved | Use TypeScript `moduleResolution: bundler` and the published relative entry. |
| Non-UI import includes React | Import `template-schema` or `template-renderer` instead of the root/UI entry. |
| Updated initial props do not replace data | Use controller load methods or remount intentionally. |

Maintainers use Node 24 with the existing lockfile; app and library builds run sequentially. See the [maintainer workspace](README.md).
