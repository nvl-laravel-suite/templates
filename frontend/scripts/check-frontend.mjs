import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { getUIScope } from './ui-scope.mjs'

// Architectural regression guard for our reachable source, not a browser sandbox.
// Authored assets and installed UI dependencies may use normal browser resources.
// Consumer examples own host transport; only shipped library composition is
// subject to the no-transport/storage architectural boundary.
const scope = getUIScope({ includeExamples: false })
const files = new Set(scope.visited)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
function visit(file) {
  const absolute = path.resolve(file)
  if (files.has(absolute) || !fs.existsSync(absolute)) return
  files.add(absolute)
  for (const entry of ts.preProcessFile(fs.readFileSync(absolute, 'utf8'), true).importedFiles) {
    const resolved = ts.resolveModuleName(entry.fileName, absolute, scope.options, ts.sys).resolvedModule
    if (resolved && !resolved.isExternalLibraryImport && !resolved.resolvedFileName.endsWith('.d.ts'))
      visit(resolved.resolvedFileName)
  }
}
for (const [entry, value] of Object.entries(pkg.exports))
  if (typeof value === 'object') visit(`src/${entry === '.' ? 'index' : entry.slice(2)}.ts`)

const forbidden = new Set([
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'localStorage', 'sessionStorage', 'indexedDB',
  'onSave', 'onPublish', 'onPreviewPDF', 'isSaving', 'isPublishing', 'isPreviewing',
  'getSaveState', 'subscribeSave', 'useVoucherSave', 'useTemplatePublishing', 'useTemplateEditorSave',
  'storageKey', 'configUrl', 'templatesUrl', 'templateStorageKey', 'pdfExportEndpoint',
  'apiTemplateEndpoint', 'localTemplatePath', 'templateSync',
])
const errors = []
for (const file of [...files].sort()) {
  if (!/\.[cm]?[jt]sx?$/.test(file)) continue
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  function report(node, message) {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
    errors.push(`${path.relative(process.cwd(), file).replaceAll('\\', '/')}:${line}: ${message}`)
  }
  function scan(node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text))
      report(node, `${node.text} crosses the frontend composition boundary`)
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && forbidden.has(node.argumentExpression.text))
      report(node, `${node.argumentExpression.text} crosses the frontend composition boundary`)
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text
      if (name.startsWith('node:') || /(^|\/)session(?:-context)?$/.test(name))
        report(node, `Forbidden runtime dependency: ${name}`)
    }
    ts.forEachChild(node, scan)
  }
  scan(source)
}
if (errors.length) throw new Error(errors.join('\n'))
console.log(`Frontend boundary verified across ${files.size} reachable source files: local composition, no transport/storage or save/publication service APIs.`)
