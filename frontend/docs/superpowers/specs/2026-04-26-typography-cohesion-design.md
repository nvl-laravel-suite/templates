# Typography Cohesion — Design Spec

**Date**: 2026-04-26
**Scope**: Audit + normalize typography across blocks of the same kind
**Status**: Shipped (commit `5d2f845`)

---

## Problem

Vouchers compose 25 block types, many of which carry their own typography settings (font size, weight, alignment, color, letter spacing, transform, line height). Authors edit blocks one at a time, so it's easy to end up with eight headings at different sizes, three list blocks at different weights, or buttons that drifted apart from one another over the course of a session.

There was no way to see this drift, and no way to fix it short of clicking each block and editing the same field repeatedly. Visual cohesion silently degraded as the project grew.

## Design

### Goal

A panel inside the existing **Validate** tab that:

1. Surfaces typography variances within a *family* of like blocks (all headings, all buttons, all list blocks, etc.).
2. Surfaces *cross-family* hints when two families are each internally consistent but disagree with one another.
3. Lets the user normalize an entire family to a single value with one click — undoable.
4. Stays passive: hovering paints a focus outline on the canvas without changing the active selection, so the audit panel stays open while the user inspects.

### Family model

A "family" is a group of blocks that should visually match. Most block types contribute one family; **metric** and **metadata** contribute two each, because their schemas have prefixed dual-text typography (`valueFontSize` + `labelFontSize`, `fieldFontSize` + `labelFontSize`).

| Family id | Source block(s) | Settings prefix |
|---|---|---|
| `heading` | heading | — |
| `text` | text | — |
| `button` | button | — |
| `badge` | badge | — |
| `list` | list | — |
| `date` | date | — |
| `dataPlaceholder` | dataPlaceholder | — |
| `metric-value` | metric | — (default keys) |
| `metric-label` | metric | `label` |
| `metadata-field` | metadata | `field` |
| `metadata-label` | metadata | `label` |

The family map is the single source of truth for which blocks contribute to which audit. Adding a new typography-bearing block means adding one case to `familiesOf()` in [lib/typography-audit.ts](src/voucher-builder/lib/typography-audit.ts).

### Audited attributes

Seven attributes, in display order:

```
fontSize · fontWeight · alignment · textColor ·
letterSpacing · textTransform · lineHeight
```

These map to the trait keys contributed by the `typography` trait. `maxWidth` is intentionally excluded — it is layout, not type.

### Variance detection

For each family with ≥ 2 member blocks:

1. Read each block's value for the attribute (respecting the family's prefix).
2. Skip undefined values — they fall back to the trait default and are not a "choice".
3. Group by value, count, and sort descending.
4. If `> 1` distinct value exists, record an `AttributeVariance` with the dominant value as `majority`.

A `FamilyReport` lists every attribute with variance for that family, plus the block IDs that contribute. `totalVariances` is the count across all families — shown as a badge in the panel header.

### Cross-family hints

After per-family analysis, walk every attribute and find families that are *individually consistent* (one unique value for the attribute) but disagree with one another. These are surfaced separately — the system isn't broken inside any single family, but the families don't share a system.

Example: every heading uses `font-bold`, every button uses `font-medium`. That's two consistent families, one cross-family hint.

The threshold is `≥ 2 distinct values across ≥ 2 consistent families`. Cross-family hints are advisory — there is no one-click fix, because "make headings match buttons" rarely matches design intent.

### Normalization

`buildNormalizationPatches(project, family, attr, value)` returns one `{ blockId, patch }` per block in the family whose current value differs from the target. The panel applies them through the existing `updateBlock` action wrapped in `pushHistory()`, so it is fully undoable.

The patch key is computed via the same `prefixForFamily` lookup used for reading, ensuring `metric-label` writes go to `labelFontSize` etc.

### Interaction model

The panel is dual-mode:

- **Focus** (visual-only) — `setFocusedBlocks(ids)` paints an amber outline on the canvas without touching `activeBlockId`. Used by:
  - Hovering a family header (outlines all family members)
  - Hovering a value chip (outlines the blocks using that value)
  - Clicking a value chip (also expands the block list inline)
- **Jump** — `setActiveBlock(id)` swaps the right panel to Block settings for that block. Triggered only by the explicit pencil icon next to a block name in the expanded list.

This separation matters: a one-click jump on hover would dismiss the audit panel before the user could read it.

### Empty state

When `families.length === 0 && crossFamily.length === 0`, the panel renders a green "Typography is consistent" card. No skeleton, no loading state — analysis is synchronous and runs on every store change via `useMemo`.

## File map

```
src/voucher-builder/
├── lib/
│   ├── typography-audit.ts        # Pure analysis + patch builder (308 lines)
│   └── typography-audit.test.ts   # 6 test groups covering family detection,
│                                  # variance grouping, prefix handling, cross-
│                                  # family hints, and patch generation
└── builder/
    ├── typography-cohesion.tsx    # The Validate-tab panel
    └── validation-panel.tsx       # Mounts <TypographyCohesionSection />
```

## Non-goals

- **Typography scales / token system.** This audits what's there; it doesn't impose a scale.
- **Color contrast / WCAG.** Lives in the broader validation panel; out of scope here.
- **Auto-fix on save.** Normalization is always user-initiated.
- **Cross-page audits** beyond the current project — vouchers are single documents.
- **Body / display font family.** Currently a global setting, not per-block, so there is no variance to detect.

## Future hooks

- A "snap to global system" button that aligns a family to the project's global typography defaults instead of the in-project majority. Requires adding a global-defaults read path that the audit can target.
- Surfacing the same engine inside the `command-palette` so power users can normalize without opening the Validate tab.
- Per-section audits (e.g. headings inside the bottom voucher section only) for vouchers that intentionally split designs across the three sections.
