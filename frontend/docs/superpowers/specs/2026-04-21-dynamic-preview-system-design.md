# Dynamic Preview System — Design Spec

**Date**: 2026-04-21
**Scope**: Preview data toggle for testing placeholder/dynamic blocks with sample data
**Status**: Approved

---

## Problem

The voucher builder has dynamic blocks (`dataPlaceholder`, `qrCode` with overwrite keys, any block with `dynamicKey`) but no way to preview what they look like with real data filled in. Designers can't verify their templates work until the external platform renders them.

## Design

### Data Sources

Two levels of preview data, resolved with project-level winning over per-block:

#### Per-Block Preview Values

- `dataPlaceholder` block: `content.previewValue: string` — sample text or image URL
- `qrCode` block: `content.previewValue: string` — sample URL for QR rendering
- Any block with `dynamicKey`: `commonSettings.previewValue: string` — sample value for the primary content field

Edited in each block's settings panel. A text input appears when the block is dynamic.

#### Project-Level Preview Payload

- `GlobalSettings.previewData: Record<string, string>` — a key-value map matching `:recipient_name` style tokens
- Edited in the Global Settings panel as a key-value list editor (reuse `ItemListEditor` pattern)
- This mirrors the API payload the external platform sends at render time

#### Resolution Order

```ts
function resolvePreviewValue(
  key: string,
  projectPayload: Record<string, string>,
  blockPreviewValue?: string
): string | undefined {
  return projectPayload[key] ?? blockPreviewValue ?? undefined
}
```

Project-level payload wins. Per-block `previewValue` is fallback. If neither exists, the block shows its normal placeholder/content.

### Toolbar Toggle

A pill toggle on `CanvasToolbar`: **Placeholders / Preview**

- Stored as `showPreviewData: boolean` in `EditorStoreState` (transient, not persisted)
- Default: `false` (shows placeholders)
- When `true`: all dynamic blocks resolve and display their preview values
- Editor remains fully functional (not read-only) — users can toggle back and forth while working

### What Gets Replaced in Preview Mode

| Block Type | Source Key | Replaced Field |
|-----------|-----------|---------------|
| `dataPlaceholder` (text) | `content.valueKey` | Shows resolved value as styled text instead of amber dashed placeholder |
| `dataPlaceholder` (image) | `content.valueKey` | Shows resolved URL as `<img>` instead of dashed box with icon |
| `qrCode` | `settings.overwriteKey` (when `allowOverwrite` is true) | QR code renders with resolved URL instead of `content.value` |
| Any block with `dynamicKey` | `commonSettings.dynamicKey` | Primary content field replaced |

### Primary Content Field Map

For `dynamicKey` blocks, determines which content field gets swapped:

```ts
const PRIMARY_CONTENT_FIELD: Record<string, string> = {
  heading: 'text',
  text: 'body',
  image: 'url',
  metric: 'value',
  badge: 'text',
  button: 'text',
  date: 'value',
  metadata: 'label',
}
```

Block types not in the map are ignored (their `dynamicKey` is metadata-only for the external system).

### Visual Indicators

**Placeholder mode (default — `showPreviewData: false`):**
- Current behavior unchanged — amber dashed boxes for `dataPlaceholder`, amber badge for `dynamicKey` blocks

**Preview mode (`showPreviewData: true`):**
- Resolved content renders with normal styling (no amber)
- A small `Eye` icon (lucide) in the corner of each dynamic block indicates it's showing preview data, so designers can distinguish dynamic blocks from static ones
- If a key has no preview value (neither project-level nor per-block), the block stays in placeholder mode with a subtle warning indicator

### Schema Changes

**`CommonBlockSettings`** (in `schema.ts`):
```ts
previewValue: z.string().default('')
```

**`GlobalSettings`** (in `schema.ts`):
```ts
// Inside the metadata object or as a top-level field:
previewData: z.record(z.string(), z.string()).default({})
```

**`DataPlaceholderBlockSchema`** content:
```ts
previewValue: z.string().default('')
```

**`QrCodeBlockSchema`** content:
```ts
previewValue: z.string().default('')
```

**`EditorStoreState`** (in `store/types.ts`):
```ts
showPreviewData: boolean  // transient, default false
```

**Store version**: Bump from 13 to **14**. Migration: previous data is compatible (new fields all have defaults).

### Settings UI Changes

**Block Settings (`BlockSettings.tsx`):**
- In the "Dynamic" container group: when `dynamicKey` is set, show a `previewValue` text input below the key input

**DataPlaceholder override:**
- Add `previewValue` text input in the placeholder settings group

**QrCode definition:**
- Add `previewValue` text input, conditional on `allowOverwrite` being true

**Global Settings (`GlobalSettings.tsx`):**
- New "Preview Data" collapsible group (defaultOpen: false)
- Uses `ItemListEditor` pattern with key + value inputs per row
- Add/remove/reorder rows

### Canvas Toolbar Changes

**`CanvasToolbar.tsx`:**
- New prop: `showPreviewData: boolean`, `onTogglePreviewData: () => void`
- Renders a pill toggle (similar to existing viewport/format toggles) with "Placeholders" / "Preview" labels
- Placed near the existing visual tooling buttons

### Renderer Changes

Each affected renderer checks `showPreviewData` from editor state and resolves its display value:

**`DataPlaceholderBlockRenderer`:** When preview mode on + value resolved → render as normal text/image instead of amber placeholder
**`QrCodeBlockRenderer`:** When preview mode on + overwrite value resolved → use resolved URL for QR generation
**`BlockRenderer` (or `SortableBlock`):** When preview mode on + block has `dynamicKey` + value resolved → pass resolved value as content override to the renderer

The preview value injection happens at the rendering layer, never mutating the store. The store always contains the original template data.

### Template with Preview Data

A builtin "Demo Voucher" template should be added to `builtins.ts` that demonstrates the system:
- Section 1: Heading with `dynamicKey: ':title'`, text with `dynamicKey: ':subtitle'`
- Section 2: `dataPlaceholder` blocks for `:recipient_name`, `:amount`, `:valid_until`
- Section 3: `qrCode` with `allowOverwrite` + `overwriteKey: ':redeem_url'`
- Project-level `previewData`: `{ ":title": "Gift Voucher", ":subtitle": "A special gift for you", ":recipient_name": "Jane Smith", ":amount": "$50.00", ":valid_until": "2026-12-31", ":redeem_url": "https://example.com/redeem/abc123" }`

## Out of Scope

- Importing preview data from external files or API
- Multiple preview data sets / scenarios
- Preview mode in exports (exports always use placeholder/original content)
- Validation of key format (`:key` convention is by convention, not enforced)
