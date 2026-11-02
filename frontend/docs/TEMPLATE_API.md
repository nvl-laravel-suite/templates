# Template API

The Creator composes HTML layouts, typed fields, styles, asset references and reusable blocks. The Editor fills a supplied definition or snapshot and applies only author-permitted overrides. Both are frontend components with local Undo/Redo, JSON import/export and synchronous HTML compilation. They have no save, publication, PDF, storage or network lifecycle.

See [commands](COMMANDS.md), [contract rules](CONTRACTS.md), [host composition](INTEGRATION.md) and [every public export](PUBLIC_API.md).

For the insertion catalog, adjustable columns, direct primitive content controls, link bindings and nested repeaters, start with [Build a template](BUILDING_TEMPLATES.md). `insertPresets` on Creator/Workspace replaces the default JSON catalog; `getTemplatePresets()` supplies fresh built-ins to extend.

```tsx
import {
  TemplateCreator, TemplateEditor, TemplateCreatorProvider, TemplateEditorProvider,
  createTemplateCreator, createTemplateEditor, useTemplateNode, useTemplateDataField,
} from '@nicolasvlachos/voucher-builder/template-creator'
import '@nicolasvlachos/voucher-builder/styles.css'
```

Import types/parsers from `/template-schema` and pure HTML/CSS functions from `/template-renderer`. These two entries run without React or a DOM. Generated JSON Schemas are available under `/schemas/*.schema.json`.

## Component and controller ownership

`<TemplateCreator initialTemplate={definition} />` and `<TemplateEditor template={definitionOrSnapshot} />` create their local document controls. Initial values are read once. To replace documents, use creator/editor `actions.load()`, or remount with a React key chosen by the host.

For custom controls, create a stable controller and pass it to a provider or workspace:

```tsx
const editor = createTemplateEditor({ template: definition, initialData: applicationData })
root.render(<TemplateEditor instance={editor} />)
// When the host discards this controller:
root.unmount()
editor.destroy()
```

A provider does not destroy a supplied instance. Callback props temporarily override its observers and restore the original observers on unmount. Explicit undefined clears an observer; omitting the prop retains the instance observer. Do not configure competing callbacks through concurrent providers for the same controller.

Getters return isolated copies. Hook snapshots are read-only views; use commands to mutate. Selection is transient UI state and does not trigger document `onChange`. Callbacks receive copies and observer failures report through `onError` without reversing a completed edit. The controller neither waits for nor acknowledges application work started from an observer.

## Components and provider options

Both workspaces accept `className` and `theme: 'light' | 'dark'` (default light). Set `--template-workspace-height` on a parent to control the embedded height. Layout responds to the component's container width. Mount one root Themelia `UIProvider` and import the bundled CSS once.

| Creator option | Behavior |
|---|---|
| `initialTemplate?: TemplateDefinition` | Initial authoring document; defaults to an empty definition. The demo supplies its invoice explicitly. |
| `instance?: TemplateCreatorInstance` | Use a host-created controller. Put initial data on that controller. |
| `onChange?(definition)` | Committed document edits, Undo/Redo and document loads. |
| `onError?(error)` | Structured `TemplateError` with operation, message, issues and optional cause. |

| Editor option | Behavior |
|---|---|
| `template: TemplateDefinition \| TemplateRevision` | Required unless an instance supplies it. Plain definitions need no revision-creation step. |
| `initialData?: JsonObject` | Initial values and application-owned values for restoration. |
| `initialPersonalization?: TemplatePersonalization` | Restore editable data/overrides matching the supplied template identity. |
| `instance?: TemplateEditorInstance` | Use a host-created controller. |
| `onChange?(personalization)` | Committed data/override edits, document loads and Undo/Redo. |
| `onError?(error)` | Structured operation/observer errors. |

Ready-made workspaces accept `onExport(result)` for completed local `{ format, data, filename, mimeType }` output. Without it, export downloads locally in the browser. Providers/controllers own only document editing and pure outputs. The host decides how to handle results and the component does not await application work. Exact declarations appear in the [public inventory](PUBLIC_API.md).

## Focused hooks

Hooks require the corresponding provider. Import them from `/template-creator` or `/hooks`.

| Hook | Result |
|---|---|
| `useTemplateCreatorInstance()` | Stable authoring controller. |
| `useTemplateDocument(selector?)` | Selected authoring document data. |
| `useTemplateNode(id)` | `{ node, select, update, remove, duplicate }`; absent node is null. |
| `useTemplateActions()` | Stable authoring commands, including synchronous `edit(draft => ...)`. |
| `useTemplateSelection()` | `{ id, node, select }`. |
| `useTemplateHistory()` | `{ canUndo, canRedo, undo, redo }`. |
| `useTemplateCreatorExport()` | Pure `render` and synchronous `exportDocument`. |
| `useTemplateContract()` | `{ schema, issues, error, clearError }`; schema is null for conflicting field paths. Errors concern local editing/export. |
| `useTemplateEditorInstance()` | Stable personalization controller. |
| `useTemplateDataField(id)` | `{ field, value, editable, issues, setValue }`; absent field is null. |
| `useTemplateEditorDocument(selector?)` | Selected template/personalization document data. |
| `useTemplateEditorActions()` | Stable personalization commands with no state subscription. |
| `useTemplateEditorSelection()` | `{ id, node, select }` for personalization. |
| `useTemplateEditorHistory()` | `{ canUndo, canRedo, undo, redo }` for personalization. |
| `useTemplateEditorExport()` | Pure `render` and synchronous `exportDocument`. |
| `useTemplateEditorValidation()` | Runtime `{ issues }`, independent of selection. |
| `useTemplatePersonalization()` | Aggregate document, selection, validation, history, actions and render/export view. |

Unchanged JSON subtrees retain identity across edits. Node/object-field subscribers do not rerender for sibling edits or selection. Prefer focused hooks for individual controls; internal stores/history arrays are private.

```tsx
function CustomerName() {
  const { field, value, editable, issues, setValue } = useTemplateDataField('customerName')
  if (!field) return null
  return <input aria-label={field.label} value={typeof value === 'string' ? value : ''}
    readOnly={!editable} aria-invalid={issues.length > 0}
    onChange={event => setValue(event.target.value)} />
}
```

Setters take a field ID, not its dotted path. `setValue(undefined)` clears a value and prunes empty parent objects; a read-only setter rejects. Local text/numeric input drafts may commit on blur or Enter, as the supplied UI does.

## Controllers and exports

`createTemplateCreator(options?)` exposes `actions`, `getTemplate()`, `render(mode?)`, `exportDocument('html' | 'json')` and `destroy()`. `edit()` makes one synchronous Undo transaction. Structural drafts remain editable while semantic issues are visible. JSON export preserves incomplete drafts. Creator HTML exports the authoring preview and may use design samples; composition checks must pass. Use Editor/runtime rendering with actual values for a final personalized document.

`createTemplateEditor(options)` exposes `actions`, `getTemplate()`, `getRevision()`, `getPersonalization()`, `render(mode?)`, `exportDocument('html' | 'json')` and `destroy()`. Editor actions include loading, field setters, permitted text/style overrides, selection and Undo/Redo. JSON export preserves incomplete values; HTML export validates runtime values. Creator rendering defaults to preview and Editor rendering defaults to runtime.

Exports return `{ format, data, filename, mimeType }` synchronously. Creator JSON is a definition; Editor JSON is personalization. `getRevision()` inspects the snapshot identity used by the personalization wire format. For a plain definition, an internal deterministic snapshot supplies that identity without a publication step. `createTemplateRevision(definition, revision?, publishedAt?)` is an optional pure helper for explicit metadata; it does not advance a counter or initiate a workflow.

## Data, defaults and restoration

Fields use a portable schema subset: string formats/enums/length, number/integer bounds, booleans, arrays and closed objects. Validation rejects contradictory limits, undeclared required keys and excessive nesting. Dynamic block bindings must have compatible types; integer may supply number. Full runtime constraints still apply.

`sample` is authoring preview data. `defaultValue` fills absence at runtime, never explicit null or malformed parents. No coercion, unknown-property stripping or mutation occurs. Personalization preview does not inject samples unless explicitly requested.

On restoration, saved personalization supplies editable values, and runtime defaults fill omissions. Application-owned values come from `initialData` or explicit runtime defaults. Conflicting supplied read-only data rejects. Editable values from `initialData` do not merge into a restored document.

## Reusable block workflow

Definitions contain property schemas/labels/descriptions/defaults, named slots, internal nodes and CSS. Editing a definition appends an immutable pinned revision; existing instances retain their version. Instance controls distinguish omitted properties, defaults, explicitly empty slots and fallback contents. Displaced slot content returns to document roots. Detachment rejects before mutation when it cannot preserve a binding/default faithfully.

`exportTemplateBlock(definition, blockId, version)` returns a dependency-complete `TemplateBlockLibrary`, including nested blocks, referenced images, font assets and theme. `parseTemplateBlockLibrary()` validates it. `importBlockLibrary()` deduplicates identical entries and rejects conflicting revisions/assets/themes atomically. Media bytes and URL resolution remain outside the artifact.

Formats remain version 1. Optional `propertyMetadata` extends the strict contract; upgrade all contract consumers before using it because older validators reject unknown fields. Legacy blocks retain their behavior. Source-field hints help authoring without requiring that field in another template.

Prefer `<TemplateEditor>` directly. The `VoucherBuilder.personalization` bridge accepts only template personalization options, light/dark theme and className. Voucher-only options are rejected by types and runtime checks.
