# Standalone VoucherBuilder Component — Design Spec

**Date**: 2026-04-23
**Scope**: Remove TanStack Start dependency, restructure into self-contained `<VoucherBuilder />` React component
**Status**: Approved

---

## Problem

The voucher builder is currently a TanStack Start SSR app with file-based routing. This ties it to a specific framework and prevents embedding it as a component in other React applications. The actual framework dependency is minimal (4 files), but the code is scattered across `src/` without clear boundaries.

## Design

### Goal

A self-contained `src/voucher-builder/` directory that exports a `<VoucherBuilder />` React component. No TanStack Start, no routing, no SSR. Props-driven configuration with feature flags, callbacks, and preset modes.

### Component API

```tsx
interface VoucherBuilderProps {
  config?: VoucherBuilderConfig
  features?: Partial<VoucherBuilderFeatures>
  mode?: 'admin' | 'editor' | 'viewer'
  initialProject?: Project
  onChange?: (project: Project) => void
  onExport?: (format: 'html' | 'json' | 'pdf', data: string | Blob) => void
  onSave?: (project: Project) => void
  locale?: string
  theme?: 'light' | 'dark' | 'system'
  className?: string
}

interface VoucherBuilderConfig {
  apiTemplateEndpoint?: string
  localTemplatePath?: string
  pdfExportEndpoint?: string
}

interface VoucherBuilderFeatures {
  templates: boolean
  templateSync: boolean
  blockLibrary: boolean
  elementsPanel: boolean
  globalSettings: boolean
  blockSettings: boolean
  validation: boolean
  export: boolean
  importJson: boolean
  preview: boolean
  previewData: boolean
  debugTools: boolean
  commandPalette: boolean
  contextMenu: boolean
  clipboard: boolean
  undoRedo: boolean
  security: boolean
}
```

### Mode Presets

| Feature | admin | editor | viewer |
|---------|-------|--------|--------|
| templates | true | true | false |
| templateSync | true | false | false |
| blockLibrary | true | true | false |
| elementsPanel | true | true | false |
| globalSettings | true | true | false |
| blockSettings | true | true | false |
| validation | true | true | false |
| export | true | true | true |
| importJson | true | false | false |
| preview | true | true | true |
| previewData | true | true | true |
| debugTools | true | false | false |
| commandPalette | true | true | false |
| contextMenu | true | true | false |
| clipboard | true | true | false |
| undoRedo | true | true | false |
| security | false | true | true |

`mode` provides defaults. Individual `features` entries override them. If neither is specified, all features are enabled (admin behavior).

### Directory Structure

```
src/
├── voucher-builder/
│   ├── index.ts                  # Public API: exports component, types, schema types
│   ├── VoucherBuilder.tsx        # Root component: context provider + Composer layout
│   ├── context.ts                # VoucherBuilderContext, useFeature(), useBuilderConfig()
│   ├── types.ts                  # Props, Features, Config, mode presets
│   │
│   ├── blocks/
│   │   ├── definitions/          # primitives/, composables/, sections/, layout/, index.ts
│   │   ├── renderers/            # primitives/, composables/, sections/, layout/, shared/
│   │   ├── registry.ts
│   │   ├── factory.ts
│   │   ├── types.ts
│   │   └── helpers/              # define-composable-block.ts, define-section-block.ts, settings-factories.ts
│   │
│   ├── store/
│   │   ├── document.ts
│   │   ├── editor.ts
│   │   ├── runtime.ts
│   │   ├── hooks.ts
│   │   ├── actions.ts
│   │   ├── types.ts
│   │   └── actionModules/        # blocks.ts, clipboard.ts, containers.ts, global.ts, history.ts, pages.ts, project.ts, sections.ts, selection.ts, shared.ts
│   │
│   ├── engine/
│   │   ├── commands.ts
│   │   ├── document.ts
│   │   ├── graph.ts
│   │   └── navigation.ts
│   │
│   ├── schema/
│   │   └── index.ts              # All Zod schemas, type exports, factory
│   │
│   ├── export/
│   │   ├── html.ts
│   │   ├── json.ts
│   │   ├── pdf-strategies.ts
│   │   └── index.ts
│   │
│   ├── templates/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── builtins.ts
│   │   └── index.ts
│   │
│   ├── builder/                  # Editor UI components
│   │   ├── canvas-toolbar.tsx
│   │   ├── voucher-canvas.tsx
│   │   ├── voucher-section.tsx
│   │   ├── layout-grid.tsx
│   │   ├── block-library.tsx
│   │   ├── block-settings.tsx
│   │   ├── block-toolbar.tsx
│   │   ├── page-elements.tsx
│   │   ├── global-settings.tsx
│   │   ├── section-settings.tsx
│   │   ├── template-picker.tsx
│   │   ├── export-dialog.tsx
│   │   ├── command-palette.tsx
│   │   ├── block-context-menu.tsx
│   │   ├── confirm-dialog.tsx
│   │   ├── shortcut-legend.tsx
│   │   ├── validation-panel.tsx
│   │   ├── quick-block-picker.tsx
│   │   ├── auto-settings-renderer.tsx
│   │   ├── font-picker.tsx
│   │   ├── ruler-overlay.tsx
│   │   ├── grid-overlay.tsx
│   │   ├── app-menubar.tsx
│   │   └── settings/             # All settings field components, overrides, types
│   │
│   ├── ui/                       # shadcn/base-ui primitives
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── tooltip.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   ├── switch.tsx
│   │   ├── popover.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── collapsible.tsx
│   │   ├── scroll-area.tsx
│   │   ├── tabs.tsx
│   │   ├── color-picker.tsx
│   │   ├── icon-picker.tsx
│   │   ├── image-upload.tsx
│   │   ├── toast.tsx
│   │   ├── rich-text-editor.tsx
│   │   ├── ...
│   │   └── typography.tsx
│   │
│   ├── hooks/
│   │   ├── use-keyboard-shortcuts.ts
│   │   ├── use-security-guard.ts
│   │   ├── use-toast.ts
│   │   ├── use-inline-edit.ts
│   │   ├── use-block-selection.ts
│   │   └── use-composable-children.ts
│   │
│   ├── lib/
│   │   ├── utils.ts              # cn() helper
│   │   ├── voucher.ts            # A4 constants, mm/px conversion
│   │   ├── fonts.ts              # Google Fonts loader
│   │   ├── icons.ts              # Icon registry
│   │   ├── preview.ts            # Preview value resolution
│   │   ├── commands.ts           # Command palette registry
│   │   ├── theme-presets.ts
│   │   ├── font-sizes.ts
│   │   ├── date-block.ts
│   │   ├── qr-code.ts
│   │   ├── block-tree.ts
│   │   └── validation.ts
│   │
│   ├── i18n/
│   │   └── core.ts               # Translation helpers
│   │
│   └── styles.css                # Complete stylesheet (Atelier Precision + shadcn tokens)
│
├── main.tsx                      # Dev SPA entry: renders <VoucherBuilder mode="admin" />
└── index.ts                      # Re-export: export { VoucherBuilder } from './voucher-builder'
```

### Context System

`VoucherBuilderContext` replaces the file-based config system and provides feature flags to all children.

```tsx
// context.ts
interface VoucherBuilderContextValue {
  config: VoucherBuilderConfig
  features: VoucherBuilderFeatures
  callbacks: {
    onChange?: (project: Project) => void
    onExport?: (format: string, data: string | Blob) => void
    onSave?: (project: Project) => void
  }
}

const VoucherBuilderContext = createContext<VoucherBuilderContextValue>(...)

export function useFeature(name: keyof VoucherBuilderFeatures): boolean
export function useBuilderConfig(): VoucherBuilderConfig
export function useBuilderCallbacks(): VoucherBuilderContextValue['callbacks']
```

### Config Migration

`src/lib/config.ts` currently fetches `public/config.json`. After the change:
- `loadAppConfig()` is removed (no fetch)
- `getAppConfig()` is replaced by `useBuilderConfig()` which reads from context
- Components that call `getAppConfig()` switch to `useBuilderConfig()`
- Components that call `loadAppConfig()` remove those calls

### Feature Guards

Every toggleable UI section wraps in `useFeature()`:

```tsx
// In canvas-toolbar.tsx:
const showDebugTools = useFeature('debugTools')
const showPreviewData = useFeature('previewData')

// In routes/index.tsx → VoucherBuilder.tsx:
const showBlockLibrary = useFeature('blockLibrary')
const showTemplates = useFeature('templates')
{showBlockLibrary && <BlockLibrary />}
{showTemplates && <TemplatePicker />}

// In use-keyboard-shortcuts.ts:
const canUndo = useFeature('undoRedo')
const canCopy = useFeature('clipboard')
```

### Callbacks

**`onChange`**: Fires on every document state change via Zustand subscription. Debounced internally (100ms) to avoid flooding.

**`onExport`**: Called from ExportDialog after successful export. Receives format string and data (HTML string, JSON string, or PDF Blob).

**`onSave`**: Wired to a Save button/shortcut (Cmd+S). If not provided, save functionality is hidden.

### Initial Project Loading

If `initialProject` is provided, it's loaded into the document store on mount (replacing the default empty project). Changes to `initialProject` after mount are ignored (controlled externally via `onChange`).

```tsx
useEffect(() => {
  if (initialProject) {
    loadProject(initialProject)
  }
}, []) // intentionally mount-only
```

### Theme

The `theme` prop controls the `dark` class on the component's root element:
- `'light'` — no dark class
- `'dark'` — adds `dark` class
- `'system'` — uses `prefers-color-scheme` media query

The A4 canvas always renders with the user's `GlobalSettings.colors` regardless of theme.

### Path Alias

The internal path alias `#/*` maps to `./src/voucher-builder/*` (updated in `tsconfig.json`). All imports within the component use this alias.

### What Gets Deleted

- `src/router.tsx`
- `src/routeTree.gen.ts`
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/lib/config.ts` (replaced by context)
- `app.config.ts`
- `.tanstack/` directory
- TanStack dependencies from `package.json`:
  - `@tanstack/react-router`
  - `@tanstack/react-start`
  - `@tanstack/react-router-devtools`
  - `vinxi` (TanStack Start's server)

### What Gets Created

- `src/voucher-builder/index.ts` — public API exports
- `src/voucher-builder/VoucherBuilder.tsx` — root component
- `src/voucher-builder/context.ts` — context + hooks
- `src/voucher-builder/types.ts` — all prop/feature types + mode presets
- `src/main.tsx` — dev SPA entry
- `src/index.ts` — re-export wrapper

### Build Configuration

`vite.config.ts` becomes a standard Vite React config:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '#': path.resolve(__dirname, 'src/voucher-builder') },
  },
})
```

For library builds (npm package), add:

```ts
build: {
  lib: {
    entry: 'src/index.ts',
    formats: ['es'],
  },
  rollupOptions: {
    external: ['react', 'react-dom'],
  },
}
```

### Migration Strategy

This is a **file move + rename** operation, not a rewrite. The code inside each file stays the same — only imports change. The steps:

1. Create `src/voucher-builder/` directory structure
2. Move files from their current locations into the new structure
3. Update all internal `#/` imports to match new paths
4. Create the new files (VoucherBuilder.tsx, context.ts, types.ts, index.ts, main.tsx)
5. Delete old TanStack files (router.tsx, routes/, routeTree.gen.ts)
6. Update vite.config.ts and tsconfig.json
7. Remove TanStack dependencies from package.json
8. Verify compilation and test

### Public API

```ts
// src/voucher-builder/index.ts
export { VoucherBuilder } from './VoucherBuilder'
export type { VoucherBuilderProps, VoucherBuilderConfig, VoucherBuilderFeatures } from './types'
export type { Project, Block, BlockType, VoucherSection, GlobalSettings, Frame, CommonBlockSettings } from './schema'
```

## Out of Scope

- npm package publishing configuration (package.json `main`/`module`/`types` fields)
- Storybook or component documentation
- SSR support (this is a client-only component)
- CSS extraction / CSS modules (styles bundled with the component via Vite)
- Peer dependency management beyond React/ReactDOM
- i18n dictionary loading from external sources
