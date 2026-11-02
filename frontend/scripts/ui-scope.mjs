import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const libraryUIEntries = ['src/main.tsx', 'src/index.ts', 'src/editor.ts', 'src/template-creator.ts']
const exampleUIEntries = [
  'examples/building-templates.tsx',
  'examples/laravel-family-host.tsx',
  'examples/laravel-host.tsx',
  'examples/laravel-published-host.tsx',
  'examples/laravel/family-panel.tsx',
  'examples/laravel/resource-tools.tsx',
  'examples/react-workspaces.tsx',
]
export const uiEntries = [...libraryUIEntries, ...exampleUIEntries]
export const uiStyles = ['src/voucher-builder/styles.css', 'src/template-creator/workspace.css']
// These renderers mix authored visuals with app-owned editor controls/annotations.
// Pure HTML export is a separate implementation; its markup is not app chrome.
const mixedRendererFiles = new Set([
  'layout/row-block.tsx', 'layout/grid-block.tsx', 'sections/section-block.tsx',
  'composables/composable-child-wrapper.tsx', 'shared/composable-child-list.tsx',
  'primitives/list-block.tsx', 'primitives/data-placeholder-block.tsx',
  'primitives/qr-code-block.tsx', 'primitives/image-block.tsx',
])
export const isUIFile = (file) => {
  const normalized = file.replaceAll('\\', '/')
  const renderer = normalized.split('/src/voucher-builder/blocks/renderers/')[1]
  return file.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(file) && (
    /\/src\/(template-creator\/|template-platform\/|template-email\/|voucher-builder\/(builder\/|ui\/|VoucherBuilder\.tsx)|main\.tsx)|\/examples\//.test(normalized)
    || mixedRendererFiles.has(renderer)
  )
}

/** Shared composition/audit graph, with a source-only option for the library boundary guard. */
export function getUIScope({ includeExamples = true } = {}) {
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd())
  const visited = new Set()
  const targets = []
  function visit(file) {
    const absolute = path.resolve(file)
    if (visited.has(absolute) || !fs.existsSync(absolute)) return
    visited.add(absolute)
    if (isUIFile(absolute)) targets.push(absolute)
    for (const entry of ts.preProcessFile(fs.readFileSync(absolute, 'utf8'), true).importedFiles) {
      const resolved = ts.resolveModuleName(entry.fileName, absolute, config.options, ts.sys).resolvedModule
      if (resolved && !resolved.isExternalLibraryImport && !resolved.resolvedFileName.endsWith('.d.ts'))
        visit(resolved.resolvedFileName)
    }
  }
  const entries = includeExamples ? uiEntries : libraryUIEntries
  entries.forEach(visit)
  return { targets: targets.sort(), visited, options: config.options }
}
