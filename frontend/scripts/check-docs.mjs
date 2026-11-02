import ts from 'typescript'
import path from 'node:path'
import { readFile, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = [
  'README.md',
  'INSTALLATION.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  ...(await readdir(path.join(root, 'docs')))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
]
const failures = []
const cache = new Map()
const text = async (file) => {
  if (!cache.has(file)) cache.set(file, await readFile(file, 'utf8'))
  return cache.get(file)
}
const prose = (source) => source.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '')
const slugs = (source) => {
  const counts = new Map()
  const result = new Set()
  for (const match of prose(source).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = match[1]
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}_\- ]/gu, '')
      .replaceAll(' ', '-')
    const count = counts.get(base) ?? 0
    result.add(base + (count ? `-${count}` : ''))
    counts.set(base, count + 1)
  }
  return result
}
let links = 0
for (const name of files) {
  const file = path.join(root, name)
  const body = prose(await text(file))
  for (const match of body.matchAll(/\[[^\]\n]+\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
    const href = match[1] ?? match[2]
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) continue
    const [raw, anchor] = href.split('#')
    const target = path.resolve(
      path.dirname(file),
      decodeURIComponent(raw.split('?')[0]) || path.basename(file),
    )
    links++
    try {
      const info = await stat(target)
      if (
        anchor &&
        info.isFile() &&
        /\.md$/i.test(target) &&
        !slugs(await text(target)).has(decodeURIComponent(anchor))
      )
        failures.push(`${name}: missing anchor ${href}`)
    } catch {
      failures.push(`${name}: missing local target ${href}`)
    }
  }
  let columns = 0
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('|')) {
      columns = 0
      continue
    }
    const count = line.replaceAll(String.fromCharCode(92) + '|', '').split('|').length
    if (!columns) columns = count
    else if (count !== columns) failures.push(`${name}: table column mismatch: ${line.slice(0, 90)}`)
  }
}
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()
const factoryType = (filename, name) => {
  const source = program.getSourceFile(path.join(root, `src/${filename}.ts`))
  const module = checker.getSymbolAtLocation(source)
  let symbol = checker.getExportsOfModule(module).find((symbol) => symbol.name === name)
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? source)
  return checker.getReturnTypeOfSignature(checker.getSignaturesOfType(type, ts.SignatureKind.Call)[0])
}
const memberType = (type, name) => {
  const symbol = checker.getPropertyOfType(type, name)
  return checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? symbol.declarations[0])
}
const commands = await text(path.join(root, 'docs/COMMANDS.md'))
const section = (start, end) =>
  commands.slice(
    commands.indexOf(start),
    end ? commands.indexOf(end, commands.indexOf(start) + start.length) : undefined,
  )
let covered = 0
const checkCommands = (label, type, body) => {
  for (const symbol of checker.getPropertiesOfType(type)) {
    const value = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? symbol.declarations[0])
    if (!checker.getSignaturesOfType(value, ts.SignatureKind.Call).length) continue
    if (!body.includes('`' + symbol.name + '('))
      failures.push(`COMMANDS.md: missing ${label}.${symbol.name}()`)
    covered++
  }
}
const creator = factoryType('template-creator', 'createTemplateCreator')
const editor = factoryType('template-creator', 'createTemplateEditor')
const voucher = factoryType('hooks', 'createVoucherBuilder')
checkCommands('creator', creator, section('## Template Creator controller', '### Creator actions'))
checkCommands(
  'creator.actions',
  memberType(creator, 'actions'),
  section('### Creator actions', '## Template Editor controller'),
)
checkCommands('editor', editor, section('## Template Editor controller', '### Editor actions'))
checkCommands(
  'editor.actions',
  memberType(editor, 'actions'),
  section('### Editor actions', '## Voucher controller'),
)
checkCommands('voucher', voucher, section('## Voucher controller', '### Voucher document actions'))
checkCommands(
  'voucher.actions',
  memberType(voucher, 'actions'),
  section('### Voucher document actions', '### Voucher template library'),
)
checkCommands(
  'voucher.templates',
  memberType(voucher, 'templates'),
  section('### Voucher template library', '## Errors and host boundaries'),
)
const events = await text(path.join(root, 'src/voucher-builder/store/events.ts'))
const inventory = await text(path.join(root, 'docs/PUBLIC_API.md'))
const eventTypes = new Set([...events.matchAll(/type:\s*'([^']+)'/g)].map((match) => match[1]))
for (const type of eventTypes)
  if (!inventory.includes(`type: '${type}'`)) failures.push(`PUBLIC_API.md: missing event ${type}`)
if (failures.length) throw new Error(failures.join('\n'))
console.log(
  `Documentation checked: ${files.length} guides, ${links} local links, ${covered} commands, ${eventTypes.size} events.`,
)
