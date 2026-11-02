# Build a template

Use `TemplateWorkspace` for module-bound authoring and `TemplateCreator` for the standalone editor. Both use the existing canvas, tree, inspector, quick picker, settings inputs and Undo/Redo. The **Insert block** picker is searchable and groups the built-in catalog with the template’s pinned reusable revisions.

## Choose the starting structure

| Group | Available building blocks |
|---|---|
| Content | Title, heading, paragraph, small text, quote, badge, link, button, image, divider, spacer, number, price, date, bulleted list, numbered list |
| Layout | Section, container, data table, one/two/three/four columns, sidebar + content |
| Structure | List item and table row, enabled when the selection has a compatible list/table ancestor |
| Dynamic | Repeating content and conditional content |

These are 28 **JSON presets** that expand into ordinary v1 nodes. They remain editable after insertion. A reusable block is different: it retains its explicit block ID/revision, property contract and named slots. Save a selected structure as a reusable block when future insertions should share that definition. Save enclosing lists/tables rather than isolated row/item definitions, because reusable instances render their own wrapper.

Select a primitive to edit its single text child directly in the inspector. More complex structures expose their children in the tree. Text values can be literal or bound, and number/currency/date formats keep their type checks. The source graph remains the authority; preview HTML is derived output.

## Configure columns

Select a column layout or one of its cells to use the existing settings controls:

- Choose one to four columns.
- Adjust a column’s percentage; the remaining columns rebalance proportionally.
- Set spacing and vertical alignment.
- Reduce the count without losing content: removed columns’ children move into the last retained column, in order. Undo restores the original structure and widths together.

Column presets use presentation tables for both document and email output. Widths, spacing and alignment are saved as normal element styles. Authors can nest columns, layouts and repeaters inside cells. Editing the table’s underlying structure can take it outside the recognized column preset; its ordinary HTML inspector remains available. Responsive stacking requires authored CSS today; the percentage controls do not imply a mobile stacking policy or email-client certification.

Selecting text keeps insertion in its surrounding content container. Incompatible structural parents are skipped: adding a paragraph while a whole list/table is selected inserts beside that list/table. Compatible structural presets find the correct list/table ancestor. Invalid direct table/list children are reported before HTML export, including content beneath transparent repeaters/conditions.

The same operations are available without React:

```ts
import {
  createTemplateCreator, createTemplateColumns, getTemplateColumns,
  getTemplatePresets,
} from '@nicolasvlachos/voucher-builder/template-creator'

const creator = createTemplateCreator()
const [layoutId] = creator.actions.insertFragment(createTemplateColumns([1, 2]))
const columns = getTemplateColumns(creator.getTemplate(), layoutId)!
const paragraph = getTemplatePresets().find(item => item.id === 'paragraph')!
creator.actions.insertFragment(paragraph.fragment, columns.columnIds[1])
creator.actions.setColumnLayout(layoutId, { widths: [30, 70], gap: 24 })
// The host owns consuming the JSON/HTML and disposing its controller.
```

## Bind content and links

Declare fields with stable IDs, typed schemas and dotted data paths. In module-bound templates use `facts`, `context`, `content`, `inputs` or `settings`. Keep application-owned voucher IDs, amounts and codes in `facts`; expose only selected `inputs` and presentation settings to customers.

For an action primitive such as `{ value: 'Book now', link: 'https://…' }`, declare `inputs.action.value` and `inputs.action.link` separately. Bind the text child to the value field. In **Link destination**, bind the destination field. The text and URL retain separate escaping/URL checks and independent exposure permissions. “Open in a new tab” also receives the renderer’s existing safe relationship attributes.

The Image preset starts as a repairable draft. Choose its asset in the inspector; the Laravel host’s existing media controls own uploads, retained IDs and preview/production URL resolution. A catalog item does not upload a file or grant access to an asset.

## Repeat and conditionally show content

Insert **Repeating content**, then choose an array field or edit its static JSON array. The field picker offers array fields. Each child can use a repeating-item binding:

| Binding | Meaning |
|---|---|
| `{ source: 'item', path: '' }` | The complete current item; works for strings, numbers, booleans and objects. In the editor, leave Item property empty. |
| `{ source: 'item', path: 'name' }` | A property of the nearest item. |
| `{ source: 'item', path: 'price.amount' }` | A nested declared property. |
| Nested repeat bound to `{ source: 'item', path: 'tags' }` | Repeat the current item’s array. Its children see each tag as their nearest item. |

Declared schemas validate paths and formats. Literal arrays have no separate item schema; nested item-bound arrays reach the runtime array checks. Empty arrays produce no children. Item bindings outside repeaters, malformed paths, scalar repeater results and incompatible numeric/date formats remain errors. The existing 1,000-items-per-repeat and 20,000-rendered-nodes limits remain in force.

For lists, put a repeater around list items; for tables, put it around rows inside a body. Duplicate an existing row/item, or insert the corresponding structural preset, to retain valid HTML wrappers. Conditions are transparent too: their children must still fit the surrounding HTML container.

`TemplateWorkspace` selects shared compilation in its raw draft and export when the graph needs repeats, conditions, structured bindings, dynamic block properties or runtime formatting. Structural family declarations also reserve shared compilation so future variants can use those capabilities. A document already configured as shared stays shared. The explicit `exportBindingDocument()` API remains strict; programmatic callers choose `exportSharedTemplateDocument()` when needed.

Configure Laravel’s bounded shared JS worker before publishing these dynamic templates; see the [module integration guide](laravel-module.md). Fixed layouts still render in PHP from their validated HTML binding manifest. No template executes Blade or arbitrary JavaScript.

## Extend the palette from any backend

Supply `insertPresets` to `TemplateCreator` or `TemplateWorkspace`. Omit the prop for the default catalog; use `[]` to expose only existing reusable revisions. To extend the catalog, append to `getTemplatePresets()`:

```tsx
import {
  TemplateCreator, TemplateNodeSchema, getTemplatePresets,
  type TemplateInsertPreset,
} from '@nicolasvlachos/voucher-builder/template-creator'

const customerHeading: TemplateInsertPreset = {
  id: 'customer-heading', name: 'Customer heading', category: 'Customer blocks',
  description: 'Uses a field declared by the receiving template.',
  fragment: { roots: ['heading'], nodes: {
    heading: TemplateNodeSchema.parse({
      id: 'heading', name: 'Customer heading', kind: 'element', tag: 'h2', children: ['copy'],
    }),
    copy: TemplateNodeSchema.parse({
      id: 'copy', name: 'Heading text', kind: 'text',
      parts: [{ value: { source: 'field', fieldId: 'customerName' } }],
    }),
  } },
}

export const Builder = ({ definition }: { definition: Parameters<typeof TemplateCreator>[0]['initialTemplate'] }) => (
  <TemplateCreator initialTemplate={definition}
    insertPresets={[...getTemplatePresets(), customerHeading]} />
)
```

The same shape can arrive as backend JSON. The host adapts its catalog response; the component knows no endpoint. Insertion validates tree ownership, remaps node/child/slot IDs on every copy and commits one guarded history step. It keeps field, asset and pinned block references intact: those dependencies must exist in the receiving template. Presets carry no hidden settings, CSS registry, tenant permissions or media grants. Use existing block-library/resource APIs for dependency-complete reusable definitions.

Existing voucher-specific SVG/QR renderers are not automatically template node types. For the shared HTML contract, supply a retained generated image or a supported serializable HTML graph. The original voucher workspace remains available for its specialized fixed-page features.

## Adopting the update

No database migration or document-version change is needed. Ship the updated JS package/worker and the Laravel module’s two bundled core schemas together: the additive empty item path must be understood on both sides. Existing nonempty item-property paths retain their meaning. The executable Laravel fixtures cover fixed columns/actions and grouped nested repeats through the real built compiler.
