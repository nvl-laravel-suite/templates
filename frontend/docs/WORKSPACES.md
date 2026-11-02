# Workspace guide

The demo opens Template Creator. It offers local template authoring, personalization and the original voucher editor. The ready-made components can be embedded independently. Template workspaces use a three-pane layout by default; `layout="compact"` places the editing tools in one right dock beside a wider canvas. The demo and components have no application-session or backend lifecycle.

## Template Creator

The top bar identifies the document and offers local JSON/HTML export and its data contract. JSON preserves unfinished work. Creator HTML compiles the authoring preview with design samples after composition checks pass; Editor/runtime rendering uses actual values for final personalized HTML. There are no Save, Publish or PDF service actions; the embedding application owns anything it does with an output.

In the default layout, header tabs select Build, Library or Setup; the sidebar selects a tool within that area and remembers its last selection. Tools that do not fit remain available in the overflow menu. The center toolbar provides Undo/Redo and insertion. The canvas fits its container and grows for flowing content. The footer reports document scope and readiness. Invalid retained fields take priority over canonical contract status; its attention action returns to the owning tool and reveals the field. Zero data-field counts are omitted. Clicking Review on a check opens the relevant panel and moves focus into the inspector.

| Panel           | What to do                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure       | Expand the tree, select an element, insert sections or primitive/control nodes, and import supported definitions/revisions or explicitly migrate a voucher.                                                   |
| Fields          | Add a field, edit its ID-independent data path/label/description/type, required/editable flags, validation limits/formats, design sample, and runtime default. Advanced schemas handle enums and nested data. |
| Styles          | Edit theme/template CSS and inspect discovered classes. Correct invalid drafts before HTML export. URLs belong to managed assets. |
| Assets          | Register image/font URLs and metadata; insert a bound image from an asset. Referenced assets must be unbound before deletion through the supplied UI. Upload/storage are application responsibilities.        |
| Reusable blocks | Insert pinned revisions. Save a complete selected structure as a reusable block, or detach an instance into editable copies. Editing a library definition does not rewrite existing pinned instances.         |

The inspector follows the selection. Direct editable text, image and link content precede element metadata. The Element actions menu groups move, duplicate, reusable-block creation and confirmed removal; those commands remain undoable and respect custom family inspectors. Element controls include name, HTML tag, parent container, class list, plain inline styles, attributes/advanced styles, and allowed personalization. Text controls expose static or bound segments and format. Repeaters require an array binding; conditions expose truthiness/equality. Use Document settings to rename the template or edit page dimensions, margins, and formatting locale.

Fields are part of the data contract, not visual elements. Deleting a bound field is blocked in the supplied UI until bindings are removed. Structural problems can still exist in a programmatically edited draft; checks explain what prevents final HTML compilation. Review opens the relevant control without automatically repairing content.

## Template Editor

The left panel contains typed document values, including nested objects and repeatable array rows. Application-owned fields display as read-only. The middle canvas reflects committed edits. The right inspector shows only overrides permitted by the author after a template-owned node is selected. Clicking inside a reusable block selects the instance, keeping its library internals protected.

Required data, types, ranges and override permissions are checked before HTML export. Incomplete drafts can be edited, undone and exported as JSON. Authoring samples are not inserted into missing user values. HTML export creates standalone markup; JSON exports personalization data/overrides. There is no persistence or PDF adapter.

The Customization target selector provides a keyboard-accessible alternative to clicking the preview. It lists permitted static text/style targets and keeps a selected protected element visible. Optional arrays/objects have Clear field actions; clearing omits the value, while an explicitly empty collection still follows its schema. Undo restores cleared values.

Reusable blocks expose definition editing, portable JSON export/import, property labels/defaults and named slot controls. Definition edits create a new pinned revision. Assigning slot content moves existing nodes; restoring fallback or replacing content moves displaced nodes back to document roots. Unrepresentable detachment fails before modifying the draft. Imported unfinished drafts retain their checks.

Undo/Redo covers values and permitted overrides. The document, selection and history are local editing state. The demo can retain mounted workspaces while switching views; reloading the page starts from its supplied data. The host explicitly preloads/restores data when embedding.

## Original voucher workspace

VoucherBuilder preserves the fixed three-section A4 Project format. Its left dock contains Layers, Blocks, and Templates. The right inspector contains selected block/section settings. Document settings select Layout, Appearance, Document details or feature-gated Sample values; switching tasks retains the same controls. The wide top bar prioritizes Preview and Export with the remaining commands in its workspace menu. Below Page’s 40rem command-overflow threshold, an app-owned command row exposes the same eligible Preview/Export actions. Canvas controls manage Undo/Redo, fit/actual/custom zoom, rulers/grid, and other available view options.

An empty document offers one Add a block/Browse templates action instead of repeating instructions in every paper section. Reusable template rows combine native Item copy, a small portrait preview, source and Use action; replacement still confirms and remains undoable. Library and inspector instances keep their portal host when drawers close or panels redock.

The Sections tree selects the active insertion target and shows its height/block count. The layer list follows that section; choosing another section clears block selection and opens its settings. Canvas sections also accept Enter/Space when focused. Layers support selection, reordering, and per-item actions. Container blocks own their nested children. Row/grid resizing preserves retained cells and removes truncated subtrees with Undo support. Common settings apply spacing, surface, border/shape, effects, visibility, animation, print behavior, and dynamic values; individual blocks supply content/appearance controls.

Admin/editor/viewer modes resolve UI feature presets. Viewer makes the supplied editor read-only; a controller still has programmatic commands. Feature flags do not implement application authorization. Builtin/host/user voucher choices are in-memory library entries, distinct from Template Creator block revisions.

## Input, focus, and keyboard behavior

Text/numeric controls in the template workspaces commit on blur or Enter. Multiline controls commit on blur; Enter adds a line. Escape cancels an uncommitted field draft before a containing surface handles the key. Invalid drafts retain their errors and block HTML export, including when their native Accordion or visited tool is closed. The readiness attention action opens the relevant retained field without discarding its buffer. Boolean/enum controls distinguish false/empty strings from absence. Typed array rows provide add/remove; Undo restores removed data.

Template workspaces expose toolbar Undo/Redo and local export buttons. They do not register the voucher editor's shortcut set. Do not assume keyboard commands are shared across every component.

Voucher shortcuts belong to the workspace containing the event target. Sibling/nested editors stay independent, and keyboard activity elsewhere in the host page does not run document commands. Local React handlers can prevent a shortcut before the workspace handles it. Composition input, Alt combinations, dialogs, menus and listboxes retain their own behavior. Native text Undo/Redo and editable-content deletion remain local.

The on-screen shortcut reference follows feature flags and read-only mode:

| Shortcut                     | Voucher action                                |
| ---------------------------- | --------------------------------------------- |
| Cmd/Ctrl+K                   | Command palette when enabled.                 |
| Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z | Undo/Redo when enabled.                       |
| Cmd/Ctrl+C / X / V           | Local document copy/cut/paste when enabled. |
| Cmd/Ctrl+D                   | Duplicate selected content.                   |
| Delete / Backspace           | Confirm removal of the selected blocks.    |
| ? (including Shift+/)       | Open keyboard shortcuts.                     |
| Escape                       | Clear selection or dismiss an active surface. |
| Up / Down                    | Navigate a single-block selection.            |

Keyboard and block-menu deletion use the same native confirmation and a snapshot of the requested IDs. Cancel preserves the document and selection; confirmed deletion is one undoable operation. Structural columns remain protected. Dimension value/unit controls and stepper buttons include the field name, and both controls refer to the same supporting description. Auto dimensions disable the numeric control.

## Embedding, sizing, and themes

`TemplateWorkspace` shows its output selector by default. For an email-only host, load an email document and set `allowTargetChange={false}`. This hides the selector and preserves the loaded target; the server must also enforce the host's accepted target. Local mode selection uses a compact native radio group. Supplying `mode` keeps selection controlled by the host and hides this group.

### Compact layout

`TemplateWorkspace`, `GroupVariantWorkspace`, `TemplateCreator` and `TemplateEditor` accept `layout?: 'default' | 'compact'`. Omit it to retain the existing three-pane arrangement. Opt in through the component prop; host CSS should not reorder or hide its internal panels.

In compact authoring, **Properties** edits the selected block or document settings. **Structure** contains the existing tree and insertion/import actions. Selecting a tree item keeps Structure open; choose **Edit properties** when ready to edit it. Clicking a canvas block opens Properties directly. A **More tools…** selector in the dock opens fields, styles, assets, reusable blocks and the additional template/family tools enabled by the workspace. The wide Build/Library/Setup row is omitted.

The personalizer uses **Values / Appearance** tabs. A family variant with a fixed layout uses **Content / Settings**; a family with structural variation points uses the Creator’s Properties/Structure tools and initially opens Variation points at the first declared target. Its inspector names that change and shows its current value, inheritance state and Use family action. Existing family declaration details start collapsed; newly created rules open for immediate editing. Design/Personalize and Variant/Customer preview controls move into the canvas toolbar in compact mode. The host's title, status slots and Save/Publish/Preview commands retain their header ownership. Controlled `mode` still belongs to the host.

At an embedding width of 760px or less, **Editing tools** opens the same dock in a Themelia drawer. Closing the drawer restores focus to its trigger. Visited tool forms, unfinished and invalid values, tree expansion, selected nodes and Undo history survive panel switches and responsive docking. An invalid retained authoring field still prevents export until repaired. These navigation choices are local UI state and do not change the document contract, personalization payload or published output.

Low-level `TemplateCreator` and `TemplateEditor` also accept `canvasControls?: ReactNode` for host controls beside their canvas tools. They remain outside rendered/exported HTML. The higher-level workspaces already place their own mode controls there when compact.

```tsx
<TemplateWorkspace
  layout="compact"
  initialDocument={emailDocument}
  allowTargetChange={false}
  onDraftChange={receiveTemplateDraft}
  header={templateHeader}
/>

<GroupVariantWorkspace
  layout="compact"
  initialDocument={variantDocument}
  familyDocument={pinnedFamilyDocument}
  effectiveDocument={effectiveVariantDocument}
  onDraftChange={receiveVariantDraft}
  header={variantHeader}
/>
```

For a low-level Creator extension, `initialPanel?: string` selects an available built-in or `workspacePanels` tool only on the initial mount. Unavailable IDs fall back to an allowed tool; changing this prop later does not reset local navigation or the draft. Built-in restrictions still apply. Each `TemplateCreatorPanel` may supply `inspectorTitle?: ReactNode` to name the selected subject separately from the tool’s navigation `label`; omitting it retains the label. These are editor composition props and never enter exported source.

Keep each `sessionKey` tied to an explicit document load/replacement. Do not change it when selecting a dock tool or mode; a new key deliberately starts a new editing session.

### Preview values and host controls

Both workspace wrappers accept `previewSettings` for a reactive sample appearance baseline. Values must match the current exposed setting schemas and style rules. Canvas previews use authored defaults, then sample values; customer preview additionally applies local personalization overrides. Customer controls show this same baseline, and Reset removes only the local override. Changing or removing sample values does not load a document, reset Undo, or persist samples in draft/exported JSON. `initialSettings` still initializes local overrides once. Invalid sample values show a Preview settings alert and are excluded until repaired.

Pass sample settings separately from `previewData`; its settings namespace is not implicitly applied. For server preview and explicit sends, merge settings **per key**: `{ ...sampleSettings, ...personalization.settings }`. Personalization callbacks contain only local overrides, so changing a content input does not clear sample appearance. Overlay nested input patches recursively so an edited leaf preserves untouched sample siblings. Explicit null, false and zero replace the sample value; arrays replace the selected array. Authored default controls continue showing saved defaults; the sample baseline only affects previews and customer controls. Equal-object rerenders do not replace local state.

The [Laravel host example](../examples/laravel-host.tsx) forwards `previewData.settings` through `previewSettings` and applies these overlays before server preview. Staff leaves the workspace mode uncontrolled so both standalone and family-variant mode selectors remain available; explicit customer mode stays controlled. Starting a new server preview, receiving a failure or changing effective runtime values clears the previous result; value changes also cancel pending responses without marking authored source dirty. Identical effective values keep the current preview. Successful retries display the returned `previewHtml`, falling back to `html` for older servers.

Its application-owned Resources and media tools paginate retained images, preserve a selection across pages, and discard responses for an earlier page, template or output target. Target-specific MIME capabilities drive the picker and file input; the legacy fallback still excludes WebP for email. The server filters `GET /assets?target=email&page=…` before pagination. Variant targets come from the effective bootstrap document or pinned family. These rules belong to the host controls and repository, with no transport added to the workspaces.

The reference host separates pinned reusable resources from template-image mapping. Resource retry does not reset retained image selection or pagination. Family change operations use exclusive Upgrade/Rebase/Detach/Regroup choices; active conflict decisions and the resulting draft preview precede saved review history. Applying a reviewed change updates a draft and never publishes it. Transport, authorization, candidate validation and publication remain host responsibilities.

The reference repository accepts optional `{ maxResponseBytes }` as its third factory argument; the main application's factory accepts it fourth after its CSRF argument. The default successful-response budget is 8 MiB, configured values must be positive safe integers, and errors keep a separate 32 KiB cap. Inject server limit/capability metadata into the page and pass the configured byte budget when constructing the repository; see [Laravel integration](laravel-module.md#server-preview-and-media).

Both `TemplateWorkspace` and `GroupVariantWorkspace` pass `header.headingTag` and native `header.slots` to their existing Page header. Use `headingTag: 'h2'` when the containing route already owns its h1, and `slots.afterDescription` for saved/draft/publication status. Prefer `headerControls` for compact contextual inputs in TemplateWorkspace; keep form sections outside its command row. `slots.actions` intentionally replaces all header controls and commands, so use it only when the host owns that entire region.

```tsx
<TemplateWorkspace
  initialDocument={emailDocument}
  allowTargetChange={false}
  header={{
    headingTag: 'h2',
    title: 'Welcome email',
    slots: { afterDescription: <span role="status">Saved draft</span> },
  }}
/>
```

Mount one Themelia `UIProvider` at the app root and import the bundled stylesheet once. See [UI integration](UI.md) for exact owners, theme boundaries and tool commands. Set a parent width and `--template-workspace-height` for template components. Their responsive rules follow the embed width, not just the viewport. The default narrow layout stacks panels; the compact layout uses its tools drawer. Documents remain scrollable. VoucherBuilder owns a full docked shell and has its own responsive rules.

Template workspaces accept light/dark. VoucherBuilder also accepts system theme and locale (current bundled UI translations: English and Arabic). Template formatting locale affects document numbers/dates; it does not translate author labels or every workspace UI string. UI strings in the template workspaces are currently English. Preserve focus outlines, control labels, dialog titles, and live error announcements in custom compositions.

CSS includes Tailwind base/utilities and is not a Shadow DOM boundary. Check host resets and import order. Print/preview styles inside compiled documents are independent of the workspace stylesheet. Any later printing/conversion follows the host's chosen environment and fonts/assets.
