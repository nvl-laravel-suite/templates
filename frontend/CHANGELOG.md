# Changelog

All notable changes to this project are documented here. Format loosely based on [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Family review consumer workflows

- Initialize family actions from the loaded draft, restore the saved operation and exact target when resuming a review, and preserve the review panel during reloads. Distinguish draft basis from published membership; a successful publication updates the panel immediately while retaining newer local edits.
- Show authorized previous, local and target conflict values with bounded Unicode-safe previews, explicit missing/empty states and type cues where values differ in type. Property conflicts can supply concise values alongside their complete diagnostic basis.
- Use native text labels for conflict choices and the email target when applying preview themes. Email compatibility errors block applying an invalid preview; warnings and absent runtime sample values do not.

### Runtime and dependency maintenance

- Preserve multi-byte customer text when the shared worker receives split stdin chunks; retain its UTF-8 byte bound. Add real-worker transport regressions to the package verification sequence.
- Require patched Zod ^4.6.6 and lock the compatible fast-uri3.1.9 transitive patch. Regenerate the revision/render-input schemas: publishedAt requires UTC timestamps including seconds, matching JSON Schema date-time validation; minute-only timestamps must be normalized by the host.

### Fixed export contract parity

- Export `requiresSharedCompiler` from `/template-renderer` so hosts can select the existing fixed or shared exporter before creating a document.
- Reserve authored content-schema keys when generating managed image references, preserving existing content values and constraints even when they use names such as `asset_logo`.
- Keep newly compiled managed-image IDs authoritative when recompiling a remapped draft, while retaining authored content/references and explicit field-backed image overrides.
- Route optional non-image attribute bindings to shared compilation and reject them in explicit fixed export. Shared rendering preserves absent-value fallbacks; required attributes, optional text and the fixed managed-ID image adapter retain support. Re-export affected drafts with the shared worker and publish a new revision to update historical fixed publications.
- Preserve authored token-shaped output literals by selecting shared compilation and rejecting fixed export for those sources. Scan output-capable title/style/attribute/text/block values; unused metadata and declared subject/plain-text token bindings retain their existing behavior.

### Themelia2.0.5 and contextual workspaces

- Pin development to Themelia2.0.5 and require the shared `^2.0.5` peer. Refresh the entire project agent bundle in `.agents/skills` and `.claude/skills`, including the new design skill and designer agent; preserve previous copies outside discovery.
- Record each view/domain owner, its purpose, data authority and chosen structure. Include all seven React consumer examples in composition/audit scope while retaining the library's transport boundary.
- Default the local demo to the compact dock, with `layout=default` for the three-pane comparison. Public component defaults remain unchanged.
- Prioritize selected content ahead of metadata and group structural commands in the native Element actions menu. Add optional `initialPanel` and `inspectorTitle` host-tool hints without resetting existing editing sessions.
- Report retained invalid drafts truthfully. Review opens the relevant tool, native disclosure and mobile editing drawer, preserving and focusing the same field. Email asset entry offers only PNG/JPEG/GIF and rejects inferred WebP before adding it.
- Make family variation entry useful immediately, distinguish inherited/custom values, retain declaration drafts in native Accordions, separate resource pins from media mapping and present exclusive family changes with native controls.
- Organize voucher settings into Layout, Appearance, Document and Sample values; use native Item template rows, clear empty insertion actions and visible narrow-screen Preview/Export. Retain docked field identity and keyboard focus through resizing and closure; name table cells uniquely.
- Scope document palettes to the actual authoring theme. Keep palette actions beside their fields, migrate the removed corner alias and draw voucher selections with padded rounded dashed semantic-token cues.


### Native accordion sections

- Inspector and collapsible settings sections now use Themelia's native Accordion, including its compact title typography, full-title trigger, chevron and keyboard behavior.
- Collapsed settings retain unfinished values after first opening. Validation badges and independent reset/remove actions remain available.

### Optional compact template layout

- Add `layout="compact"` to TemplateWorkspace, GroupVariantWorkspace, TemplateCreator and TemplateEditor. The existing three-pane arrangement remains the default. Compact authoring combines Properties, Structure and a More tools selector in one right dock; tree selection stays in Structure until Edit properties, while canvas selection opens Properties.
- Move the higher-level workspaces' mode controls into the canvas toolbar in compact mode. Preserve host header commands and controlled-mode behavior. Low-level Creator/Editor accept `canvasControls` for host toolbar content.
- Consolidate personalization into Values/Appearance and fixed-layout family variants into Content/Settings. At embedding widths up to 760px, expose the same controls in a native Themelia Editing tools drawer with trigger focus restoration. Preserve visited forms, invalid drafts, tree expansion, selection and Undo across tool/drawer switches; document contracts, rendering and persistence responsibilities remain unchanged.

### Themelia 2.0.4 and editor navigation

- Upgrade the shared Themelia peer requirement and development pin to 2.0.4 with official Base UI ^1.9.0. Follow its calmer Card defaults and 12/24/32px padding tiers; default control sizes and radius roles remain unchanged.
- Group creator tools under Build, Library and Setup with native tool tabs, per-group selection and mounted panels that preserve invalid drafts. Keep contextual inspection during configuration; disclose customer/family access separately and align family content, preview and settings panels.
- Copy the official canonical/shared skill bundle into both project agent destinations, including templates and rebased references. Archive obsolete managed skills outside discovery and add `test:ui-skills` setup regressions. Existing release artifacts and host deployments are outside this update.

### Browser CSS runtime

- Ship a standalone PostCSS browser runtime and resolve the package's browser imports through it. This removes Vite development warnings from disabled Node filesystem, path, URL and source-map imports without console filtering or consumer aliases. Existing Node entries and renderer files remain unchanged.
- Build the browser asset and third-party license notices separately in `dist-browser`; demo and package builds retain their existing `dist` behavior. Add a real Vite dependency-optimization regression for all ten entries, CSS parsing/errors and matching document/email output, with original Node/SSR resolution preserved.

### Host workspace composition

- Add reactive `previewSettings` to both workspace wrappers. Sample appearance updates canvas and customer-control defaults without remounting, resetting Undo, or persisting sample values. Local personalization overrides take precedence and Reset reveals the current baseline. Invalid or unexposed samples report a recoverable alert. Hosts merge sample values and local overrides per key for preview/send.
- Correct the Laravel host examples to overlay nested sample inputs and per-key settings, retain explicit null/false/zero values, and forward sample appearance to both workspaces. Staff can switch a family variant into customer preview; explicit customer mode stays controlled. A new or failed server preview clears the previous result, and retry can replace it.
- Add `TemplateWorkspace.allowTargetChange` (default true) so hosts can hide the output selector while preserving the loaded target. Both workspace wrappers expose native header slots and heading level for lifecycle status and embedded headings.
- Use the compact native Themelia radio group consistently for authoring/personalization and variant/customer modes. Controlled mode, draft data and undo history remain unchanged.
- Share the host's Themelia installation through peer `^2.0.1` rather than installing a second fixed copy. Development remains pinned to 2.0.1; the consumed public controls and header APIs also match 2.0.3. Keep importing the builder stylesheet once.

### Laravel preview and media

- Add `previewHtml` to staff preview HTTP responses. Optional `include_inline_assets` defaults to true; false returns `inlineAssets: []` while preserving the other delivery fields. The example repository opts out of duplicate attachment bytes and displays `previewHtml ?? html`.
- Retain and deduplicate only assets referenced by final HTML image CIDs. All candidate assets still require authorization and checksum validation; stored documents and dependency pins stay unchanged. Document output continues embedding retained images as data URIs.
- Bound the complete serialized render, including inline asset bytes, with `limits.output_bytes` (10 MiB by default). Bound the exact preview JSON response envelope with `limits.preview_bytes` (8 MiB by default); exceeding it returns HTTP 422 with `errors.preview`.
- Paginate retained images in the Laravel reference tools, preserve valid selections while paging, and discard superseded list/upload results. Consume optional target-specific MIME capabilities and asset queries; email picker/upload controls exclude WebP, including on older servers.
- Allow the reference repository's optional third options argument to configure `maxResponseBytes` from injected server metadata. Preserve the 8 MiB success default, exact UTF-8 byte boundaries, legacy calls and independent 32 KiB error cap. The main host accepts options fourth after its CSRF argument.

### Preview chrome

- Add dedicated editor-only selection chrome with a rounded dashed boundary, 8px of preview selection padding, a softly raised action bar, parent navigation and canonical undoable commands. Selection colours, radius and elevation use Themelia semantic tokens. Logical containers use their visible descendants; repeated instances share one toolbar that stays available while scrolling. Managed structure exposes navigation without generic structural actions. Remove commands confirm and restore focus; no frame or controls enter authored HTML, CSS or exports.
- Hide preview scrollbars while retaining wheel/trackpad and keyboard scrolling; whole-document sizing includes the outer email wrapper and rounds up fractional heights.
- Coalesce iframe document resize-observer measurements into one animation-frame pass while retaining a forced immediate measurement on load. HTML replacement synchronously disposes the old document's observer, queued measurements and handlers before the next load; equal-HTML rerenders retain the binding. Cleanup is idempotent and also cancels queued work on reload/unmount. Avoid publishing state when measured geometry is unchanged. Sizing formulas and authored HTML/CSS are unchanged.
- Use the native compact mode selector for Design and Personalize. Preview-only scroll rules never enter exported HTML or saved source.

### Email profile

- Add the `email-safe/1` profile with dedicated table-based sections, headers, footers, actions, dividers, spacers and columns, using the existing React builder and JSON graph. Email column width, cell spacing and nested mobile stacking remain canonical undoable edits.
- Add Email checks, restricted normal controls and email-aware preview/HTML export. Unsupported imported, reusable, family or advanced content stays repairable in drafts and blocks final email output.
- Inline essential CSS into complete 600px email HTML while retaining explicit responsive rules. Enforce email source/settings/media/link rules in both compilation paths and Laravel publication/runtime, including trusted CID assets. Deploy the updated compiler and module together; no database migration is needed. Existing email layouts using unsupported rules may need repair; see the email guide. This is a conservative authoring profile, not inbox-client certification.

### Builder visual polish

- Frame navigation, preview and inspector with consistent native surfaces, aligned headers and responsive spacing. Quiet utility actions reduce redundant borders.
- Keep content and column controls prominent; group appearance, advanced attributes, placement and permissions in persistent disclosures. Collapsed invalid fields show a Needs attention badge and preserve unfinished values.
- Improve customer setting spacing, display bounded long-text fields as multiline inputs, and align the export status row. Family reviews use responsive target fields, visible conflict selections and a bounded preview.

### Template generation audit

- Shared voucher/template quick picker with 28 JSON presets and host-provided catalog props; atomic fragment insertion with fresh IDs and existing family guards/history.
- Existing settings controls now edit one-to-four column layouts, unequal widths, spacing and alignment. Reducing columns preserves content. Primitive text and link destination bindings are available directly after insertion.
- Primitive/current-item and nested literal-array repeaters work across JS and Laravel. Structural list/table checks prevent browser repair from relocating authored content.
- Module authoring drafts/exports select shared compilation for dynamic content and family declarations. Explicit fixed export remains strict; deploy the updated package, worker and bundled core schemas together. No database migration is required.

### Family workflow clarity

- Select allowed family changes in a short list and edit the selected variation in the existing inspector. Keep unfinished point inputs while switching, show hidden validation issues in navigation, and place controls before the preview in narrow embeddings.
- Separate Appearance from Customer access; use consistent Inherited, Customized and Use family labels. Compact ordered-section actions preserve the existing canonical history and constraints.
- Organize host family changes into choose, review and apply sections with named family context, saved review status and a separate publication step. Show the final preview after conflict choices and prevent applying an unavailable preview. Source formats and backend APIs are unchanged.

### Frontend-only composition boundary

- **Breaking API cleanup:** remove application-session, save/publication and PDF service lifecycles. Components accept preloaded JSON, edit locally and return HTML/CSS/JSON; the consuming application handles its own infrastructure independently.
- Remove network/configuration URLs, endpoint options, browser storage, template synchronization and persistence hooks. Voucher template choices are preloaded or edited in memory; `templates.add()`/`onTemplateAdd` replace storage-oriented naming.
- Creator defaults to a blank definition. Editor accepts definitions directly, supports explicit local document replacement, and keeps focused document/action/selection/history/validation/export hooks. HTML/JSON exports are synchronous; JSON preserves incomplete work and HTML validates final composition/data.
- Rename pure `publishTemplate()` to `createTemplateRevision()` for optional snapshot metadata. Rename the paired compilation contract to `TemplateRenderInput` and its artifact to `template-render-input.v1`; no request transport or publication workflow is implied.
- Rewrite current installation, API, contract, command, host-composition and workspace guides/examples around input/output ownership. The older entries below describe superseded development history; use the current guides and generated declarations for the supported API.

### Earlier development history

- Honor canonical revisions returned by publication callbacks so hosts own version/timestamp policy and normalized publication snapshots. Validate returned contracts/identity without overwriting editable drafts or newer documents. Keep opaque acknowledgements backward compatible, remove application-global template/PDF configuration fallbacks, document transport-neutral host contracts, and check portable entries/schemas without React, network, browser storage or an external schema registry.

- Clarify the frontend component/contract boundary: the Creator exports revision JSON locally without a publication handler; save, publish and PDF integrations remain optional host callbacks. Remove framework/deployment assumptions from the main examples and guides. Add regressions for editing, block exchange, rendering and exports with no storage/network access.

- Restore unfinished creator drafts while keeping publication/render validation strict. Save/publish deduplication and status/errors now follow loaded document generations.
- Add focused Template Editor document, actions, selection, history, save, export and validation hooks; preserve the aggregate hook contract. Add accessible customization selection and explicit omission for optional arrays/objects.
- Add portable reusable block libraries with a generated schema, dependency export, atomic import/conflict checks, property metadata/defaults, immutable definition revisions and slot controls. Detachment rejects unrepresentable missing/fallback bindings before committing; legacy bindings remain supported.
- Reject mixed voucher/personalization props in types and at runtime. Put template callbacks inside personalization or use TemplateEditor directly.
- Align optional repeater rendering with contracts, handle own property names safely, preserve maximum-length field IDs during block capture, and clarify the invoice example's manually entered amounts.

- Scoped voucher shortcuts to the owning embed, fixed Shift+Z/question-mark handling, preserved modal/local-editing ownership, and unified keyboard/menu deletion confirmation. Shortcut help follows capabilities; compound dimension controls expose field-specific names and descriptions. Corrected template-library persistence/merge documentation.

- Added a hash-bound Themelia source/contract review and drift check. Native resource Cards, class rows, provided-value facts and keycaps replace remaining custom compositions; explicit native adapter props, repeated slider names and theme-aware ruler/annotation styling are corrected.

- Refined Themelia composition: neutral chrome, accessible section/field navigation, synchronized canvas selection, stable template selection without iframe reloads, and usable slider tracks beside numeric inputs.

- **Breaking UI requirement:** React 19 and Node >=22.12.0. Migrated the workspaces to Themelia React UI 2.0.1 with Base UI 1.8 and Lucide 1; document formats and controller/hook contracts remain unchanged.
- Themelia Page commands/tabs, Tree, forms, typed choices, numeric/color controls, search, uploads, scoped portals and overlay lifecycle replace the independent UI recipes. Narrow embeds retain access to all editing panels.
- Published complete version-matched agent skills, repeatable setup/identity checks, reachable-UI composition lint, host examples and a dedicated UI integration guide. Removed obsolete modal/select implementations and shadcn/cmdk/react-colorful dependencies.

- Save/PDF capability buttons now follow callback overrides, including explicit clearing and removal; nested async transaction results are rejected without unhandled promises.
- Deep contract fixes for preview samples, trusted-data defaults/parents, publication counters/cancellation, block-slot detachment, slot-name/locale validation, and provider ownership transitions.
- Complete command/contract/integration/workspace/maintenance guides, generated export/event inventory, executable JSON fixtures, typed React examples, and automated documentation/package checks.

- Docked voucher workspace with isolated provider sessions, public controllers, focused hooks, and typed save/export results.
- Template Creator and controlled Template Editor, with versioned JSON definitions, immutable published revisions, pinned reusable blocks, assets, and flowing layouts.
- Six portable Draft 2020-12 JSON Schemas, semantic validation, explicit runtime defaults, and React-free server rendering.
- Consistent restoration of personalization defaults and application-owned values; malformed parent data remains visible to validation.
- Focused template node/data-field hooks with structural sharing, instance-only editor mounting, and explicit public snapshots.
- Field validation controls and actionable template checks, responsive embedded workspaces, and updated integration references.
- Embedded persistence and configuration/network loading are opt-in. See README migration notes when upgrading from shared global state.

## 0.6.0 — 2026-04-27

External integration release. The builder now exposes a complete headless render API, an action event bus for host-side hooks, and template pre-hydration. Existing prop / callback surface is unchanged; everything new is additive.

### Added

- **`renderFromPayload({ project, data, frame?, documentTitle?, validate? })`** — one-shot headless render in [export/render-from-payload.ts](src/voucher-builder/export/render-from-payload.ts). Accepts a `Project`, a `gct-voucher` v2/v1 envelope, or a JSON string of either. Returns `{ html, errors, warnings, manifest, validation? }`.
- **`exportToHTML(project, options?)`** — second arg adds `data` (substitution payload), `frame` (image+opacity override), `documentTitle` (`<title>` override). Substitution applies to `dataPlaceholder.valueKey`, `qrCode.overwriteKey`, and any block's `commonSettings.dynamicKey`.
- **`getProjectDynamicKeys(project)`** + **`validateRenderPayload(project, data)`** — manifest introspection in [export/dynamic-keys.ts](src/voucher-builder/export/dynamic-keys.ts). Surfaces `{ keys, required, optional, occurrences[] }` and a `{ ok, missing, unused, expected }` validation report.
- **`onAction(event)` prop** — fires for every meaningful editor mutation (block add/remove/update/duplicate/reorder, section update/activate, history push/undo/redo, project load/reset, template load, clipboard copy/cut/paste, global update, frame update). Backed by a tiny synchronous pub/sub bus in [store/events.ts](src/voucher-builder/store/events.ts).
- **`config.templates: VoucherTemplate[]`** — pre-hydrated templates registered before first paint, no network round-trip.
- **`config.templatesUrl: string`** — URL fetched once on mount; accepts `VoucherTemplate[]` or `{ templates: [...] }`. Stamped `source: 'api'`.
- **Public API exports.** `resolveFeatures`, `MODE_PRESETS`, `parseVoucherImport`, `exportToHTML`, `exportToJSON`, `renderFromPayload`, `getProjectDynamicKeys`, `validateRenderPayload`. Types: `BuilderActionEvent`, `BuilderActionType`, `DynamicKeyManifest`, `DynamicKeyOccurrence`, `DynamicKeySource`, `PayloadValidationResult`, `RenderPayload`, `RenderResult`, `ExportToHTMLOptions`, `ImportResult`, `VoucherExport`, `VoucherTemplate`.
- **Library build** — `npm run build:package` produces a publish-ready `dist/` (ESM + sourcemaps + CSS + `.d.ts` with rewritten path aliases). React/react-dom are peerDependencies; everything else externalized.
- **Docs.** [README.md](README.md) rewritten with the full API. New [docs/API.md](docs/API.md) reference and [docs/superpowers/specs/2026-04-27-external-render-api-design.md](docs/superpowers/specs/2026-04-27-external-render-api-design.md) design spec.

### Changed

- **`exportToJSON(project)`** — returns a v2 envelope `{ format, version: 2, page, project }` carrying the full normalized Project. The previous v1 denormalized shape was lossy for rows / grids / tables / metadata / preview data; it's still **read** by `parseVoucherImport` for backward compat with a warning. New imports of saved JSON are lossless and round-trip cleanly.
- **`theme="system"`** — now follows `prefers-color-scheme` and live-updates on OS changes. Was silently treated as light.
- **HTML export — `visibility` + `anchor`.** `visibility: 'print-only' / 'screen-only'` now emits `.nc-print-only` / `.nc-screen-only` classes plus matching `@media print` rules. `commonSettings.anchor` now emits `id="..."` on the wrapper `<div>` so deep links work.
- **HTML export — block fidelity.** Badge applies `text-transform` and `letter-spacing`. Hero / Quote apply `settings.textColor` to the wrapper for cascade. Section honours `headerStyle` (default / underline / accent-bar) plus `titleSize` and `titleFontWeight`. Socials block exposes `textColor` in the appearance group.
- **Feature flag wiring.** `templateSync`, `clipboard`, `previewData`, `debugTools` flags are now actually checked at the corresponding UI sites (Sync button, context menu, Preview Data editor, Debug toolbar). `viewer` mode is genuinely read-only — clipboard, undo/redo, settings panels all disable.

### Fixed

- **JSON import bug.** Previously the importer expected a `_format: 'cved'` key never produced by the exporter, so exported JSON could not be re-imported. Now `parseVoucherImport` recognizes v2 envelopes, v1 envelopes, and raw `Project` snapshots; an exported file in one window can be imported in another with no data loss.
- **`onSave` callback** is now reachable via Cmd/Ctrl+S.
- **`onExport` callback** now fires from the export dialog with the format and payload.
- **`resolveFeatures` and `MODE_PRESETS`** are exported from the package root (previously internal-only).
- **9 scopes documented**, not 7 — `animation` and `print` were shipped earlier but missing from the docs table. CLAUDE.md updated.

### Metrics

- **Tests:** 49/49 passing.
- **Public exports:** 9 functions + 18 types (was 1 function + 7 types).
- **Block-export fidelity:** badge / hero / quote / section / socials gaps closed; the canvas and the exported HTML are now in lockstep across all 25 block types.

### Design docs

- [docs/superpowers/specs/2026-04-27-external-render-api-design.md](docs/superpowers/specs/2026-04-27-external-render-api-design.md)
- [docs/superpowers/specs/2026-04-26-typography-cohesion-design.md](docs/superpowers/specs/2026-04-26-typography-cohesion-design.md)

---

## 0.5.0 — 2026-04-24

First release of the consolidated, self-contained `VoucherBuilder` component. The entire UI surface, block system, and export pipeline now compose from a single set of primitives, with no duplicated logic or cross-namespace imports.

### Added

- **Settings primitives.** `SettingBlock` + `SettingInput` polymorphic component with 22 variants (text, numeric, choice, toggle, color, composite, media) as the only rendering surface for every settings panel.
- **Scope registry.** Seven shared settings modules (`spacing`, `surface`, `border-shape`, `effects`, `layout`, `visibility`, `dynamic`) composed per block via `BlockDefinition.scopes`. Previously-hidden `CommonBlockSettings` fields (`visibility`, `minHeight`, `anchor`, `fullWidth`) now have UI.
- **Block trait system.** Nine reusable traits (`typography`, `rich-text`, `heading-level`, `link`, `icon`, `image-source`, `dimension`, `date-format`, `qr-config`) that contribute fields + settings groups at registration time. Supports prefixed instances (e.g. `metric` uses typography twice with `as: 'value'` and `as: 'label'`).
- **Render primitives.** `resolveTypography`, `resolveLink`, `resolveImage`, `resolveDate`, `buildCommonStyles`, `buildComposableChildStyles`, shared class maps (`BUTTON_VARIANT_CLASSES`, `AVATAR_SIZE_CLASSES`, `FONT_WEIGHT_NUMERIC_MAP`, etc.) and option arrays.
- **Shared enum tuples.** [schema/enums.ts](src/voucher-builder/schema/enums.ts) with 17 reusable zod enum values (alignment, font size, font weight, tracking, transform, heading level, object fit, aspect ratio, shadow preset, image filter, date format/mode, QR EC, etc.).
- **Registry helpers.** `isContainerBlockType(type)` and `labelOf(block)` replace hardcoded type lists and duplicated switch statements across the UI.
- **Export helpers.** `cssFromStyle`, `commonWrapperCss`, `typographyCss` in [export/html-helpers.ts](src/voucher-builder/export/html-helpers.ts). The HTML export pipeline now consumes the same `resolveTypography` + `buildCommonStyles` primitives as the canvas.
- **vitest.config.ts.** Explicit `src/` include and `.worktrees/` exclude.
- **README + CHANGELOG + refreshed CLAUDE.md.**

### Changed

- **Package name** `tss-csv-maker` → `gct-voucher-builder`.
- **`VoucherBuilder` component isolation.** `src/voucher-builder/` now has zero imports crossing outside its namespace. 32 prior leaks repointed (`#/lib/utils` → `#/voucher-builder/lib/utils`, `#/components/ui/*` → `#/voucher-builder/ui/*`, `#/lib/schema` → `#/voucher-builder/schema`, `#/lib/blocks/definitions` → `#/voucher-builder/blocks/definitions`).
- **HTML export pipeline.** Collapsed 9 per-block inline style maps (letter-spacing, font-weight, font-size, shadow, filter) into centralized primitives. Fixed a long-standing bug where `font-family:"Inter"...` emitted unescaped double quotes in inline style attributes.
- **25 block definitions and renderers** migrated onto traits + primitives. Every duplicated `weightClasses` / `trackingClasses` / `alignClass` map and `block.settings as any` cast removed.
- **Pre-existing test failures fixed.** Stale `#/lib/blocks/definitions` imports and obsolete `bio` fixtures corrected in `graph`, `document`, `commands`, `factory`, and `registry` test suites.
- **Config naming.** Hardcoded colors swept to CSS var fallbacks (`var(--nc-border, #e5e7eb)`, `var(--nc-surface, #f9fafb)`, `var(--nc-secondary, #6b7280)`).

### Removed

- **Legacy source tree.** Deleted `src/components/`, `src/lib/`, `src/store/`, `src/hooks/`, `src/i18n/`, `src/routes/`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/styles.css`, `src/types/` — ~240 files, ~22,000 LOC of pre-standalone code no longer reachable from `main.tsx`.
- **Compat shim.** `settings/compat.tsx` and `settings/settings-inputs.tsx` deleted after all consumers (global-settings, section-settings, overrides, dialogs) were migrated to import `SettingInput` / `SettingBlock` directly.
- **Unused dependencies.** `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `@tanstack/react-devtools`, `@tanstack/router-plugin`, `@tanstack/devtools-vite`, `@testing-library/dom`, `@testing-library/react`, `@tailwindcss/typography`.
- **Stale git worktree.** `.worktrees/improvements`.

### Fixed

- Heading export `font-family` attribute broke style parsing due to unescaped double quotes.
- Metadata block typography migrated to prefixed trait; renderer falls back to legacy `fieldColor` / `labelColor` for persisted projects.

### Metrics

- **Bundle size:** 1,158 kB → 1,027 kB (13% smaller); gzip 350 kB → 318 kB.
- **Source tree:** ~27,000 LOC → ~22,000 LOC (−18%).
- **Enum tuple duplication:** 90 inline z.enum literals → 36 (the rest are genuinely per-block).
- **Tests:** 31/31 passing, scoped cleanly to `src/voucher-builder/`.

### Design docs

- [docs/superpowers/specs/2026-04-24-settings-primitives-and-scope-registry-design.md](docs/superpowers/specs/2026-04-24-settings-primitives-and-scope-registry-design.md)
- [docs/superpowers/specs/2026-04-24-block-traits-system-design.md](docs/superpowers/specs/2026-04-24-block-traits-system-design.md)

---

## Pre-0.5.0

The project history before 0.5.0 includes the standalone VoucherBuilder extraction, dynamic preview system, pluggable PDF export, dark mode completion, and earlier template + config layers. See the git log (`git log --oneline`) for the full trail.
