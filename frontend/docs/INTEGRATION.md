# Embedding and host composition

This package is a frontend document component library. Its contract is **JSON in, edits and HTML/CSS/JSON out**. The consuming application preloads documents, fields, reusable blocks, asset references and values. It receives changes or explicitly obtains an export and handles the result through its own infrastructure.

## Backend-independent frontend contract

| Input supplied by the host | Component boundary |
|---|---|
| Definition with HTML nodes, CSS, fields, assets and block revisions | Creator `initialTemplate` or `actions.load()` |
| Definition or validated template snapshot | Editor `template` or `actions.load()` |
| Application-owned values | Editor `initialData` |
| Previous editable values and permitted overrides | Editor `initialPersonalization` |
| Preloaded voucher documents and template choices | Voucher `initialProject` and `config.templates` |
| Change/error observation | `onChange`, `onError` and focused hooks |
| Export output | Synchronous HTML/JSON commands and export observers |

These payloads work with a React page embedded in Laravel, Rails, Django, ASP.NET, a browser-only app or any other host. The library does not interpret routes, API clients, tokens, CSRF, response wrappers or database records. No backend integration is configured inside a workspace.

## Supplying and retrieving documents

Load data before mounting, then pass plain JSON matching the exported contracts. The application controls loading, retry and failure UI while obtaining that input.

```tsx
function ComposeDocument({ definition, receiveChange }) {
  return <TemplateCreator initialTemplate={definition} onChange={receiveChange} />
}

function FillDocument({ template, values, applicationData, receiveChange, receiveExport }) {
  return <TemplateEditor
    template={template}
    initialData={applicationData}
    initialPersonalization={values}
    onChange={receiveChange}
    onExport={receiveExport}
  />
}
```

Handlers observe completed local work. They do not turn the component into a save client or make it track an application request. A host toolbar can call `getTemplate()`, `getPersonalization()` or synchronous export commands, then use the result in any way. The [typed React examples](../examples/react-workspaces.tsx) demonstrate this separation without endpoints or SDKs.

Definitions may be unfinished drafts. Restore them with `parseTemplateDraft()` so semantic issues remain repairable. JSON export preserves incomplete work. Use `parseTemplateDefinition()` for a complete definition and runtime rendering checks before treating HTML as final. Personalization JSON and template-definition JSON are different artifacts.

## Choosing the workspace layout

Set `layout="compact"` on `TemplateWorkspace` or `GroupVariantWorkspace` to keep the canvas beside one right tools dock. Both retain the current three-pane arrangement when the prop is omitted. Use the same prop on low-level `TemplateCreator` or `TemplateEditor`; no host CSS reordering is needed.

```tsx
<TemplateWorkspace
  layout="compact"
  sessionKey={loadedTemplateKey}
  initialDocument={templateDocument}
  onDraftChange={receiveTemplateDraft}
  onPersonalizationChange={receivePersonalization}
  header={templateHeader}
/>

<GroupVariantWorkspace
  layout="compact"
  sessionKey={loadedVariantKey}
  initialDocument={variantDocument}
  familyDocument={pinnedFamilyDocument}
  effectiveDocument={effectiveVariantDocument}
  onDraftChange={receiveVariantDraft}
  onPersonalizationChange={receivePersonalization}
  header={variantHeader}
/>
```

Compact authoring puts Properties and Structure in local tabs, with other enabled tools in the dock's More tools selector. Tree selection stays in Structure until **Edit properties** is chosen; selecting a canvas block opens Properties. Personalization uses Values/Appearance, and fixed-layout family variants use Content/Settings. At an embedding width of 760px or less, **Editing tools** opens the same controls in a Themelia drawer and restores trigger focus on close.

The workspaces place their uncontrolled mode selector beside the canvas tools in compact mode. Host header identity, status slots and commands keep their existing APIs; controlled `mode` keeps its existing ownership. Low-level Creator/Editor consumers may supply `canvasControls` for their own toolbar content. Keep `sessionKey` stable across tool and mode switches so local editing state is retained.

Layout and tool navigation are UI state. They do not enter `onDraftChange`, template JSON, personalization or published versions. Visited controls and tree expansion remain mounted through dock/drawer switches, including invalid buffered fields that must still block authoring export. Saving, asset access, preview requests, publication and personalized delivery continue through the host's existing integration. See the [workspace guide](WORKSPACES.md#compact-layout) for the full interaction model.

## Local state and loading

The ready-made workspace creates local editing state. A provider exposes that same document to custom controls, and factories provide an explicit controller when the host needs imperative access. These are in-memory document controls, with no connection handles or storage identities.

Initial values are read once. Creator `actions.load(input)` loads a new definition/snapshot. Editor `actions.load(template, { data, personalization })` replaces its document and inputs. Voucher `actions.loadProject(project)` loads a supplied project. The host decides when to perform those replacements; a React key is also a valid remount boundary.

Create a controller once, rather than during every render. If the application creates it, call `destroy()` after the final consumer unmounts. A provider restores the callback configuration on a supplied controller rather than destroying it. Callback props can change without replacing the document. Snapshot getters and callbacks provide copies; hook snapshots are read-only by convention. Mutate through commands so Undo/Redo and focused subscriptions stay consistent.

Use `<TemplateEditor>` directly for the template contract. The `VoucherBuilder.personalization` bridge accepts only template personalization options plus light/dark theme and className. Voucher-only modes, feature flags, controllers and callbacks are rejected there.

## HTML, CSS and reusable blocks

`renderTemplate()` compiles locally to `{ html, css, data, issues }`. `html` is a complete document containing its document styles. The workspace stylesheet styles the editing UI and is not needed inside exported HTML.

Reusable blocks are pinned definitions with property contracts, defaults, named slots, internal nodes and scoped CSS. `exportTemplateBlock()` creates a portable library containing the selected version and required block/asset references; `importBlockLibrary()` merges it atomically. No block registry or vendor service is involved. Media bytes are outside the JSON contract.

Supply usable image/font URLs before rendering or provide the synchronous `resolveAsset` function. The renderer does not perform network requests, uploads or signing. Normal browser preview loads of those URLs follow the application's browser environment. The host owns asset access and any later delivery/conversion of HTML.

## Validation and compatibility

The six self-contained JSON Schemas are portable to any conforming Draft 2020-12 validator. They specify normalized wire shapes. Semantic parsers additionally validate references, graph ownership/cycles, pinned dependencies, fields, styles, asset URLs, snapshot identity and override policy. A separate contract implementation must preserve those semantics as well as the JSON shape.

`editable: false` controls the supplied editing UI. `initialData`/`trustedData` provide application-owned values for restoration and comparison. Neither option implements application authorization. How the host obtains or verifies those values remains its own concern.

Keep contract consumers compatible when adding optional block `propertyMetadata`; older strict validators reject unknown fields. The current formats remain version 1. The optional `TemplateRevision` snapshot retains its `publishedAt` metadata for wire compatibility; this does not add a publication workflow.

## Migration to the frontend-only surface

- Remove save/publication/PDF callbacks and their lifecycle hooks. Obtain JSON/HTML locally and run application actions outside the library.
- Replace URL/configuration/storage options with preloaded JSON and asset references.
- Use document/component/controller terminology. Selection, clipboard and Undo/Redo are local UI state.
- Use focused hooks and automatic Undo commands rather than importing internal stores or calling `pushHistory()` before each edit.
- Existing voucher documents keep their own format. Use `adaptVoucherProject()` explicitly when converting to template composition, and review its warnings.

See [contracts](CONTRACTS.md), [Template API](TEMPLATE_API.md), [Voucher API](API.md) and the [command reference](COMMANDS.md) for exact behavior.
