# Themelia UI integration

The component UI requires **themelia-react-ui `^2.0.5`**, **React 19**, official **`@base-ui/react ^1.9.0`** and **Lucide React 1**. The npm development lockfile is pinned to Themelia 2.0.5. Development and verification use Node 24. UI owners style the local composition tools; plain JSON contracts and pure HTML/CSS outputs remain separate from workspace chrome.

## Host setup

Declare `themelia-react-ui` in the host dependencies to satisfy the builder's `^2.0.5` peer dependency. Install with `npm install 'themelia-react-ui@^2.0.5' '@base-ui/react@^1.9.0'`. Remove older private Base UI archive pins or overrides before refreshing the host lockfile. The host controls and builder must share one resolved Themelia installation so their provider context is shared. Keep aligned peer versions; `npm ls themelia-react-ui @base-ui/react` helps detect duplicate installations.

Mount one `UIProvider` at the application root. Reuse an existing Themelia provider instead of adding a provider around each workspace. Workspaces remain usable with Themelia's fallback display defaults, but an explicit application boundary makes formatting and density deliberate.

```tsx
import { UIProvider } from 'themelia-react-ui/ui-provider'
import { TemplateCreator } from '@nicolasvlachos/voucher-builder/template-creator'
import '@nicolasvlachos/voucher-builder/styles.css'

export function App() {
  return (
    <UIProvider config={{ typography: { defaultTextSize: 'sm' } }}>
      <TemplateCreator />
    </UIProvider>
  )
}
```

The required `@nicolasvlachos/voucher-builder/styles.css` stylesheet includes compiled Themelia styles, the default neutral theme, Tailwind base/utilities and application canvas geometry. Import it once before host overrides, even when the host already imports Themelia styles; that host import does not supply the builder's workspace geometry. No consumer source scanning is necessary. Do not add another Themelia stylesheet import solely for these components. A host that already uses Themelia can keep its own theme overrides after this stylesheet. See the complete [typed host examples](../examples/react-workspaces.tsx).

`UIProvider` supplies stable display defaults. Controllers/hooks own local editing, selection, history, contract validation and synchronous HTML/JSON output. The host supplies input and consumes changes/exports through its own infrastructure. The library has no save, publication, PDF, storage or network orchestration. Use the [template API](TEMPLATE_API.md), [voucher API](API.md) and [host composition](INTEGRATION.md) for those contracts.

## Component ownership

The template canvas has a purpose-made element frame and compact contextual controls. These are editor drawing geometry, rendered above the iframe rather than around authored HTML elements. Table rows/cells retain their original layout, and output never includes the frame, labels or commands. Themelia continues to own workspace panels, forms and confirmation dialogs. Creator commands remain undoable and family guards remain authoritative; personalization offers navigation without structural commands.

Selection uses a rounded dashed border with 8px of editor-only breathing room around the rendered element. Its colours come from Themelia: `muted-foreground` for the boundary, `muted` for the floating toolbar, `primary` for emphasis, and `ring` for keyboard focus. Radius and toolbar elevation use the existing `radius` and `shadow-md` tokens. There is no separate selection palette. Selection padding never changes authored layout or enters exports. Hover and pressed effects respect pointer capability and reduced motion preferences.

For a standalone `TemplateCanvas`, `selectionActions` accepts a React node for host-supplied contextual controls and `selectionDescription` explains structural restrictions. Both props affect editor chrome only. The host owns action permissions and callbacks. Repeated render instances have separate boundaries and one toolbar; nonvisual conditions/repeaters use the union of their visible descendants, or an identity bar when none render. Arrow keys/Home/End navigate enabled toolbar commands.

| Responsibility                                                               | Owner                                                                                                                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Document identity, one main command, ordered secondary commands and overflow | `Page` from `themelia-react-ui/layout/page`                                                                                                  |
| Creator work areas and tools                                                 | Default: Page tabs and native OverflowTabBar; compact: Properties/Structure plus the native Editor tool Select                             |
| Docked canvas, inspector tracks, paper scaling and iframe selection          | Application workspace geometry; the generic WorkspaceLayout's hidden rail does not fit the two required editing panels                       |
| Passive rows, columns and peer spacing                                       | `Stack` / `Grid` from `base/structure` with semantic gap props                                                                               |
| Hierarchical structure navigation                                            | `Tree` from `base/tree`, controlled selection/expansion and reveal of selected ancestors                                                     |
| Flat section / field selection                                               | `ListRadioGroup` from `base/choice-inputs`; native radio semantics, one selected target                                                      |
| Field labels, validation copy and settings sections                          | `FormField`, `FormSection` from `base/forms`; flat `Card` sections                                                                           |
| Text drafts and finite choices                                               | `Input`, `Textarea`, `Select`, `ToggleField`, `PillRadioGroup`, `ListRadioGroup`, `Checkbox`, `Switch`                                       |
| Numeric drafts and CSS dimensions                                            | `DecimalInput` plus `Select`; a CSS dimension can include auto, percent, em and rem, unlike a physical width/height/depth tuple              |
| Colors and ranges                                                            | `ColorInput`, `SliderField` from `base/value-inputs`                                                                                         |
| Image files and existing URLs                                                | `ImageUpload` from `base/upload` plus `Input`; the app reads the selected file into the existing document format and aborts superseded reads |
| Icon/block search and command selection                                      | `Command` and its input/list/group/item owners                                                                                               |
| Popups, menus and tooltips                                                  | Public `base/popover`, `base/navigation`, `base/display` families                                                                            |
| Retained setting and inspector disclosures                                   | Native `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `base/accordion`, with `keepMounted`                         |
| Dialogs, confirmation and narrow voucher panels                              | `ActionDialog`, `ConfirmDialog`, `ActionDrawer` from `features/overlays`                                                                     |
| Empty, loading, error and validation feedback                                | `EmptyState`, `LoadingState`, `ErrorState`, `Alert`, FormField errors                                                                        |
| Copy and badges                                                              | Themelia `Heading`, `Text`, `Badge`; neutral badges identify revisions, semantic tones indicate actual status                                |

Internal voucher adapters retain established settings callback shapes: numeric values normalize to strings only for presentation, one-thumb arrays adapt to scalar sliders, and legacy Button variants map to Themelia tone/style/size props. These are private migration seams, not new public APIs. New UI should use exact Themelia family imports directly.

The creator remembers the active tool in each work area. Tool panels stay mounted when hidden so switching groups preserves invalid drafts, validation and disclosure state. Configuration tools retain the contextual selected-element inspector. The **Customer and family access** disclosure starts collapsed and preserves its controls when closed. Family variants without structural controls use the same navigation/content/preview/settings panel geometry; appearance and access stay in persistent disclosures.

Block library entries use `Item` content rows rendered as native buttons, so descriptions can wrap without a fixed button height. Keep media and copy on the same row with layout-only `flex-nowrap`; the Item owner supplies its typography and density. Saved snippets use the same row treatment. Empty search feedback considers both block definitions and snippets. Drag previews also use Item rather than a separately styled miniature row.

Original voucher template entries use native `ItemGroup` and `Item` media/content/title/description parts, with a compact portrait preview, source badge, Use action and user-entry maintenance menu. Portrait thumbnails show the complete document; fixed dimensions belong to preview geometry. A category Select keeps many categories usable in a narrow dock. Adding the current voucher creates an in-memory library entry; import/export exchange JSON. Add/edit dialogs place Cancel and the primary commit in the ActionDialog footer. Search/filter empty states provide a clear action.

Voucher FieldShell gives a single control a stable ID, visible native label and described-by supporting text. Reset actions are siblings of labels. Composite controls share the group label/help without reusing one ID on multiple inputs. The FormField supporting-copy wrapper must not receive that control ID: its direct child is a Stack, and FormField would clone the ID onto that wrapper. In-place rich text needs explicit label activation because a contenteditable element is not a native labelable input. Creator advanced settings and collapsible voucher setting groups use native Accordion anatomy and `keepMounted` content. Existing fields retain invalid drafts when collapsed; voucher groups mount their fields on first opening and then retain them. Inline setting groups use a flat, unpadded Card under the inspector’s inset owner. Stack owns related field spacing.

The inline voucher rich-text editor remains application-owned because it edits an existing sanitized document node in place and commits one change on blur or Enter and cancels with Escape. Its toolbar uses Themelia buttons, stays inline for form fields so keyboard focus remains inside drawers, and floats only over the canvas; link entry uses ActionDialog and restores the saved document selection after dismissal. Its form frame consumes public control roles (`rounded-radius`, `border-input`, control text inset, provider size and the one-edge/three-pixel focus halo); it has no editing-only border or radius. The public full RichTextEditor has built-in formats that the voucher sanitizer does not retain and no public format-removal/custom-editable-renderer seam. Its separately exported RichTextEditorToolbar does support custom buttons; its embedded frame and selection lifecycle differ from this floating editor. See the [specific contract comparison](UI_COMPLIANCE.md#application-boundaries-and-retained-warning). This is a named application-owned editing exception; ordinary fields use Input/Textarea.

The standalone preview defaults to the compact dock; use `layout=default` to inspect the public three-pane default. It accepts `?theme=dark` and `?workspace=voucher&theme=dark`. Add `density=sm` to verify provider size inheritance. Add `geometry=scaled` for a demo-only stress profile: radius 24px, spacing scale 0.8 and density scale 0.875. These parameters configure the demo boundary, not the public workspace API.

The original voucher’s document settings use a native task selector for **Layout**, **Appearance**, **Document details** and feature-gated **Sample values**. Switching tasks retains mounted controls. Empty documents expose one insertion/template action. On wide layouts Preview and Export lead the header; below Page’s 40rem command-overflow threshold, an app-owned command row keeps the same eligible actions visible. The native Page menu retains the remaining commands. Library and inspector fields keep the same portal host across native drawer dismissal and responsive docking.

Palette controls display authored document colors supplied by the current template/family or actual voucher instance. They do not borrow an unrelated fallback voucher or application theme palette. Recent colors remain an in-memory editing preference. Application chrome and output colors have separate responsibilities.

## Theme and layout boundaries

Each workspace uses `ThemeScope` so menus and overlays inherit the same light/dark theme as their trigger. Explicit light mode also works inside a dark host. Voucher direction additionally uses `DirectionProvider` alongside the document's direction. ThemeScope does not add a second UIProvider.

Use semantic foreground/surface/status variables. Change shared geometry at the theme boundary (`--radius`, `--height-action`, `--height-control`, `--surface-x`, `--surface-y`, `--space-scale`, `--density-scale`), following the installed token reference. Use public size/density/inset props for local choices. Do not override button, input, menu or tab padding, typography, focus rings or corners with local CSS.

Application CSS owns track widths, placement, overflow and actual document geometry. The Page's first structural child participates in the bounded workspace height; it retains the owner's header/body gap and gutters. Template Creator, Editor and the fixed-layout family workspace use Page `gutter="md"` / `padding="md"`; the original voucher keeps its deliberate `sm` page gutter/inset. Inspector subjects use the normal 24px surface inset. On narrow template embeddings the same mounted panels stack in document order. The voucher workspace moves its single library/inspector instances into ActionDrawer. Its documented `contentClassName` region is flush (`p-0`) because those embedded panels already own their gutters; drawer headers retain the native overlay inset. No hidden desktop-only editing control is required to finish a document.

The preview paper has an intentionally white fallback independent of chrome. Authored background/colors, millimetre dimensions, document typography, scaling and selection annotations belong to the document engine. The advanced template CSS/JSON text areas retain code-oriented typography; ordinary form fields use the shared control recipe. These drawing/editing responsibilities are distinct from UI branding.

## Selection, borders and color roles

The shipped chrome uses Themelia's neutral default theme. A host can opt into a brand stylesheet after the bundled CSS. Status tones remain reserved for errors, warnings and actual status; authored document colors are independent of workspace theming.

The hierarchical Structure panel uses Tree. Flat section and field lists use ListRadioGroup, with its native radio marker, descriptions, exclusive selection and arrow-key behavior. They do not have artificial expansion affordances or a duplicate Active badge. Fields mode hides stale element selection and disables layout insertion; its canvas is a sample-data preview. Clicking an element returns to Structure editing. The voucher section choice identifies the active insertion target with height and block count. Its layer list follows that section. Editable layer rows use Item with its supported muted treatment for selection; only hierarchy indentation is application geometry. Text buttons retain space for names, and menu commands use icon-only buttons. Selecting a section clears block selection and returns the inspector to section settings; adding a block uses that active section. Canvas groups also accept Enter/Space while focused.

Canvas annotations are application drawing affordances, not form focus recipes or authored borders. Hover and selection use padded, rounded dashed marks; labels and contextual controls identify the selected target. Selecting a block suppresses the enclosing section's selected mark. Paired primary/primary-foreground edges remain legible over artwork in both themes. Voucher selection strokes and section captions retain screen size as the paper zooms, keeping them usable on narrow canvases. The selected mark sits outside the artwork clip with a counter-scaled 4px inset and rounded corners; authored section corners remain part of the document. Captions use native Badge geometry on an opaque semantic background so they remain legible over white paper in dark mode; the drawing wrapper owns placement, counter-scaling and a root-based background corner, without overriding Badge anatomy. Print/export output does not include these application marks.

The template canvas draws selection in the parent workspace above the annotated iframe. Changing selection keeps srcDoc and the iframe document stable, preserving scroll and loaded resources. Preview scrollbars remain hidden while wheel, trackpad and keyboard scrolling stay available. Bounds update after loading, document resize and canvas scaling; repeated instances receive matching marks. The pure renderer's optional selectedNodeId preview contract remains available to backend consumers.

One outer workspace boundary and the dock boundaries separate regions. Selection does not recolor those dividers or editable field frames. Numeric companion fields receive an application-owned width wrapper so their slider siblings retain usable tracks; the SliderField owner retains its thumb, focus, keyboard and validation behavior.

## Geometry and control policy

The default theme has two corner roles: controls, rows and nested bodies use `rounded-radius` from the 12px `--radius` root; outer cards, popups and shells use `rounded-surface`, four-thirds of that root (16px by default). `rounded-inner` is removed in 2.0.5. Badge and circular radio/swatch indicators have intentional native shape mechanics. Equal roles move together; forcing every object to one radius would violate the component contract.

Ordinary inspector regions and independent resource Cards use the normal 24px surface inset. Native Item rows keep their own row density. Themelia 2.0.5 defaults Card to the calmer `card` surface, an unruled header and a ruled footer; explicit `framed`, divider and provider overrides remain available. Card padding tiers are 12px (`sm`), 24px (default) and 32px (`lg`). Flat setting Cards delegate their inset to the inspector and own only their header/body rhythm. Stack/Grid own sibling gaps. Panel geometry multiplies the public spacing roots once, so changing `--space-scale` also moves the workspace gutters. A collapse action does not add padding around the entire heading. The one compact surface is the floating canvas rich-text toolbar: Card `padding="sm"` deliberately gives its action strip a 12px inset. This is the composition checker's retained `compact-card` warning in `src/voucher-builder/ui/rich-text-editor.tsx`; it is intentional toolbar geometry, not a subject card default. The floating placement uses intrinsic width and disables Card query containment through its public style prop, since this action strip has no responsive card-header layout. This avoids stretching a toolbar across the viewport while keeping Card padding, corners and elevation native.

Button and choice adapters inherit the provider scale when no explicit local size is needed. Reset, drag and disclosure actions can use the supported small icon-button preset. Alignment and border styles use PillRadioGroup; shadow enable/inset and linked sides use ToggleField. Native disabled props block editing, instead of dimming an interactive wrapper. Four-sided spacing is stored and shown in pixels; its former unit-cycling label did not convert the data and was removed. Linking sides writes one explicit value to all sides; an external unequal update unlinks the presentation.

Image controls share ImageUpload for both frames and content. Lists expose removal actions without hover and do not show a drag grip unless reordering exists. Sortable inspector collections have named native buttons and pointer/keyboard sensors. Typography checks use Card, Badge and Alert instead of independently styled capsules, borders and status washes.

For visual review, compare these expected token-derived measurements (16px root font), then inspect clipping and focus in screenshots:

| Demo profile      | md control | sm control | Surface radius | Control radius | Normal surface inset |
| ----------------- | ---------- | ---------- | ------------ | ------------ | -------------------- |
| Default           | 32px       | 28px       | 16px           | 12px           | 24px                 |
| `geometry=scaled` | 28px       | 24.5px     | 32px           | 24px           | 19.2px               |

Open selects, palette popups and drawers in each theme; check the popup's surface as well as its trigger. Change density independently from spacing. Verify narrow and long-content layouts, input/Select/button alignment, keyboard section changes, disabled controls, disclosure state and selected document bounds. Passing a source check alone is not visual acceptance.

Single-field flat inspector groups omit a duplicate heading when their title matches the field label. Group descriptions and collapsible sections retain their context, and conditional groups disappear when no fields are visible. Content-only child inspectors filter individual settings fields even when a definition mixes content and style in one group. Inline switch/checkbox fields retain their adjacent reset action outside the label. Template Input and Textarea drafts share Escape cancellation; Enter still inserts a line in multiline fields.

## Agent skills and scripts

The canonical capabilities are [themelia-components](../.agents/skills/themelia-components/SKILL.md) for setup and typed APIs, [themelia-tokenization](../.agents/skills/themelia-tokenization/SKILL.md) for themes and shared geometry, [themelia-composition](../.agents/skills/themelia-composition/SKILL.md) for hierarchy and responsive regions, and [themelia-design](../.agents/skills/themelia-design/SKILL.md) for reading records, ranking information and critiquing rendered views. They share the complete [consumer bundle](../.agents/skills/themelia-react-ui-consumer/SKILL.md), including references, scripts, examples and domain templates. The same five sibling directories are copied into package-local `.agents/skills` and `.claude/skills`. The marked block in [CLAUDE.md](../CLAUDE.md) points agents at the installed package's declarations and scripts. Keep app policy in this guide, outside the package's copied guidance.

```bash
npm run setup:ui
npm run check:ui-skill
npm run test:ui-skills
node node_modules/themelia-react-ui/docs/consumer-skill/scripts/find-components.mjs Workspace --limit 3
node node_modules/themelia-react-ui/docs/consumer-skill/scripts/inspect-component.mjs OverflowTabBar --import themelia-react-ui/base/navigation
node node_modules/themelia-react-ui/docs/consumer-skill/scripts/inspect-tokens.mjs surface --limit 8
node node_modules/themelia-react-ui/docs/consumer-skill/scripts/map-composition.mjs --roles
node node_modules/themelia-react-ui/docs/consumer-skill/scripts/pin-button-defaults.mjs src
npm run check:ui
npm run check:ui-audit
npm run lint
npm run verify
```

`setup:ui` resolves the physical installed package and uses its official complete-bundle copier, including rebased links and templates. Each project destination contains five skill directories and 81 assets. Differing managed copies and obsolete foundation/forms skills move to `.cache/themelia-skills-backups`, outside skill discovery; unrelated skills stay in place. Repeated setup is supported and replaces the exact versioned contributor block only when needed. `check:ui-skill` verifies both destinations, every expected asset and the contributor block. `test:ui-skills` exercises setup, repeat runs, stale/missing content and safe backup behavior in isolated fixtures. An upgrade requires refreshing the complete bundle and reading the new declarations.

For an explicitly requested alternate destination, `THEMELIA_SKILL_DIR` names the full shared `themelia-react-ui-consumer` directory; the complete bundle is copied as siblings in its parent directory. Global publication requires a user request. Normal project setup writes only the two project destinations.

The finder selects exact public imports, declarations, optional peers and relevant recipes. Inspectors resolve exact component contracts and supported token roots; the mapper suggests cooperating owners and surfaces. Installed declarations remain authoritative. The button-default script is intentionally report-only here: untoned actions should stay neutral rather than converting every action into a primary. Its proposed pins are not migration errors. Review DnD/ref/handler spreads manually. Do not run `--write` indiscriminately.

`check:ui` resolves source imports from the browser, public UI entries and seven supplied React consumer examples, then runs the package’s unmodified composition checker on reachable UI modules. Tests, unused scaffolding and authored document renderers are excluded. The former shadcn generator configuration is removed; new work follows the installed Themelia consumer skill. `lint` runs this same UI policy; TypeScript separately checks source/tests. The supplemental policy also inspects recognized callback adapters for control radius, inset, size and state overrides, and rejects library anatomy/state selectors in application CSS. Dynamic props and named application drawing/editing exceptions still require rendered review. The checker cannot establish visual or interaction correctness.

Only the bundled consumer scripts are app commands. The Themelia repository's build, catalogue and release scripts do not ship in its npm package and are not consuming-app checks. Optional peers are installed for the forms, value-input and upload families used here; maps, charts and Tiptap are not required by this application UI.

## Keyboard ownership and compound controls

Voucher keyboard events are scoped to their owning workspace, including nested embeds. Handling runs after local React prevention, and modal/menu/listbox commands, composition input and native editing retain ownership. Shift+Z uses the browser's uppercase key value; question-mark help works with Shift+/. Keyboard and block-menu deletion share a native confirmation and remain undoable. Shortcut help reflects UI features and read-only mode. Dimension controls receive field-specific names/shared supporting text; native controls retain geometry and states.

## Source compliance record

The [component and contract review](UI_COMPLIANCE.md) maps every reachable UI file, JSX use, public import family and application CSS rule. Its machine inventory and manually authored hash-bound ledger are checked with `npm run check:ui-audit`, also included in `verify`. Regenerating the inventory does not approve a changed file. Read the named rich-text/drawing boundaries and rendered-state limits before interpreting a clean result.

Creator assets and reusable blocks use normal native Cards: version/kind belongs in titleSuffix, maintenance commands in actions, and insertion in footerSlot. Discovered CSS classes use native Item rows; provided personalization values use MetadataList. Shortcut keys use native Badge geometry inside semantic kbd wrappers. Row widths and grid heights use separately named native sliders without reusing one group ID. Code Textarea height uses rows rather than a CSS minimum.

Block definition editing uses native ActionDialog, Card command slots, FormField, Select, Input and commit-aware JSON controls. It creates a new revision instead of altering pinned instances. Property defaults/omission and slot assignment are application contracts; native controls own their appearance. Personalization's stable Customization target Select supplies a keyboard path to permitted text/style controls. Optional collection Clear actions omit values explicitly. Field rows subscribe through the focused data hook and memoize independently of selection changes.

## Context before composition

For each view or domain component, record its incentive and essence: whose decision it supports, the actual data and authority involved, and the next action. Read typical, large, exceptional and empty records; distinguish supplied fixtures from production evidence. Rank must/should/could/omit information, identify one focal point, and sketch narrow/wide reading order before selecting owners. Inspect fitting domain owners and their public parts, then explain any application-specific relationship that remains. Do not adopt a component merely because its name resembles a domain term.

Use native controls and semantic tokens for composition. Preserve draft state, field exposure, family inheritance, host transport boundaries and the authored HTML contract. Source inventory, behavioral regressions and rendered critique answer different questions: none substitutes for the others.

## Verification

Use [the release workflow](MAINTENANCE.md#verification-and-release). Verify desktop/narrow embeds, light/dark portals, long titles, menu keyboard navigation, Escape/focus restoration, invalid drafts, empty collections and local import/export. Regressions cover field semantics (including false/empty enums), mounted document state, Undo, contract-review navigation and observer ownership. Voucher notifications are provider-scoped Themelia alerts; errors remain until dismissed and transient notices expire after four seconds.

Settings regressions also check native label targets, supporting-copy associations, unique IDs across repeated/compound controls, checkbox activation and disabled labels. The creator regression checks that collapsing/reopening advanced settings retains invalid JSON and its validation state. Personalization array cards use the public Card `headerClassName="flex-nowrap"` layout seam for their short numbered title and named icon action. Inspect library descriptions at dock widths, category/action popups, definition dialog footers and field labels; long content should scroll inside its intended panel.

The template picker consumes preloaded JSON and local library commands. The host supplies its own input-loading UI outside the component. Test imports, add/update/remove and source replacement without a transport or browser storage.

App and library builds both replace dist. Finish with `build:package`; the source typecheck intentionally does not depend on dist, while `check:examples` checks the built consuming-package declarations separately. The reusable-block contract pass adds a sixth wire artifact and optional property metadata; see [compatibility guidance](TEMPLATE_API.md#reusable-block-workflow) before updating frontend/backend validators.

Current 2.0.5 review status: the upgrade and contextual source changes have focused regression evidence, but the final rendered 390/1440 light/dark pass is pending access to the unlocked Mac session. Earlier screenshots describe their dated builds; they do not certify this revision. Record fresh appearance/interaction results and any unverified states separately before claiming visual acceptance.
