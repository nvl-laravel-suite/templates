import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import { getUIScope, uiEntries, uiStyles, isUIFile } from './ui-scope.mjs'

const relative = (file) => path.relative(process.cwd(), file).replaceAll('\\', '/')
const hash = (value) => crypto.createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex')
const scope = getUIScope()
let packageRoot = path.dirname(fileURLToPath(import.meta.resolve('themelia-react-ui')))
while (true) {
  const manifest = path.join(packageRoot, 'package.json')
  if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === 'themelia-react-ui')
    break
  const parent = path.dirname(packageRoot)
  if (parent === packageRoot) throw new Error('Cannot resolve installed Themelia package')
  packageRoot = parent
}
const indexPath = path.join(packageRoot, 'docs/consumer-skill/references/public-api.json')
const api = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const families = new Map(api.families.map((family) => [family.import, family]))

// A barrel alone cannot detect changes in re-exported props, recipes or runtime.
// Fingerprint all shipped declarations/runtime/styles and the complete guidance.
function fingerprintDirectory(directory) {
  const entries = []
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (!file.endsWith('.map'))
        entries.push([
          path.relative(packageRoot, file).replaceAll('\\', '/'),
          crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
        ])
    }
  }
  visit(directory)
  return entries.sort(([a], [b]) => a.localeCompare(b, 'en'))
}
const packageFingerprint = hash(
  JSON.stringify([
    ...fingerprintDirectory(path.join(packageRoot, 'dist')),
    ...fingerprintDirectory(path.join(packageRoot, 'docs/consumer-skill')),
    ...fingerprintDirectory(path.join(packageRoot, 'docs/consumer-skills')),
    ...fingerprintDirectory(path.join(packageRoot, 'templates')),
    ['package.json', hash(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))],
  ]),
)
const inputs = [
  ...new Set([
    ...scope.visited,
    ...[
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'CLAUDE.md',
      'docs/UI.md',
      'scripts/audit-ui.mjs',
      'scripts/ui-scope.mjs',
      'scripts/check-ui.mjs',
      'scripts/composition-output-exceptions.mjs',
    ].map((file) => path.resolve(file)),
  ]),
]
  .filter((file) => !scope.targets.includes(file))
  .sort()
  .map((file) => ({ file: relative(file), sha256: hash(fs.readFileSync(file, 'utf8')) }))
const inputsFingerprint = hash(JSON.stringify(inputs))

export function inventoryFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = []
  const bindings = new Map()
  const components = []
  const uses = []
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const module = statement.moduleSpecifier.text
    const resolved = ts.resolveModuleName(module, file, scope.options, ts.sys).resolvedModule
    const symbols = []
    if (statement.importClause?.name)
      symbols.push({ local: statement.importClause.name.text, symbol: 'default' })
    const named = statement.importClause?.namedBindings
    if (named && ts.isNamespaceImport(named)) symbols.push({ local: named.name.text, symbol: '*' })
    else
      for (const binding of named?.elements ?? [])
        symbols.push({ local: binding.name.text, symbol: (binding.propertyName ?? binding.name).text })
    const family = families.get(module)
    const owner = family
      ? module
      : resolved && !resolved.isExternalLibraryImport
        ? relative(resolved.resolvedFileName)
        : module
    for (const binding of symbols) bindings.set(binding.local, `${owner}#${binding.symbol}`)
    if (family || (resolved && !resolved.isExternalLibraryImport))
      imports.push({ module, owner, symbols, ...(family ? { declaration: family.declaration } : {}) })
  }
  function scan(node) {
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text))
      components.push({
        name: node.name.text,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const root = tag.split('.')[0]
      const props = node.attributes.properties.map((attr) => {
        if (ts.isJsxSpreadAttribute(attr))
          return {
            name: '...',
            kind: 'spread',
            value: attr.expression.getText(source).replace(/\s+/g, ' ').slice(0, 220),
          }
        return {
          name: attr.name.getText(source),
          kind: !attr.initializer || ts.isStringLiteral(attr.initializer) ? 'literal' : 'expression',
          value: attr.initializer?.getText(source).replace(/\s+/g, ' ').slice(0, 220) ?? 'true',
        }
      })
      uses.push({
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        tag,
        owner:
          bindings.get(root) ?? (/^[a-z]/.test(root) ? `native:${root}` : `local:${relative(file)}#${root}`),
        props,
      })
    }
    ts.forEachChild(node, scan)
  }
  scan(source)
  return { file: relative(file), sha256: hash(text), imports, components, uses }
}

const files = scope.targets.map(inventoryFile)
const styles = uiStyles.map((file) => {
  const text = fs.readFileSync(file, 'utf8')
  const rules = []
  postcss.parse(text, { from: file }).walkRules((rule) =>
    rules.push({
      line: rule.source.start.line,
      selector: rule.selector,
      declarations: rule.nodes
        .filter((node) => node.type === 'decl')
        .map((node) => `${node.prop}: ${node.value}`),
    }),
  )
  return { file, sha256: hash(text), rules }
})
const referencedFamilies = [
  ...new Set(
    files.flatMap((file) => file.imports.filter((item) => item.declaration).map((item) => item.module)),
  ),
].sort()
const contracts = referencedFamilies.map((module) => {
  const family = families.get(module)
  return {
    module,
    declaration: family.declaration,
    sha256: hash(fs.readFileSync(path.join(packageRoot, family.declaration), 'utf8')),
  }
})
const excluded = []
function candidates(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) candidates(file)
    else if (
      isUIFile(path.resolve(file)) &&
      !/\.(test|spec)\.tsx$/.test(file) &&
      !scope.targets.includes(path.resolve(file))
    )
      excluded.push({
        file: relative(file),
        reason: 'Not reachable from the audited browser/public UI entries.',
      })
  }
}
candidates('src')
candidates('examples')
const inventory = {
  schemaVersion: 1,
  package: api.package,
  version: api.version,
  packageFingerprint,
  inputsFingerprint,
  inputs,
  indexSha256: hash(fs.readFileSync(indexPath, 'utf8')),
  entries: uiEntries,
  contracts,
  files,
  styles,
  excluded,
}
const output = 'docs/ui-compliance.inventory.json'
if (process.argv.includes('--inventory')) {
  fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`)
  console.log(
    `Inventoried ${files.length} UI files, ${files.reduce((count, file) => count + file.uses.length, 0)} JSX sites, ${contracts.length} public families and ${styles.reduce((count, file) => count + file.rules.length, 0)} CSS rules.`,
  )
} else {
  const saved = JSON.parse(fs.readFileSync(output, 'utf8'))
  if (JSON.stringify(saved) !== JSON.stringify(inventory))
    throw new Error(
      'UI audit inventory is stale. Review changed contracts/source, then refresh the inventory and review ledger.',
    )
  const review = JSON.parse(fs.readFileSync('docs/ui-compliance.review.json', 'utf8'))
  if (review.schemaVersion !== 1) throw new Error('Unsupported UI review ledger version.')
  const errors = []
  if (review.packageFingerprint !== packageFingerprint || review.inputsFingerprint !== inputsFingerprint)
    errors.push('Installed package, guidance, reachability inputs or audit tools changed: renew the review.')
  for (const item of [...files, ...styles]) {
    const record = review.files[item.file]
    if (!record?.decision || !record?.rules?.length || record.sha256 !== item.sha256)
      errors.push(`${item.file}: missing or stale reviewed decision`)
  }
  for (const contract of contracts)
    if (
      review.contracts[contract.module]?.sha256 !== contract.sha256 ||
      !review.contracts[contract.module]?.note
    )
      errors.push(`${contract.module}: missing or stale contract review`)
  for (const file of Object.keys(review.files))
    if (![...files, ...styles].some((item) => item.file === file))
      errors.push(`${file}: review entry is outside current scope`)
  for (const module of Object.keys(review.contracts))
    if (!contracts.some((contract) => contract.module === module))
      errors.push(`${module}: contract review is outside current scope`)
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(
    `UI compliance ledger matches ${files.length} files, ${contracts.length} public contracts and ${styles.length} stylesheets. Source/contract changes require renewed review; this is not a rendered-state guarantee.`,
  )
}
