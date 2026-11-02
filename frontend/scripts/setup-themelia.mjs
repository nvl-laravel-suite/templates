import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let root = path.dirname(fileURLToPath(import.meta.resolve('themelia-react-ui')))
let manifest
while (true) {
  const file = path.join(root, 'package.json')
  if (
    fs.existsSync(file) &&
    (manifest = JSON.parse(fs.readFileSync(file, 'utf8'))).name === 'themelia-react-ui'
  )
    break
  const parent = path.dirname(root)
  assert(parent !== root, 'Cannot resolve themelia-react-ui')
  root = parent
}
const source = path.join(root, 'docs/consumer-skill')
const {
  focusedSkills,
  sharedSkillName,
  consumerBundleFiles,
  checkCopiedConsumerBundle,
  copyConsumerBundle,
} = await import(pathToFileURL(path.join(source, 'scripts/setup-skills.mjs')).href)
const canonical = [sharedSkillName, ...focusedSkills]
const managed = [...canonical, 'themelia-foundation', 'themelia-forms']
const configured = process.env.THEMELIA_SKILL_DIR
assert(configured === undefined || configured.trim(), 'THEMELIA_SKILL_DIR must name a shared skill directory')
// The existing environment variable names the shared skill, while the upstream
// helper accepts the parent directory containing the complete sibling bundle.
const destinations = configured === undefined
  ? ['.agents/skills', '.claude/skills'].map((directory) => path.resolve(directory))
  : [path.dirname(path.resolve(configured))]
const write = process.argv.includes('--write')

function safeDirectory(directory) {
  assert(directory !== path.parse(directory).root, 'Refusing a filesystem root as a skill destination')
  let current = directory
  while (true) {
    const stat = fs.lstatSync(current, { throwIfNoEntry: false })
    if (stat) {
      assert(!stat.isSymbolicLink(), `Skill path must not contain a symlink: ${current}`)
      assert(stat.isDirectory(), `Skill path must be a directory: ${current}`)
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
}

function realAssets(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    assert(!entry.isSymbolicLink(), `Skill assets must not contain a symlink: ${file}`)
    if (entry.isDirectory()) realAssets(file)
    else assert(entry.isFile(), `Skill asset must be a regular file: ${file}`)
  }
}

for (const name of ['public-api.json', 'tokens.json', 'component-contracts.json']) {
  const metadata = JSON.parse(fs.readFileSync(path.join(source, 'references', name), 'utf8'))
  assert.equal(metadata.package, manifest.name)
  assert.equal(metadata.version, manifest.version)
}
const instructions = ['AGENTS.md', 'CLAUDE.md'].find((file) => fs.lstatSync(file, { throwIfNoEntry: false })) ?? 'AGENTS.md'
const instructionStat = fs.lstatSync(instructions, { throwIfNoEntry: false })
assert(!instructionStat?.isSymbolicLink(), `Contributor instructions must not be a symlink: ${instructions}`)
assert(!instructionStat || instructionStat.isFile(), `Contributor instructions must be a regular file: ${instructions}`)
const reference = fs.readFileSync(path.join(source, 'references/agents-md.md'), 'utf8')
const marker = /<!-- themelia-react-ui:start [\s\S]*?<!-- themelia-react-ui:end -->/
const block = reference.match(marker)?.[0]
assert(block, 'Installed Themelia project instructions are missing their marked block')
const text = instructionStat ? fs.readFileSync(instructions, 'utf8') : ''
assert(
  !text.includes('<!-- themelia-react-ui:start') ||
    (marker.test(text) && (text.match(/<!-- themelia-react-ui:start/g) ?? []).length === 1),
  `Malformed Themelia guidance in ${instructions}; preserve one complete marked block`,
)

// Preflight every destination before moving anything, so a linked second agent
// directory cannot leave the first agent with only part of an upgrade.
const plans = destinations.map((destination) => {
  safeDirectory(destination)
  consumerBundleFiles(root, destination)
  const existing = fs.existsSync(destination) ? fs.readdirSync(destination) : []
  const owned = existing.filter((name) =>
    managed.some((skill) => name === skill || name.startsWith(`${skill}.backup-`)),
  )
  for (const name of owned) {
    const directory = path.join(destination, name)
    safeDirectory(directory)
    realAssets(directory)
  }
  let current = false
  try {
    checkCopiedConsumerBundle({ packageRoot: root, destination })
    current = true
  } catch (error) {
    if (!write) throw error
  }
  const obsolete = owned.filter((name) => !canonical.includes(name))
  assert(write || !obsolete.length, `Obsolete Themelia skills at ${destination}; run npm run setup:ui`)
  return { destination, current, archive: current ? obsolete : owned }
})

if (write) {
  const archived = plans.flatMap(({ destination, archive }) =>
    archive.map((name) => ({ destination, name })),
  )
  if (archived.length) {
    const backupParent = path.resolve('.cache/themelia-skills-backups')
    safeDirectory(backupParent)
    const backup = path.join(backupParent, `${Date.now()}-${randomUUID()}`)
    const moves = archived.map(({ destination, name }) => {
      const relative = path.relative(process.cwd(), destination)
      const evidence = relative && !relative.startsWith(`..${path.sep}`) && relative !== '..'
        ? relative
        : relative === ''
          ? 'project-root'
          : path.join('external', destination.slice(path.parse(destination).root.length))
      return { from: path.join(destination, name), to: path.join(backup, evidence, name) }
    })
    for (const { from, to } of moves) {
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.renameSync(from, to)
    }
    fs.writeFileSync(
      path.join(backup, 'manifest.json'),
      `${JSON.stringify({ package: manifest.name, version: manifest.version, moves }, null, 2)}\n`,
    )
  }
  for (const { destination, current } of plans)
    if (!current) copyConsumerBundle({ packageRoot: root, destination })
  const updated = marker.test(text)
    ? text.replace(marker, block)
    : `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${block}\n`
  if (updated !== text) fs.writeFileSync(instructions, updated)
}
assert(
  fs.existsSync(instructions) && fs.readFileSync(instructions, 'utf8').includes(block),
  `Missing/stale ${instructions} guidance; run npm run setup:ui`,
)
for (const destination of destinations) {
  const result = checkCopiedConsumerBundle({ packageRoot: root, destination })
  console.log(
    `${manifest.name}@${manifest.version}: ${result.skills.length} skills, ${result.assets} assets verified at ${destination}; ${instructions} current`,
  )
}
