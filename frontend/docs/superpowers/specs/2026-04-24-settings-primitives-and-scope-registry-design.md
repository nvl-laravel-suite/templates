# Settings Primitives & Scope Registry

**Date:** 2026-04-24
**Status:** Approved for implementation

## Problem

The voucher builder's settings UI has three layers of drift:

1. `block-settings.tsx` hand-rolls 4 local components (`ContainerSpacing`, `ContainerSurface`, `ContainerBorder`, `ContainerDynamic`), each with a different prop shape. Labels, defaults, and field ordering are baked inline.
2. `src/components/builder/settings/` contains 15+ single-purpose field components (`BorderField`, `ColorField`, `OpacityField`, `ShadowControl`, `SpacingSlider`, `ItemListEditor`, etc.) each with its own API. Adding a new control means a new file plus wiring in at least two places.
3. Already-existing `CommonBlockSettings` fields have no UI (`visibility`, `minHeight`, `anchor`, `fullWidth`) because exposing them would require more hand-rolled container groups.

Symptoms: shadow values stored as raw CSS strings parsed back to presets; `borderStyle as any` type-casts; `marginLeft ?? 0` fallbacks because the margin control treats X-axis as optional; header styling split between `SettingsGroup` and inline JSX so label tweaks don't propagate.

## Goal

A two-layer settings system where:

- **Primitives** are the only rendering surface. Changing a label's typography once updates every group and every input in the app.
- **Scopes** are reusable, self-contained settings modules with a standard API. Blocks compose scopes by id.
- **Registries** wire scopes to blocks — one line per scope per block, no duplication.

## Architecture

### Layer 1 — Primitives

Two components, one sub-primitive. They live in `src/components/builder/settings/primitives/`.

**`SettingBlock`** — the group container. Replaces every `SettingsGroup` + `ContainerSpacing/Surface/Border/Dynamic` wrapper.

```tsx
<SettingBlock
  label="Border & Shape"
  description="Outline, radius, shadow"   // optional, below label
  hint="4 fields"                          // optional, right-aligned meta
  icon={Square}                            // optional lucide icon
  display="collapsible"                    // 'collapsible' | 'inline' | 'card'
  defaultOpen={false}
>
  {children}
</SettingBlock>
```

**`SettingInput`** — polymorphic input. One JSX entry point, renders the right control via `type`.

```tsx
<SettingInput
  label="Padding Top"
  hint="12px"
  description="Inner top spacing"
  disabled={false}
  type="slider"
  value={value}
  onChange={onChange}
  onChangeStart={onChangeStart}
  min={0} max={80} step={1} suffix="px"
/>
```

Supported `type` variants (union-typed so each variant's extra props are required only for that type):

| Category | Variants |
|---|---|
| Text | `input`, `textarea`, `rich_editor`, `mono` |
| Numeric | `number`, `stepper`, `slider`, `spacing`, `dimension` |
| Unit-aware | `unit` (px/em/rem/%/mm toggle buttons) |
| Toggles | `switch`, `checkbox` |
| Choice | `pills`, `select`, `alignment`, `icon`, `color`, `color-swatch` |
| Composite | `border`, `shadow`, `opacity` |
| Media/data | `image`, `list` |

**`UnitToggle`** — sub-primitive for unit switching. Used by `dimension`, `unit`, anywhere else.

```tsx
<UnitToggle units={['px', 'em', '%']} value="px" onChange={...} />
```

Every variant shares the same outer label/hint/description/disabled API. Variant-specific concerns (slider steps, mono font, toggle buttons) live inside the variant's renderer.

### Layer 2 — Scope definitions

A scope is a self-contained settings module. `defineScope()` registers it into a global `scopeRegistry`.

```ts
defineScope({
  id: 'border-shape',
  title: 'Border & Shape',
  icon: Square,
  display: 'collapsible',
  defaultOpen: false,
  source: 'common',                        // 'common' | 'settings' | 'content'
  fields: [
    {
      key: 'border',
      label: 'Border',
      type: 'border',
      read: (s) => ({ radius: s.borderRadius, width: s.borderWidth, color: s.borderColor, style: s.borderStyle }),
      write: (v) => ({ borderRadius: v.radius, borderWidth: v.width, borderColor: v.color, borderStyle: v.style }),
    },
    {
      key: 'shadow',
      label: 'Shadow',
      type: 'shadow',
      read: (s) => s.boxShadow,
      write: (v) => ({ boxShadow: v }),
    },
  ],
})
```

Each field declares:
- `key`, `label`, optional `description` / `hint`
- `type` — a `SettingInput` variant
- `read(source) => inputValue` — maps from block data to the input's value
- `write(inputValue) => Partial<source>` — maps back to a patch
- Variant-specific config (min/max/step/options/etc.) passed through to the input

Built-in scopes ship:
- `spacing` — padding, margin
- `surface` — background color, opacity
- `border-shape` — border (composite), radius
- `effects` — shadow, (future: blur, filter)
- `layout` — fullWidth, minHeight
- `visibility` — visibility enum (visible / print-only / screen-only)
- `dimensions` — width, height (where applicable)
- `dynamic` — dynamicKey, previewValue

### Layer 3 — Block registry integration

`BlockDefinition` gains two optional fields:

```ts
scopes?: string[]                                   // ordered, e.g. ['spacing','border-shape','dynamic']
scopeOverrides?: Record<string, ScopeOverride>      // hide fields or override defaults per block
```

`ScopeOverride` shape:

```ts
interface ScopeOverride {
  hiddenFields?: string[]                           // skip specific field keys
  defaultOpen?: boolean                             // override collapse state
  title?: string                                    // override label (rare)
}
```

`BlockSettings.tsx` becomes a minimal renderer: loop `def.scopes ?? DEFAULT_SCOPES`, resolve each from the registry, render `<SettingBlock>` wrapping fields rendered through `<SettingInput>`. The 4 hand-rolled container components are deleted.

Per-block content groups (block-specific `settingsLayout`) keep their declarative shape. `AutoSettingsRenderer` is rewritten to emit `SettingBlock` + `SettingInput` — no custom JSX, no separate `*Field` files.

### Layer 4 — Data flow

```
Block instance
  ├── commonSettings  ← scopes with source: 'common'
  ├── settings        ← scopes with source: 'settings' + per-block settings groups
  └── content         ← per-block content groups (settingsLayout)
```

Scopes + auto-rendered per-block groups all go through the same `SettingInput` dispatcher. One history commit strategy (`pushHistory` on change start, live updates via direct setter).

## File layout

```
src/components/builder/settings/
├── primitives/
│   ├── setting-block.tsx              # SettingBlock
│   ├── setting-input.tsx              # SettingInput dispatcher
│   ├── unit-toggle.tsx                # UnitToggle
│   ├── variants/
│   │   ├── text.tsx                   # input, textarea, rich_editor, mono
│   │   ├── numeric.tsx                # number, stepper, slider, spacing, dimension
│   │   ├── toggle.tsx                 # switch, checkbox
│   │   ├── choice.tsx                 # pills, select, alignment, icon
│   │   ├── color.tsx                  # color, color-swatch
│   │   ├── composite.tsx              # border, shadow, opacity
│   │   └── media.tsx                  # image, list
│   └── index.ts
├── scopes/
│   ├── registry.ts                    # defineScope, getScope, scopeRegistry
│   ├── spacing.ts
│   ├── surface.ts
│   ├── border-shape.ts
│   ├── effects.ts
│   ├── layout.ts
│   ├── visibility.ts
│   ├── dimensions.ts
│   ├── dynamic.ts
│   └── index.ts
├── auto-settings-renderer.tsx          # rewritten to emit primitives
└── index.ts                            # public barrel
```

Deleted files: `border-settings.tsx`, `alignment-control.tsx`, `color-swatch-control.tsx`, `fields.tsx`, `item-list-editor.tsx`, `list-control.tsx`, `number-stepper-control.tsx`, `opacity-slider.tsx`, `option-pills.tsx`, `settings-field.tsx`, `settings-group.tsx`, `settings-inputs.tsx`, `shadow-control.tsx`, `spacing-slider.tsx`. Their logic moves into variants.

## Migration plan

1. Build primitives (`SettingBlock`, `SettingInput`, `UnitToggle`, variants) alongside old components.
2. Build scope registry + port 4 existing container groups (spacing, surface, border-shape, dynamic).
3. Add new scopes: effects, layout, visibility, dimensions.
4. Rewire `BlockSettings.tsx`. Default scope list `['spacing','surface','border-shape','effects','dynamic']` matches today's UI for unmodified blocks.
5. Rewrite `AutoSettingsRenderer` to emit primitives.
6. Update any override modules in `settings/overrides/` to use primitives.
7. Delete old field files.
8. `npx tsc --noEmit` + smoke test canvas + settings panel.

## Scope boundaries

**In scope**
- Refactor settings UI layer (primitives + scopes + registry)
- Expose already-existing `CommonBlockSettings` fields via new scopes (visibility, minHeight, fullWidth, anchor)
- Mechanical updates to 25 block definitions (adopt `scopes` where default doesn't match)

**Out of scope**
- New block types
- Schema version bump (store version stays at 14)
- Per-block content UI redesign — `settingsLayout` shape stays
- Export pipeline changes
- Frame / section / template system changes

## Success criteria

- `src/components/builder/settings/` contains only primitives, scopes, registry, and the auto-renderer
- `BlockSettings.tsx` is under 80 lines; no local container components
- `CommonBlockSettings` field without a UI → zero
- Adding a new scope = one file under `scopes/`, one line in the block's `scopes` array
- `npx tsc --noEmit` passes
- Canvas + settings panel work for all 25 block types with no visible regression
