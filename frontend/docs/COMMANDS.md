# Controller and command reference

Import template factories from `/template-creator` or `/hooks`, and the voucher factory from `/hooks` or `/editor`. Hook snapshots are read-only views. Commands own mutations and history; do not write through a snapshot or an internal store.

This guide lists every public command. Exact parameter types, unions and return values are linked in the [export inventory](PUBLIC_API.md). Commands are synchronous local operations. IDs identify fields/elements/blocks; dotted data paths describe JSON values and are not interchangeable with field IDs.

## Template Creator controller

Email column layouts additionally accept `stackOnMobile` in `setColumnLayout`. Their gap uses cell padding, and nested tables keep their own mobile policy. See [Email templates](EMAIL_TEMPLATES.md).

`createTemplateCreator(options?)` creates local authoring controls. `initialTemplate` defaults to an empty definition; the demo explicitly supplies its invoice. Structurally invalid input throws during creation; semantically incomplete drafts remain editable and exportable as JSON.

| Method | Result / behavior |
|---|---|
| `getTemplate()` | Isolated definition copy. |
| `render(mode?)` | Pure `TemplateRenderResult`; preview is the default. No download or application action. |
| `exportDocument(format)` | Synchronous `{ format, data, filename, mimeType }`. JSON preserves the definition draft. HTML compiles the authoring preview with design samples; composition checks must pass. |
| `destroy()` | Disconnect observers and reject future mutations/rendering/exports. Snapshot getters remain readable. |

### Creator actions

| Command | Behavior |
|---|---|
| `edit(change)` | Clone → synchronous draft function → structural parse → one history entry and one `onChange`. Identity must stay the same. Invalid/async edits throw and leave the document unchanged. Unchanged edits are no-ops. |
| `select(id)` | Select a template-owned node or `null`; unknown IDs are ignored. No document change/history entry. |
| `updateNode(id, patch)` | Shallow patch preserving the node's ID and kind. Replace a nested property deliberately or use `edit` for nested mutations. Missing ID is a no-op. |
| `insert(tag?, parentId?)` | Insert an HTML element; defaults to paragraph at document root. Adds initial text for content tags, selects the element, returns its ID. |
| `insertControl(kind, parentId?)` | Insert `repeat` or `condition`, select it, return ID. Configure bindings before final HTML export. |
| `insertFragment(fragment, parentId?)` | Copy `{roots,nodes}` into the current definition, remap all graph/slot IDs, select and return the new roots. Tree ownership is validated before one guarded Undo step. Referenced fields/assets/pinned blocks belong to the receiving definition; incomplete semantic drafts remain repairable. |
| `setColumnLayout(id, patch)` | Update a recognized presentation-table column layout in one guarded Undo step. Count is 1–4; positive relative widths normalize to 100%; spacing is 0–64 px; alignment is top/middle/bottom. Reducing count moves removed columns’ content into the last retained cell. Custom unrecognized structures reject atomically. |
| `insertImage(assetId, parentId?)` | Require an existing image asset, bind `src`, initialize alt text from its name, select, return ID. One Undo step. |
| `remove(id)` | Remove the subtree and its child references. |
| `duplicate(id)` | Copy the subtree with new IDs, insert after the source, select the copy. Returns void. |
| `move(id, parentId, index)` | Reparent/reorder at root or a child-capable element. Indices are bounded by the destination list. Rejects moving into its own descendants. Use `setBlockSlot` for named block-slot contents. |
| `undo()` | Restore the previous definition and notify. Up to 100 authoring snapshots are retained. |
| `redo()` | Restore the next definition. A new edit clears Redo. |
| `load(input)` | Load a structurally parsed repairable definition draft or validated snapshot; reset selection/history. No data loading or persistence is performed. |
| `saveBlock(id, name, existingBlockId?)` | Capture a complete subtree as a pinned block revision. Bindings become properties with labels, descriptions, source-field hints and runtime defaults. Short legacy `p_<fieldId>` names are retained; long/colliding names use valid unique identifiers. Return block ID. An existing ID creates its next version. |
| `insertBlock(blockId, version, parentId?)` | Insert a pinned instance and return node ID. Source-field hints (or legacy naming) bind existing fields. Unmatched properties remain omitted and use declared block defaults; required properties without defaults need authoring before final rendering. |
| `setBlockProperty(id, name, value)` | Set a declared property binding on a block instance. `undefined` omits it, enabling its runtime default. Unknown instances/properties reject atomically; incomplete required bindings are repairable drafts. |
| `setBlockSlot(id, name, ids)` | Move distinct existing template nodes into a declared slot. `[]` explicitly empties it; `undefined` restores fallback content. Displaced nodes return to document roots. Reject cycles/unknown references; one Undo step. |
| `reviseBlock(blockId, version, patch)` | Validate an edited definition and append its next version. ID/version are assigned by the command. Existing revisions and insertions remain pinned. Returns the new version number. |
| `importBlockLibrary(input)` | Parse a portable dependency-complete library and import missing blocks/assets in one Undo step. Identical revisions deduplicate; conflicting revisions, asset identities, or nonempty themes reject atomically. Returns the entry block ID/version. Does not insert it or create fields. |
| `detachBlock(id)` | Copy an instance into template-owned nodes, resolve bindings/defaults/slots and retain its CSS class. Reject before committing if an omitted property or dynamic fallback cannot be represented faithfully outside the block. Library revisions stay intact. |

Use `TemplateNodeSchema.parse()` to construct block/slot nodes with explicit references. `createTemplateNode(kind?, tag?)` supplies defaults for element/text/repeat/condition only; `createTemplateDefinition(name?)` supplies an empty definition; `createInvoiceTemplate()` supplies the demo document. Generated IDs are new each call.

## Template Editor controller

`createTemplateEditor({ template, initialData?, initialPersonalization?, ...observers })` accepts a complete definition or optional validated snapshot. Missing/invalid editable values can exist as drafts. Read-only values are application-owned. See the [restoration rules](CONTRACTS.md#defaults-and-trusted-data).

`editor.actions.refreshTrustedData(data)` refreshes read-only values from the host while retaining editable customer values, selection, and Undo/Redo. History snapshots also receive the new trusted values, so Undo cannot restore stale protected facts. Replacing the definition remains an explicit `load` operation.

| Method | Result / behavior |
|---|---|
| `getTemplate()` | Isolated definition copy. |
| `getRevision()` | Isolated snapshot/identity copy used by the personalization wire contract. |
| `getPersonalization()` | Isolated current personalization copy. |
| `render(mode?)` | `TemplateRenderResult`, runtime by default. Preview keeps missing user inputs visible; it does not inject samples. No download or persistence. |
| `exportDocument(format)` | Synchronous `{ format, data, filename, mimeType }` for `html` or `json`. JSON preserves current personalization drafts; HTML validates runtime values. |
| `destroy()` | Disconnect observers and reject further writes/rendering/exports; snapshot getters remain readable. |

### Editor actions

| Command | Behavior |
|---|---|
| `select(id)` | Select an existing template node or clear with null; no document edit. |
| `load(template, options?)` | Replace with a supplied definition/snapshot and optional `{ data, personalization }`; reset selection/history. No external loading is performed. |
| `refreshTrustedData(data)` | Refresh protected host values in the current state and history while preserving customer edits, selection and Undo/Redo. |
| `setField(id, value)` | Set by field ID; reject unknown or application-owned fields. `undefined` clears a value and prunes empty parents. Draft type/value errors remain visible and block final HTML export. |
| `override(id, patch)` | Merge permitted `{ text?, style? }` at a template-owned node. Text requires static literal parts and content permission; styles require an element with style permission. Empty styles are removed. |
| `clearOverride(id)` | Remove all overrides for that node. |
| `undo()` | Restore previous personalization and notify. Up to 100 snapshots. |
| `redo()` | Restore next personalization; a new edit clears Redo. |

## Voucher controller

`createVoucherBuilder(options?)` owns local controls for one fixed three-section Project, selection, clipboard, history, template choices and subscriptions. It defaults to a starter voucher and performs no storage or requests.

| Method | Behavior |
|---|---|
| `getProject()` | Isolated Project copy. |
| `subscribe(listener)` | Committed document notifications; returns unsubscribe. Separate from the debounced `onChange` prop. |
| `subscribeAction(listener)` | Typed action events after committed batches; returns unsubscribe. |
| `exportProject(options)` | Synchronous typed HTML/JSON result; the host chooses how to consume it. |
| `exportHTML(options?)` | Synchronous HTML string helper. |
| `exportJSON()` | Synchronous portable voucher JSON helper. |
| `importProject(input)` | Strict import result `{ project, errors, warnings }`; a successful import is an undoable replacement. |
| `destroy()` | Disconnect observers/timers and release subscriptions when a host-created controller is discarded. |

### Voucher document actions

Public document mutations record Undo automatically (50 snapshots). `transaction(edit)` groups synchronous changes into one Undo step and one document notification; nested transactions join the outer batch, and Promise results are rejected at every nesting level. Exceptions restore local document/editor state and suppress rolled-back events. Complete application work outside a transaction.

| Command | Behavior |
|---|---|
| `transaction(edit)` | Return the synchronous function result after a committed batch. |
| `getProject()` | Same isolated snapshot convenience as the controller. |
| `loadProject(project, options?)` | Validate supplied Project JSON and reset history by default. `{ history: 'record' }` makes replacement undoable. `preserveHistory` is deprecated. |
| `resetProject()` | Reset to a starter voucher through the document commands. |
| `updateSection(sectionId, patch)` | Patch section appearance/dimensions/content references. |
| `addBlock(sectionId, type)` | Create a localized default block in a section. |
| `removeBlock(blockId)` | Remove a subtree. |
| `removeBlocks(blockIds)` | Normalize selected roots and remove their subtrees. |
| `updateBlock(blockId, patch)` | Shallow block patch; ID/type are protected. Prefer focused content/settings helpers when merging those objects. |
| `updateBlockContent(blockId, key, value)` | Set one content key. |
| `updateBlockCommonSettings(blockId, patch)` | Merge common settings. |
| `updateBlockCommonSettingsMany(blockIds, patch)` | Merge common settings across selected blocks. |
| `reorderBlocks(sectionId, fromIndex, toIndex)` | Reorder section roots. |
| `duplicateBlock(blockId, sectionId)` | Clone subtree into section. |
| `duplicateBlocks(blockIds, sectionId)` | Clone normalized selected subtrees. |
| `moveBlockUp(blockId, sectionId)` | Move one position toward the start. |
| `moveBlockDown(blockId, sectionId)` | Move one position toward the end. |
| `addBlockToColumn(columnId, type)` | Insert in an existing child container. |
| `removeBlockFromColumn(columnId, blockId)` | Remove its subtree from that container. |
| `duplicateBlockInColumn(columnId, blockId)` | Duplicate within the container. |
| `moveBlockBetweenColumns(blockId, fromKey, toKey, toIndex)` | Move between containers; descendant targets are rejected. |
| `reorderColumnBlocks(columnKey, fromIndex, toIndex)` | Reorder a container's child IDs. |
| `moveBlockToColumn(blockId, sectionId, columnId, index)` | Move a section root into a container. |
| `moveBlockToSection(blockId, columnId, sectionId, index)` | Move a container child into section roots. |
| `resizeRow(blockId, columns)` | Columns must be integer 1–4; preserve retained children, remove truncated subtrees, add missing columns. |
| `resizeGrid(blockId, columns, rows)` | Each dimension integer 1–4; update cells and remove truncated subtrees. |
| `updateGlobal(patch)` | Shallow global patch. |
| `updateLayout(patch)` | Merge layout settings. |
| `updateColors(patch)` | Merge color settings. |
| `updateTypography(patch)` | Merge typography settings. |
| `updateMetadata(patch)` | Merge metadata. |
| `updateFrame(patch)` | Merge frame image/opacity. |
| `undo()` | Previous project snapshot. |
| `redo()` | Next project snapshot. |
| `pushHistory()` | Deprecated; public mutations already record Undo. |
| `copyBlock(blockId)` | Copy a subtree to the local document clipboard. |
| `cutBlock(blockId)` | Copy then remove. |
| `pasteBlock(sectionId)` | Instantiate clipboard with new IDs in a section. |
| `copyBlocks(blockIds)` | Copy normalized root subtrees. |
| `cutBlocks(blockIds)` | Copy then remove roots. |
| `pasteBlocks(sectionId)` | Paste all clipboard roots. |

### Voucher selection and view actions

These affect transient workspace state rather than persisted Project data. They do not make the document dirty or trigger document `onChange`.

| Command | Behavior |
|---|---|
| `setActiveSectionId(id)` | Change active section or clear with null. |
| `setActiveBlock(id, options?)` | Select one block; `{ additive: true }` toggles it in the multi-selection. |
| `setActiveBlocks(ids)` | Normalize/select multiple roots. |
| `clearActiveSelection()` | Clear active block(s). |
| `setFocusedBlocks(ids)` | Visual highlight without changing the editing selection. |
| `clearFocusedBlocks()` | Remove highlights. |
| `setShowRulers(show)` | Ruler visibility. |
| `setShowGrid(show)` | Grid visibility. |
| `setGridSize(size)` | Grid spacing. |
| `setSnapToGrid(snap)` | Snap preference. |
| `setDebugMode(debug)` | Debug overlays. |
| `setShowPreviewData(show)` | Preview-data visibility. |
| `setZoomLevel(level)` | Canvas zoom. |
| `setZoomMode(mode)` | `fit`, `actual`, or `custom`. |

### Voucher template library

Use `instance.templates` or `useVoucherTemplates()`. Template IDs are library identities; loading instantiates fresh project IDs. Choices are builtin, host-supplied or user-created in-memory JSON. Library changes are separate from Project Undo.

| Command | Behavior |
|---|---|
| `list()` | Isolated list copy. |
| `load(templateOrId)` | Instantiate, localize and load as an undoable document replacement; return Project. |
| `add(input)` | Add an in-memory user template; absent project uses the current document. Return the template and notify `onTemplateAdd`. |
| `update(id, patch)` | Update a user template or return null; invoke `onTemplateUpdate` on success. |
| `remove(id)` | Remove a user template or return null; invoke `onTemplateDelete` on success. |
| `replace(templates)` | Replace host-supplied choices with supplied JSON; no fetch or storage. |
| `exportJSON()` | Serialize user templates only. |
| `importJSON(input)` | Import a user-template JSON list and return imported/skipped/errors. |

All choices are in memory. Preload `config.templates` or call `replace()` when the host supplies another list. Export/import exchanges JSON; it does not establish a storage policy.

## Errors and host boundaries

Factories and parsers can throw before mounting. Document edits validate structural requirements; not every low-level voucher patch supplies complete semantic validation. Use strict import/schema boundaries for external JSON. `TemplateError` adds operation and issues; `VoucherBuilderError` adds operation/cause. Observer exceptions are reported and isolated. Application requests and their status/errors belong outside the component library.

See [host composition](INTEGRATION.md) for input/output ownership, loading and compatibility.
