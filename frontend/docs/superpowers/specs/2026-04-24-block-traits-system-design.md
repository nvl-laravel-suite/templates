# Block Traits System

**Date:** 2026-04-24
**Status:** Approved for implementation
**Follows:** 2026-04-24-settings-primitives-and-scope-registry-design.md

## Problem

The 25 block definitions + their renderers duplicate identical concerns:

1. **Field option arrays** — `fontWeight`, `letterSpacing`, `textTransform`, `alignment`, `lineHeight`, `fontSize`, `textColor`, `maxWidth` are redeclared inline in heading.ts, text.ts, button.ts, badge.ts, metric.ts, quote.ts. Adding an option means editing 6 files.
2. **Renderer className maps** — `weightClasses`, `trackingClasses`, alignment maps, textColor fallbacks repeat across heading-block.tsx, text-block.tsx, button-block.tsx, badge-block.tsx, metric-block.tsx.
3. **`settingsLayout` helpers name groups but don't dedupe data** — `typographyGroup([...])` wraps a pre-declared field list; the fields are re-authored per block.
4. **Cross-cutting concerns like `link`, `icon`, `image-source`, `dimension`, `date-format` are bespoke per block** — no shared field or renderer helper.

This is the same drift pattern the settings refactor eliminated. The fix is structurally identical.

## Goal

A two-layer, registry-driven system that mirrors the settings architecture:

- **Render primitives** — reusable atoms (`BlockRoot`, `useTypographyTrait`, icon resolution, text rendering) that every renderer composes.
- **Traits** — registered, composable modules that contribute fields + settings groups + render helpers. Blocks declare `traits: [...]` instead of redeclaring fields.
- **Registries** — a `traitRegistry` analogous to `scopeRegistry` / `blockRegistry`.

## Architecture

### Layer 1 — Render primitives

Under `src/voucher-builder/blocks/primitives/`:

- **`BlockRoot`** — optional wrapper component for complex renderers. Applies id/anchor + accessibility attrs. Most renderers won't need it (LayoutGrid already applies commonSettings via the engine); use for blocks that need an extra container.
- **`resolveTypography(settings)`** → `{ className, style }` — turns the 8 typography settings into a className string + style object.
- **`resolveDimension(value, unit)`** → string CSS value — handles px/em/rem/%/mm.
- **`resolveIcon(name, size)`** → React node — lucide lookup with fallback.
- **`resolveTextColor(settings, fallback?)`** → string — centralizes the `var(--nc-text, ...)` pattern.
- **`resolveLink(settings)`** → `{ href, target, rel }` with `openInNew` handling.
- **`renderRichText(html)`** → already sanitized HTML → React prop (thin wrapper over `dangerouslySetInnerHTML`).

### Layer 2 — Trait definition API

```ts
defineTrait({
  id: 'typography',
  title: 'Typography',
  display: 'collapsible',
  defaultOpen: true,

  // Fields this trait contributes. Source = 'content' or 'settings'.
  fields: {
    fontSize:      { source: 'settings', schema: { type: 'enum', default: 'md', display: 'pills', options: FONT_SIZE_OPTIONS } },
    fontWeight:    { source: 'settings', schema: { type: 'enum', default: 'normal', options: WEIGHT_OPTIONS } },
    letterSpacing: { source: 'settings', schema: { type: 'enum', default: 'normal', options: TRACKING_OPTIONS } },
    textTransform: { source: 'settings', schema: { type: 'enum', default: 'none', options: TRANSFORM_OPTIONS } },
    alignment:     { source: 'settings', schema: { type: 'alignment', default: 'left' } },
    lineHeight:    { source: 'settings', schema: { type: 'slider', default: 0, min: 0, max: 3, step: 0.1 } },
    maxWidth:      { source: 'settings', schema: { type: 'slider', default: 0, min: 0, max: 100, step: 5, suffix: '%' } },
    textColor:     { source: 'settings', schema: { type: 'color', default: '' } },
  },

  // Fields listed in settings panel order (can omit some for `fieldOrder` overrides)
  fieldOrder: ['fontSize', 'alignment', 'fontWeight', 'letterSpacing', 'textTransform', 'lineHeight', 'maxWidth', 'textColor'],

  // Runtime render helper — pure function, blocks call it from their renderer
  resolve(block): { className: string; style: CSSProperties } { ... },
})
```

Trait fields flow into the block's own `content`/`settings` field maps at registration time. The block definition stays structurally identical — a block with `traits: ['typography']` ends up with the 8 typography fields as if they'd been hand-authored.

**Trait config overrides.** A block can tune a trait:

```ts
traits: ['typography'],
traitConfig: {
  typography: {
    defaults: { fontWeight: 'bold' },     // override default values
    hideFields: ['letterSpacing'],        // drop fields it doesn't need
    renameFields: { fontSize: 'size' },   // rare, only if the block has a naming conflict
  },
}
```

### Layer 3 — Block registry integration

`BlockDefinition` gains:

```ts
traits?: string[]                                       // ordered
traitConfig?: Record<string, TraitOverride>
```

At registration time (`defineBlock`), the trait fields are merged into `def.content` and `def.settings`. The merged result is what the factory, schema, and AutoSettingsRenderer see — existing systems keep working unchanged.

### Layer 4 — Settings panel integration

`AutoSettingsRenderer` already walks `settingsLayout`. Traits contribute their own group via `trait.settingsGroup()`. `defineBlock` merges these trait groups into the block's `settingsLayout` in a canonical position (after content groups, before container scopes) unless the block explicitly places a trait group via its group id:

```ts
settingsLayout: [
  contentGroup(['text']),
  'trait:typography',           // positioned explicitly
  customGroup([...]),
]
```

Groups without explicit placement append to the end in trait declaration order.

### Built-in traits

| Trait id | Title | Fields | Resolver | Used by |
|---|---|---|---|---|
| `rich-text` | Content | single string field, rich/plain, placeholder | — | heading, text, quote, button |
| `typography` | Typography | fontSize, fontWeight, letterSpacing, textTransform, alignment, lineHeight, maxWidth, textColor | `resolveTypography` | heading, text, button, badge, metric, quote |
| `heading-level` | Level | level (h1-h6) | `resolveHeadingTag` | heading |
| `link` | Link | url, openInNew, rel | `resolveLink` | button, image |
| `icon` | Icon | icon, iconPosition, iconSize | `resolveIcon` | button, badge, metric, contactInfo |
| `image-source` | Source | src, alt, objectFit, aspectRatio | `resolveImage` | image, avatar, hero |
| `dimension` | Size | width, height (dimension fields) | `resolveDimension` | image, avatar, sticker, qrCode |
| `date-format` | Format | format, locale | `resolveDate` | date, metadata |
| `qr-config` | QR | value, errorCorrection, allowOverwrite, overwriteKey | `resolveQr` | qrCode |
| `constraints` | Constraints | maxWidth, minHeight, aspectRatio | — | shared |

## File layout

```
src/voucher-builder/blocks/
├── traits/
│   ├── registry.ts                # defineTrait, getTrait, listTraits
│   ├── rich-text.ts
│   ├── typography.ts
│   ├── heading-level.ts
│   ├── link.ts
│   ├── icon.ts
│   ├── image-source.ts
│   ├── dimension.ts
│   ├── date-format.ts
│   ├── qr-config.ts
│   ├── constraints.ts
│   └── index.ts
├── primitives/
│   ├── resolve-typography.ts
│   ├── resolve-icon.tsx
│   ├── resolve-link.ts
│   ├── resolve-image.ts
│   ├── resolve-dimension.ts
│   ├── resolve-date.ts
│   └── index.ts
├── definitions/         # existing
├── renderers/           # existing
├── registry.ts          # extended with trait merge
└── types.ts             # extended with traits/traitConfig
```

## Migration plan

1. Build trait registry + defineTrait API.
2. Build render primitives (pure resolver functions).
3. Implement 10 built-in traits.
4. Extend `defineBlock` to merge trait fields into content/settings and their groups into settingsLayout.
5. Migrate block definitions + renderers in this order (proof first, then mechanical):
   - `heading` → proves typography + rich-text + heading-level
   - `text` → proves typography + rich-text
   - `button` → proves typography + link + icon
   - `image` → proves image-source + dimension + link
   - `date` → proves date-format
   - `qrCode` → proves qr-config + dimension
   - Remaining 19 blocks — mechanical
6. Type check + build + dev.

## Scope boundaries

**In scope**
- Trait system + registry
- Render primitives
- Migrate all 25 block definitions + renderers
- Preserve existing commonSettings / scopes / LayoutGrid behavior
- Preserve existing Zod schemas (no bump)

**Out of scope**
- New block types
- Canvas / layout engine changes
- Export pipeline changes
- Schema version bump — traits contribute fields that already existed per block; merged result matches today's shape

## Success criteria

- Every duplicated option array (`WEIGHT_OPTIONS`, `TRACKING_OPTIONS`, `TRANSFORM_OPTIONS`, etc.) lives in exactly one trait file.
- Every renderer className map (`weightClasses`, `trackingClasses`) lives in exactly one primitive.
- Adding "extrabold" to font weight = one line in one file.
- `npx tsc --noEmit` passes.
- Canvas + settings panel work for all 25 block types with no visible regression.
