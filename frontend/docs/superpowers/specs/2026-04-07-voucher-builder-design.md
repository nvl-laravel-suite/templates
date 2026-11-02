# GCT Voucher Builder — Design Spec

**Date**: 2026-04-07
**Status**: Approved
**Origin**: Repurpose of Nexus Composer (CV builder) into a constrained A4 voucher builder

---

## 1. Product Vision

A visual gifting voucher builder that produces pixel-perfect A4 vouchers. Users compose vouchers by placing blocks into three fixed vertical sections on an A4 canvas, with a decorative frame image as the background. The builder provides mm-accurate rulers, grid overlays, snap-to-grid, and debug tooling. Output is HTML or JSON (with HTML-fragment or raw-block modes) for consumption by an external PDF rendering service.

**This is NOT a PDF generator.** It is a visual builder + exporter. Another service consumes the export and produces the final PDF.

---

## 2. Page Model

### 2.1 Dimensions
- **Fixed A4**: 210mm x 297mm, always. No other paper sizes.
- **Unit system**: All measurements stored in mm. Rendered to px via scale factor (`1mm = 3.7795px` at 96dpi).

### 2.2 Sections
Three vertical sections stacked top-to-bottom inside the page:

| Section | Default Height | Purpose |
|---------|---------------|---------|
| Section 1 (Top) | 90mm | Header area — logo, title, branding |
| Section 2 (Middle) | 100mm | Main content — voucher details, imagery |
| Section 3 (Bottom) | 90mm | Footer area — terms, QR code, contact |

- Section heights are **configurable** by the user.
- Sections span the full width of the content area (210mm minus left/right margins).
- Sections are the **primary input** — the user sets section heights first.

### 2.3 Margins
- **Computed by default**: `marginTopBottom = (297 - sum(sectionHeights)) / 2`
- With defaults (90+100+90 = 280mm): `(297 - 280) / 2 = 8.5mm` top and bottom
- **Left/right margins**: 10mm default, configurable
- **Asymmetric override**: User can set top and bottom margins independently
- **Validation**: `marginTop + sum(sectionHeights) + marginBottom` must equal 297mm. If user overrides margins, system warns/prevents if the total exceeds the page.

### 2.4 Frame Image
- A full A4 (210x297mm) background image that covers the entire page
- Renders **behind** all sections
- Sections sit on top of the frame; margin areas reveal the frame's decorative borders
- Configurable opacity
- The frame image is optional — without it, background is white/transparent

```
┌─────────── 210mm ───────────┐
│ ░░░░░░ frame image ░░░░░░░░ │  ← top margin (frame visible)
│ ░┌───────────────────────┐░ │
│ ░│     Section 1 (90mm)  │░ │  ← content on top of frame
│ ░├───────────────────────┤░ │
│ ░│     Section 2 (100mm) │░ │
│ ░├───────────────────────┤░ │
│ ░│     Section 3 (90mm)  │░ │
│ ░└───────────────────────┘░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← bottom margin (frame visible)
└─────────────────────────────┘
  ░ = frame visible through margins
  Left/right margins also reveal frame
```

---

## 3. Section Architecture

### 3.1 Data Model
Each section is a mini-canvas with its own ordered block list:

```typescript
interface VoucherSection {
  id: string                    // "section-1" | "section-2" | "section-3"
  height: number                // mm
  padding: number               // inner padding, mm (default 4mm)
  backgroundColor?: string      // optional, renders on top of frame
  backgroundOpacity?: number    // 0-1
  blockIds: string[]            // ordered root-level blocks in this section
}
```

### 3.2 Block Nesting Within Sections
Sections support the same nesting as the current page model:

```
Section
  └─ block (heading, text, image, etc.)
  └─ row
  │   ├─ column → [block, block]
  │   └─ column → [block]
  └─ block
```

- Rows and columns work identically to the current system
- `columnBlocks: Record<string, string[]>` remains for row→column→block nesting
- **No section-in-section nesting** — sections are top-level only

### 3.3 Overflow Handling

**Prevention (primary):**
- Before inserting a block, measure the section's current content height
- If adding the block would exceed the section's height, **block the insertion**
- Show a toast/indicator: "Section 1 is full (90mm limit)"

**Debug mode (secondary):**
- When debug is enabled, content renders past the section boundary (no clipping)
- A red dashed line marks the section boundary
- An overflow indicator shows: "Overflowing by 12mm"
- This lets users see what's overflowing and decide what to remove/resize

**Export behavior:**
- Export always clips to section boundaries — overflow content is not included

### 3.4 Section Padding
- Per-section configurable inner padding (default 4mm)
- Applied uniformly on all four sides within the section
- Reduces the usable area for blocks: `usableWidth = sectionWidth - 2*padding`, `usableHeight = sectionHeight - 2*padding`

---

## 4. Block System

### 4.1 Blocks to Remove (24 blocks)

**CV Sections (11):**
- `experienceSection`, `educationSection`, `skillsSection`, `languagesSection`
- `certificationsSection`, `projectsSection`, `awardsSection`, `referencesSection`
- `volunteerSection`, `publicationsSection`, `summarySection`

**Internal Entries (10):**
- `timelineEntry`, `educationEntry`, `languageEntry`, `certificationEntry`
- `projectEntry`, `awardEntry`, `referenceEntry`, `volunteerEntry`, `publicationEntry`
- `sectionHeader`

**CV Composables (2):**
- `skillMatrix`, `interests`

**Settings Overrides to Remove (11 files):**
- All section override files: `skills-section-override`, `experience-section-override`, `education-section-override`, `languages-section-override`, `certifications-section-override`, `projects-section-override`, `awards-section-override`, `references-section-override`, `volunteer-section-override`, `publications-section-override`, `summary-section-override`

### 4.2 Blocks to Keep (44 blocks)

**Primitives (25):** All stay — heading, text, image, button, spacer, pageBreak, date, qrCode, divider, list, code, progress, badge, metric, rating, separator, highlight, linkList, signature, iconBadge, avatar, timeline, statBar, tagCloud

**Composables (17):** bio, hero, quote, callout, testimonial, featureCard, socials, contactInfo, table, letterHeader, projectShowcase, pricingTier, profileCard, statsRow, portfolioItem, footer, placeholder

**Layout (3):** row, grid, column

**Generic section (1):** section (repurposed as a grouping container within voucher sections)

### 4.3 Blocks to Evaluate for Removal Later
Some kept blocks may not make sense for vouchers but are harmless to keep:
- `code` — unlikely on a voucher but useful for debug/developer vouchers
- `pageBreak` — single page, no page breaks needed. **Remove.**
- `timeline` — edge case, keep for now
- `statBar` — edge case, keep for now

### 4.4 Block Categories Update
Remove `cv` category. Remaining categories:
- `layout` — row, grid, column
- `content` — heading, text, divider, list, badge, separator, quote, callout, etc.
- `media` — image, avatar, hero, bio, featureCard, profileCard, portfolioItem, projectShowcase
- `data` — date, qrCode, metric, rating, progress, highlight, statBar, tagCloud, table, contactInfo, socials, signature, linkList, iconBadge

---

## 5. Visual Tooling

### 5.1 Rulers
- mm-graduated rulers along the **top** and **left** edges of the canvas
- Show tick marks at 1mm, labels at 10mm intervals
- Rulers reflect the actual mm dimensions at current zoom level
- **Toggle-able** from the canvas toolbar

### 5.2 Grid Overlay
- Rendered inside sections as a subtle dot or line grid
- **Configurable grid spacing**: 5mm (default), 10mm, or custom mm value
- Grid color: light gray, subtle enough to not obscure content
- **Snap-to-grid**: when enabled, block placement/resizing snaps to grid intersections
- **Toggle-able** from the canvas toolbar

### 5.3 Debug Mode
- **Section colorize**: each section gets a distinct semi-transparent color wash
  - Section 1: blue at 8% opacity
  - Section 2: green at 8% opacity
  - Section 3: red at 8% opacity
- **Overflow visualization**: content renders past section boundaries, red dashed boundary line, overflow measurement label
- **Section height labels**: each section shows its height in mm
- **Toggle-able** from the canvas toolbar

### 5.4 Canvas Toolbar
A floating or docked toolbar with toggles:
- `[Rulers]` `[Grid]` `[Snap]` `[Debug]` `[Zoom: fit/100%/+/-]`

---

## 6. Scaling & Display

### 6.1 Scale Calculation
- Canvas renders the A4 page at a computed scale to fit the viewport
- `scale = viewportWidth / (210mm * 3.7795)` — fit-to-width by default
- All block rendering uses CSS `transform: scale()` on the page container
- Measurements remain in mm internally; px conversion happens at render time

### 6.2 Zoom Controls
- **Fit to width** (default): scale the page to fill available horizontal space
- **100%**: 1:1 pixel mapping (actual print size on a 96dpi screen)
- **Custom zoom**: slider or +/- buttons
- Zoom level displayed in toolbar

### 6.3 Pixel-Perfect Rendering
- All section heights, margins, and paddings are computed from mm values
- CSS uses `mm` units where supported, falling back to computed px values
- Export HTML uses exact mm positioning for print fidelity

---

## 7. Export System

### 7.1 Remove
- `exportPdf.ts` — no more direct PDF export
- `exportAts.ts` — ATS is CV-specific
- `exportSigned.ts` — signed export not needed

### 7.2 Keep & Modify: HTML Export (`export.ts`)
- Self-contained HTML with inlined CSS
- Frame image as `background-image` on the page container
- Sections as absolutely-positioned divs with exact mm dimensions
- Blocks rendered inside sections with their styles
- Fonts inlined or linked (Google Fonts)
- Output is a single HTML string suitable for headless browser → PDF conversion

### 7.3 New: JSON Export (`exportJson.ts`)

Single JSON envelope with two content modes:

```typescript
interface VoucherExport {
  format: "gct-voucher"
  version: 1

  page: {
    width: 210
    height: 297
    unit: "mm"
  }

  margins: {
    top: number      // mm
    bottom: number   // mm
    left: number     // mm
    right: number    // mm
  }

  frame: {
    imageUrl: string | null
    opacity: number
  }

  global: {
    fonts: { heading: string, body: string }
    colors: { primary, accent, background, text, secondary, border, surface, link }
    baseSize: number
  }

  sections: VoucherSectionExport[]
}

interface VoucherSectionExport {
  id: string
  height: number    // mm
  padding: number   // mm
  backgroundColor?: string

  // Mode: "html" — pre-rendered HTML fragments
  html?: string

  // Mode: "blocks" — raw block data for consumer rendering
  blocks?: ExportBlock[]
}

interface ExportBlock {
  type: string
  content: Record<string, unknown>
  settings: Record<string, unknown>
  commonSettings: Record<string, unknown>
  children?: ExportBlock[]    // for rows/columns
}
```

The consuming service chooses which mode it wants at export time.

---

## 8. Store Architecture Changes

### 8.1 Document Store (`src/store/document.ts`)
Current model (pages array with blockIds) is replaced:

```typescript
// Old
interface ProjectData {
  pages: Page[]
  blocks: Record<string, Block>
  columnBlocks: Record<string, string[]>
  global: GlobalSettings
}

// New
interface VoucherProject {
  sections: [VoucherSection, VoucherSection, VoucherSection]  // always exactly 3
  blocks: Record<string, Block>       // flat block map (unchanged)
  columnBlocks: Record<string, string[]>  // row/column nesting (unchanged)
  frame: {
    imageUrl: string | null
    opacity: number
  }
  global: GlobalSettings              // simplified (no sidebar, no paper size)
}
```

### 8.2 Global Settings Simplification
Remove:
- `layout.paperSize` — always A4
- `layout.sidebarWidth`, `layout.sidebarBackground` — no sidebar
- Page layout variants (`standard`, `sidebar-left`, `sidebar-right`, `split`, `bento`) — not applicable

Add:
- `layout.marginLeft`, `layout.marginRight` — configurable (default 10mm)
- `layout.marginTop`, `layout.marginBottom` — computed or overridden

### 8.3 Editor Store (`src/store/editor.ts`)
Add new transient state:
- `showRulers: boolean`
- `showGrid: boolean`
- `gridSize: number` (mm)
- `snapToGrid: boolean`
- `debugMode: boolean`
- `zoomLevel: number` (percentage)
- `zoomMode: 'fit' | 'actual' | 'custom'`

### 8.4 Action Modules
- `pages.ts` — **remove** (no multi-page support)
- `blocks.ts` — modify to work with sections instead of pages
- New: `sections.ts` — section height adjustment, section-level operations

### 8.5 Store Version
Bump store version (currently 9) → 10 with migration that:
- Converts existing project data to new voucher format
- Or simply resets to a blank voucher template (since this is a product pivot, not a migration)

---

## 9. Canvas & Layout Changes

### 9.1 Remove
- `page-manager.tsx` — no multi-page
- `page-break-overlay.tsx` — no page breaks
- Sidebar rendering logic in `layout-grid.tsx`
- Layout variant handling (`sidebar-left`, `sidebar-right`, `split`, `bento`)

### 9.2 Modify: `layout-grid.tsx`
The canvas becomes:
1. A scaled A4 container with the frame image as background
2. Three section containers, absolutely positioned by computed mm offsets
3. Each section is a `SortableContext` (dnd-kit) accepting blocks
4. Blocks render inside sections with the existing `BlockRenderer` + `SortableBlock` pattern
5. Section boundary markers at the edges of each section

### 9.3 New Components
- `VoucherCanvas` — the main canvas wrapper with scaling, rulers, grid
- `VoucherSection` — a section container with height enforcement, drop zone, debug overlay
- `CanvasToolbar` — rulers/grid/snap/debug/zoom toggles
- `RulerOverlay` — mm-graduated rulers
- `GridOverlay` — configurable grid lines/dots

---

## 10. DnD Changes

### 10.1 Current DnD
Blocks drag between pages and into/out of columns. Collision detection prioritizes column children → column drop zones → page-level sortables.

### 10.2 New DnD
- Blocks drag **between sections** (not pages)
- Same column/row nesting DnD within a section
- Collision detection: column-children → column-drop-zones → section-level sortables
- **Overflow check on drop**: if dropping a block into a section would overflow it, reject the drop with feedback

---

## 11. UI Changes

### 11.1 Block Library
- Remove `cv` category entirely
- Remove all CV section blocks and entry blocks from the library
- Categories remain: layout, content, media, data

### 11.2 Global Settings Panel
- Remove page layout variants, sidebar settings, paper size
- Add: frame image picker, frame opacity
- Add: margin controls (with computed display)
- Add: section height controls for all 3 sections
- Show validation: total height indicator, overflow warning

### 11.3 Section Settings
When a section is selected (click on section background):
- Height (mm)
- Padding (mm)
- Background color + opacity
- Section label (for debug display)

### 11.4 Branding
- Rename from "Nexus Composer" to "GCT Voucher Builder" (or TBD brand name)
- Update any CV-specific copy, tooltips, placeholder text

---

## 12. Files to Delete

```
# Renderers
src/components/blocks/sections/awards-section-block.tsx
src/components/blocks/sections/certifications-section-block.tsx
src/components/blocks/sections/education-section-block.tsx
src/components/blocks/sections/experience-section-block.tsx
src/components/blocks/sections/languages-section-block.tsx
src/components/blocks/sections/projects-section-block.tsx
src/components/blocks/sections/publications-section-block.tsx
src/components/blocks/sections/references-section-block.tsx
src/components/blocks/sections/skills-section-block.tsx
src/components/blocks/sections/summary-section-block.tsx
src/components/blocks/sections/volunteer-section-block.tsx

src/components/blocks/internal/award-entry-block.tsx
src/components/blocks/internal/certification-entry-block.tsx
src/components/blocks/internal/education-entry-block.tsx
src/components/blocks/internal/language-entry-block.tsx
src/components/blocks/internal/project-entry-block.tsx
src/components/blocks/internal/publication-entry-block.tsx
src/components/blocks/internal/reference-entry-block.tsx
src/components/blocks/internal/section-header-block.tsx
src/components/blocks/internal/timeline-entry-block.tsx
src/components/blocks/internal/volunteer-entry-block.tsx

src/components/blocks/composables/skill-matrix-block.tsx
src/components/blocks/composables/interests-block.tsx

# Definitions
src/lib/blocks/definitions/sections/experience-section.ts
src/lib/blocks/definitions/sections/education-section.ts
src/lib/blocks/definitions/sections/skills-section.ts
src/lib/blocks/definitions/sections/languages-section.ts
src/lib/blocks/definitions/sections/certifications-section.ts
src/lib/blocks/definitions/sections/projects-section.ts
src/lib/blocks/definitions/sections/awards-section.ts
src/lib/blocks/definitions/sections/references-section.ts
src/lib/blocks/definitions/sections/volunteer-section.ts
src/lib/blocks/definitions/sections/publications-section.ts
src/lib/blocks/definitions/sections/summary-section.ts

src/lib/blocks/definitions/internal/timeline-entry.ts
src/lib/blocks/definitions/internal/education-entry.ts
src/lib/blocks/definitions/internal/language-entry.ts
src/lib/blocks/definitions/internal/certification-entry.ts
src/lib/blocks/definitions/internal/project-entry.ts
src/lib/blocks/definitions/internal/award-entry.ts
src/lib/blocks/definitions/internal/reference-entry.ts
src/lib/blocks/definitions/internal/volunteer-entry.ts
src/lib/blocks/definitions/internal/publication-entry.ts
src/lib/blocks/definitions/internal/section-header.ts

src/lib/blocks/definitions/composables/skill-matrix.ts
src/lib/blocks/definitions/composables/interests.ts

# Settings overrides
src/components/builder/settings/overrides/skills-section-override.tsx
src/components/builder/settings/overrides/experience-section-override.tsx
src/components/builder/settings/overrides/education-section-override.tsx
src/components/builder/settings/overrides/languages-section-override.tsx
src/components/builder/settings/overrides/certifications-section-override.tsx
src/components/builder/settings/overrides/projects-section-override.tsx
src/components/builder/settings/overrides/awards-section-override.tsx
src/components/builder/settings/overrides/references-section-override.tsx
src/components/builder/settings/overrides/volunteer-section-override.tsx
src/components/builder/settings/overrides/publications-section-override.tsx
src/components/builder/settings/overrides/summary-section-override.tsx

# Export
src/lib/exportPdf.ts
src/lib/exportAts.ts
src/lib/exportSigned.ts

# Page management
src/components/builder/page-break-overlay.tsx
```

---

## 13. Migration Strategy

This is a **product pivot**, not an incremental migration. Strategy:

1. **Phase 1 — Strip**: Remove all CV-specific blocks, sections, entries, overrides, exports
2. **Phase 2 — Restructure**: Replace page model with section model in store, schema, and canvas
3. **Phase 3 — Canvas**: Build new VoucherCanvas with sections, frame, scaling
4. **Phase 4 — Tooling**: Add rulers, grid, snap, debug mode
5. **Phase 5 — Export**: New HTML export (section-aware), new JSON export
6. **Phase 6 — Polish**: Block library cleanup, global settings, branding, UX

Each phase should leave the app in a buildable (if not fully functional) state.

---

## 14. Out of Scope

- PDF rendering (external service responsibility)
- Voucher templates/presets (future work after core is stable)
- User authentication / saving to cloud
- Voucher code generation logic
- Payment/redemption system
- Multi-page vouchers
- Print-specific CSS beyond what the HTML export handles
