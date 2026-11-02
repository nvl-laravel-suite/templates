# GCT Voucher Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Nexus Composer CV builder into a constrained A4 voucher builder with 3 fixed sections, frame image background, visual tooling (rulers, grid, debug), and HTML/JSON export.

**Architecture:** Strip all CV-specific blocks (24 blocks), replace the multi-page model with a single-page 3-section voucher model, rebuild the canvas to render sections with mm-accurate positioning, and replace exports with voucher-aware HTML + JSON.

**Tech Stack:** React 19, Zustand v5, Zod, Tailwind v4, shadcn/ui, @dnd-kit, lucide-react

---

## File Structure

### Files to Create
- `src/lib/voucher.ts` — Voucher constants, mm↔px conversion, section height math
- `src/components/builder/voucher-canvas.tsx` — Main canvas with scaling, frame, sections
- `src/components/builder/voucher-section.tsx` — Individual section container with overflow detection
- `src/components/builder/canvas-toolbar.tsx` — Rulers/grid/snap/debug/zoom toggles
- `src/components/builder/ruler-overlay.tsx` — mm-graduated rulers
- `src/components/builder/grid-overlay.tsx` — Configurable grid lines
- `src/lib/export-json.ts` — JSON export with html/blocks modes
- `src/store/actionModules/sections.ts` — Section height adjustment, section-level operations

### Files to Delete (full list in Task 1)
- 11 CV section renderers, 10 internal entry renderers, 2 CV composable renderers
- 11 CV section definitions, 10 internal entry definitions, 2 CV composable definitions
- 12 CV settings overrides
- `src/lib/exportPdf.ts`, `src/lib/exportAts.ts`, `src/lib/exportSigned.ts`
- `src/components/builder/page-break-overlay.tsx`, `src/components/builder/page-manager.tsx`

### Files to Modify
- `src/lib/schema.ts` — Remove 23 CV block schemas, replace Page/Project with voucher model
- `src/lib/blocks/definitions/index.ts` — Remove CV exports
- `src/lib/blocks/registry.ts` — Remove `cv` category
- `src/lib/blocks/types.ts` — Remove `cv` from BlockCategory
- `src/components/builder/settings/overrides/index.ts` — Remove CV override imports/registrations
- `src/lib/export.ts` — Remove CV block cases, restructure for sections
- `src/store/document.ts` — Replace page model with sections
- `src/store/editor.ts` — Add visual tooling state
- `src/store/types.ts` — Update types for sections + visual tooling
- `src/store/hooks.ts` — Replace page hooks with section hooks
- `src/store/actions.ts` — Wire section actions
- `src/store/actionModules/blocks.ts` — Replace page references with section references
- `src/components/builder/layout-grid.tsx` — Gut and rewire for voucher sections
- `src/components/builder/global-settings.tsx` — Remove sidebar/paper size, add frame/section controls

---

## Phase 1: Strip CV-Specific Code

### Task 1: Delete CV Block Files

**Files:** Delete the following files (48 files total)

- [ ] **Step 1: Delete CV section renderers**

```bash
rm src/components/blocks/sections/awards-section-block.tsx
rm src/components/blocks/sections/certifications-section-block.tsx
rm src/components/blocks/sections/education-section-block.tsx
rm src/components/blocks/sections/experience-section-block.tsx
rm src/components/blocks/sections/languages-section-block.tsx
rm src/components/blocks/sections/projects-section-block.tsx
rm src/components/blocks/sections/publications-section-block.tsx
rm src/components/blocks/sections/references-section-block.tsx
rm src/components/blocks/sections/skills-section-block.tsx
rm src/components/blocks/sections/summary-section-block.tsx
rm src/components/blocks/sections/volunteer-section-block.tsx
rm -rf src/components/blocks/sections/variants/
```

- [ ] **Step 2: Delete internal entry renderers**

```bash
rm src/components/blocks/internal/award-entry-block.tsx
rm src/components/blocks/internal/certification-entry-block.tsx
rm src/components/blocks/internal/education-entry-block.tsx
rm src/components/blocks/internal/language-entry-block.tsx
rm src/components/blocks/internal/project-entry-block.tsx
rm src/components/blocks/internal/publication-entry-block.tsx
rm src/components/blocks/internal/reference-entry-block.tsx
rm src/components/blocks/internal/section-header-block.tsx
rm src/components/blocks/internal/timeline-entry-block.tsx
rm src/components/blocks/internal/volunteer-entry-block.tsx
```

- [ ] **Step 3: Delete CV composable renderers**

```bash
rm src/components/blocks/composables/skill-matrix-block.tsx
rm src/components/blocks/composables/interests-block.tsx
```

- [ ] **Step 4: Delete CV section definitions**

```bash
rm src/lib/blocks/definitions/sections/experience-section.ts
rm src/lib/blocks/definitions/sections/education-section.ts
rm src/lib/blocks/definitions/sections/skills-section.ts
rm src/lib/blocks/definitions/sections/languages-section.ts
rm src/lib/blocks/definitions/sections/certifications-section.ts
rm src/lib/blocks/definitions/sections/projects-section.ts
rm src/lib/blocks/definitions/sections/awards-section.ts
rm src/lib/blocks/definitions/sections/references-section.ts
rm src/lib/blocks/definitions/sections/volunteer-section.ts
rm src/lib/blocks/definitions/sections/publications-section.ts
rm src/lib/blocks/definitions/sections/summary-section.ts
```

- [ ] **Step 5: Delete internal entry definitions**

```bash
rm src/lib/blocks/definitions/internal/timeline-entry.ts
rm src/lib/blocks/definitions/internal/education-entry.ts
rm src/lib/blocks/definitions/internal/section-header.ts
rm src/lib/blocks/definitions/internal/language-entry.ts
rm src/lib/blocks/definitions/internal/certification-entry.ts
rm src/lib/blocks/definitions/internal/project-entry.ts
rm src/lib/blocks/definitions/internal/award-entry.ts
rm src/lib/blocks/definitions/internal/reference-entry.ts
rm src/lib/blocks/definitions/internal/volunteer-entry.ts
rm src/lib/blocks/definitions/internal/publication-entry.ts
```

- [ ] **Step 6: Delete CV composable definitions**

```bash
rm src/lib/blocks/definitions/composables/skill-matrix.ts
rm src/lib/blocks/definitions/composables/interests-block.ts
```

- [ ] **Step 7: Delete CV settings overrides**

```bash
rm src/components/builder/settings/overrides/skills-section-override.tsx
rm src/components/builder/settings/overrides/experience-section-override.tsx
rm src/components/builder/settings/overrides/education-section-override.tsx
rm src/components/builder/settings/overrides/languages-section-override.tsx
rm src/components/builder/settings/overrides/certifications-section-override.tsx
rm src/components/builder/settings/overrides/projects-section-override.tsx
rm src/components/builder/settings/overrides/awards-section-override.tsx
rm src/components/builder/settings/overrides/references-section-override.tsx
rm src/components/builder/settings/overrides/interests-override.tsx
rm src/components/builder/settings/overrides/volunteer-section-override.tsx
rm src/components/builder/settings/overrides/publications-section-override.tsx
rm src/components/builder/settings/overrides/summary-section-override.tsx
```

- [ ] **Step 8: Delete obsolete export and layout files**

```bash
rm src/lib/exportPdf.ts
rm src/lib/exportAts.ts
rm src/lib/exportSigned.ts
rm src/components/builder/page-break-overlay.tsx
rm src/components/builder/page-manager.tsx
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: delete 48 CV-specific block, definition, override, and export files"
```

---

### Task 2: Clean Up Imports and Registrations

**Files:**
- Modify: `src/lib/blocks/definitions/index.ts`
- Modify: `src/components/builder/settings/overrides/index.ts`
- Modify: `src/lib/blocks/registry.ts:158-164`
- Modify: `src/lib/blocks/types.ts:29`

- [ ] **Step 1: Clean definitions/index.ts — remove CV exports**

Replace the entire file with only the kept exports:

```typescript
// Import all block definitions — importing them registers them in the registry

// Primitives
export { headingBlock } from './primitives/heading'
export { textBlock } from './primitives/text'
export { imageBlock } from './primitives/image'
export { buttonBlock } from './primitives/button'
export { spacerBlock } from './primitives/spacer'
export { pageBreakBlock } from './primitives/page-break'
export { dateBlock } from './primitives/date'
export { qrCodeBlock } from './primitives/qr-code'
export { dividerBlock } from './primitives/divider'
export { listBlock } from './primitives/list'
export { codeBlock } from './primitives/code'
export { progressBlock } from './primitives/progress'
export { badgeBlock } from './primitives/badge'
export { metricBlock } from './primitives/metric'
export { ratingBlock } from './primitives/rating'
export { separatorBlock } from './primitives/separator'
export { highlightBlock } from './primitives/highlight'
export { linkListBlock } from './primitives/link-list'
export { signatureBlock } from './primitives/signature'
export { iconBadgeBlock } from './primitives/icon-badge'
export { avatarBlock } from './primitives/avatar'
export { timelineBlock } from './primitives/timeline'
export { statBarBlock } from './primitives/stat-bar'
export { tagCloudBlock } from './primitives/tag-cloud'

// Composables
export { bioBlock } from './composables/bio'
export { heroBlock } from './composables/hero'
export { quoteBlock } from './composables/quote'
export { calloutBlock } from './composables/callout'
export { testimonialBlock } from './composables/testimonial'
export { featureCardBlock } from './composables/feature-card'
export { socialsBlock } from './composables/socials'
export { contactInfoBlock } from './composables/contact-info'
export { tableBlock } from './composables/table'
export { letterHeaderBlock } from './composables/letter-header'
export { projectShowcaseBlock } from './composables/project-showcase'
export { pricingTierBlock } from './composables/pricing-tier'
export { profileCardBlock } from './composables/profile-card'
export { statsRowBlock } from './composables/stats-row'
export { portfolioItemBlock } from './composables/portfolio-item'
export { footerBlock } from './composables/footer'
export { placeholderBlock } from './composables/placeholder'

// Sections (generic only)
export { sectionBlock } from './sections/section'

// Layout
export { rowBlock } from './layout/row'
export { gridBlock } from './layout/grid'
export { columnBlock } from './layout/column'
```

- [ ] **Step 2: Clean overrides/index.ts — remove CV override imports and map entries**

Replace the entire file:

```typescript
import type { ReactNode } from 'react'
import { ContactInfoOverride } from './contact-info-override'
import { GridOverride } from './grid-override'
import { HighlightOverride } from './highlight-override'
import { IconBadgeOverride } from './icon-badge-override'
import { LinkListOverride } from './link-list-override'
import { RowOverride } from './row-override'
import { SectionOverride } from './section-override'
import { SocialsOverride } from './socials-override'
import { StatBarOverride } from './stat-bar-override'
import { TableOverride } from './table-override'
import { TagCloudOverride } from './tag-cloud-override'
import { TimelineOverride } from './timeline-override'
import type { BlockOverrideProps } from './types'

export { type BlockOverrideProps } from './types'

export const customOverrides: Record<string, (props: BlockOverrideProps) => ReactNode> = {
  row: RowOverride,
  grid: GridOverride,
  socials: SocialsOverride,
  table: TableOverride,
  contactInfo: ContactInfoOverride,
  section: SectionOverride,
  highlight: HighlightOverride,
  linkList: LinkListOverride,
  iconBadge: IconBadgeOverride,
  timeline: TimelineOverride,
  statBar: StatBarOverride,
  tagCloud: TagCloudOverride,
}
```

- [ ] **Step 3: Remove 'cv' from BlockCategory type**

In `src/lib/blocks/types.ts`, change line 29:

```typescript
// Old
export type BlockCategory = 'layout' | 'content' | 'media' | 'data' | 'cv'

// New
export type BlockCategory = 'layout' | 'content' | 'media' | 'data'
```

- [ ] **Step 4: Remove 'cv' from BLOCK_CATEGORIES array**

In `src/lib/blocks/registry.ts`, change lines 158-164:

```typescript
export const BLOCK_CATEGORIES: { key: BlockCategory; label: string }[] = [
  { key: 'layout', label: 'Layout' },
  { key: 'content', label: 'Content' },
  { key: 'media', label: 'Media' },
  { key: 'data', label: 'Data' },
]
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks/definitions/index.ts src/components/builder/settings/overrides/index.ts src/lib/blocks/registry.ts src/lib/blocks/types.ts
git commit -m "chore: remove CV block imports, overrides, and category from registry"
```

---

### Task 3: Strip CV Block Schemas from schema.ts

**Files:**
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Remove all CV block schema definitions**

Search `src/lib/schema.ts` for these schema variable definitions and delete each one (the `z.object({...})` block and its preceding comment):

- `ExperienceSectionBlockSchema`
- `EducationSectionBlockSchema`
- `SkillsSectionBlockSchema`
- `LanguagesSectionBlockSchema`
- `CertificationsSectionBlockSchema`
- `ProjectsSectionBlockSchema`
- `AwardsSectionBlockSchema`
- `ReferencesSectionBlockSchema`
- `VolunteerSectionBlockSchema`
- `PublicationsSectionBlockSchema`
- `SummarySectionBlockSchema`
- `TimelineEntryBlockSchema`
- `EducationEntryBlockSchema`
- `SectionHeaderBlockSchema`
- `LanguageEntryBlockSchema`
- `CertificationEntryBlockSchema`
- `ProjectEntryBlockSchema`
- `AwardEntryBlockSchema`
- `ReferenceEntryBlockSchema`
- `VolunteerEntryBlockSchema`
- `PublicationEntryBlockSchema`
- `InterestsBlockSchema`
- `SkillMatrixBlockSchema`

- [ ] **Step 2: Remove CV schemas from the BlockSchema union**

In the `BlockSchema = z.discriminatedUnion('type', [...])` array (around line 1291), remove these entries:

```
TimelineEntryBlockSchema,
SkillsSectionBlockSchema,
SectionHeaderBlockSchema,
EducationEntryBlockSchema,
ExperienceSectionBlockSchema,
EducationSectionBlockSchema,
LanguageEntryBlockSchema,
LanguagesSectionBlockSchema,
CertificationEntryBlockSchema,
CertificationsSectionBlockSchema,
ProjectEntryBlockSchema,
ProjectsSectionBlockSchema,
AwardEntryBlockSchema,
AwardsSectionBlockSchema,
ReferenceEntryBlockSchema,
ReferencesSectionBlockSchema,
InterestsBlockSchema,
VolunteerEntryBlockSchema,
VolunteerSectionBlockSchema,
PublicationEntryBlockSchema,
PublicationsSectionBlockSchema,
SummarySectionBlockSchema,
SkillMatrixBlockSchema,
```

The union should retain all primitives, kept composables, layout, and `SectionBlockSchema`.

- [ ] **Step 3: Remove CV type exports**

Delete these type export lines (around lines 1391-1429):

```typescript
// DELETE all of these:
export type TimelineEntryBlock = ...
export type SkillsSectionBlock = ...
export type SectionHeaderBlock = ...
export type EducationEntryBlock = ...
export type ExperienceSectionBlock = ...
export type EducationSectionBlock = ...
export type LanguageEntryBlock = ...
export type LanguagesSectionBlock = ...
export type CertificationEntryBlock = ...
export type CertificationsSectionBlock = ...
export type ProjectEntryBlock = ...
export type ProjectsSectionBlock = ...
export type AwardEntryBlock = ...
export type AwardsSectionBlock = ...
export type ReferenceEntryBlock = ...
export type ReferencesSectionBlock = ...
export type InterestsBlock = ...
export type VolunteerEntryBlock = ...
export type VolunteerSectionBlock = ...
export type PublicationEntryBlock = ...
export type PublicationsSectionBlock = ...
export type SummarySectionBlock = ...
export type SkillMatrixBlock = ...
```

- [ ] **Step 4: Remove PageBreakBlockSchema from the union** (single-page voucher, no page breaks)

Also remove `PageBreakBlockSchema` from the discriminated union and delete its type export.

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Fix any remaining type errors from imports of deleted types in other files. These will primarily be in `src/lib/export.ts` — leave those for Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts
git commit -m "chore: strip 24 CV block schemas from Zod schema and union"
```

---

### Task 4: Clean CV Cases from export.ts

**Files:**
- Modify: `src/lib/export.ts`

- [ ] **Step 1: Remove CV block case handlers from renderBlock()**

In the `renderBlock()` function's switch statement, delete these cases:

- `case 'timelineEntry':` (around line 232-249)
- `case 'educationEntry':` (around line 251-262)
- `case 'sectionHeader':` (around line 318-322)
- `case 'languageEntry':` (around line 323-328)
- `case 'certificationEntry':` (around line 330-336)
- `case 'projectEntry':` (around line 338-346)
- `case 'awardEntry':` (around line 348-354)
- `case 'referenceEntry':` (around line 356-362)
- `case 'volunteerEntry':` (around line 387-396)
- `case 'publicationEntry':` (around line 398-406)
- Remove CV section types from the combined section case (lines 365-374), keeping only `case 'section':`:

```typescript
// Keep ONLY this:
case 'section': {
  const title = content.title || ''
  const titleColor = settings.titleColor || textColor
  const dividerColor = settings.dividerColor || 'var(--nc-accent, #3b82f6)'
  const childIds = getChildren(block.id)
  const children = childIds.map((id) => renderBlock(id, depth + 1)).join('\n')
  inner = `<section style="margin-bottom:1rem">
    <h3 style="font-weight:bold;color:${titleColor};border-bottom:2px solid ${dividerColor};padding-bottom:4px;margin-bottom:8px">${escapeHtml(title)}</h3>
    ${children}
  </section>`
  break
}
```

- Also remove `case 'pageBreak':` if it exists.

- [ ] **Step 2: Remove any import references to deleted export files**

Search the codebase for imports of `exportPdf`, `exportAts`, `exportSigned` and remove/update them.

```bash
grep -r "exportPdf\|exportAts\|exportSigned\|export-ats\|export-pdf\|export-signed" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove CV block cases from HTML export and clean dead imports"
```

---

### Task 5: Remove PageBreakOverlay from LayoutGrid

**Files:**
- Modify: `src/components/builder/layout-grid.tsx:5,231`

- [ ] **Step 1: Remove PageBreakOverlay import and usage**

In `src/components/builder/layout-grid.tsx`:

Remove line 5:
```typescript
// DELETE
import { PageBreakOverlay } from '#/components/builder/page-break-overlay'
```

Remove line 231:
```typescript
// DELETE
<PageBreakOverlay paperSize={paperSize} />
```

Also remove the `paperSize` variable (line 198) since it's no longer used:
```typescript
// DELETE
const paperSize = (globalSettings.layout as any)?.paperSize || 'a4'
```

- [ ] **Step 2: Update EmptyState copy for voucher context**

In the `EmptyState` function (around line 123), update the CV-specific copy:

```typescript
function EmptyState() {
  const cards = [
    {
      icon: Sparkles,
      title: 'Quick Start',
      description: 'Start with a pre-built voucher template',
      color: 'text-violet-500',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      icon: LayoutTemplate,
      title: 'Pick a Template',
      description: 'Choose from voucher designs',
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      icon: FileText,
      title: 'Start Blank',
      description: 'Build from scratch with blocks',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
  ]
  // ... rest stays the same
}
```

- [ ] **Step 3: Run type check and dev server**

```bash
npx tsc --noEmit
npm run dev
```

Verify the app starts and the canvas renders (it will be empty/broken for sections but should not crash).

- [ ] **Step 4: Commit**

```bash
git add src/components/builder/layout-grid.tsx
git commit -m "chore: remove PageBreakOverlay and update empty state for voucher context"
```

---

### Task 6: Clean CV Migration Code from Document Store

**Files:**
- Modify: `src/store/document.ts:212-236`

- [ ] **Step 1: Remove CV-specific migration blocks**

In the `migrate()` function in `src/store/document.ts`:

Remove the `if (version < 6)` block (lines 212-219) that migrates experienceSection/educationSection/skillsSection variants — these block types no longer exist.

Remove CV-specific parts from the `if (version < 7)` block (lines 222-236) — specifically the section variant handling for `experienceSection` and `educationSection`. Keep the `paperSize` default setting.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/store/document.ts
git commit -m "chore: remove CV block migration code from document store"
```

---

## Phase 2: Restructure Data Model

### Task 7: Create Voucher Constants and Utilities

**Files:**
- Create: `src/lib/voucher.ts`

- [ ] **Step 1: Create the voucher utility module**

```typescript
// src/lib/voucher.ts

/** A4 dimensions in mm */
export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

/** Conversion factor: 1mm = 3.7795275591px at 96dpi */
export const MM_TO_PX = 3.7795275591

/** Convert mm to px */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX
}

/** Convert px to mm */
export function pxToMm(px: number): number {
  return px / MM_TO_PX
}

/** Default section heights in mm */
export const DEFAULT_SECTION_HEIGHTS: [number, number, number] = [90, 100, 90]

/** Default margin in mm (left/right) */
export const DEFAULT_MARGIN_HORIZONTAL = 10

/** Compute top/bottom margins from section heights */
export function computeMargins(sectionHeights: [number, number, number]): {
  top: number
  bottom: number
} {
  const totalSections = sectionHeights[0] + sectionHeights[1] + sectionHeights[2]
  const remaining = A4_HEIGHT_MM - totalSections
  const half = remaining / 2
  return { top: half, bottom: half }
}

/** Validate that sections + margins fit within A4 */
export function validateLayout(
  sectionHeights: [number, number, number],
  margins: { top: number; bottom: number }
): { valid: boolean; overflow: number } {
  const total = sectionHeights[0] + sectionHeights[1] + sectionHeights[2] + margins.top + margins.bottom
  return {
    valid: total <= A4_HEIGHT_MM,
    overflow: Math.max(0, total - A4_HEIGHT_MM),
  }
}

/** Section IDs (stable) */
export const SECTION_IDS = ['section-1', 'section-2', 'section-3'] as const
export type VoucherSectionId = typeof SECTION_IDS[number]

/** Compute section Y positions in mm */
export function computeSectionPositions(
  sectionHeights: [number, number, number],
  marginTop: number
): [number, number, number] {
  const y1 = marginTop
  const y2 = y1 + sectionHeights[0]
  const y3 = y2 + sectionHeights[1]
  return [y1, y2, y3]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/voucher.ts
git commit -m "feat: add voucher constants and mm/px conversion utilities"
```

---

### Task 8: Update Zod Schema for Voucher Model

**Files:**
- Modify: `src/lib/schema.ts` (Page/Project schemas around lines 1434-1462)

- [ ] **Step 1: Replace Page and Project schemas with voucher equivalents**

Replace the `PageLayoutSchema`, `PageSchema`, and `ProjectSchema` (lines 1435-1462) with:

```typescript
// ── Voucher Section ─────────────────────────────────────────────
export const VoucherSectionSchema = z.object({
  id: z.string(),
  height: z.number().default(90),        // mm
  padding: z.number().default(4),        // mm
  backgroundColor: z.string().default('transparent'),
  backgroundOpacity: z.number().min(0).max(1).default(1),
  blockIds: z.array(z.string()).default([]),
})

export type VoucherSection = z.infer<typeof VoucherSectionSchema>

// ── Frame ───────────────────────────────────────────────────────
export const FrameSchema = z.object({
  imageUrl: z.string().nullable().default(null),
  opacity: z.number().min(0).max(1).default(1),
})

export type Frame = z.infer<typeof FrameSchema>

// ── Project ─────────────────────────────────────────────────────
export const ProjectSchema = z.object({
  global: GlobalSettingsSchema,
  blocks: z.record(z.string(), BlockSchema),
  sections: z.tuple([VoucherSectionSchema, VoucherSectionSchema, VoucherSectionSchema]),
  columnBlocks: z.record(z.string(), z.array(z.string())).default({}),
  frame: FrameSchema.default({ imageUrl: null, opacity: 1 }),
})

export type Project = z.infer<typeof ProjectSchema>
```

- [ ] **Step 2: Update GlobalSettingsSchema layout — remove sidebar, paper size**

Replace the `layout` field in `GlobalSettingsSchema` (lines 48-56):

```typescript
layout: z.object({
  pagePadding: z.number().default(40),
  marginLeft: z.number().default(10),   // mm
  marginRight: z.number().default(10),  // mm
  marginTopOverride: z.number().nullable().default(null),   // null = auto-compute
  marginBottomOverride: z.number().nullable().default(null), // null = auto-compute
}),
```

- [ ] **Step 3: Keep the createDefaultBlock export working**

The `createDefaultBlock` function at the bottom should still work since it delegates to `createBlockInstance` which uses the registry.

- [ ] **Step 4: Run type check to identify cascading type errors**

```bash
npx tsc --noEmit 2>&1 | head -80
```

This will show all files that reference `Page`, `PageLayout`, `pages`, etc. — these are addressed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts
git commit -m "feat: replace Page/Project schema with VoucherSection/Frame model"
```

---

### Task 9: Update Store Types

**Files:**
- Modify: `src/store/types.ts`

- [ ] **Step 1: Update DocumentStoreState and related types**

Replace the content of `src/store/types.ts`:

```typescript
import type { Block, BlockType, CommonBlockSettings, GlobalSettings, Project, VoucherSection, Frame } from '#/lib/schema'
import type { BlockTreeSnapshot } from '#/lib/block-tree'

export interface ProjectSnapshot {
  global: GlobalSettings
  blocks: Record<string, Block>
  sections: [VoucherSection, VoucherSection, VoucherSection]
  columnBlocks: Record<string, string[]>
  frame: Frame
}

export interface DocumentStoreState extends Project {}

export interface EditorStoreState {
  activeSectionId: string | null
  activeBlockId: string | null
  activeBlockIds: string[]
  undoStack: ProjectSnapshot[]
  redoStack: ProjectSnapshot[]
  history: ProjectSnapshot[]
  historyIndex: number
  clipboard: BlockTreeSnapshot | null
  showWizard: boolean
  // Visual tooling
  showRulers: boolean
  showGrid: boolean
  gridSize: number       // mm
  snapToGrid: boolean
  debugMode: boolean
  zoomLevel: number      // percentage, 100 = actual size
  zoomMode: 'fit' | 'actual' | 'custom'
}

export interface ComposerActions {
  // Section actions
  updateSection: (sectionId: string, updates: Partial<VoucherSection>) => void
  // Block actions
  addBlock: (sectionId: string, type: BlockType) => void
  removeBlock: (blockId: string) => void
  removeBlocks: (blockIds: string[]) => void
  setActiveBlock: (blockId: string | null, options?: { additive?: boolean }) => void
  setActiveBlocks: (blockIds: string[]) => void
  clearActiveSelection: () => void
  updateBlock: (blockId: string, updates: Partial<Block>) => void
  updateBlockCommonSettings: (blockId: string, updates: Partial<CommonBlockSettings>) => void
  updateBlockCommonSettingsMany: (blockIds: string[], updates: Partial<CommonBlockSettings>) => void
  reorderBlocks: (sectionId: string, fromIndex: number, toIndex: number) => void
  duplicateBlock: (blockId: string, sectionId: string) => void
  duplicateBlocks: (blockIds: string[], sectionId: string) => void
  moveBlockUp: (blockId: string, sectionId: string) => void
  moveBlockDown: (blockId: string, sectionId: string) => void
  // Container actions (row/column nesting)
  addBlockToColumn: (columnId: string, blockType: BlockType) => void
  removeBlockFromColumn: (columnId: string, blockId: string) => void
  duplicateBlockInColumn: (columnId: string, blockId: string) => void
  moveBlockBetweenColumns: (blockId: string, fromKey: string, toKey: string, toIndex: number) => void
  reorderColumnBlocks: (columnKey: string, fromIndex: number, toIndex: number) => void
  moveBlockToColumn: (blockId: string, sectionId: string, columnId: string, index: number) => void
  moveBlockToSection: (blockId: string, columnId: string, sectionId: string, index: number) => void
  // Global actions
  updateGlobal: (updates: Partial<GlobalSettings>) => void
  updateLayout: (layout: Partial<GlobalSettings['layout']>) => void
  updateColors: (colors: Partial<GlobalSettings['colors']>) => void
  updateTypography: (typography: Partial<GlobalSettings['typography']>) => void
  updateMetadata: (metadata: Partial<GlobalSettings['metadata']>) => void
  updateFrame: (frame: Partial<Frame>) => void
  // History
  undo: () => void
  redo: () => void
  pushHistory: () => void
  // Clipboard
  copyBlock: (blockId: string) => void
  cutBlock: (blockId: string) => void
  pasteBlock: (sectionId: string) => void
  // Project
  resetProject: () => void
  loadProject: (project: Project) => void
  getProject: () => Project
  updateBlockContent: (blockId: string, key: string, value: unknown) => void
  // Editor visual tooling
  setShowRulers: (show: boolean) => void
  setShowGrid: (show: boolean) => void
  setGridSize: (size: number) => void
  setSnapToGrid: (snap: boolean) => void
  setDebugMode: (debug: boolean) => void
  setZoomLevel: (level: number) => void
  setZoomMode: (mode: 'fit' | 'actual' | 'custom') => void
  setActiveSectionId: (sectionId: string | null) => void
}

export interface ComposerState extends DocumentStoreState, EditorStoreState, ComposerActions {}
```

- [ ] **Step 2: Commit**

```bash
git add src/store/types.ts
git commit -m "feat: update store types for voucher sections and visual tooling"
```

---

### Task 10: Update Document Store

**Files:**
- Modify: `src/store/document.ts`

- [ ] **Step 1: Update defaultGlobal and createEmptyProject**

Replace the `defaultGlobal` and `createEmptyProject` in `src/store/document.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DocumentStoreState } from './types'
import type { GlobalSettings } from '#/lib/schema'
import { defaultCommonSettings } from '#/lib/schema'
import { SECTION_IDS, DEFAULT_SECTION_HEIGHTS } from '#/lib/voucher'

export const defaultGlobal: GlobalSettings = {
  layout: {
    pagePadding: 40,
    marginLeft: 10,
    marginRight: 10,
    marginTopOverride: null,
    marginBottomOverride: null,
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseSize: 16,
    lineHeight: 1.5,
    headingLineHeight: 1.2,
    paragraphSpacing: 0,
    headingSpacing: 0,
  },
  colors: {
    primary: '#111827',
    accent: '#3b82f6',
    background: '#ffffff',
    text: '#111827',
    secondary: '#6b7280',
    border: '#e5e7eb',
    surface: '#f9fafb',
    link: '#2563eb',
  },
  metadata: {
    title: 'Untitled Voucher',
    author: '',
    subject: undefined,
    keywords: [],
    language: 'en',
  },
}

export function createEmptyProject(): DocumentStoreState {
  return {
    global: defaultGlobal,
    blocks: {},
    sections: [
      { id: SECTION_IDS[0], height: DEFAULT_SECTION_HEIGHTS[0], padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, blockIds: [] },
      { id: SECTION_IDS[1], height: DEFAULT_SECTION_HEIGHTS[1], padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, blockIds: [] },
      { id: SECTION_IDS[2], height: DEFAULT_SECTION_HEIGHTS[2], padding: 4, backgroundColor: 'transparent', backgroundOpacity: 1, blockIds: [] },
    ],
    columnBlocks: {},
    frame: { imageUrl: null, opacity: 1 },
  }
}
```

- [ ] **Step 2: Update the persist config — bump version to 12, reset migration**

Since this is a product pivot, the migration should reset to a blank voucher:

```typescript
export const useDocumentStore = create<DocumentStoreState>()(
  persist(
    () => createEmptyProject(),
    {
      name: 'gct-voucher-project',
      version: 12,
      migrate: (_persisted: unknown, version: number) => {
        // Product pivot: any old data resets to blank voucher
        if (version < 12) {
          return createEmptyProject() as unknown as DocumentStoreState
        }
        return _persisted as unknown as DocumentStoreState
      },
    },
  ),
)
```

- [ ] **Step 3: Commit**

```bash
git add src/store/document.ts
git commit -m "feat: replace page-based document store with voucher section model"
```

---

### Task 11: Update Editor Store

**Files:**
- Modify: `src/store/editor.ts`

- [ ] **Step 1: Add visual tooling state to initial editor state**

```typescript
import { create } from 'zustand'
import type { EditorStoreState } from './types'
import { SECTION_IDS } from '#/lib/voucher'

export function createInitialEditorState(): EditorStoreState {
  return {
    activeSectionId: SECTION_IDS[0],
    activeBlockId: null,
    activeBlockIds: [],
    undoStack: [],
    redoStack: [],
    history: [],
    historyIndex: -1,
    clipboard: null,
    showWizard: false,
    showRulers: false,
    showGrid: false,
    gridSize: 5,
    snapToGrid: false,
    debugMode: false,
    zoomLevel: 100,
    zoomMode: 'fit',
  }
}

export const useEditorStore = create<EditorStoreState>(() => createInitialEditorState())
```

- [ ] **Step 2: Commit**

```bash
git add src/store/editor.ts
git commit -m "feat: add visual tooling state to editor store"
```

---

### Task 12: Update Store Hooks

**Files:**
- Modify: `src/store/hooks.ts`

- [ ] **Step 1: Replace page hooks with section hooks and add visual tooling hooks**

```typescript
import { useDocumentStore } from './document'
import { useEditorStore } from './editor'
import { composerActions } from './actions'
import type { DocumentStoreState, EditorStoreState } from './types'

export function useDocumentState<T>(selector: (state: DocumentStoreState) => T): T {
  return useDocumentStore(selector)
}

export function useEditorState<T>(selector: (state: EditorStoreState) => T): T {
  return useEditorStore(selector)
}

export function useSelectionState() {
  const activeBlockId = useEditorState((state) => state.activeBlockId)
  const activeBlockIds = useEditorState((state) => state.activeBlockIds)
  return { activeBlockId, activeBlockIds }
}

export function useSectionState() {
  const sections = useDocumentState((state) => state.sections)
  const activeSectionId = useEditorState((state) => state.activeSectionId)
  return { sections, activeSectionId }
}

export function useFrameState() {
  return useDocumentState((state) => state.frame)
}

export function useGlobalSettingsState() {
  return useDocumentState((state) => state.global)
}

export function useHistoryState() {
  const undoStack = useEditorState((state) => state.undoStack)
  const redoStack = useEditorState((state) => state.redoStack)
  return { undoStack, redoStack }
}

export function useClipboardState() {
  const clipboard = useEditorState((state) => state.clipboard)
  return { clipboard }
}

export function useVisualToolingState() {
  return {
    showRulers: useEditorState((s) => s.showRulers),
    showGrid: useEditorState((s) => s.showGrid),
    gridSize: useEditorState((s) => s.gridSize),
    snapToGrid: useEditorState((s) => s.snapToGrid),
    debugMode: useEditorState((s) => s.debugMode),
    zoomLevel: useEditorState((s) => s.zoomLevel),
    zoomMode: useEditorState((s) => s.zoomMode),
  }
}

export function useSelectionActions() {
  return {
    setActiveBlock: composerActions.setActiveBlock,
    setActiveBlocks: composerActions.setActiveBlocks,
    clearActiveSelection: composerActions.clearActiveSelection,
  }
}

export function useHistoryActions() {
  return {
    pushHistory: composerActions.pushHistory,
    undo: composerActions.undo,
    redo: composerActions.redo,
  }
}

export function useSectionActions() {
  return {
    updateSection: composerActions.updateSection,
    setActiveSectionId: composerActions.setActiveSectionId,
  }
}

export function useProjectActions() {
  return {
    resetProject: composerActions.resetProject,
    loadProject: composerActions.loadProject,
    getProject: composerActions.getProject,
  }
}

export function useGlobalSettingsActions() {
  return {
    updateLayout: composerActions.updateLayout,
    updateColors: composerActions.updateColors,
    updateTypography: composerActions.updateTypography,
    updateMetadata: composerActions.updateMetadata,
    updateFrame: composerActions.updateFrame,
  }
}

export function useBlockActions() {
  return {
    addBlock: composerActions.addBlock,
    updateBlock: composerActions.updateBlock,
    updateBlockCommonSettings: composerActions.updateBlockCommonSettings,
    updateBlockCommonSettingsMany: composerActions.updateBlockCommonSettingsMany,
    removeBlock: composerActions.removeBlock,
    removeBlocks: composerActions.removeBlocks,
    duplicateBlock: composerActions.duplicateBlock,
    duplicateBlocks: composerActions.duplicateBlocks,
    moveBlockUp: composerActions.moveBlockUp,
    moveBlockDown: composerActions.moveBlockDown,
    duplicateBlockInColumn: composerActions.duplicateBlockInColumn,
    reorderBlocks: composerActions.reorderBlocks,
    reorderColumnBlocks: composerActions.reorderColumnBlocks,
  }
}

export function useContainerActions() {
  return {
    addBlockToColumn: composerActions.addBlockToColumn,
    removeBlockFromColumn: composerActions.removeBlockFromColumn,
    duplicateBlockInColumn: composerActions.duplicateBlockInColumn,
    reorderColumnBlocks: composerActions.reorderColumnBlocks,
    moveBlockBetweenColumns: composerActions.moveBlockBetweenColumns,
    moveBlockToColumn: composerActions.moveBlockToColumn,
    moveBlockToSection: composerActions.moveBlockToSection,
  }
}

export function useClipboardActions() {
  return {
    copyBlock: composerActions.copyBlock,
    cutBlock: composerActions.cutBlock,
    pasteBlock: composerActions.pasteBlock,
  }
}

export function useVisualToolingActions() {
  return {
    setShowRulers: composerActions.setShowRulers,
    setShowGrid: composerActions.setShowGrid,
    setGridSize: composerActions.setGridSize,
    setSnapToGrid: composerActions.setSnapToGrid,
    setDebugMode: composerActions.setDebugMode,
    setZoomLevel: composerActions.setZoomLevel,
    setZoomMode: composerActions.setZoomMode,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/store/hooks.ts
git commit -m "feat: replace page hooks with section/visual tooling hooks"
```

---

### Task 13: Update Block Actions for Section Model

**Files:**
- Modify: `src/store/actionModules/blocks.ts`

- [ ] **Step 1: Replace page references with section references**

The `blocks.ts` action module currently references `page.blockIds`. Update all methods that use `pageId` to use `sectionId` instead. The key change is in `addBlock`, `reorderBlocks`, `moveBlockUp`, `moveBlockDown`, `duplicateBlock`, `duplicateBlocks`.

The commands (`ADD_BLOCK_TO_PAGE`, `REORDER_PAGE_BLOCKS`, `DUPLICATE_BLOCKS_IN_PAGE`) reference pages — these need to be updated in the command handler (likely in `src/lib/engine/` or `src/store/actionModules/shared.ts`). Search for these command types:

```bash
grep -r "ADD_BLOCK_TO_PAGE\|REORDER_PAGE_BLOCKS\|DUPLICATE_BLOCKS_IN_PAGE\|REMOVE_BLOCKS" src/ --include="*.ts" --include="*.tsx" -l
```

Update the command types and their handlers to work with `sectionId` instead of `pageId`. The section is found via `state.sections.find(s => s.id === sectionId)` instead of `state.pages.find(p => p.id === pageId)`.

- [ ] **Step 2: Update the page actions module**

Modify `src/store/actionModules/pages.ts` to become a section actions module, or create a new `sections.ts`:

```typescript
// src/store/actionModules/sections.ts
import { updateProjectState } from '../runtime'
import type { ComposerActions } from '../types'
import type { VoucherSection } from '#/lib/schema'

export const sectionActions: Pick<ComposerActions, 'updateSection'> = {
  updateSection: (sectionId, updates) => {
    updateProjectState((state) => {
      const idx = state.sections.findIndex((s) => s.id === sectionId)
      if (idx === -1) return null
      const newSections = [...state.sections] as [VoucherSection, VoucherSection, VoucherSection]
      newSections[idx] = { ...newSections[idx], ...updates }
      return { sections: newSections }
    })
  },
}
```

- [ ] **Step 3: Wire section actions into the actions barrel**

Update `src/store/actions.ts` to include section actions and any new visual tooling actions.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit 2>&1 | head -80
```

Fix remaining type errors. This is the most interconnected task — expect cascading fixes across:
- `src/lib/engine/graph.ts` (page root ID helpers)
- `src/store/actionModules/containers.ts` (moveBlockToPage)
- Any component that calls `addBlock(pageId, type)` needs to switch to `addBlock(sectionId, type)`
- DnD handlers that reference pages

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate block/page actions to section-based model"
```

---

### Task 14: Compile and Verify Phase 2

**Files:** All modified files

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit
```

Fix all remaining errors.

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Start dev server and verify no crashes**

```bash
npm run dev
```

Open the browser and confirm the app loads without runtime errors (canvas may be empty/broken — that's fine, we're building it in Phase 3).

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve remaining type errors from section model migration"
```

---

## Phase 3: Build Voucher Canvas

### Task 15: Create VoucherSection Component

**Files:**
- Create: `src/components/builder/voucher-section.tsx`

- [ ] **Step 1: Build the section container**

```typescript
import { memo } from 'react'
import { cn } from '#/lib/utils'
import { mmToPx } from '#/lib/voucher'
import type { VoucherSection as VoucherSectionType, Block } from '#/lib/schema'

interface VoucherSectionProps {
  section: VoucherSectionType
  blocks: Block[]
  isActive: boolean
  debugMode: boolean
  debugColor: string
  marginLeft: number   // mm
  marginRight: number  // mm
  pagePadding: number  // px
  onSelect: () => void
  children: React.ReactNode
}

const DEBUG_COLORS = [
  'rgba(59, 130, 246, 0.08)',   // blue
  'rgba(34, 197, 94, 0.08)',    // green
  'rgba(239, 68, 68, 0.08)',    // red
]

export const VoucherSectionComponent = memo(function VoucherSectionComponent({
  section,
  blocks,
  isActive,
  debugMode,
  debugColor,
  marginLeft,
  marginRight,
  pagePadding,
  onSelect,
  children,
}: VoucherSectionProps) {
  const heightPx = mmToPx(section.height)
  const paddingPx = mmToPx(section.padding)
  const marginLeftPx = mmToPx(marginLeft)
  const marginRightPx = mmToPx(marginRight)

  return (
    <div
      className={cn(
        'relative transition-all',
        isActive && 'ring-2 ring-blue-400/50',
      )}
      style={{
        height: debugMode ? undefined : heightPx,
        minHeight: heightPx,
        maxHeight: debugMode ? undefined : heightPx,
        overflow: debugMode ? 'visible' : 'hidden',
        marginLeft: marginLeftPx,
        marginRight: marginRightPx,
        padding: paddingPx,
        backgroundColor: debugMode ? debugColor : (
          section.backgroundColor !== 'transparent'
            ? section.backgroundColor
            : undefined
        ),
        opacity: section.backgroundOpacity,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect()
      }}
    >
      {/* Section boundary marker */}
      {debugMode && (
        <>
          <div className="absolute left-0 right-0 bottom-0 border-b-2 border-dashed border-red-400/60 pointer-events-none" style={{ bottom: 0 }} />
          <div className="absolute right-2 top-1 text-[10px] font-mono text-muted-foreground/50 pointer-events-none">
            {section.id} · {section.height}mm
          </div>
        </>
      )}

      {/* Block content */}
      {children}

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <p className="text-[11px] text-muted-foreground/40">
            Drop blocks here
          </p>
        </div>
      )}
    </div>
  )
})

export { DEBUG_COLORS }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/builder/voucher-section.tsx
git commit -m "feat: create VoucherSection container component"
```

---

### Task 16: Create VoucherCanvas Component

**Files:**
- Create: `src/components/builder/voucher-canvas.tsx`
- Modify: `src/components/builder/layout-grid.tsx` (replace LayoutGrid with VoucherCanvas usage)

- [ ] **Step 1: Build the main canvas**

```typescript
import { memo, useMemo, useRef } from 'react'
import { cn } from '#/lib/utils'
import { A4_WIDTH_MM, A4_HEIGHT_MM, mmToPx, computeMargins, computeSectionPositions } from '#/lib/voucher'
import { VoucherSectionComponent, DEBUG_COLORS } from '#/components/builder/voucher-section'
import { BlockRenderer } from '#/components/blocks/block-renderer'
import { useDocumentState, useGlobalSettingsState, useSelectionActions, useVisualToolingState, useFrameState, useSectionState } from '#/store/hooks'
import { getFontFamily } from '#/lib/fonts'
import { getDirection } from '#/i18n/core'
import type { Block, CommonBlockSettings } from '#/lib/schema'
import { defaultCommonSettings } from '#/lib/schema'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useBlockSelection } from '#/hooks/use-block-selection'

const A4_WIDTH_PX = mmToPx(A4_WIDTH_MM)
const A4_HEIGHT_PX = mmToPx(A4_HEIGHT_MM)

function getWrapperStyles(cs: CommonBlockSettings | undefined, pagePadding: number): React.CSSProperties {
  const s = cs || defaultCommonSettings
  const isFullWidth = s.fullWidth
  const hPadLeft = s.paddingLeft > 0 ? s.paddingLeft : (isFullWidth ? 0 : pagePadding)
  const hPadRight = s.paddingRight > 0 ? s.paddingRight : (isFullWidth ? 0 : pagePadding)

  return {
    paddingTop: s.paddingTop || undefined,
    paddingBottom: s.paddingBottom || undefined,
    paddingLeft: hPadLeft || undefined,
    paddingRight: hPadRight || undefined,
    marginTop: s.marginTop || undefined,
    marginBottom: s.marginBottom || undefined,
    backgroundColor: s.backgroundColor !== 'transparent' ? s.backgroundColor : undefined,
    borderWidth: s.borderWidth || undefined,
    borderColor: s.borderWidth ? s.borderColor : undefined,
    borderStyle: s.borderWidth ? 'solid' as const : undefined,
    borderRadius: s.borderRadius || undefined,
    opacity: s.opacity < 1 ? s.opacity : undefined,
    boxShadow: s.boxShadow || undefined,
    minHeight: s.minHeight || undefined,
  }
}

const SortableBlock = memo(function SortableBlock({ block, sectionId, pagePadding }: {
  block: Block; sectionId: string; pagePadding: number
}) {
  const { activeBlockId, activeBlockIds, selectBlock } = useBlockSelection()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const isSelected = activeBlockIds.includes(block.id)
  const isPrimaryActive = activeBlockId === block.id

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const wrapperStyles = getWrapperStyles(block.commonSettings, pagePadding)

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-inline-editing]')) return
    e.stopPropagation()
    selectBlock(block.id, e.shiftKey)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      className={cn(
        'group relative cursor-pointer transition-all duration-150',
        isSelected ? 'nc-selected' : 'hover:nc-selected-light',
      )}
      onClick={handleClick}
    >
      <div
        className="absolute top-2 z-10 flex flex-col gap-1 opacity-0 transition group-hover:opacity-100"
        style={{ left: Math.max((wrapperStyles.paddingLeft as number || 0) - 20, 4) }}
      >
        <button
          {...attributes}
          {...listeners}
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded bg-background shadow-sm border text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <div style={{ ...wrapperStyles, containerType: 'inline-size' as const }}>
        <BlockRenderer block={block} />
      </div>
    </div>
  )
})

export function VoucherCanvas() {
  const blocks = useDocumentState((state) => state.blocks)
  const globalSettings = useGlobalSettingsState()
  const frame = useFrameState()
  const { sections, activeSectionId } = useSectionState()
  const { clearActiveSelection } = useSelectionActions()
  const { debugMode } = useVisualToolingState()
  const containerRef = useRef<HTMLDivElement>(null)

  const layout = globalSettings.layout
  const pagePadding = layout?.pagePadding ?? 40
  const marginLeft = (layout as any)?.marginLeft ?? 10
  const marginRight = (layout as any)?.marginRight ?? 10
  const direction = getDirection(globalSettings.metadata.language)

  const sectionHeights: [number, number, number] = [
    sections[0].height,
    sections[1].height,
    sections[2].height,
  ]

  const margins = useMemo(() => {
    const marginTopOverride = (layout as any)?.marginTopOverride
    const marginBottomOverride = (layout as any)?.marginBottomOverride
    const computed = computeMargins(sectionHeights)
    return {
      top: marginTopOverride ?? computed.top,
      bottom: marginBottomOverride ?? computed.bottom,
    }
  }, [sectionHeights, layout])

  return (
    <div
      ref={containerRef}
      className="relative mx-auto my-8 bg-white nc-paper print:m-0 print:shadow-none"
      style={{
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        '--nc-primary': globalSettings.colors.primary,
        '--nc-accent': globalSettings.colors.accent,
        '--nc-background': globalSettings.colors.background,
        '--nc-text': globalSettings.colors.text,
        '--nc-secondary': (globalSettings.colors as any).secondary || '#6b7280',
        '--nc-border': (globalSettings.colors as any).border || '#e5e7eb',
        '--nc-surface': (globalSettings.colors as any).surface || '#f9fafb',
        '--nc-link': (globalSettings.colors as any).link || '#2563eb',
        '--nc-page-padding': `${pagePadding}px`,
        fontFamily: getFontFamily(globalSettings.typography.bodyFont),
        fontSize: globalSettings.typography.baseSize,
        lineHeight: globalSettings.typography.lineHeight,
        backgroundColor: globalSettings.colors.background,
        color: globalSettings.colors.text,
        direction,
        overflow: 'hidden',
      } as React.CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) clearActiveSelection()
      }}
    >
      {/* Frame background image */}
      {frame.imageUrl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${frame.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: frame.opacity,
          }}
        />
      )}

      {/* Top margin spacer */}
      <div style={{ height: mmToPx(margins.top) }} />

      {/* Three sections */}
      {sections.map((section, index) => {
        const sectionBlocks = section.blockIds
          .map((id) => blocks[id])
          .filter(Boolean)

        return (
          <VoucherSectionComponent
            key={section.id}
            section={section}
            blocks={sectionBlocks}
            isActive={activeSectionId === section.id}
            debugMode={debugMode}
            debugColor={DEBUG_COLORS[index]}
            marginLeft={marginLeft}
            marginRight={marginRight}
            pagePadding={pagePadding}
            onSelect={() => {}}
          >
            {sectionBlocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                sectionId={section.id}
                pagePadding={pagePadding}
              />
            ))}
          </VoucherSectionComponent>
        )
      })}

      {/* Bottom margin spacer */}
      <div style={{ height: mmToPx(margins.bottom) }} />
    </div>
  )
}
```

- [ ] **Step 2: Update layout-grid.tsx to use VoucherCanvas**

Replace the `LayoutGrid` export to delegate to VoucherCanvas. Or, if the parent component directly mounts `LayoutGrid`, update it to mount `VoucherCanvas` instead. Search for `LayoutGrid` usage:

```bash
grep -r "LayoutGrid\|layout-grid" src/ --include="*.ts" --include="*.tsx" -l
```

Update the parent to import and render `VoucherCanvas` instead of `LayoutGrid`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: create VoucherCanvas with A4 layout, frame, and 3-section rendering"
```

---

### Task 17: Create Canvas Toolbar

**Files:**
- Create: `src/components/builder/canvas-toolbar.tsx`

- [ ] **Step 1: Build the toolbar with toggle buttons**

```typescript
import { Ruler, Grid3x3, Magnet, Bug, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { useVisualToolingState, useVisualToolingActions } from '#/store/hooks'
import { cn } from '#/lib/utils'

function ToolbarToggle({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'bg-foreground/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export function CanvasToolbar() {
  const { showRulers, showGrid, snapToGrid, debugMode, zoomLevel, zoomMode } = useVisualToolingState()
  const {
    setShowRulers, setShowGrid, setSnapToGrid,
    setDebugMode, setZoomLevel, setZoomMode,
  } = useVisualToolingActions()

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/95 px-2 py-1 shadow-sm backdrop-blur-sm">
      <ToolbarToggle active={showRulers} onClick={() => setShowRulers(!showRulers)} icon={Ruler} label="Rulers" />
      <ToolbarToggle active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={Grid3x3} label="Grid" />
      <ToolbarToggle active={snapToGrid} onClick={() => setSnapToGrid(!snapToGrid)} icon={Magnet} label="Snap" />
      <ToolbarToggle active={debugMode} onClick={() => setDebugMode(!debugMode)} icon={Bug} label="Debug" />

      <div className="mx-1 h-4 w-px bg-border" />

      <button
        onClick={() => setZoomLevel(Math.max(25, zoomLevel - 10))}
        className="p-1 text-muted-foreground hover:text-foreground"
        title="Zoom out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => {
          if (zoomMode === 'fit') {
            setZoomMode('actual')
            setZoomLevel(100)
          } else {
            setZoomMode('fit')
          }
        }}
        className="min-w-[3rem] text-center text-[11px] font-mono text-muted-foreground hover:text-foreground"
        title={zoomMode === 'fit' ? 'Switch to 100%' : 'Fit to width'}
      >
        {zoomMode === 'fit' ? 'Fit' : `${zoomLevel}%`}
      </button>
      <button
        onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
        className="p-1 text-muted-foreground hover:text-foreground"
        title="Zoom in"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Mount the toolbar above the canvas**

Find where the canvas is mounted and add the toolbar above it. This is typically in the main builder layout component.

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/canvas-toolbar.tsx
git commit -m "feat: create canvas toolbar with rulers/grid/snap/debug/zoom toggles"
```

---

## Phase 4: Visual Tooling

### Task 18: Create Ruler Overlay

**Files:**
- Create: `src/components/builder/ruler-overlay.tsx`

- [ ] **Step 1: Build mm-graduated rulers**

```typescript
import { memo } from 'react'
import { A4_WIDTH_MM, A4_HEIGHT_MM, mmToPx } from '#/lib/voucher'

export const RulerOverlay = memo(function RulerOverlay() {
  const width = mmToPx(A4_WIDTH_MM)
  const height = mmToPx(A4_HEIGHT_MM)
  const tickSmall = 4
  const tickLarge = 8

  const horizontalTicks: React.ReactNode[] = []
  for (let mm = 0; mm <= A4_WIDTH_MM; mm++) {
    const x = mmToPx(mm)
    const isMajor = mm % 10 === 0
    horizontalTicks.push(
      <line key={`h-${mm}`} x1={x} y1={isMajor ? 20 - tickLarge : 20 - tickSmall} x2={x} y2={20} stroke="#94a3b8" strokeWidth={isMajor ? 0.5 : 0.25} />,
    )
    if (isMajor && mm > 0) {
      horizontalTicks.push(
        <text key={`ht-${mm}`} x={x} y={10} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">{mm}</text>,
      )
    }
  }

  const verticalTicks: React.ReactNode[] = []
  for (let mm = 0; mm <= A4_HEIGHT_MM; mm++) {
    const y = mmToPx(mm)
    const isMajor = mm % 10 === 0
    verticalTicks.push(
      <line key={`v-${mm}`} x1={isMajor ? 20 - tickLarge : 20 - tickSmall} y1={y} x2={20} y2={y} stroke="#94a3b8" strokeWidth={isMajor ? 0.5 : 0.25} />,
    )
    if (isMajor && mm > 0) {
      verticalTicks.push(
        <text key={`vt-${mm}`} x={10} y={y + 3} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">{mm}</text>,
      )
    }
  }

  return (
    <>
      {/* Top ruler */}
      <svg
        className="absolute pointer-events-none"
        style={{ top: -22, left: 0, width, height: 20 }}
        viewBox={`0 0 ${width} 20`}
      >
        <rect width={width} height={20} fill="#f8fafc" />
        {horizontalTicks}
      </svg>

      {/* Left ruler */}
      <svg
        className="absolute pointer-events-none"
        style={{ top: 0, left: -22, width: 20, height }}
        viewBox={`0 0 20 ${height}`}
      >
        <rect width={20} height={height} fill="#f8fafc" />
        {verticalTicks}
      </svg>
    </>
  )
})
```

- [ ] **Step 2: Mount in VoucherCanvas when showRulers is true**

Add to `VoucherCanvas`:
```typescript
{showRulers && <RulerOverlay />}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/ruler-overlay.tsx
git commit -m "feat: add mm-graduated ruler overlays for canvas"
```

---

### Task 19: Create Grid Overlay

**Files:**
- Create: `src/components/builder/grid-overlay.tsx`

- [ ] **Step 1: Build configurable grid lines**

```typescript
import { memo } from 'react'
import { A4_WIDTH_MM, A4_HEIGHT_MM, mmToPx } from '#/lib/voucher'

interface GridOverlayProps {
  gridSize: number  // mm
  marginTop: number // mm
  marginLeft: number // mm
  marginRight: number // mm
  sectionHeights: [number, number, number]
}

export const GridOverlay = memo(function GridOverlay({ gridSize, marginTop, marginLeft, marginRight, sectionHeights }: GridOverlayProps) {
  const contentWidth = A4_WIDTH_MM - marginLeft - marginRight
  const contentHeight = sectionHeights[0] + sectionHeights[1] + sectionHeights[2]

  const dots: React.ReactNode[] = []
  for (let x = 0; x <= contentWidth; x += gridSize) {
    for (let y = 0; y <= contentHeight; y += gridSize) {
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={mmToPx(marginLeft + x)}
          cy={mmToPx(marginTop + y)}
          r={0.5}
          fill="#cbd5e1"
        />,
      )
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: mmToPx(A4_WIDTH_MM), height: mmToPx(A4_HEIGHT_MM) }}
    >
      {dots}
    </svg>
  )
})
```

- [ ] **Step 2: Mount in VoucherCanvas when showGrid is true**

```typescript
{showGrid && (
  <GridOverlay
    gridSize={gridSize}
    marginTop={margins.top}
    marginLeft={marginLeft}
    marginRight={marginRight}
    sectionHeights={sectionHeights}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/grid-overlay.tsx
git commit -m "feat: add configurable grid overlay for canvas"
```

---

## Phase 5: Export System

### Task 20: Update HTML Export for Voucher Sections

**Files:**
- Modify: `src/lib/export.ts`

- [ ] **Step 1: Restructure exportToHTML for sections instead of pages**

The current export iterates `pages` and their `blockIds`. Update it to:
1. Read `project.sections` instead of `project.pages`
2. Render the frame as a background image on the page container
3. Position sections with mm-accurate CSS
4. Remove sidebar logic
5. Use the new margin computation

Key changes to the `exportToHTML` function:
- Replace `const { global: g, blocks, pages, columnBlocks } = project` with `const { global: g, blocks, sections, columnBlocks, frame } = project`
- Remove page iteration loop, replace with section rendering
- Add frame image as background-image on the page wrapper
- Position each section using absolute positioning with `top: Ymm` and `height: Hmm`
- Use `mm` CSS units for positions

- [ ] **Step 2: Commit**

```bash
git add src/lib/export.ts
git commit -m "feat: restructure HTML export for voucher sections with frame background"
```

---

### Task 21: Create JSON Export

**Files:**
- Create: `src/lib/export-json.ts`

- [ ] **Step 1: Build the JSON exporter**

```typescript
import type { Project, Block } from '#/lib/schema'
import { computeMargins } from '#/lib/voucher'
import { getBlockListChildIds, getDirectChildIds } from '#/lib/engine/graph'

export type JsonExportMode = 'html' | 'blocks'

export interface VoucherExport {
  format: 'gct-voucher'
  version: 1
  page: { width: 210; height: 297; unit: 'mm' }
  margins: { top: number; bottom: number; left: number; right: number }
  frame: { imageUrl: string | null; opacity: number }
  global: {
    fonts: { heading: string; body: string }
    colors: Record<string, string>
    baseSize: number
  }
  sections: VoucherSectionExport[]
}

export interface VoucherSectionExport {
  id: string
  height: number
  padding: number
  backgroundColor?: string
  html?: string
  blocks?: ExportBlock[]
}

export interface ExportBlock {
  type: string
  content: Record<string, unknown>
  settings: Record<string, unknown>
  commonSettings: Record<string, unknown>
  children?: ExportBlock[]
}

export function exportToJSON(project: Project, mode: JsonExportMode = 'blocks'): VoucherExport {
  const { global: g, blocks, sections, columnBlocks, frame } = project
  const layout = g.layout as any
  const sectionHeights: [number, number, number] = [sections[0].height, sections[1].height, sections[2].height]
  const computedMargins = computeMargins(sectionHeights)

  const graph = { blocks, pages: [], columnBlocks }
  const getChildren = (blockId: string) => getBlockListChildIds(graph, blockId)

  function blockToExport(blockId: string): ExportBlock | null {
    const block = blocks[blockId]
    if (!block) return null

    const childIds = getChildren(blockId)
    const children = childIds.map(blockToExport).filter(Boolean) as ExportBlock[]

    return {
      type: block.type,
      content: block.content as Record<string, unknown>,
      settings: (block as any).settings || {},
      commonSettings: (block.commonSettings || {}) as Record<string, unknown>,
      ...(children.length > 0 ? { children } : {}),
    }
  }

  return {
    format: 'gct-voucher',
    version: 1,
    page: { width: 210, height: 297, unit: 'mm' },
    margins: {
      top: layout?.marginTopOverride ?? computedMargins.top,
      bottom: layout?.marginBottomOverride ?? computedMargins.bottom,
      left: layout?.marginLeft ?? 10,
      right: layout?.marginRight ?? 10,
    },
    frame: {
      imageUrl: frame?.imageUrl ?? null,
      opacity: frame?.opacity ?? 1,
    },
    global: {
      fonts: { heading: g.typography.headingFont, body: g.typography.bodyFont },
      colors: g.colors as Record<string, string>,
      baseSize: g.typography.baseSize,
    },
    sections: sections.map((section) => {
      const sectionExport: VoucherSectionExport = {
        id: section.id,
        height: section.height,
        padding: section.padding,
        backgroundColor: section.backgroundColor !== 'transparent' ? section.backgroundColor : undefined,
      }

      if (mode === 'blocks') {
        sectionExport.blocks = section.blockIds
          .map(blockToExport)
          .filter(Boolean) as ExportBlock[]
      }

      // HTML mode can be added later using the existing HTML renderer

      return sectionExport
    }),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/export-json.ts
git commit -m "feat: create JSON export with html/blocks modes for voucher"
```

---

## Phase 6: Polish

### Task 22: Update Global Settings UI

**Files:**
- Modify: `src/components/builder/global-settings.tsx`

- [ ] **Step 1: Remove sidebar settings, add frame and section controls**

Replace the Layout settings group in `GlobalSettings` component:

```typescript
<SettingsGroup title="Layout" display="flat">
  <SliderField label="Content Padding" value={pp} onChange={(v) => updateLayout({ pagePadding: v })} onChangeStart={beginHistoryChange} min={0} max={80} step={4} />
  <SliderField label="Left Margin" value={(settings.layout as any)?.marginLeft ?? 10} onChange={(v) => updateLayout({ marginLeft: v } as any)} onChangeStart={beginHistoryChange} min={0} max={30} step={1} suffix="mm" />
  <SliderField label="Right Margin" value={(settings.layout as any)?.marginRight ?? 10} onChange={(v) => updateLayout({ marginRight: v } as any)} onChangeStart={beginHistoryChange} min={0} max={30} step={1} suffix="mm" />
</SettingsGroup>
```

Remove: Paper Size pills, Sidebar Width slider, Sidebar Background color, Sidebar Border pills.

Add a new Frame settings group and Section settings group (using `useSectionState`, `useSectionActions`, `useFrameState`).

- [ ] **Step 2: Commit**

```bash
git add src/components/builder/global-settings.tsx
git commit -m "feat: update global settings for voucher layout, frame, and sections"
```

---

### Task 23: Update Branding and Persist Key

**Files:**
- Modify: `src/store/document.ts` (persist name already updated in Task 10)
- Search and replace "Nexus Composer" references

- [ ] **Step 1: Search for CV/Nexus branding**

```bash
grep -ri "nexus\|curriculum\|resume\|cv " src/ --include="*.ts" --include="*.tsx" -l
```

Update found references to "GCT Voucher Builder" or generic terms.

- [ ] **Step 2: Update page title/metadata defaults**

Already done in Task 10 (metadata.title = "Untitled Voucher").

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: update branding from Nexus Composer to GCT Voucher Builder"
```

---

### Task 24: Final Verification

**Files:** All

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Run dev server and manual verification**

```bash
npm run dev
```

Verify:
- App loads without errors
- Canvas shows 3 sections with correct proportions
- Can add blocks to sections
- Debug mode colorizes sections
- Frame image setting works
- HTML export produces valid output
- JSON export produces correct structure
- No CV blocks appear in block library
- No CV-related text/copy remains

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: GCT Voucher Builder — complete migration from CV builder"
```
