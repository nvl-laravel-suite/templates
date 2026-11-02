# Voucher Builder Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 8 ergonomic and architectural issues identified during codebase audit — template system overhaul with API sync, wizard removal, multi-select clipboard, deep keyboard navigation, canvas DnD hints, pluggable PDF export, documentation rewrite, and dark mode completion.

**Architecture:** The work is organized in 5 dependency-ordered phases. Phase 1 cleans up stale code/docs. Phase 2 builds the new template system. Phase 3 improves editor ergonomics (3 parallelizable tasks). Phase 4 adds pluggable PDF export. Phase 5 completes dark mode.

**Tech Stack:** React 19, TanStack Start, Zustand v5, Zod, Tailwind v4, shadcn/ui, @dnd-kit, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-21-voucher-builder-improvements-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/config.ts` | App configuration loader (`public/config.json`) |
| `src/lib/templates/types.ts` | `VoucherTemplate`, `PartialTemplate` types |
| `src/lib/templates/registry.ts` | Template loading, merging, instantiation |
| `src/lib/templates/builtins.ts` | Built-in templates in new format |
| `src/lib/engine/navigation.ts` | `getNavigableBlockList()` for deep arrow navigation |
| `src/lib/export/html.ts` | `exportToHTML` (moved from `export.ts`) |
| `src/lib/export/json.ts` | `exportToJSON` (moved from `export-json.ts`) |
| `src/lib/export/pdf-strategies.ts` | PDF strategy interface + built-in strategies |
| `src/lib/export/index.ts` | Re-exports from export module |
| `public/config.json` | Default app config (optional, gitignored) |
| `public/config.example.json` | Example config for documentation |

### Modified Files

| File | Changes |
|------|---------|
| `src/store/editor.ts` | Remove `showWizard` |
| `src/store/types.ts` | Remove `showWizard`, update clipboard type |
| `src/store/actionModules/clipboard.ts` | Array-based copy/cut/paste |
| `src/routes/index.tsx` | Remove wizard refs, add config loading, update template picker |
| `src/lib/commands.ts` | Remove wizard command, remove `openWizard` from context |
| `src/hooks/use-keyboard-shortcuts.ts` | Multi-select copy/cut, deep arrow navigation |
| `src/components/builder/template-picker.tsx` | Full rewrite — grid layout, search, sync, confirmation |
| `src/components/builder/export-dialog.tsx` | Add PDF format, strategy picker |
| `src/components/builder/canvas-toolbar.tsx` | Add Layers toggle button |
| `src/components/builder/block-context-menu.tsx` | Multi-select copy/cut |
| `src/components/blocks/layout/row-block.tsx` | Empty column drop hints |
| `src/styles.css` | `.dark` overrides for `--nc-*` tokens |
| `CLAUDE.md` | Full rewrite for voucher product |
| `WALKTHROUGH.md` | Full rewrite for voucher product |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/builder/quick-start-wizard.tsx` | Replaced by template picker |
| `src/lib/export.ts` | Moved to `src/lib/export/html.ts` |
| `src/lib/export-json.ts` | Moved to `src/lib/export/json.ts` |

---

## Phase 1: Foundation (Cleanup)

### Task 1: Remove Quick Start Wizard

**Files:**
- Delete: `src/components/builder/quick-start-wizard.tsx`
- Modify: `src/store/types.ts:25` (remove `showWizard`)
- Modify: `src/store/editor.ts:15` (remove `showWizard`)
- Modify: `src/routes/index.tsx:22,66,207,249,337` (remove wizard imports, state, refs)
- Modify: `src/lib/commands.ts:32,92` (remove wizard from context and commands)

- [ ] **Step 1: Remove wizard from store types**

In `src/store/types.ts`, remove the `showWizard` field from `EditorStoreState`:

```ts
// Remove this line (line 25):
showWizard: boolean
```

- [ ] **Step 2: Remove wizard from editor initial state**

In `src/store/editor.ts`, remove `showWizard` from `createInitialEditorState()`:

```ts
// Remove this line (line 15):
showWizard: false,
```

- [ ] **Step 3: Remove wizard command from commands.ts**

In `src/lib/commands.ts`:

Remove `openWizard` from `CommandContext` interface (line 32):
```ts
// Remove this line:
openWizard: () => void
```

Remove the wizard command from the actions array (line 92):
```ts
// Remove this object from the actions array:
{ id: 'wizard', label: 'Open Quick Start', category: 'Actions', icon: Sparkles, action: () => ctx.openWizard() },
```

- [ ] **Step 4: Remove wizard from routes/index.tsx**

In `src/routes/index.tsx`:

Remove the import (line 22):
```ts
// Remove:
import { QuickStartWizard } from '#/components/builder/quick-start-wizard'
```

Remove state declaration (line 66):
```ts
// Remove:
const [wizardOpen, setWizardOpen] = useState(false)
```

Remove `openWizard` from `commandContext` (line 207):
```ts
// Remove:
openWizard: () => setWizardOpen(true),
```

Remove the wizard button from the left sidebar (line 249 area — the Sparkles button):
```ts
// Remove the button with onClick={() => setWizardOpen(true)} and Sparkles icon
```

Remove the `<QuickStartWizard>` component from the overlay section (line 337):
```ts
// Remove:
<QuickStartWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
```

Also remove the `Sparkles` import from lucide-react if no longer used.

- [ ] **Step 5: Delete the wizard file**

```bash
rm src/components/builder/quick-start-wizard.tsx
```

- [ ] **Step 6: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are remaining references to `showWizard` or `QuickStartWizard`, fix them.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove Quick Start Wizard

Wizard bypassed undo layer and is superseded by the template picker.
Removes component, store state, command palette entry, and all references."
```

---

### Task 2: Documentation — Rewrite CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (full rewrite)

- [ ] **Step 1: Rewrite CLAUDE.md**

Replace the entire file with accurate voucher builder documentation. The new content must cover:

- **Product name**: GCT Voucher Builder (not Nexus Composer)
- **Stack**: TanStack Start, React 19, Tailwind v4, shadcn/ui, Zustand v5, Zod, @dnd-kit, lucide-react
- **Commands**: `npm run dev`, `npm run build`, `npx tsc --noEmit`
- **Path alias**: `#/*` maps to `./src/*`
- **Key architecture**:
  - 25 block types in 5 categories: 16 primitives, 5 composables, 1 section, 3 layout
  - 3-section voucher model on fixed A4 canvas (210x297mm)
  - `VoucherSection` schema (id, height, padding, backgroundColor, backgroundOpacity, widthMode, verticalAlign, blockIds)
  - Frame system (background image overlay with opacity)
  - Sticker blocks (absolute positioning in mm)
  - Data placeholder blocks and QR code overwrite keys for dynamic vouchers
  - Block definitions in `src/lib/blocks/definitions/` using `defineBlock()`, `defineComposableBlock()`, `defineSectionBlock()`
  - Zod schemas in `src/lib/schema.ts`
  - Store: `src/store/document.ts` (persisted, v13), `src/store/editor.ts` (transient), `src/store/hooks.ts` (feature API)
  - Export: HTML (`src/lib/export.ts`), JSON (`src/lib/export-json.ts`)
  - Settings system: auto-generated from definitions via `AutoSettingsRenderer`
- **Conventions**: Same as current (focused store hooks, no padding in renderers, CSS variables, enum pill/select threshold, SettingsInput/SettingsTextarea rules)
- **Settings ownership**: Same parent-child cascade rules
- **Block definition helpers**: Same table (defineBlock, defineComposableBlock, defineSectionBlock)
- **Registration chain**: Same 5-point chain but updated block counts
- **Skills table**: Same

Use the deep-dive analysis as the authoritative source. Remove all CV-specific content (sidebar layouts, ATS export, CV intelligence, page system, 58-block references).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md for voucher builder product

Updates from CV builder references to current 25-block voucher model
with 3-section A4 canvas, frame system, and actual architecture."
```

---

### Task 3: Documentation — Rewrite WALKTHROUGH.md

**Files:**
- Modify: `WALKTHROUGH.md` (full rewrite)

- [ ] **Step 1: Rewrite WALKTHROUGH.md**

Full rewrite covering the current voucher product. Sections:

1. **What We're Building** — Visual voucher/gift card designer with block-based composition on A4 canvas
2. **The Idea** — Structured content blocks + visual freedom for voucher design (not CV building)
3. **Architecture Overview** — Accurate diagram with 3-section model, store layers, block registry
4. **The Block System** — 25 blocks, 5 categories, definition examples using actual voucher blocks
5. **Block Inventory** — Tables for all 25 blocks with content fields and key settings
6. **The Settings System** — 12 field types, auto-generation, overrides (accurate to current)
7. **Global Settings & Theming** — Layout (margin, pagePadding), typography, 8 color tokens, 10 presets
8. **The 3-Section Canvas** — VoucherSection schema, heights in mm, widthMode, verticalAlign, frame overlay
9. **The Export Pipeline** — HTML export, structured JSON export (`gct-voucher` format)
10. **Inline Editing** — heading, text, list blocks
11. **Templates** — Built-in, local folder, API sync, dual mode (full/partial)
12. **Design System** — Atelier Precision (unchanged)
13. **Icon System** — 53 icons, 8 categories (unchanged)
14. **Keyboard Shortcuts** — Current shortcuts table
15. **Data Model & Persistence** — Project with sections tuple, Frame, columnBlocks, store v13
16. **Project Structure** — Accurate directory tree

Remove: CV Intelligence, Auto-Fit, sidebar layouts, page system, 58-block inventory, ATS/PDF/signed export, CV templates.

- [ ] **Step 2: Commit**

```bash
git add WALKTHROUGH.md
git commit -m "docs: rewrite WALKTHROUGH.md for voucher builder product

Complete rewrite reflecting 25-block inventory, 3-section A4 canvas,
frame system, current settings, and accurate data model."
```

---

## Phase 2: Template System

### Task 4: App Configuration Layer

**Files:**
- Create: `src/lib/config.ts`
- Create: `public/config.example.json`

- [ ] **Step 1: Create the config module**

Create `src/lib/config.ts`:

```ts
import { z } from 'zod'

const AppConfigSchema = z.object({
  apiTemplateEndpoint: z.string().url().optional(),
  localTemplatePath: z.string().default('/templates/'),
  pdfExportEndpoint: z.string().url().optional(),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

const DEFAULT_CONFIG: AppConfig = {
  localTemplatePath: '/templates/',
}

let cachedConfig: AppConfig | null = null

export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig

  try {
    const res = await fetch('/config.json')
    if (!res.ok) {
      cachedConfig = DEFAULT_CONFIG
      return cachedConfig
    }
    const raw = await res.json()
    cachedConfig = AppConfigSchema.parse(raw)
    return cachedConfig
  } catch {
    cachedConfig = DEFAULT_CONFIG
    return cachedConfig
  }
}

export function getAppConfig(): AppConfig {
  return cachedConfig ?? DEFAULT_CONFIG
}
```

- [ ] **Step 2: Create example config**

Create `public/config.example.json`:

```json
{
  "apiTemplateEndpoint": "https://api.example.com/templates",
  "localTemplatePath": "/templates/",
  "pdfExportEndpoint": "https://pdf.example.com/render"
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/config.ts public/config.example.json
git commit -m "feat: add app configuration layer

Loads optional public/config.json at startup for API template endpoint,
local template path, and PDF export endpoint. Falls back to defaults."
```

---

### Task 5: Template Types and Registry

**Files:**
- Create: `src/lib/templates/types.ts`
- Create: `src/lib/templates/registry.ts`
- Create: `src/lib/templates/builtins.ts`
- Modify: `src/lib/templates/index.ts` (rewrite exports)

- [ ] **Step 1: Create template types**

Create `src/lib/templates/types.ts`:

```ts
import type { Project, GlobalSettings, Frame, BlockType, CommonBlockSettings } from '#/lib/schema'

export interface VoucherTemplate {
  id: string
  name: string
  description: string
  icon?: string
  category?: string
  thumbnail?: string
  mode: 'full' | 'partial'
  source: 'builtin' | 'local' | 'api'
  project?: Project
  partial?: PartialTemplate
}

export interface PartialTemplate {
  global?: Partial<GlobalSettings>
  frame?: Partial<Frame>
  sections?: PartialTemplateSection[]
}

export interface PartialTemplateSection {
  index: 0 | 1 | 2
  height?: number
  backgroundColor?: string
  backgroundOpacity?: number
  widthMode?: 'wide' | 'narrow' | 'tight'
  verticalAlign?: 'center' | 'start' | 'end'
  blocks: PartialTemplateBlock[]
}

export interface PartialTemplateBlock {
  type: BlockType
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  commonSettings?: Partial<CommonBlockSettings>
  children?: PartialTemplateBlock[]
}
```

- [ ] **Step 2: Create the registry**

Create `src/lib/templates/registry.ts`:

```ts
import type { VoucherTemplate } from './types'
import type { Project } from '#/lib/schema'
import { createDefaultBlock, defaultCommonSettings } from '#/lib/schema'
import { getComposableTemplates } from '#/lib/blocks'
import { createEmptyProject } from '#/store/document'
import { getAppConfig } from '#/lib/config'
import { nanoid } from 'nanoid'
import { builtinTemplates } from './builtins'
import '#/lib/blocks/definitions'

const CACHE_KEY = 'gct-voucher-templates-api'

let localTemplates: VoucherTemplate[] = []
let apiTemplates: VoucherTemplate[] = []

function getCachedApiTemplates(): VoucherTemplate[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as VoucherTemplate[]
  } catch {
    return []
  }
}

function cacheApiTemplates(templates: VoucherTemplate[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(templates))
}

export async function syncApiTemplates(): Promise<VoucherTemplate[]> {
  const config = getAppConfig()
  if (!config.apiTemplateEndpoint) return []

  const res = await fetch(config.apiTemplateEndpoint)
  if (!res.ok) throw new Error(`Template sync failed: ${res.status}`)

  const raw: VoucherTemplate[] = await res.json()
  const stamped = raw.map((t) => ({ ...t, source: 'api' as const }))
  apiTemplates = stamped
  cacheApiTemplates(stamped)
  return stamped
}

export async function loadLocalTemplates(): Promise<VoucherTemplate[]> {
  const config = getAppConfig()
  const path = config.localTemplatePath || '/templates/'

  try {
    const res = await fetch(`${path}index.json`)
    if (!res.ok) return []
    const filenames: string[] = await res.json()

    const results: VoucherTemplate[] = []
    for (const filename of filenames) {
      try {
        const r = await fetch(`${path}${filename}`)
        if (r.ok) {
          const tmpl: VoucherTemplate = await r.json()
          results.push({ ...tmpl, source: 'local' as const })
        }
      } catch { /* skip bad files */ }
    }
    localTemplates = results
    return results
  } catch {
    return []
  }
}

export function getTemplates(): VoucherTemplate[] {
  const cached = apiTemplates.length > 0 ? apiTemplates : getCachedApiTemplates()
  const all = [...builtinTemplates, ...localTemplates, ...cached]

  // Deduplicate by ID — later sources override earlier
  const map = new Map<string, VoucherTemplate>()
  for (const t of all) map.set(t.id, t)
  return Array.from(map.values())
}

export function instantiateTemplate(template: VoucherTemplate): Project {
  if (template.mode === 'full' && template.project) {
    // Deep clone and regenerate all block IDs to avoid collisions
    const cloned = structuredClone(template.project)
    const oldToNew = new Map<string, string>()

    // Generate new IDs for all blocks
    const newBlocks: Record<string, any> = {}
    for (const [oldId, block] of Object.entries(cloned.blocks)) {
      const newId = nanoid(8)
      oldToNew.set(oldId, newId)
      newBlocks[newId] = { ...block, id: newId }
    }
    cloned.blocks = newBlocks

    // Remap columnBlocks keys and values
    const newColBlocks: Record<string, string[]> = {}
    for (const [oldKey, childIds] of Object.entries(cloned.columnBlocks)) {
      const newKey = oldToNew.get(oldKey) || oldKey
      newColBlocks[newKey] = childIds.map((id) => oldToNew.get(id) || id)
    }
    cloned.columnBlocks = newColBlocks

    // Remap section blockIds
    for (const section of cloned.sections) {
      section.blockIds = section.blockIds.map((id: string) => oldToNew.get(id) || id)
    }

    // Remap internal content references (childIds, columnIds, cellIds)
    for (const block of Object.values(cloned.blocks) as any[]) {
      if (block.content?.childIds) {
        block.content.childIds = block.content.childIds.map((id: string) => oldToNew.get(id) || id)
      }
      if (block.content?.columnIds) {
        block.content.columnIds = block.content.columnIds.map((id: string) => oldToNew.get(id) || id)
      }
      if (block.content?.cellIds) {
        block.content.cellIds = block.content.cellIds.map((id: string) => oldToNew.get(id) || id)
      }
    }

    return cloned
  }

  if (template.mode === 'partial' && template.partial) {
    return instantiatePartial(template.partial)
  }

  return createEmptyProject()
}

function instantiatePartial(partial: import('./types').PartialTemplate): Project {
  const project = createEmptyProject()

  if (partial.global) {
    project.global = {
      ...project.global,
      ...partial.global,
      layout: { ...project.global.layout, ...(partial.global.layout || {}) },
      typography: { ...project.global.typography, ...(partial.global.typography || {}) },
      colors: { ...project.global.colors, ...(partial.global.colors || {}) },
      metadata: { ...project.global.metadata, ...(partial.global.metadata || {}) },
    }
  }

  if (partial.frame) {
    project.frame = { ...project.frame, ...partial.frame }
  }

  if (partial.sections) {
    for (const sectionDef of partial.sections) {
      const section = project.sections[sectionDef.index]
      if (!section) continue

      if (sectionDef.height !== undefined) section.height = sectionDef.height
      if (sectionDef.backgroundColor) section.backgroundColor = sectionDef.backgroundColor
      if (sectionDef.backgroundOpacity !== undefined) section.backgroundOpacity = sectionDef.backgroundOpacity
      if (sectionDef.widthMode) section.widthMode = sectionDef.widthMode
      if (sectionDef.verticalAlign) section.verticalAlign = sectionDef.verticalAlign

      for (const blockDef of sectionDef.blocks) {
        const { block, children, colBlocks } = instantiateBlockDef(blockDef)
        project.blocks[block.id] = block
        section.blockIds.push(block.id)
        Object.assign(project.blocks, children)
        Object.assign(project.columnBlocks, colBlocks)
      }
    }
  }

  return project
}

function instantiateBlockDef(def: import('./types').PartialTemplateBlock): {
  block: import('#/lib/schema').Block
  children: Record<string, import('#/lib/schema').Block>
  colBlocks: Record<string, string[]>
} {
  const id = nanoid(8)
  const block = createDefaultBlock(def.type, id)

  if (def.content) (block as any).content = { ...block.content, ...def.content }
  if (def.settings) (block as any).settings = { ...(block as any).settings, ...def.settings }
  if (def.commonSettings) block.commonSettings = { ...(block.commonSettings || defaultCommonSettings), ...def.commonSettings }

  const children: Record<string, any> = {}
  const colBlocks: Record<string, string[]> = {}

  // Handle composable child templates from the registry
  const composableTemplates = getComposableTemplates(def.type)
  if (composableTemplates && composableTemplates.length > 0 && !def.children) {
    const childIds: string[] = []
    for (const tmpl of composableTemplates) {
      const childId = nanoid(8)
      childIds.push(childId)
      const child = createDefaultBlock(tmpl.type as any, childId)
      ;(child as any).commonSettings = { ...(child.commonSettings || defaultCommonSettings), alias: tmpl.alias }
      if (tmpl.contentOverrides) (child as any).content = { ...child.content, ...tmpl.contentOverrides }
      if (tmpl.settingsOverrides) (child as any).settings = { ...(child as any).settings, ...tmpl.settingsOverrides }
      children[childId] = child
    }
    ;(block as any).content.childIds = childIds
    colBlocks[id] = childIds
  }

  // Handle explicit children from template definition
  if (def.children) {
    const childIds: string[] = []
    for (const childDef of def.children) {
      const result = instantiateBlockDef(childDef)
      childIds.push(result.block.id)
      children[result.block.id] = result.block
      Object.assign(children, result.children)
      Object.assign(colBlocks, result.colBlocks)
    }
    ;(block as any).content.childIds = childIds
    colBlocks[id] = childIds
  }

  return { block, children, colBlocks }
}
```

- [ ] **Step 3: Convert existing templates to builtins**

Create `src/lib/templates/builtins.ts`:

```ts
import type { VoucherTemplate } from './types'

export const builtinTemplates: VoucherTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, minimal voucher with heading and text',
    icon: 'file',
    category: 'general',
    mode: 'partial',
    source: 'builtin',
    partial: {
      sections: [
        {
          index: 0,
          blocks: [
            { type: 'heading', content: { text: 'Voucher Title' }, settings: { level: 'h1', fontWeight: 'bold' } },
            { type: 'divider' },
            { type: 'text', content: { body: 'Start building your voucher here...' } },
          ],
        },
      ],
    },
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Hero section with social links and contact info',
    icon: 'layout',
    category: 'general',
    mode: 'partial',
    source: 'builtin',
    partial: {
      sections: [
        {
          index: 0,
          blocks: [
            { type: 'hero' },
            { type: 'divider' },
            { type: 'socials' },
            { type: 'contactInfo' },
          ],
        },
      ],
    },
  },
]
```

- [ ] **Step 4: Update the templates index**

Rewrite `src/lib/templates/index.ts`:

```ts
export type { VoucherTemplate, PartialTemplate, PartialTemplateSection, PartialTemplateBlock } from './types'
export { builtinTemplates } from './builtins'
export { getTemplates, syncApiTemplates, loadLocalTemplates, instantiateTemplate } from './registry'
```

- [ ] **Step 5: Verify it compiles**

```bash
npx tsc --noEmit
```

Fix any import errors. The old `templates` array and `DocumentTemplate` type are no longer exported — callers will be updated in the next task.

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/
git commit -m "feat: template system with types, registry, and builtin templates

Supports full (project snapshot) and partial (declarative block placement)
template modes. Three sources: builtin, local folder, API sync with
localStorage cache. Old template format replaced."
```

---

### Task 6: Template Picker Redesign

**Files:**
- Modify: `src/components/builder/template-picker.tsx` (full rewrite)
- Modify: `src/routes/index.tsx` (update template picker usage, load config)

- [ ] **Step 1: Rewrite the template picker**

Rewrite `src/components/builder/template-picker.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { getTemplates, syncApiTemplates, loadLocalTemplates, instantiateTemplate } from '#/lib/templates'
import type { VoucherTemplate } from '#/lib/templates'
import { getAppConfig, loadAppConfig } from '#/lib/config'
import { useProjectActions, useHistoryActions, useGlobalSettingsState } from '#/store/hooks'
import { localizeProjectDefaults } from '#/i18n/core'
import { ConfirmDialog } from '#/components/builder/confirm-dialog'
import { SettingsInput } from '#/components/builder/settings/settings-inputs'
import { RefreshCw, Search, X } from 'lucide-react'
import { toast } from '#/hooks/use-toast'

export function TemplatePicker() {
  const { loadProject } = useProjectActions()
  const { pushHistory } = useHistoryActions()
  const globalSettings = useGlobalSettingsState()
  const language = globalSettings.metadata.language || 'en'

  const [templates, setTemplates] = useState<VoucherTemplate[]>([])
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<VoucherTemplate | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const config = getAppConfig()
  const hasApiEndpoint = !!config.apiTemplateEndpoint

  // Load templates on mount
  useEffect(() => {
    async function load() {
      await loadAppConfig()
      await loadLocalTemplates()
      setTemplates(getTemplates())
    }
    load()
  }, [])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await syncApiTemplates()
      setTemplates(getTemplates())
      toast('Templates synced', 'success')
    } catch (err) {
      toast(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSyncing(false)
    }
  }, [])

  const handleConfirmLoad = useCallback(() => {
    if (!confirmTarget) return
    const project = instantiateTemplate(confirmTarget)
    const localized = localizeProjectDefaults(project, language)
    pushHistory()
    loadProject(localized)
    setConfirmTarget(null)
    toast(`Loaded template: ${confirmTarget.name}`, 'success')
  }, [confirmTarget, language, pushHistory, loadProject])

  // Derive categories from templates
  const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))] as string[]

  const filtered = templates.filter((t) => {
    const matchesSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !activeCategory || t.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const sourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      builtin: 'bg-muted text-muted-foreground',
      local: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      api: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    }
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${colors[source] || colors.builtin}`}>
        {source}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="nc-section-label">Templates</span>
        {hasApiEndpoint && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <SettingsInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="pl-7 pr-7"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              !activeCategory ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors ${
                cat === activeCategory ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map((template) => (
          <button
            key={template.id}
            onClick={() => setConfirmTarget(template)}
            className="nc-block-card flex flex-col items-start gap-1 p-2 rounded-lg border border-border/50 hover:border-border text-left transition-all"
          >
            {template.thumbnail ? (
              <img
                src={template.thumbnail}
                alt={template.name}
                className="w-full h-16 object-cover rounded"
              />
            ) : template.icon ? (
              <div className="w-full h-16 flex items-center justify-center bg-muted/50 rounded">
                <span className="text-2xl text-muted-foreground">{template.icon}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-[11px] font-medium truncate flex-1">{template.name}</span>
              {sourceBadge(template.source)}
            </div>
            <span className="text-[10px] text-muted-foreground line-clamp-2">{template.description}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center py-4">No templates found</p>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Load Template"
        message="Loading a template will replace your current work. This cannot be undone."
        confirmLabel="Load Template"
        onConfirm={handleConfirmLoad}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update routes/index.tsx imports**

In `src/routes/index.tsx`:

Remove the old `templates` and `DocumentTemplate` imports (line 42):
```ts
// Remove:
import { templates } from '#/lib/templates'
```

Remove or update `handleLoadTemplateWithConfirm` (lines 169-184) — the template picker now handles its own confirmation dialog, so this function and associated `confirmState` usage for template loading is no longer needed in the route.

The `TemplatePicker` import stays (line 41), but it now uses the new component.

- [ ] **Step 3: Load config at app startup**

In `src/routes/index.tsx`, add config loading in the `Composer` component:

```ts
import { loadAppConfig } from '#/lib/config'

// Inside Composer(), add:
useEffect(() => {
  loadAppConfig()
}, [])
```

- [ ] **Step 4: Verify it compiles and renders**

```bash
npx tsc --noEmit
npm run dev
```

Open the app, verify the template picker shows in the left sidebar with the built-in templates. Clicking a template should show a confirmation dialog before loading.

- [ ] **Step 5: Commit**

```bash
git add src/components/builder/template-picker.tsx src/routes/index.tsx
git commit -m "feat: redesign template picker with search, categories, sync, and confirmation

Grid layout with source badges, category filter tabs, search input.
Confirmation dialog prevents accidental data loss. Sync button appears
only when API endpoint is configured."
```

---

## Phase 3: Editor Polish

### Task 7: Multi-Select Copy/Cut/Paste

**Files:**
- Modify: `src/store/types.ts:34` (update clipboard type)
- Modify: `src/store/actionModules/clipboard.ts` (array-based operations)
- Modify: `src/hooks/use-keyboard-shortcuts.ts:87-102` (multi-select shortcuts)
- Modify: `src/components/builder/block-context-menu.tsx:81-93` (multi-select menu items)

- [ ] **Step 1: Update clipboard type in store**

In `src/store/types.ts`, change the clipboard field in `EditorStoreState` (around line 23):

```ts
// Change from:
clipboard: BlockTreeSnapshot | null
// To:
clipboard: BlockTreeSnapshot[] | null
```

- [ ] **Step 2: Rewrite clipboard actions**

Rewrite `src/store/actionModules/clipboard.ts`:

```ts
import { captureBlockTree } from '#/lib/block-tree'
import { useDocumentStore } from '#/store/document'
import { useEditorStore } from '#/store/editor'
import { applyProjectCommand } from './shared'

export function copyBlocks(blockIds: string[]) {
  const { blocks, columnBlocks } = useDocumentStore.getState()
  const snapshots = blockIds
    .map((id) => captureBlockTree(id, blocks, columnBlocks))
    .filter(Boolean)

  if (snapshots.length > 0) {
    useEditorStore.setState({ clipboard: snapshots })
  }
}

export function cutBlocks(blockIds: string[]) {
  const { blocks, columnBlocks } = useDocumentStore.getState()
  const snapshots = blockIds
    .map((id) => captureBlockTree(id, blocks, columnBlocks))
    .filter(Boolean)

  if (snapshots.length > 0) {
    useEditorStore.setState({ clipboard: snapshots })
    applyProjectCommand({ type: 'REMOVE_BLOCKS', blockIds })
  }
}

export function pasteBlocks(sectionId: string) {
  const { clipboard } = useEditorStore.getState()
  if (!clipboard || clipboard.length === 0) return

  for (const snapshot of clipboard) {
    applyProjectCommand({ type: 'PASTE_BLOCK_TREE_TO_SECTION', sectionId, snapshot })
  }
}
```

- [ ] **Step 3: Update ComposerActions type**

In `src/store/types.ts`, update the clipboard methods in `ComposerActions`:

```ts
// Replace:
copyBlock: (blockId: string) => void
cutBlock: (blockId: string) => void
pasteBlock: (sectionId: string) => void
// With:
copyBlock: (blockId: string) => void
cutBlock: (blockId: string) => void
pasteBlock: (sectionId: string) => void
copyBlocks: (blockIds: string[]) => void
cutBlocks: (blockIds: string[]) => void
pasteBlocks: (sectionId: string) => void
```

- [ ] **Step 4: Update action aggregator**

In `src/store/actions.ts`, update the clipboard action references:

```ts
// In the composerActions object, add:
copyBlock: (blockId: string) => copyBlocks([blockId]),
cutBlock: (blockId: string) => cutBlocks([blockId]),
pasteBlock: (sectionId: string) => pasteBlocks(sectionId),
copyBlocks,
cutBlocks,
pasteBlocks,
```

- [ ] **Step 5: Update useClipboardActions hook**

In `src/store/hooks.ts`, update the `useClipboardActions` hook to expose the new functions:

```ts
export function useClipboardActions() {
  return {
    copyBlock: composerActions.copyBlock,
    cutBlock: composerActions.cutBlock,
    pasteBlock: composerActions.pasteBlock,
    copyBlocks: composerActions.copyBlocks,
    cutBlocks: composerActions.cutBlocks,
    pasteBlocks: composerActions.pasteBlocks,
  }
}
```

- [ ] **Step 6: Update keyboard shortcuts**

In `src/hooks/use-keyboard-shortcuts.ts`, the hook already imports clipboard actions via hooks. Update to use the new multi-select variants. First, update the destructuring to include the new functions:

```ts
const { copyBlocks, cutBlocks, pasteBlocks } = useClipboardActions()
```

Then replace the copy/cut handlers (lines 87-102):

```ts
// Cmd+C — copy (lines 87-93)
if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
  e.preventDefault()
  const ids = activeBlockIds.length > 0 ? activeBlockIds : activeBlockId ? [activeBlockId] : []
  if (ids.length > 0) {
    copyBlocks(ids)
    toast(`Copied ${ids.length} block${ids.length > 1 ? 's' : ''}`, 'info')
  }
  return
}

// Cmd+X — cut (lines 96-102)
if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
  e.preventDefault()
  const ids = activeBlockIds.length > 0 ? activeBlockIds : activeBlockId ? [activeBlockId] : []
  if (ids.length > 0) {
    cutBlocks(ids)
    toast(`Cut ${ids.length} block${ids.length > 1 ? 's' : ''}`, 'info')
  }
  return
}
```

Also update the paste handler to use `pasteBlocks`:

```ts
// Cmd+V — paste
if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
  e.preventDefault()
  if (activeSectionId) pasteBlocks(activeSectionId)
  return
}
```

- [ ] **Step 7: Update context menu**

In `src/components/builder/block-context-menu.tsx`, add hook imports and update Copy, Cut, and Paste items. Add:

```ts
const { copyBlocks, cutBlocks, pasteBlocks } = useClipboardActions()
const { clipboard } = useClipboardState()
```

Update the menu items array:

```ts
// Copy:
{
  label: 'Copy',
  shortcut: '⌘C',
  action: () => {
    const ids = activeBlockIds.includes(blockId) && activeBlockIds.length > 1
      ? activeBlockIds
      : [blockId]
    copyBlocks(ids)
    toast(`Copied ${ids.length} block${ids.length > 1 ? 's' : ''}`, 'info')
  },
},
// Cut:
{
  label: 'Cut',
  shortcut: '⌘X',
  action: () => {
    const ids = activeBlockIds.includes(blockId) && activeBlockIds.length > 1
      ? activeBlockIds
      : [blockId]
    cutBlocks(ids)
    toast(`Cut ${ids.length} block${ids.length > 1 ? 's' : ''}`, 'info')
  },
},
// Paste — update disabled check for array clipboard:
{
  label: 'Paste Below',
  shortcut: '⌘V',
  disabled: !clipboard || clipboard.length === 0,
  action: () => { if (sectionId) pasteBlocks(sectionId) },
},
```

- [ ] **Step 8: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/store/types.ts src/store/actionModules/clipboard.ts src/store/actions.ts src/store/hooks.ts src/hooks/use-keyboard-shortcuts.ts src/components/builder/block-context-menu.tsx
git commit -m "feat: multi-select copy/cut/paste

Clipboard now stores an array of block tree snapshots. Cmd+C/X operate
on all selected blocks. Context menu respects multi-selection. Paste
inserts all copied blocks in order."
```

---

### Task 8: Arrow Navigation Into Columns

**Files:**
- Create: `src/lib/engine/navigation.ts`
- Modify: `src/hooks/use-keyboard-shortcuts.ts:146-156` (deep navigation)

- [ ] **Step 1: Create the navigation module**

Create `src/lib/engine/navigation.ts`:

```ts
import type { VoucherSection, Block } from '#/lib/schema'
import { getBlockChildKind } from '#/lib/blocks/registry'

/**
 * Returns a flat, depth-first ordered list of all navigable block IDs
 * in a section. Structural blocks (columns, grid cells) are skipped —
 * navigation goes directly to their children.
 */
export function getNavigableBlockList(
  section: VoucherSection,
  blocks: Record<string, Block>,
  columnBlocks: Record<string, string[]>,
): string[] {
  const result: string[] = []

  function visit(blockId: string) {
    const block = blocks[blockId]
    if (!block) return

    const childKind = getBlockChildKind(block.type)

    if (childKind === 'row-columns' || childKind === 'grid-cells') {
      // Structural block — add self, then visit structural children's contents
      result.push(blockId)
      const structField = childKind === 'row-columns' ? 'columnIds' : 'cellIds'
      const structIds: string[] = (block.content as any)?.[structField] || []
      for (const structId of structIds) {
        // Skip the column/cell itself, visit its children directly
        const childIds = columnBlocks[structId] || []
        for (const childId of childIds) {
          visit(childId)
        }
      }
    } else if (childKind === 'block-list') {
      // Composable or section block — add self, then visit children
      result.push(blockId)
      const childIds = columnBlocks[blockId] || []
      for (const childId of childIds) {
        visit(childId)
      }
    } else {
      // Leaf block
      result.push(blockId)
    }
  }

  for (const rootId of section.blockIds) {
    visit(rootId)
  }

  return result
}
```

- [ ] **Step 2: Update keyboard arrow navigation**

In `src/hooks/use-keyboard-shortcuts.ts`, replace the arrow key handler (lines 146-156).

Add import at top:
```ts
import { getNavigableBlockList } from '#/lib/engine/navigation'
```

Replace the arrow handler:

```ts
// ArrowUp / ArrowDown — deep navigation
if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
  e.preventDefault()
  if (!activeBlockId || !activeSectionId) return

  const section = sections.find((s: any) => s.id === activeSectionId)
  if (!section) return

  const navigable = getNavigableBlockList(section, blocks, columnBlocks)
  const currentIndex = navigable.indexOf(activeBlockId)
  if (currentIndex === -1) return

  const nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1
  if (nextIndex < 0 || nextIndex >= navigable.length) return

  composerActions.setActiveBlock(navigable[nextIndex])

  // Scroll into view
  const el = document.querySelector(`[data-block-id="${navigable[nextIndex]}"]`)
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  return
}
```

This requires `blocks` and `columnBlocks` to be available in the hook. Add them to the hook's data access:

```ts
const blocks = useDocumentState((s) => s.blocks)
const columnBlocks = useDocumentState((s) => s.columnBlocks)
const sections = useDocumentState((s) => s.sections)
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/engine/navigation.ts src/hooks/use-keyboard-shortcuts.ts
git commit -m "feat: arrow key navigation into columns, grids, and composables

Depth-first traversal flattens the block tree so arrow keys navigate
through all visible blocks, including children of rows, grids, and
composable blocks. Structural blocks (columns, cells) are skipped."
```

---

### Task 9: Canvas DnD Discoverability

**Files:**
- Modify: `src/components/builder/canvas-toolbar.tsx` (add Layers toggle)
- Modify: `src/routes/index.tsx` (wire Layers toggle state)

- [ ] **Step 1: Add Layers toggle to canvas toolbar**

In `src/components/builder/canvas-toolbar.tsx`, add a `Layers` icon button. Add to the props interface:

```ts
showLayers?: boolean
onToggleLayers?: () => void
```

Add the import:
```ts
import { Layers } from 'lucide-react'
```

Add the button in the toolbar (before the Preview button, around line 108):

```tsx
{onToggleLayers && (
  <button
    onClick={onToggleLayers}
    className={`p-1 rounded transition-colors ${showLayers ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    title="Toggle Layers panel"
  >
    <Layers className="h-3.5 w-3.5" />
  </button>
)}
```

- [ ] **Step 2: Wire up in routes/index.tsx**

In `src/routes/index.tsx`, add state for the Layers panel:

```ts
const [showLayers, setShowLayers] = useState(true)
```

Pass to `CanvasToolbar`:

```tsx
<CanvasToolbar
  // ...existing props
  showLayers={showLayers}
  onToggleLayers={() => setShowLayers((v) => !v)}
/>
```

Conditionally render `PageElements` based on `showLayers`:

```tsx
{showLayers && activeSection && hasBlocks && (
  <PageElements ... />
)}
```

- [ ] **Step 3: Add empty column placeholders in RowBlockRenderer**

In `src/components/blocks/layout/row-block.tsx`, find where empty columns are rendered (around line 480). Ensure empty columns show a "Drop blocks here" placeholder similar to empty sections. The existing code at lines 480-484 already has `showEmptyColIndicator` logic — verify it renders a visible placeholder when the column has zero children, not just during drag operations. If it only shows during drag, add a static placeholder:

```tsx
{columnChildren.length === 0 && !isDragActive && (
  <div className="flex items-center justify-center h-full min-h-[40px] border border-dashed border-border/30 rounded">
    <span className="text-[9px] text-muted-foreground/40 select-none">Drop blocks here</span>
  </div>
)}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/builder/canvas-toolbar.tsx src/routes/index.tsx src/components/blocks/layout/row-block.tsx
git commit -m "feat: add Layers toggle and empty column placeholders

Layers toggle button on canvas toolbar controls the floating elements
panel. Empty row columns now show a persistent 'Drop blocks here'
placeholder for better discoverability."
```

---

## Phase 4: Export

### Task 10: Reorganize Export Files

**Files:**
- Create: `src/lib/export/html.ts` (move from `src/lib/export.ts`)
- Create: `src/lib/export/json.ts` (move from `src/lib/export-json.ts`)
- Create: `src/lib/export/index.ts`
- Delete: `src/lib/export.ts`
- Delete: `src/lib/export-json.ts`
- Modify: all files importing from old paths

- [ ] **Step 1: Create the export directory and move files**

```bash
mkdir -p src/lib/export
mv src/lib/export.ts src/lib/export/html.ts
mv src/lib/export-json.ts src/lib/export/json.ts
```

- [ ] **Step 2: Create the index re-export**

Create `src/lib/export/index.ts`:

```ts
export { exportToHTML, downloadFile } from './html'
export { exportToJSON } from './json'
export type { VoucherExport, VoucherSectionExport, ExportBlock, JsonExportMode } from './json'
```

- [ ] **Step 3: Update all imports**

Search for imports from the old paths and update them:

```bash
# Find all files importing from '#/lib/export' or '#/lib/export-json'
grep -r "from '#/lib/export'" src/ --include="*.ts" --include="*.tsx" -l
grep -r "from '#/lib/export-json'" src/ --include="*.ts" --include="*.tsx" -l
```

For each file found, update the import path:
- `from '#/lib/export'` → `from '#/lib/export/index'` (or just `from '#/lib/export'` if the path alias resolves directory indexes)
- `from '#/lib/export-json'` → `from '#/lib/export'`

Note: TanStack Start / Vite should resolve `#/lib/export` to `#/lib/export/index.ts` automatically. Verify with `npx tsc --noEmit`.

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/ src/components/ src/routes/
git rm src/lib/export.ts src/lib/export-json.ts 2>/dev/null || true
git commit -m "refactor: move export files into src/lib/export/ directory

Organizes export modules (html, json) into a dedicated directory in
preparation for adding pluggable PDF export strategies."
```

---

### Task 11: Pluggable PDF Export

**Files:**
- Create: `src/lib/export/pdf-strategies.ts`
- Modify: `src/lib/export/index.ts` (add PDF re-exports)
- Modify: `src/components/builder/export-dialog.tsx` (add PDF option)

- [ ] **Step 1: Create PDF strategy module**

Create `src/lib/export/pdf-strategies.ts`:

```ts
import { getAppConfig } from '#/lib/config'

export interface PdfExportOptions {
  filename: string
  paperSize: 'a4' | 'letter'
  margins: { top: number; bottom: number; left: number; right: number }
}

export interface PdfExportStrategy {
  id: string
  label: string
  description?: string
  export: (html: string, options: PdfExportOptions) => Promise<Blob | void>
}

const browserPrintStrategy: PdfExportStrategy = {
  id: 'browser-print',
  label: 'Browser Print',
  description: 'Opens the browser print dialog',
  export: async (html: string) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)

    const printCSS = `
      @page { size: A4; margin: 0; }
      @media print {
        html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `

    iframe.srcdoc = html.replace('</head>', `<style>${printCSS}</style></head>`)

    return new Promise<void>((resolve) => {
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => {
            document.body.removeChild(iframe)
            resolve()
          }, 1000)
        }, 500)
      }
    })
  },
}

const remoteStrategy: PdfExportStrategy = {
  id: 'remote',
  label: 'Server Render',
  description: 'Renders PDF via remote service',
  export: async (html: string, options: PdfExportOptions) => {
    const config = getAppConfig()
    if (!config.pdfExportEndpoint) throw new Error('No PDF export endpoint configured')

    const res = await fetch(config.pdfExportEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, options }),
    })

    if (!res.ok) throw new Error(`PDF export failed: ${res.status}`)
    return res.blob()
  },
}

export function getAvailablePdfStrategies(): PdfExportStrategy[] {
  const strategies: PdfExportStrategy[] = [browserPrintStrategy]
  const config = getAppConfig()
  if (config.pdfExportEndpoint) {
    strategies.push(remoteStrategy)
  }
  return strategies
}

export function getPdfStrategy(id: string): PdfExportStrategy | undefined {
  return getAvailablePdfStrategies().find((s) => s.id === id)
}
```

- [ ] **Step 2: Update export index**

Add to `src/lib/export/index.ts`:

```ts
export { getAvailablePdfStrategies, getPdfStrategy } from './pdf-strategies'
export type { PdfExportStrategy, PdfExportOptions } from './pdf-strategies'
```

- [ ] **Step 3: Update ExportDialog with PDF format**

Rewrite `src/components/builder/export-dialog.tsx` to add PDF support:

```tsx
import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { exportToHTML, downloadFile, exportToJSON, getAvailablePdfStrategies } from '#/lib/export'
import type { PdfExportStrategy } from '#/lib/export'
import { useProjectActions, useGlobalSettingsState } from '#/store/hooks'
import { toast } from '#/hooks/use-toast'
import { SettingsInput } from '#/components/builder/settings/settings-inputs'
import { Download, Loader2 } from 'lucide-react'

type ExportFormat = 'html' | 'json' | 'pdf'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { getProject } = useProjectActions()
  const globalSettings = useGlobalSettingsState()
  const title = globalSettings.metadata.title || 'voucher'
  const [fileName, setFileName] = useState(title)
  const [format, setFormat] = useState<ExportFormat>('html')
  const [exporting, setExporting] = useState(false)

  const pdfStrategies = useMemo(() => getAvailablePdfStrategies(), [])
  const [pdfStrategyId, setPdfStrategyId] = useState(pdfStrategies[0]?.id || 'browser-print')

  const handleExport = async () => {
    const project = getProject()
    const name = fileName || 'voucher'

    if (format === 'html') {
      const html = exportToHTML(project)
      downloadFile(html, `${name}.html`, 'text/html')
      toast('Exported as HTML', 'success')
      onClose()
    } else if (format === 'json') {
      const json = exportToJSON(project)
      downloadFile(JSON.stringify(json, null, 2), `${name}.json`, 'application/json')
      toast('Exported as JSON', 'success')
      onClose()
    } else if (format === 'pdf') {
      const strategy = pdfStrategies.find((s) => s.id === pdfStrategyId)
      if (!strategy) return

      setExporting(true)
      try {
        const html = exportToHTML(project)
        const margin = globalSettings.layout.margin || 10
        const result = await strategy.export(html, {
          filename: name,
          paperSize: 'a4',
          margins: { top: margin, bottom: margin, left: margin, right: margin },
        })

        if (result instanceof Blob) {
          const url = URL.createObjectURL(result)
          const a = document.createElement('a')
          a.href = url
          a.download = `${name}.pdf`
          a.click()
          URL.revokeObjectURL(url)
        }

        toast('Exported as PDF', 'success')
        onClose()
      } catch (err) {
        toast(`PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
      } finally {
        setExporting(false)
      }
    }
  }

  const formats: { id: ExportFormat; label: string }[] = [
    { id: 'html', label: 'HTML' },
    { id: 'json', label: 'JSON' },
    { id: 'pdf', label: 'PDF' },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Export Voucher</DialogTitle>

        <div className="space-y-4 pt-2">
          {/* File name */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">File name</label>
            <SettingsInput
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="voucher"
            />
          </div>

          {/* Format selector */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Format</label>
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                    format === f.id
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* PDF strategy selector */}
          {format === 'pdf' && pdfStrategies.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Method</label>
              <div className="flex rounded-lg border bg-muted/50 p-0.5">
                {pdfStrategies.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPdfStrategyId(s.id)}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                      pdfStrategyId === s.id
                        ? 'bg-background shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/pdf-strategies.ts src/lib/export/index.ts src/components/builder/export-dialog.tsx
git commit -m "feat: pluggable PDF export with browser print and remote strategies

Adds PdfExportStrategy interface with two built-in strategies:
browser-print (always available) and remote (configured via endpoint).
Export dialog now offers HTML, JSON, and PDF formats."
```

---

## Phase 5: Visual

### Task 12: Dark Mode for App Tokens

**Files:**
- Modify: `src/styles.css` (add `.dark` overrides for `--nc-*` tokens)

- [ ] **Step 1: Add dark mode overrides**

In `src/styles.css`, after the existing `.dark` block (ends around line 121), add a new block for the custom app tokens:

```css
/* ── Dark mode: custom app tokens ────────────────────────── */
.dark {
  /* Canvas */
  --nc-canvas: oklch(0.15 0.005 260);
  --nc-canvas-dots: oklch(0.22 0.006 260);
  --nc-toolbar-glass: oklch(0.18 0.005 260 / 90%);
  --nc-selection: oklch(0.65 0.16 265);
  --nc-selection-light: oklch(0.25 0.06 265);
  --nc-hover-lift: 0 2px 8px oklch(0 0 0 / 0.4), 0 0 0 1px oklch(0.3 0.005 260);
  --nc-toolbar-shadow: 0 2px 12px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.25 0.005 260);
  --nc-paper-shadow: 0 1px 4px oklch(0 0 0 / 0.4), 0 4px 16px oklch(0 0 0 / 0.3);

  /* Settings system */
  --nc-st-muted: oklch(0.60 0.01 260);
  --nc-st-border: oklch(0.28 0.005 260);
  --nc-st-border-strong: oklch(0.35 0.008 260);
  --nc-st-surface: oklch(0.18 0.004 260);
  --nc-st-surface-hover: oklch(0.22 0.005 260);
  --nc-st-accent-subtle: oklch(0.22 0.05 265);
  --nc-st-section-line: oklch(0.25 0.005 260);
}
```

Note: If the existing `.dark` block already contains some custom properties, merge into it instead of creating a second `.dark` block. CSS allows multiple blocks with the same selector, but a single block is cleaner.

- [ ] **Step 2: Verify dark mode renders correctly**

```bash
npm run dev
```

Toggle dark mode in the app (if there's a theme toggle). Verify:
- Canvas background uses the dark dot pattern
- Toolbars have the dark frosted glass effect
- Selection rings are visible against dark backgrounds
- Settings sidebar borders, surfaces, and section lines use dark tokens
- The A4 paper canvas itself stays light (uses `GlobalSettings.colors`, not dark mode)

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: complete dark mode with custom app token overrides

Adds .dark overrides for all --nc-* canvas tokens (canvas, dots, toolbar
glass, selection, paper shadow) and --nc-st-* settings tokens (muted,
border, surface, accent, section line). Editor chrome darkens; the A4
canvas document itself always uses the user's chosen colors."
```

---

## Summary

| Task | Phase | Files Changed | Description |
|------|-------|--------------|-------------|
| 1 | Foundation | 5 modified, 1 deleted | Remove Quick Start Wizard |
| 2 | Foundation | 1 modified | Rewrite CLAUDE.md |
| 3 | Foundation | 1 modified | Rewrite WALKTHROUGH.md |
| 4 | Templates | 2 created | App configuration layer |
| 5 | Templates | 4 created/modified | Template types, registry, builtins |
| 6 | Templates | 2 modified | Template picker redesign |
| 7 | Editor | 5 modified | Multi-select copy/cut/paste |
| 8 | Editor | 1 created, 1 modified | Arrow navigation into columns |
| 9 | Editor | 2 modified | Canvas DnD discoverability (Layers toggle) |
| 10 | Export | 3 created, 2 deleted | Reorganize export files |
| 11 | Export | 3 created/modified | Pluggable PDF export |
| 12 | Visual | 1 modified | Dark mode app tokens |

**Parallelizable:** Tasks 7, 8, 9 (Phase 3) are independent and can run concurrently. Tasks 2 and 3 can also run in parallel.

**Note:** Tasks 2-3 (docs rewrite) reference export paths as `src/lib/export.ts` and `src/lib/export-json.ts`. After Task 10 (Phase 4) moves these files to `src/lib/export/`, update the paths in CLAUDE.md and WALKTHROUGH.md to `src/lib/export/html.ts`, `src/lib/export/json.ts`, `src/lib/export/pdf-strategies.ts`. This is a trivial search-replace and does not warrant a separate task.
