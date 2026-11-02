# Voucher API

The original voucher component composes a fixed three-section A4 Project. Its document model differs from the flowing template model; see [Template API](TEMPLATE_API.md) for Template Creator/Editor and reusable template blocks. Use [commands](COMMANDS.md) for every controller method and [public declarations](PUBLIC_API.md) for exact types.

Import `/editor` for voucher UI, `/hooks` for custom controls, `/schema` for voucher types and `/renderer` for pure HTML/JSON functions. Non-UI entries do not require React or a DOM. No entry implements a backend or storage/network adapter.

## Component and provider

```tsx
import { VoucherBuilder } from '@nicolasvlachos/voucher-builder/editor'
import '@nicolasvlachos/voucher-builder/styles.css'

export function ComposeVoucher({ project, templates, onChange }) {
  return <VoucherBuilder initialProject={project} config={{ templates }} onChange={onChange} />
}
```

Mount a root Themelia `UIProvider` and import the stylesheet once. `VoucherBuilder` supplies its own document provider. Custom workspaces can compose `VoucherBuilderProvider`, `VoucherBuilderEditor` and sibling controls under one provider. Separate mounted documents keep independent selection, clipboard, history and template choices.

Initial data is read once. `actions.loadProject()` loads another supplied document; a React key can remount it. A host-created controller must be stable and destroyed when discarded. Providers restore supplied controllers' observers on unmount. Callback updates do not replace document state.

### Component options

| Option | Purpose |
|---|---|
| `initialProject` | Supplied Project JSON; otherwise a starter voucher. |
| `instance` | Host-created `createVoucherBuilder()` controller for shared custom controls. |
| `config` | `{ templates?: VoucherTemplate[] }`, preloaded by the host. |
| `mode` | `admin`, `editor` or `viewer` UI preset. |
| `features` | Override the preset's available UI controls. |
| `onChange` | Committed Project changes, debounced by `changeDebounceMs` (default 100ms). |
| `onSelectionChange` | Selection observer separate from document changes. |
| `onAction` | Typed action-event observer. |
| `onExport`, `onExportComplete` | Completed local HTML/JSON export observers. |
| `onTemplateAdd`, `onTemplateUpdate`, `onTemplateDelete` | Observe in-memory template-library edits. |
| `onError` | Local operation/observer errors. |
| `theme`, `locale`, `className` | Appearance and UI language options. |

No save callback, endpoint/configuration URL, storage key, remote template source, sync flag or PDF strategy is accepted. The host obtains output and uses its own APIs independently. Feature flags configure UI availability and do not implement application authorization.

## Focused hooks

| Hook | Purpose |
|---|---|
| `useVoucherInstance()` | Stable public document controller. |
| `useVoucherProject(selector?)` | Focused Project subscription. |
| `useVoucherBlock(id)` | Block plus undoable update/content/settings commands. |
| `useVoucherActions()` | Stable document commands and synchronous `transaction()`. |
| `useVoucherSelection()` | Selected blocks/section and selection commands. |
| `useVoucherHistory()` | Undo/Redo availability and commands. |
| `useVoucherExport()` | Synchronous HTML/JSON export commands. |
| `useVoucherTemplates()` | Current in-memory choices and library commands. |
| `useVoucherChange(handler, debounceMs?)` | Effect-managed Project change observation. |
| `useVoucherEvent(type, handler)` | Typed action subscription; `'*'` observes all actions. |
| `useVoucherConfig()`, `useVoucherFeature(name)` | Preloaded configuration and resolved UI flags. |

Hook snapshots are read-only; commands own mutations and history. Public mutations record Undo automatically. `transaction(commands => ...)` groups synchronous edits into one Undo step and notification; thrown errors roll back the batch. Await application work before starting a transaction. Unchanged selections need no document write.

## Local exports and rendering

`instance.exportProject({ format: 'html' | 'json', ...options })` returns a typed result synchronously. The host chooses whether to display, download, deliver or store its string. `exportHTML()` and `exportJSON()` are direct synchronous helpers. `importProject(input)` strictly parses JSON and returns `{ project, errors, warnings }`; successful import is undoable.

```ts
import { renderFromPayload } from '@nicolasvlachos/voucher-builder/renderer'

const result = renderFromPayload({
  project: suppliedProject,
  data: { customer_name: 'Jane', voucher_code: 'ABC-123' },
  documentTitle: 'Voucher ABC-123',
  strict: true,
  validate: true,
})
if (result.errors.length) throw new Error(result.errors.join('; '))
const html = result.html
```

`renderFromPayload()` accepts a Project, v2/v1 `gct-voucher` envelope or JSON string. It returns `{ html, errors, warnings, manifest, validation? }`. `strict: true` validates the imported Project; `validate: true` rejects missing required dynamic values. No requests or downloads occur.

| Rendering input | Purpose |
|---|---|
| `project` | Document JSON or supported envelope/string. |
| `data` | Dynamic substitutions: string, number, null or undefined values. |
| `frame` | Optional frame URL/opacity override. |
| `documentTitle` | HTML title override. |
| `strict` | Validate Project shape after import. |
| `validate` | Refuse missing required substitution keys. |

`exportToHTML(project, options?)` compiles directly. `exportToJSON(project)` serializes a normalized v2 envelope containing the full Project. `parseVoucherImport(input, options?)` reads raw Projects or supported envelopes; older lossy v1 documents can produce migration warnings. Asset URLs and substitutions are host-supplied.

## Dynamic-key contract

`getProjectDynamicKeys(project)` reports data/content/asset manifests. Each category contains `keys`, `required`, `optional` and `occurrences`. Occurrences identify block/key sources and defaults. Use this to build host forms or inspect expected substitutions without mounting an editor.

`validateRenderPayload(project, data)` returns `{ ok, missing, unused, expected }`. Required keys depend on whether the source supplies a default. These helpers describe the original voucher model; flowing templates instead use typed fields and `getTemplateDataSchema()`.

## Action callbacks

`BuilderActionEvent` is a discriminated union generated in the [event reference](PUBLIC_API.md#voucher-action-events). It covers local block, selection, container, section, history, project, template, clipboard, global/frame and export actions. `BuilderActionType` is its discriminator.

Observers receive copies after committed batches. An observer exception does not block other subscribers or reverse an edit; it reports through `onError`. Rolled-back transactions emit no committed document mutations. Selection events can appear in the action stream without triggering document `onChange`.

```tsx
useVoucherEvent('block.add', event => {
  console.log(event.blockId, event.sectionId, event.blockType)
})
```

## Templates

`VoucherTemplate` contains an ID, display metadata and a voucher Project. Its source is `builtin`, `host` or `user`. Template choices are JSON held in memory; loading one instantiates fresh project IDs.

Supply host choices through `config.templates` or `templates.replace()`. `templates.add()` captures a user choice; `update()` and `remove()` edit user choices. `list()`, `load()`, `importJSON()` and `exportJSON()` cover local use and exchange. These methods do not persist or synchronize anything. The host may observe add/update/delete and process those JSON values independently.

## Schema and feature composition

Use `/schema` for `ProjectSchema`, `BlockSchema`, Project/Block types and the registered block union. Common settings cover spacing, surface, border/shape, layout, effects, visibility, animation, printing and dynamic values. Container operations preserve graph ownership and record Undo. See the generated declarations for every block-specific setting.

`resolveFeatures(mode?, overrides?)` composes a UI preset. `MODE_PRESETS` exposes admin/editor/viewer presets. Viewer disables supplied mutation controls. Enabled flags include templates, block/settings panels, validation, import/export, preview data, debug controls, command palette, context menus, clipboard and history. No flag establishes host permissions.

For new host integrations, pass JSON, use hooks/commands and receive output. See [host composition](INTEGRATION.md) and [workspace behavior](WORKSPACES.md).
