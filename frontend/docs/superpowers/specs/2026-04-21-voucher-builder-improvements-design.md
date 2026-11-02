# GCT Voucher Builder — Improvements Design Spec

**Date**: 2026-04-21
**Scope**: 8 issues identified during deep-dive audit
**Status**: Draft

---

## Table of Contents

1. [Template System Overhaul](#1-template-system-overhaul)
2. [Quick Start Wizard Removal](#2-quick-start-wizard-removal)
3. [Multi-Select Copy/Cut](#3-multi-select-copycut)
4. [Arrow Navigation Into Columns](#4-arrow-navigation-into-columns)
5. [Canvas DnD Discoverability](#5-canvas-dnd-discoverability)
6. [Export Expansion with Pluggable PDF](#6-export-expansion-with-pluggable-pdf)
7. [Documentation Update](#7-documentation-update)
8. [Dark Mode for App Tokens](#8-dark-mode-for-app-tokens)

---

## 1. Template System Overhaul

### Problem

- The sidebar `TemplatePicker` loads templates without a confirmation dialog, silently destroying user work.
- Templates are hardcoded TypeScript objects — no external configurability.
- No way to sync templates from an external platform.

### Design

#### Template Format

A `VoucherTemplate` type supports two modes:

```ts
interface VoucherTemplate {
  id: string
  name: string
  description: string
  icon?: string                // lucide icon key
  category?: string            // "corporate", "gift", "event", etc.
  thumbnail?: string           // preview image URL or base64 data URI
  mode: 'full' | 'partial'
  source: 'builtin' | 'local' | 'api'

  // Full mode — complete project snapshot, loaded as-is
  project?: Project

  // Partial mode — declarative block placement, app instantiates blocks
  partial?: PartialTemplate
}

interface PartialTemplate {
  global?: Partial<GlobalSettings>
  frame?: Partial<Frame>
  sections?: PartialTemplateSection[]
}

interface PartialTemplateSection {
  index: 0 | 1 | 2
  height?: number
  backgroundColor?: string
  backgroundOpacity?: number
  widthMode?: 'wide' | 'narrow' | 'tight'
  verticalAlign?: 'center' | 'start' | 'end'
  blocks: PartialTemplateBlock[]
}

interface PartialTemplateBlock {
  type: BlockType
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  commonSettings?: Partial<CommonBlockSettings>
  children?: PartialTemplateBlock[]   // for composables/rows/sections
}
```

#### Three Template Sources

Templates are loaded from three sources and merged into a single list. Sources are checked in this order; duplicate IDs from later sources override earlier ones:

1. **Built-in** — TypeScript objects in `src/lib/templates/builtins.ts`. Always available. The existing templates are refactored to use the new `VoucherTemplate` format.

2. **Local folder** — JSON files conforming to `VoucherTemplate` schema, served from `public/templates/` (or a configurable path). Read at app startup via a TanStack Start server function or static fetch. Each `.json` file is one template. Missing folder = no local templates, no error.

3. **API sync** — Fetched from a configurable endpoint on manual trigger. Response is `VoucherTemplate[]`. Cached in localStorage under key `gct-voucher-templates-api`. The endpoint URL is stored in app configuration (see Configuration section below).

#### Template Registry

A new `src/lib/templates/registry.ts` module:

```ts
// Loads and merges templates from all sources
function getTemplates(): VoucherTemplate[]

// Load from API endpoint, cache to localStorage
async function syncApiTemplates(endpoint: string): Promise<VoucherTemplate[]>

// Load from local folder
async function loadLocalTemplates(): Promise<VoucherTemplate[]>

// Instantiate a template into a Project
function instantiateTemplate(template: VoucherTemplate): Project
```

`instantiateTemplate()` handles both modes:
- **Full**: Deep-clones `template.project`, regenerates all block IDs via `instantiateBlockTree` to avoid collisions with existing data.
- **Partial**: Creates an empty project, applies `global`/`frame` overrides, iterates declared sections, calls `createDefaultBlock` for each block, applies content/settings overrides, wires up `columnBlocks` for composables/rows/grids, assigns block IDs to section `blockIds`.

#### Template Picker Redesign

Replaces the current `TemplatePicker` component. New file: `src/components/builder/template-picker.tsx` (rewrite).

- Shows all templates from all sources in a grid layout.
- Each card: thumbnail (or icon fallback), name, description, source badge (built-in / local / api).
- Optional category filter tabs at top (derived from templates' `category` fields).
- Search input to filter by name/description.
- **Confirmation dialog before loading** — uses the existing `ConfirmDialog` component: "Loading a template will replace your current work. This cannot be undone."
- "Sync Templates" button in the header — visible only when an API endpoint is configured. Shows loading state during fetch. Disabled when no endpoint.
- The picker lives in the left sidebar, replacing the current `TemplatePicker`.

#### Configuration

A lightweight config layer for external integration settings. New file: `src/lib/config.ts`:

```ts
interface AppConfig {
  apiTemplateEndpoint?: string     // URL for template sync
  localTemplatePath?: string       // path for local templates (default: '/templates/')
  pdfExportEndpoint?: string       // URL for remote PDF rendering (headless Chrome, etc.)
}
```

Config is loaded from `public/config.json` (optional file, missing = defaults). This keeps configuration out of the code and allows deployment-time customization without rebuilds. The config is fetched once at app startup and cached in memory.

---

## 2. Quick Start Wizard Removal

### Problem

- The wizard bypasses the action/undo layer (direct `useDocumentStore.setState` in setTimeout).
- With the new template picker providing a better onboarding path, the wizard is redundant.

### Design

**Delete:**
- `src/components/builder/quick-start-wizard.tsx`
- `showWizard` from `EditorStoreState` and its initial value in `editor.ts`
- Wizard-related state and open/close logic in `routes/index.tsx`
- "Open Quick Start Wizard" command from `src/lib/commands.ts`
- Wizard button from the left sidebar header

**No replacement needed.** The template picker is the onboarding path. First-time users see the template picker in the left sidebar with clear CTAs.

---

## 3. Multi-Select Copy/Cut

### Problem

`Cmd+C` and `Cmd+X` only work with `activeBlockId` (single selection). Multi-select copy is not supported.

### Design

#### Clipboard State Change

```ts
// Before
clipboard: BlockTreeSnapshot | null

// After
clipboard: BlockTreeSnapshot[] | null
```

Always stored as an array, even for single blocks (array of length 1).

#### Action Changes

- `copyBlock(blockId)` → `copyBlocks(blockIds: string[])` — captures a `BlockTreeSnapshot` for each block ID.
- `cutBlock(blockId)` → `cutBlocks(blockIds: string[])` — captures snapshots, then removes all blocks.
- `pasteBlock(sectionId)` → `pasteBlocks(sectionId)` — instantiates all snapshots in the clipboard, appends to section in order.

Backward-compatible: single-block operations pass `[blockId]`.

#### Keyboard Shortcut Changes

In `use-keyboard-shortcuts.ts`:
- `Cmd+C`: If `activeBlockIds.length > 0`, copy all. Else if `activeBlockId`, copy single.
- `Cmd+X`: Same pattern.
- `Cmd+V`: Calls `pasteBlocks` (handles array automatically).

#### Context Menu Changes

- "Copy" and "Cut" in `BlockContextMenu` call the new array-based actions, passing the current `activeBlockIds` (or `[contextBlockId]` if right-clicking a non-selected block).

---

## 4. Arrow Navigation Into Columns

### Problem

Arrow Up/Down only navigates section-level blocks. Blocks inside rows, grids, composables, and sections are unreachable via keyboard.

### Design

#### Navigable Block List

A new pure function in `src/lib/engine/navigation.ts`:

```ts
function getNavigableBlockList(
  sections: VoucherSection[],
  blocks: Record<string, Block>,
  columnBlocks: Record<string, string[]>,
  activeSectionId: string
): string[]
```

Returns a flat, ordered list of all visible block IDs in the active section by depth-first traversal:

```
section root block A
section root block B (row)
  → column 1 child 1
  → column 1 child 2
  → column 2 child 1
section root block C (composable)
  → child 1
  → child 2
section root block D
```

Structural blocks (columns, grid cells) are skipped — navigation goes directly to their children. Hidden blocks (`visibility: 'print-only'` when not in print) are included (they're still selectable).

#### Keyboard Handler Update

In `use-keyboard-shortcuts.ts`, replace the current flat `blockIds` iteration with:

```ts
const navigable = getNavigableBlockList(sections, blocks, columnBlocks, activeSectionId)
const currentIndex = navigable.indexOf(activeBlockId)
// ArrowUp → navigable[currentIndex - 1]
// ArrowDown → navigable[currentIndex + 1]
```

If the newly selected block is inside a column and not currently visible in the viewport, scroll it into view.

---

## 5. Canvas DnD Discoverability

### Problem

Canvas drag-and-drop only supports flat section-level reordering. Moving blocks into/out of columns requires the Elements panel, which isn't obviously discoverable.

### Design

Rather than making canvas DnD handle full nesting (complex and error-prone), improve discoverability of the Elements panel:

1. **Elements panel toggle on canvas toolbar** — Add a "Layers" icon button to the `CanvasToolbar` (bottom bar) that toggles the floating `PageElements` panel visibility. Currently the panel just auto-appears; give users explicit control.

2. **Hint on drag near containers** — When a user drags a block on the canvas and hovers over a row/grid block, show a subtle tooltip: "Open Layers panel to move blocks between containers". Show once per session (tracked in editor state, not persisted).

3. **Empty column drop hints** — When a row has an empty column visible on the canvas, show a faint "Drop blocks here" placeholder (this already exists in `VoucherSectionContainer` for empty sections — apply the same pattern to empty columns in `RowBlockRenderer`).

---

## 6. Export Expansion with Pluggable PDF

### Problem

Only HTML and JSON are wired in the export dialog. PDF export exists in code but isn't surfaced. The PDF approach should be pluggable to support both browser print and remote rendering.

### Design

#### PDF Export Strategy Interface

New file: `src/lib/export/pdf-strategies.ts`:

```ts
interface PdfExportStrategy {
  id: string
  label: string                    // shown in export dialog
  description?: string
  export: (html: string, options: PdfExportOptions) => Promise<Blob | void>
}

interface PdfExportOptions {
  filename: string
  paperSize: 'a4' | 'letter'
  margins: { top: number; bottom: number; left: number; right: number }
}
```

#### Built-in Strategies

1. **`browser-print`** — Refactored from existing `exportPdf.ts`. Creates hidden iframe with HTML, triggers `window.print()`. Returns `void` (browser handles the dialog). Always available.

2. **`remote`** — POSTs rendered HTML to a configurable endpoint. Expects a PDF blob response. Endpoint URL comes from `AppConfig.pdfExportEndpoint`. Only available when endpoint is configured.

#### Strategy Registry

```ts
// src/lib/export/pdf-strategies.ts
function getAvailablePdfStrategies(config: AppConfig): PdfExportStrategy[]
function getPdfStrategy(id: string): PdfExportStrategy | undefined
```

Custom strategies can be registered by adding to the registry. The `remote` strategy is included but only surfaces when configured.

#### Export Dialog Changes

`ExportDialog` updated:
- Format selector: **HTML** / **JSON** / **PDF**
- When PDF selected:
  - Strategy dropdown (if >1 available), defaults to first available
  - Filename input
- "Export" button triggers the selected strategy
- Loading state during remote PDF generation
- Error handling with toast on failure

#### File Reorganization

Current export files are flat in `src/lib/`. Move to a dedicated directory:

```
src/lib/export/
├── html.ts              # exportToHTML (moved from export.ts)
├── json.ts              # exportToJSON (moved from export-json.ts)
├── pdf-strategies.ts    # strategy interface + registry + built-in strategies
└── index.ts             # re-exports
```

---

## 7. Documentation Update

### Problem

`CLAUDE.md` and `WALKTHROUGH.md` describe the original 58-block CV builder, not the current voucher product.

### Design

#### CLAUDE.md Rewrite

Update to reflect:
- Product name: GCT Voucher Builder
- 25 block types (not 58), organized by actual categories
- 3-section voucher model (not multi-page)
- VoucherSection schema (not Page)
- Frame system
- Sticker blocks
- Data placeholder / QR code overwrite for dynamic vouchers
- Template system (3 sources, dual mode)
- Export formats: HTML, JSON, PDF (pluggable)
- Store version 13
- Remove all CV-specific content (sidebar layouts, ATS export, CV intelligence, etc.)

#### WALKTHROUGH.md Rewrite

Full rewrite covering:
- Product vision (voucher/gift card builder, not CV builder)
- The 3-section A4 canvas model
- Block inventory (25 blocks with actual categories)
- Template system with API sync
- Settings system (accurate to current state)
- Export pipeline (HTML, JSON, pluggable PDF)
- Data model (VoucherSection, Frame, actual Project shape)
- Design system (unchanged — Atelier Precision)
- Keyboard shortcuts (unchanged)

#### Approach

Both documents are rewritten from scratch using the current codebase as source of truth. The deep-dive analysis from this conversation provides the accurate inventory.

---

## 8. Dark Mode for App Tokens

### Problem

shadcn/ui tokens have `.dark` class overrides in `styles.css`, but the custom `--nc-*` app tokens (canvas, paper shadow, toolbar glass, selection, settings tokens) have no dark variants. Dark mode partially works but custom UI elements stay light-themed.

### Design

Add `.dark` overrides for all custom tokens in `src/styles.css`:

#### Canvas Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--nc-canvas` | oklch(0.945 0.004 80) | oklch(0.15 0.005 260) |
| `--nc-canvas-dots` | oklch(0.88 0.006 80) | oklch(0.22 0.006 260) |
| `--nc-toolbar-glass` | oklch(0.995 0.002 80 / 92%) | oklch(0.18 0.005 260 / 90%) |
| `--nc-selection` | oklch(0.60 0.14 265) | oklch(0.65 0.16 265) |
| `--nc-selection-light` | oklch(0.93 0.04 265) | oklch(0.25 0.06 265) |
| `--nc-paper-shadow` | (current multi-layer) | darker shadow with lower opacity |
| `--nc-hover-lift` | (current) | adjusted for dark surfaces |
| `--nc-toolbar-shadow` | (current) | adjusted for dark surfaces |

#### Settings Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--nc-st-muted` | oklch(0.52 0.01 260) | oklch(0.60 0.01 260) |
| `--nc-st-border` | oklch(0.90 0.005 80) | oklch(0.28 0.005 260) |
| `--nc-st-border-strong` | oklch(0.82 0.008 80) | oklch(0.35 0.008 260) |
| `--nc-st-surface` | oklch(0.975 0.003 80) | oklch(0.18 0.004 260) |
| `--nc-st-surface-hover` | oklch(0.96 0.004 80) | oklch(0.22 0.005 260) |
| `--nc-st-accent-subtle` | oklch(0.95 0.03 265) | oklch(0.22 0.05 265) |
| `--nc-st-section-line` | oklch(0.91 0.005 80) | oklch(0.25 0.005 260) |

Text size tokens (`--nc-st-heading`, `--nc-st-label`, etc.) and spacing tokens don't need dark overrides — they're dimensional, not chromatic.

#### Implementation

A single `.dark { }` block in `styles.css` containing all token overrides, placed adjacent to the existing `.dark` block for shadcn tokens. The canvas document itself (the A4 paper) does NOT use dark mode — it always renders with the user's chosen `GlobalSettings.colors`. Dark mode only affects the editor chrome (sidebar, toolbar, canvas background).

---

## Implementation Order

These are ordered by dependency and impact:

| Phase | Issues | Rationale |
|-------|--------|-----------|
| **Phase 1: Foundation** | #7 Docs, #2 Wizard removal | Clean up stale code and docs first. No new features depend on old wizard. |
| **Phase 2: Template System** | #1 Template overhaul | Core feature. Depends on wizard being removed. |
| **Phase 3: Editor Polish** | #3 Multi-select copy, #4 Arrow navigation, #5 Canvas DnD hints | Independent improvements to editor ergonomics. Can be parallelized. |
| **Phase 4: Export** | #6 Pluggable PDF export | Builds on existing export code. Independent of other phases. |
| **Phase 5: Visual** | #8 Dark mode tokens | Purely visual. No functional dependencies. |

---

## Out of Scope

- ATS-optimized export (CV-specific, not relevant to vouchers)
- Signed `.cved` export (CV-specific)
- Sidebar page layouts (removed in voucher pivot)
- CV section blocks and entry blocks (removed)
- Rich text in export (already handled by existing `sanitizeRichTextHtml`)
- Template creation UI (users don't create templates in the app — they come from external sources)
