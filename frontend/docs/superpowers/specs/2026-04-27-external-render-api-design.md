# External Render API — Design Spec

**Date**: 2026-04-27
**Scope**: Headless rendering, dynamic-key contracts, action callbacks, template pre-hydration
**Status**: Shipped

---

## Problem

Three integrations were either ad-hoc or impossible:

1. **Server-side rendering of saved vouchers.** A host service receiving a saved JSON had no supported way to fill it with per-recipient data and produce HTML. The only `exportToHTML` consumed an in-memory `Project` and shipped no substitution layer; the JSON export shape was lossy and could not be re-imported back into a Project.
2. **Hooking into editor actions.** Existing callbacks (`onChange / onExport / onSave / onTemplateSave / onTemplateUpdate / onTemplateDelete`) were terminal — they signalled "the project changed" without surfacing what kind of change. Host apps that needed to mirror commands into a CRDT, push analytics, or coordinate multi-user editing had to diff snapshots.
3. **Pre-loading templates from a host app.** The template registry only knew how to fetch from `apiTemplateEndpoint` (manual sync) or `localTemplatePath` (filesystem). A host that already had templates in memory had to write to localStorage by hand or stand up a fake fetch endpoint.

## Design

Three orthogonal additions, each pure and independently usable.

### 1. Dynamic-key contract — manifest + validation

A `Project` already declares the keys it expects via three mechanisms:

- `commonSettings.dynamicKey` on any block (with `previewValue` fallback)
- `dataPlaceholder.content.valueKey`
- `qrCode.settings.overwriteKey` (when `allowOverwrite: true`)

We surface this declared surface as a typed manifest:

```ts
function getProjectDynamicKeys(project: Project): DynamicKeyManifest

interface DynamicKeyManifest {
  keys: string[]
  required: string[]   // no default at any level
  optional: string[]   // project or block provides a default
  occurrences: DynamicKeyOccurrence[]
}

interface DynamicKeyOccurrence {
  blockId: string
  blockType: string
  key: string
  source: 'dynamic' | 'placeholder' | 'qr-overwrite'
  hasDefault: boolean
  defaultValue?: string
  placeholderType?: 'text' | 'image' // dataPlaceholder only
}
```

The manifest is the contract the host can use to **build forms, validate payloads, or document an integration without re-implementing block types**. Required keys are the ones the host MUST supply; optional keys can be supplied to override the project default.

Default-resolution priority (highest wins):
1. Payload `data[key]` (non-empty)
2. Project `global.previewData[key]`
3. Block `commonSettings.previewValue` (dynamic-key blocks only)
4. Block `content.value` (qrCode fallback)

Validation is a thin wrapper around the manifest:

```ts
function validateRenderPayload(
  project: Project,
  data: Record<string, unknown> | null | undefined,
): { ok: boolean; missing: string[]; unused: string[]; expected: string[] }
```

### 2. `renderFromPayload` — single-call render

```ts
function renderFromPayload(payload: RenderPayload): RenderResult

interface RenderPayload extends ExportToHTMLOptions {
  /** Project | gct-voucher v2/v1 envelope | JSON string of either. */
  project: Project | Record<string, unknown> | string
  /** Validate `data` against the manifest and refuse to render if required keys missing. */
  validate?: boolean
}

interface ExportToHTMLOptions {
  data?: Record<string, string | number | null | undefined>
  frame?: { imageUrl?: string | null; opacity?: number }
  documentTitle?: string
}

interface RenderResult {
  html: string
  errors: string[]
  warnings: string[]
  manifest?: DynamicKeyManifest
  validation?: PayloadValidationResult
}
```

Routes through `parseVoucherImport` so any wire format works, then through `exportToHTML(project, options)` which performs the substitutions inline before emitting markup. Pure — no DOM, no React, no module-level state.

The substitution applies before render so it cooperates with all existing block renderers, animation/visibility CSS, anchor IDs, and the `<title>` override.

### 3. Action event bus — `onAction` callback

A tiny synchronous pub/sub bus that action modules call after they mutate the store. `VoucherBuilder.tsx` subscribes the host's `onAction` callback during mount and unsubscribes on unmount.

```ts
type BuilderActionEvent =
  | { type: 'block.add'; sectionId: string; blockId: string; blockType: string }
  | { type: 'block.remove'; blockIds: string[] }
  | { type: 'block.update'; blockId: string; patch: Partial<Block> }
  | { type: 'block.duplicate'; sourceId: string; newId: string; sectionId: string }
  | { type: 'block.move'; blockId: string; sectionId: string; fromIndex: number; toIndex: number }
  | { type: 'block.reorder'; sectionId: string; blockIds: string[] }
  | { type: 'section.update'; sectionId: string; patch: Partial<VoucherSection> }
  | { type: 'section.activate'; sectionId: string | null }
  | { type: 'history.push' | 'history.undo' | 'history.redo' }
  | { type: 'project.load'; project: Project }
  | { type: 'project.reset' }
  | { type: 'template.load'; templateId: string; templateName: string }
  | { type: 'clipboard.copy' | 'clipboard.cut'; blockIds: string[] }
  | { type: 'clipboard.paste'; sectionId: string; count: number }
  | { type: 'global.update'; patch: Record<string, unknown> }
  | { type: 'frame.update'; patch: Record<string, unknown> }
```

Synchronous on purpose: events fire after state has settled, so a handler reading the store inside the callback always sees a consistent snapshot. Each handler runs inside try/catch so a misbehaving subscriber can't break dispatch.

**Selection events are intentionally omitted** — they fire on every click/hover and would drown the bus. Hosts that need selection state subscribe to the editor store directly.

### 4. Template pre-hydration

Two new fields on `VoucherBuilderConfig`:

- `templates?: VoucherTemplate[]` — direct array, registered before the picker reads
- `templatesUrl?: string` — single fetch on mount; accepts `VoucherTemplate[]` or `{ templates: [...] }`

Both live in a new `externalTemplates` bucket inside the registry, stamped `source: 'api'` and merged into `getTemplates()` between local and cached buckets:

```
[builtinTemplates, ...localTemplates, ...externalTemplates, ...cached, ...userTemplates]
```

Last-write-wins dedup by `id` means a user-saved template can shadow an external one with the same id.

Two registry helpers exposed:
```ts
function setExternalTemplates(templates: VoucherTemplate[]): void
function loadTemplatesFromUrl(url: string): Promise<VoucherTemplate[]>
```

## File map

```
src/voucher-builder/
├── export/
│   ├── html.ts                    # ExportToHTMLOptions + applyDataSubstitutions + visibility/anchor/title
│   ├── json.ts                    # v2 envelope ({ format, version: 2, project })
│   ├── import.ts                  # parseVoucherImport — accepts Project, v2, v1, JSON string
│   ├── render-from-payload.ts     # NEW — one-shot headless entry
│   └── dynamic-keys.ts            # NEW — manifest + validation
├── store/
│   ├── events.ts                  # NEW — pub/sub bus + BuilderActionEvent union
│   └── actionModules/             # emit calls added to blocks, history, project, sections, clipboard, global
├── templates/
│   └── registry.ts                # setExternalTemplates + loadTemplatesFromUrl + externalTemplates bucket
├── types.ts                       # VoucherBuilderConfig.templates + templatesUrl, onAction prop
├── context.ts                     # callbacks.onAction
└── VoucherBuilder.tsx             # subscribeAction(onAction) + setExternalTemplates(config.templates)
```

## Recipes

### Server route

```ts
import { renderFromPayload } from 'gct-voucher-builder'

app.post('/render-voucher', (req, res) => {
  const { templateJson, data } = req.body
  const { html, errors } = renderFromPayload({
    project: templateJson,    // string | object — both work
    data,
    validate: true,
    documentTitle: `Voucher #${data.code}`,
  })
  if (errors.length) return res.status(400).json({ errors })
  res.type('html').send(html)
})
```

### Build a recipient form from a saved template

```ts
import { parseVoucherImport, getProjectDynamicKeys } from 'gct-voucher-builder'

const { project } = parseVoucherImport(savedJson)
const manifest = getProjectDynamicKeys(project!)

// Render an input per declared key, default-filled from the manifest
const inputs = manifest.occurrences.map((o) => ({
  name: o.key,
  required: !o.hasDefault,
  defaultValue: o.defaultValue,
  type: o.placeholderType === 'image' ? 'url' : 'text',
}))
```

### Mirror editor actions to a CRDT

```tsx
<VoucherBuilder
  onAction={(event) => {
    switch (event.type) {
      case 'block.add':       crdt.send({ op: 'add',    section: event.sectionId, id: event.blockId, kind: event.blockType }); break
      case 'block.remove':    crdt.send({ op: 'remove', ids: event.blockIds }); break
      case 'block.update':    crdt.send({ op: 'patch',  id: event.blockId, patch: event.patch }); break
      case 'block.reorder':   crdt.send({ op: 'order',  section: event.sectionId, ids: event.blockIds }); break
      case 'template.load':   crdt.send({ op: 'snapshot', from: event.templateId }); break
    }
  }}
/>
```

### Ship templates with the host app

```tsx
import corporateGiftV1 from './templates/corporate-gift.json'
import sportsRewardV2 from './templates/sports-reward.json'

<VoucherBuilder
  config={{
    templates: [corporateGiftV1, sportsRewardV2],
    // Or fetched once, no Sync button required:
    // templatesUrl: 'https://cdn.example.com/voucher-templates.json',
  }}
/>
```

## Non-goals

- **Streaming render** — `renderFromPayload` is one-shot. For very large projects, host apps can chunk by section and concatenate.
- **Two-way binding to the bus** — `onAction` is read-only. Host apps that want to dispatch programmatically use the existing action hooks (`useBlockActions`, `useProjectActions`, etc.) on a child component, or import `composerActions` directly.
- **Templates write-back to `templatesUrl`** — the URL is fetch-only; user templates persist locally and reach the host via `onTemplateSave`/`onTemplateUpdate`/`onTemplateDelete`.
- **Schema-level validation of payload value types** — `validateRenderPayload` only checks presence. Type/shape is the host's job (or a follow-up zod-driven layer).

## Verification

End-to-end browser tests (run during the implementation session):
- Manifest extraction over a fixture with all three substitution sources → correct `keys/required/optional/occurrences` payload
- `renderFromPayload({ validate: true })` short-circuits with `Missing required dynamic keys: …`
- Unused payload keys produce a warning, not an error
- QR overwrite verified by comparing SVG matrices for different `data` values (matrices differ; fallback distinct)
- Pre-hydrated templates appear in `getTemplates()` with `source: 'api'` + the supplied category
- Action bus emits all 11 expected event types from a single drive sequence (`section.activate, history.push, block.add, block.update, block.duplicate, history.undo, history.redo, global.update, clipboard.copy, block.remove, project.reset`)
