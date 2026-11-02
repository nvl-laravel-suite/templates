# Dynamic Preview System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preview data toggle that lets designers test dynamic/placeholder blocks with sample values, using both per-block and project-level preview data.

**Architecture:** Schema changes add `previewValue` fields to CommonBlockSettings, DataPlaceholder content, and QrCode content, plus `previewData` on GlobalSettings. A `resolvePreviewValue()` pure function handles resolution (project-level wins). A toolbar toggle (`showPreviewData`) switches renderers between placeholder and preview display. No store mutations — preview injection happens at render time only.

**Tech Stack:** React 19, Zustand v5, Zod, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-04-21-dynamic-preview-system-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/preview.ts` | `resolvePreviewValue()` function + `PRIMARY_CONTENT_FIELD` map |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/schema.ts` | Add `previewValue` to CommonBlockSettings, DataPlaceholder, QrCode; add `previewData` to GlobalSettings |
| `src/lib/blocks/types.ts` | Add `previewValue` to DEFAULT_COMMON_SETTINGS |
| `src/store/document.ts` | Bump version 13→14, add migration |
| `src/store/types.ts` | Add `showPreviewData` to EditorStoreState + ComposerActions |
| `src/store/editor.ts` | Add `showPreviewData: false` to initial state |
| `src/store/actionModules/global.ts` | Add `setShowPreviewData` action |
| `src/store/hooks.ts` | Add `showPreviewData` to visual tooling hooks |
| `src/components/builder/canvas-toolbar.tsx` | Add preview toggle button |
| `src/routes/index.tsx` | Wire preview toggle to toolbar |
| `src/components/builder/block-settings.tsx` | Add `previewValue` input to Dynamic group |
| `src/components/builder/global-settings.tsx` | Add Preview Data key-value editor |
| `src/lib/blocks/definitions/primitives/data-placeholder.ts` | Add `previewValue` content field |
| `src/lib/blocks/definitions/primitives/qr-code.ts` | Add `previewValue` content field |
| `src/components/blocks/primitives/data-placeholder-block.tsx` | Render preview values |
| `src/components/blocks/primitives/qr-code-block.tsx` | Use preview value for QR |
| `src/components/builder/layout-grid.tsx` | Show eye icon on dynamic blocks in preview mode |
| `src/lib/templates/builtins.ts` | Add demo voucher template |

---

## Phase 1: Schema & Store

### Task 1: Schema Changes

**Files:**
- Modify: `src/lib/schema.ts:25-26,49-50,83-84,325-326,520-521`
- Modify: `src/lib/blocks/types.ts:188` (DEFAULT_COMMON_SETTINGS)
- Modify: `src/store/document.ts:60-67` (version bump)

- [ ] **Step 1: Add `previewValue` to CommonBlockSettingsSchema**

In `src/lib/schema.ts`, add after `dynamicKey` (line 25):

```ts
// Line 25 currently:
  dynamicKey: z.string().default(''),
})
// Change to:
  dynamicKey: z.string().default(''),
  previewValue: z.string().default(''),
})
```

Also update `defaultCommonSettings` (after line 49):

```ts
  dynamicKey: '',
  previewValue: '',
}
```

- [ ] **Step 2: Add `previewData` to GlobalSettingsSchema**

In `src/lib/schema.ts`, add after the `metadata` object (before line 84's closing paren):

```ts
  metadata: z.object({
    title: z.string().default('Untitled Document'),
    author: z.string().default(''),
    subject: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    language: z.string().default('en'),
  }),
  previewData: z.record(z.string(), z.string()).default({}),
})
```

- [ ] **Step 3: Add `previewValue` to DataPlaceholderBlockSchema content**

In `src/lib/schema.ts` at line 520, add before the content object closes:

```ts
  content: z.object({
    valueKey: z.string().default(''),
    placeholderText: z.string().default('Placeholder'),
    placeholderType: z.enum(['text', 'image']).default('text'),
    previewValue: z.string().default(''),
  }),
```

- [ ] **Step 4: Add `previewValue` to QrCodeBlockSchema content**

In `src/lib/schema.ts` at line 325, add before the content object closes:

```ts
  content: z.object({
    value: z.string().default('https://example.com'),
    label: z.string().default(''),
    previewValue: z.string().default(''),
  }),
```

- [ ] **Step 5: Update DEFAULT_COMMON_SETTINGS in types.ts**

In `src/lib/blocks/types.ts`, find `DEFAULT_COMMON_SETTINGS` and add:

```ts
  dynamicKey: '',
  previewValue: '',
}
```

- [ ] **Step 6: Bump store version**

In `src/store/document.ts`, change version and migration:

```ts
      version: 14,
      migrate: (_persisted: unknown, version: number) => {
        if (version < 13) {
          return createEmptyProject() as unknown as DocumentStoreState
        }
        // v13 → v14: new fields have defaults, data is compatible
        return _persisted as unknown as DocumentStoreState
      },
```

- [ ] **Step 7: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/schema.ts src/lib/blocks/types.ts src/store/document.ts
git commit -m "feat: add previewValue and previewData schema fields

Adds previewValue to CommonBlockSettings, DataPlaceholder content, and
QrCode content. Adds previewData record to GlobalSettings. Bumps store
version 13→14 with compatible migration."
```

---

### Task 2: Store — Preview Toggle State

**Files:**
- Modify: `src/store/types.ts:29,82`
- Modify: `src/store/editor.ts:20`
- Modify: `src/store/actionModules/global.ts:17,63`
- Modify: `src/store/hooks.ts:51,146`

- [ ] **Step 1: Add to EditorStoreState**

In `src/store/types.ts`, add after `debugMode: boolean` (line 29):

```ts
  debugMode: boolean
  showPreviewData: boolean
```

Also add to `ComposerActions` interface:

```ts
  setShowPreviewData: (show: boolean) => void
```

- [ ] **Step 2: Add to initial editor state**

In `src/store/editor.ts`, add after `debugMode: false` (line 20):

```ts
    debugMode: false,
    showPreviewData: false,
```

- [ ] **Step 3: Add action**

In `src/store/actionModules/global.ts`, add `'setShowPreviewData'` to the Pick type list, then add the implementation after `setDebugMode`:

```ts
export function setShowPreviewData(show: boolean) {
  useEditorStore.setState({ showPreviewData: show })
}
```

- [ ] **Step 4: Update hooks**

In `src/store/hooks.ts`, add to `useVisualToolingState()`:

```ts
    showPreviewData: useEditorState((s) => s.showPreviewData),
```

Add to `useVisualToolingActions()`:

```ts
    setShowPreviewData: composerActions.setShowPreviewData,
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/store/types.ts src/store/editor.ts src/store/actionModules/global.ts src/store/hooks.ts
git commit -m "feat: add showPreviewData toggle to editor state

Transient boolean in editor store, not persisted. Includes action,
hook exposure, and type updates."
```

---

## Phase 2: Preview Logic & Toolbar

### Task 3: Preview Resolution Function

**Files:**
- Create: `src/lib/preview.ts`

- [ ] **Step 1: Create the module**

Create `src/lib/preview.ts`:

```ts
/**
 * Dynamic preview system — resolves placeholder keys to preview values.
 * Project-level payload wins over per-block previewValue.
 */

/** Map from block type to the content field that gets replaced by dynamicKey preview */
export const PRIMARY_CONTENT_FIELD: Record<string, string> = {
  heading: 'text',
  text: 'body',
  image: 'url',
  metric: 'value',
  badge: 'text',
  button: 'text',
  date: 'value',
  metadata: 'label',
}

/**
 * Resolve a preview value for a given key.
 * Priority: projectPayload > blockPreviewValue > undefined
 */
export function resolvePreviewValue(
  key: string,
  projectPayload: Record<string, string>,
  blockPreviewValue?: string,
): string | undefined {
  if (!key) return undefined
  const fromProject = projectPayload[key]
  if (fromProject !== undefined && fromProject !== '') return fromProject
  if (blockPreviewValue !== undefined && blockPreviewValue !== '') return blockPreviewValue
  return undefined
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/preview.ts
git commit -m "feat: add preview value resolution function

Pure function resolvePreviewValue() with project-level > per-block
priority. PRIMARY_CONTENT_FIELD maps block types to their replaceable
content field."
```

---

### Task 4: Toolbar Preview Toggle

**Files:**
- Modify: `src/components/builder/canvas-toolbar.tsx:7-17,107-109`
- Modify: `src/routes/index.tsx:298-308`

- [ ] **Step 1: Add toggle to canvas toolbar**

In `src/components/builder/canvas-toolbar.tsx`, add to the props interface:

```ts
  showPreviewData?: boolean
  onTogglePreviewData?: () => void
```

Add the `Eye` import from lucide-react:

```ts
import { Eye } from 'lucide-react'
```

Add a toggle button after the Debug toggle (before the separator). Use the same `toggleClass` helper as other toggles:

```tsx
{onTogglePreviewData && (
  <>
    <div className="w-px h-4 bg-border/50" />
    <button
      onClick={onTogglePreviewData}
      className={toggleClass(!!showPreviewData)}
      title={showPreviewData ? 'Showing preview data' : 'Showing placeholders'}
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
  </>
)}
```

- [ ] **Step 2: Wire up in routes/index.tsx**

In `src/routes/index.tsx`, import the hooks:

```ts
const { showPreviewData } = useVisualToolingState()
const { setShowPreviewData } = useVisualToolingActions()
```

(These hooks may already be destructured for other visual tooling state — add to existing destructuring if so.)

Pass to `CanvasToolbar`:

```tsx
<CanvasToolbar
  // ...existing props
  showPreviewData={showPreviewData}
  onTogglePreviewData={() => setShowPreviewData(!showPreviewData)}
/>
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/builder/canvas-toolbar.tsx src/routes/index.tsx
git commit -m "feat: add preview data toggle to canvas toolbar

Eye icon button toggles between placeholder and preview data display.
Uses same toggleClass styling as other visual tooling buttons."
```

---

## Phase 3: Settings UI

### Task 5: Block Settings — Preview Value Input

**Files:**
- Modify: `src/components/builder/block-settings.tsx:117-145`

- [ ] **Step 1: Extend ContainerDynamic with preview value input**

In `src/components/builder/block-settings.tsx`, update the `ContainerDynamic` function. After the `dynamicKey` input (line 141), add a preview value input:

```tsx
function ContainerDynamic({
  settings,
  onChange,
}: {
  settings: CommonBlockSettings
  onChange: (updates: Partial<CommonBlockSettings>) => void
}) {
  const isEnabled = !!settings.dynamicKey
  return (
    <SettingsGroup title="Dynamic" defaultOpen={false}>
      <SwitchField
        label="Dynamic Field"
        description="Bind this block to a template key"
        value={isEnabled}
        onChange={(v) => onChange({ dynamicKey: v ? ':key' : '' })}
      />
      {isEnabled && (
        <>
          <SettingsInput
            value={settings.dynamicKey || ''}
            onChange={(e) => onChange({ dynamicKey: e.target.value })}
            placeholder=":key_name"
            spellCheck={false}
            className="font-mono text-[11px]"
          />
          <SettingsInput
            value={settings.previewValue || ''}
            onChange={(e) => onChange({ previewValue: e.target.value })}
            placeholder="Preview value..."
            spellCheck={false}
            className="text-[11px]"
          />
        </>
      )}
    </SettingsGroup>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/block-settings.tsx
git commit -m "feat: add preview value input to Dynamic settings group

Shows a preview value text input below the dynamic key when a block
is bound to a template key."
```

---

### Task 6: Block Definitions — Preview Value Fields

**Files:**
- Modify: `src/lib/blocks/definitions/primitives/data-placeholder.ts`
- Modify: `src/lib/blocks/definitions/primitives/qr-code.ts`

- [ ] **Step 1: Add previewValue to data-placeholder definition**

In `src/lib/blocks/definitions/primitives/data-placeholder.ts`, add to the `content` fields (after `placeholderType`):

```ts
    previewValue: { type: 'string', default: '', placeholder: 'Preview text or image URL...' },
```

Also add `previewValue` to the `settingsLayout` — in the "Placeholder" group's `fields` array:

```ts
    { title: 'Placeholder', display: 'flat', fields: ['valueKey', 'placeholderText', 'placeholderType', 'previewValue'] },
```

- [ ] **Step 2: Add previewValue to qr-code definition**

In `src/lib/blocks/definitions/primitives/qr-code.ts`, add to the `content` fields (after `label`):

```ts
    previewValue: { type: 'string', default: '', placeholder: 'Preview URL for QR...' },
```

Add `previewValue` to the settingsLayout "API Overwrite" group:

```ts
    { title: 'API Overwrite', fields: ['allowOverwrite', 'overwriteKey', 'previewValue'] },
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/blocks/definitions/primitives/data-placeholder.ts src/lib/blocks/definitions/primitives/qr-code.ts
git commit -m "feat: add previewValue content field to dataPlaceholder and qrCode definitions

Shows in settings panel for testing placeholder blocks with sample data."
```

---

### Task 7: Global Settings — Preview Data Editor

**Files:**
- Modify: `src/components/builder/global-settings.tsx:200-207`

- [ ] **Step 1: Add Preview Data group**

In `src/components/builder/global-settings.tsx`, add a new settings group before the closing `</SettingsPanel>`. First, read the file to verify the exact imports and patterns used. The component needs:

- Access to `globalSettings.previewData` (already available via `useGlobalSettingsState`)
- An action to update it (use `updateGlobal` from `useGlobalSettingsActions` or a direct update)

Add after the Metadata group (before `</SettingsPanel>`):

```tsx
      <SettingsGroup title="Preview Data" defaultOpen={false}>
        <p className="text-[10px] text-muted-foreground mb-2">
          Key-value pairs for testing dynamic blocks. Keys should match placeholder tokens (e.g. :recipient_name).
        </p>
        {Object.entries(globalSettings.previewData || {}).map(([key, value], i) => (
          <div key={i} className="flex gap-1 mb-1">
            <SettingsInput
              value={key}
              onChange={(e) => {
                const data = { ...(globalSettings.previewData || {}) }
                const val = data[key]
                delete data[key]
                data[e.target.value] = val
                updateGlobal({ previewData: data })
              }}
              placeholder=":key"
              className="font-mono text-[11px] flex-1"
              spellCheck={false}
            />
            <SettingsInput
              value={value}
              onChange={(e) => {
                updateGlobal({ previewData: { ...(globalSettings.previewData || {}), [key]: e.target.value } })
              }}
              placeholder="value"
              className="text-[11px] flex-1"
            />
            <button
              onClick={() => {
                beginHistoryChange()
                const data = { ...(globalSettings.previewData || {}) }
                delete data[key]
                updateGlobal({ previewData: data })
              }}
              className="text-muted-foreground hover:text-destructive px-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            beginHistoryChange()
            updateGlobal({ previewData: { ...(globalSettings.previewData || {}), ':new_key': '' } })
          }}
          className="w-full border border-dashed border-border/50 rounded py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          + Add entry
        </button>
      </SettingsGroup>
```

Make sure `X` from lucide-react is imported (check existing imports — it may already be there). Also ensure `updateGlobal` is available (it should come from `useGlobalSettingsActions`; read the file to confirm the exact hook name used).

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/global-settings.tsx
git commit -m "feat: add preview data key-value editor in global settings

Collapsible group with add/remove/edit rows for project-level preview
data payload. Keys match :token convention used by dynamic blocks."
```

---

## Phase 4: Renderer Changes

### Task 8: DataPlaceholder Preview Rendering

**Files:**
- Modify: `src/components/blocks/primitives/data-placeholder-block.tsx`

- [ ] **Step 1: Add preview mode rendering**

Rewrite `src/components/blocks/primitives/data-placeholder-block.tsx`:

```tsx
import type { DataPlaceholderBlock as DataPlaceholderBlockType } from '#/lib/schema'
import { ImageIcon, Eye } from 'lucide-react'
import { resolveFontSize } from '#/lib/font-sizes'
import { useVisualToolingState, useGlobalSettingsState } from '#/store/hooks'
import { resolvePreviewValue } from '#/lib/preview'

export function DataPlaceholderBlockRenderer({ block }: { block: DataPlaceholderBlockType }) {
  const { content, settings } = block
  const { showPreviewData } = useVisualToolingState()
  const globalSettings = useGlobalSettingsState()

  const previewData = globalSettings.previewData || {}
  const resolved = showPreviewData
    ? resolvePreviewValue(content.valueKey, previewData, content.previewValue)
    : undefined

  // Preview mode — image placeholder with resolved URL
  if (content.placeholderType === 'image') {
    const width = settings.width || 120
    const height = settings.height || 80

    if (resolved && showPreviewData) {
      return (
        <div style={{ textAlign: settings.alignment }} className="relative">
          <img
            src={resolved}
            alt={content.valueKey}
            style={{ width: width || undefined, height: height || undefined, objectFit: 'cover' }}
            className="inline-block rounded"
          />
          <Eye className="absolute top-1 right-1 h-3 w-3 text-blue-500/60" />
        </div>
      )
    }

    return (
      <div style={{ textAlign: settings.alignment }}>
        <div
          className="inline-flex flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-amber-400/50 bg-amber-50/50"
          style={{
            width: width || undefined,
            height: height || undefined,
            minWidth: 80,
            minHeight: 60,
          }}
        >
          <ImageIcon className="h-5 w-5 text-amber-500/60" />
          <span className="text-amber-600/70 font-mono text-[10px]">{content.valueKey || '?'}</span>
          <span className="text-foreground/50 text-[10px]">{content.placeholderText}</span>
        </div>
      </div>
    )
  }

  // Preview mode — text placeholder with resolved value
  if (resolved && showPreviewData) {
    return (
      <div style={{ textAlign: settings.alignment }} className="relative inline-block">
        <span
          style={{
            fontSize: resolveFontSize(settings.fontSize),
            fontWeight: settings.fontWeight,
          }}
        >
          {resolved}
        </span>
        <Eye className="inline-block ml-1 h-3 w-3 text-blue-500/40" />
      </div>
    )
  }

  return (
    <div style={{ textAlign: settings.alignment }}>
      <span
        className="inline-block rounded border-2 border-dashed border-amber-400/50 bg-amber-50/50 px-2 py-0.5"
        style={{
          fontSize: resolveFontSize(settings.fontSize),
          fontWeight: settings.fontWeight,
          width: settings.width || undefined,
          height: settings.height || undefined,
        }}
      >
        <span className="text-amber-600/70 font-mono text-[10px] mr-1">{content.valueKey || '?'}</span>
        <span className="text-foreground/60">{content.placeholderText}</span>
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/primitives/data-placeholder-block.tsx
git commit -m "feat: render preview values in dataPlaceholder blocks

When preview toggle is on, resolved text shows as normal styled content
and resolved image URLs render as <img>. Eye icon indicates dynamic state."
```

---

### Task 9: QrCode Preview Rendering

**Files:**
- Modify: `src/components/blocks/primitives/qr-code-block.tsx`

- [ ] **Step 1: Add preview value resolution**

Read `src/components/blocks/primitives/qr-code-block.tsx` to understand the current structure. The key change: when `showPreviewData` is on and the block has `allowOverwrite` with an `overwriteKey`, resolve the preview value and use it as the QR code's value instead of `content.value`.

Add imports:

```ts
import { useVisualToolingState, useGlobalSettingsState } from '#/store/hooks'
import { resolvePreviewValue } from '#/lib/preview'
import { Eye } from 'lucide-react'
```

Inside the component, before the QR rendering logic:

```ts
const { showPreviewData } = useVisualToolingState()
const globalSettings = useGlobalSettingsState()

const previewData = globalSettings.previewData || {}
const effectiveValue = (showPreviewData && settings.allowOverwrite && settings.overwriteKey)
  ? resolvePreviewValue(settings.overwriteKey, previewData, content.previewValue) || content.value
  : content.value
```

Then replace `content.value` with `effectiveValue` wherever it's used for QR generation (the `renderQrCodeSvg` call).

Also, when preview mode is active and a preview value was resolved, show the `Eye` icon instead of or alongside the amber "API:" badge:

```tsx
{showPreviewData && settings.allowOverwrite && settings.overwriteKey && resolvePreviewValue(settings.overwriteKey, previewData, content.previewValue) && (
  <span className="absolute top-0 right-0 z-20 rounded-bl bg-blue-400/90 px-1.5 py-0.5 text-[8px] text-white leading-none flex items-center gap-0.5">
    <Eye className="h-2.5 w-2.5" /> Preview
  </span>
)}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/blocks/primitives/qr-code-block.tsx
git commit -m "feat: QR code renders with preview value when toggle is on

When preview mode active and overwriteKey has a resolved value, the
QR code renders with the preview URL. Blue 'Preview' badge replaces
the amber 'API:' badge."
```

---

### Task 10: Dynamic Key Block Preview (Layout Grid)

**Files:**
- Modify: `src/components/builder/layout-grid.tsx:117-122`

- [ ] **Step 1: Update SortableBlock dynamic badge and content override**

In `src/components/builder/layout-grid.tsx`, the `SortableBlock` component renders a `dynamicKey` amber badge at lines 117-122. Update this to:

1. Show an eye icon + blue badge in preview mode (instead of amber)
2. Pass resolved preview content to the renderer when preview mode is on

Add imports:

```ts
import { useVisualToolingState, useGlobalSettingsState } from '#/store/hooks'
import { resolvePreviewValue, PRIMARY_CONTENT_FIELD } from '#/lib/preview'
import { Eye } from 'lucide-react'
```

Inside `SortableBlock`, add:

```ts
const { showPreviewData } = useVisualToolingState()
const globalSettings = useGlobalSettingsState()
```

Replace the dynamic key badge (lines 117-122):

```tsx
{/* Dynamic key badge */}
{block.commonSettings?.dynamicKey && (
  showPreviewData ? (
    <span className="absolute top-0 right-0 z-20 rounded-bl bg-blue-400/90 px-1.5 py-0.5 text-[8px] text-white leading-none flex items-center gap-0.5">
      <Eye className="h-2.5 w-2.5" />
    </span>
  ) : (
    <span className="absolute top-0 right-0 z-20 rounded-bl bg-amber-400/90 px-1.5 py-0.5 font-mono text-[8px] text-amber-900 leading-none">
      {block.commonSettings.dynamicKey}
    </span>
  )
)}
```

For content override: when `showPreviewData` is on and the block has a `dynamicKey` with a resolved value, create a modified block with the primary content field replaced:

```ts
const previewData = globalSettings.previewData || {}
const dynamicKey = block.commonSettings?.dynamicKey
const primaryField = PRIMARY_CONTENT_FIELD[block.type]
const resolvedDynamic = dynamicKey && primaryField && showPreviewData
  ? resolvePreviewValue(dynamicKey, previewData, block.commonSettings?.previewValue)
  : undefined

const renderBlock = resolvedDynamic && primaryField
  ? { ...block, content: { ...block.content, [primaryField]: resolvedDynamic } }
  : block
```

Then pass `renderBlock` to `<BlockRenderer>` instead of `block`:

```tsx
<BlockRenderer block={renderBlock} />
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/layout-grid.tsx
git commit -m "feat: dynamic blocks show preview content when toggle is on

SortableBlock resolves dynamicKey preview values and injects them into
the block's primary content field at render time (no store mutation).
Badge switches from amber key label to blue eye icon in preview mode."
```

---

## Phase 5: Demo Template

### Task 11: Demo Voucher Template

**Files:**
- Modify: `src/lib/templates/builtins.ts`

- [ ] **Step 1: Add demo voucher template**

In `src/lib/templates/builtins.ts`, add a third template to the array (before the closing `]`):

```ts
  {
    id: 'demo-voucher',
    name: 'Demo Voucher',
    description: 'Gift voucher with dynamic placeholders and preview data',
    icon: 'gift',
    category: 'voucher',
    mode: 'partial',
    source: 'builtin',
    partial: {
      global: {
        previewData: {
          ':title': 'Gift Voucher',
          ':subtitle': 'A special gift for you',
          ':recipient_name': 'Jane Smith',
          ':amount': '$50.00',
          ':valid_until': '2026-12-31',
          ':redeem_url': 'https://example.com/redeem/abc123',
        },
      },
      sections: [
        {
          index: 0,
          blocks: [
            {
              type: 'heading',
              content: { text: ':title' },
              settings: { level: 'h1', fontWeight: 'bold', alignment: 'center' },
              commonSettings: { dynamicKey: ':title', previewValue: 'Gift Voucher' },
            },
            {
              type: 'text',
              content: { body: ':subtitle' },
              settings: { alignment: 'center', fontSize: 'lg' },
              commonSettings: { dynamicKey: ':subtitle', previewValue: 'A special gift for you' },
            },
          ],
        },
        {
          index: 1,
          blocks: [
            {
              type: 'dataPlaceholder',
              content: { valueKey: ':recipient_name', placeholderText: 'Recipient Name', placeholderType: 'text', previewValue: 'Jane Smith' },
              settings: { fontSize: 'xl', fontWeight: 'bold', alignment: 'center' },
            },
            { type: 'divider' },
            {
              type: 'dataPlaceholder',
              content: { valueKey: ':amount', placeholderText: 'Amount', placeholderType: 'text', previewValue: '$50.00' },
              settings: { fontSize: '2xl', fontWeight: 'bold', alignment: 'center' },
            },
            {
              type: 'dataPlaceholder',
              content: { valueKey: ':valid_until', placeholderText: 'Valid Until', placeholderType: 'text', previewValue: '2026-12-31' },
              settings: { fontSize: 'sm', alignment: 'center' },
            },
          ],
        },
        {
          index: 2,
          blocks: [
            {
              type: 'qrCode',
              content: { value: 'https://example.com', label: 'Scan to redeem', previewValue: 'https://example.com/redeem/abc123' },
              settings: { alignment: 'center', size: 120, showLabel: true, allowOverwrite: true, overwriteKey: ':redeem_url' },
            },
          ],
        },
      ],
    },
  },
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates/builtins.ts
git commit -m "feat: add demo voucher template with dynamic placeholders

Three-section voucher with heading, text, dataPlaceholder, and qrCode
blocks all wired to preview data. Includes project-level previewData
payload for testing the preview toggle."
```

---

## Summary

| Task | Phase | Files | Description |
|------|-------|-------|-------------|
| 1 | Schema | 3 | Schema changes — previewValue + previewData fields, store version bump |
| 2 | Store | 4 | showPreviewData toggle state + action + hooks |
| 3 | Logic | 1 | resolvePreviewValue() function + PRIMARY_CONTENT_FIELD map |
| 4 | Toolbar | 2 | Eye toggle button on canvas toolbar |
| 5 | Settings | 1 | Preview value input in Dynamic container group |
| 6 | Settings | 2 | previewValue field in dataPlaceholder + qrCode definitions |
| 7 | Settings | 1 | Preview Data key-value editor in global settings |
| 8 | Renderer | 1 | DataPlaceholder preview rendering |
| 9 | Renderer | 1 | QrCode preview rendering |
| 10 | Renderer | 1 | Dynamic key blocks — content override + badge swap |
| 11 | Template | 1 | Demo voucher template with preview data |

**Parallelizable:** Tasks 5, 6, 7 (Phase 3 settings) are independent. Tasks 8, 9, 10 (Phase 4 renderers) are independent.
