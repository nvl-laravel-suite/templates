import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const script = fileURLToPath(new URL('./setup-themelia.mjs', import.meta.url))
let packageRoot = path.dirname(fileURLToPath(import.meta.resolve('themelia-react-ui')))
while (
  !fs.existsSync(path.join(packageRoot, 'package.json')) ||
  JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).name !== 'themelia-react-ui'
)
  packageRoot = path.dirname(packageRoot)
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
const { checkCopiedConsumerBundle } = await import(
  pathToFileURL(path.join(packageRoot, 'docs/consumer-skill/scripts/setup-skills.mjs')).href
)
const skillNames = [
  'themelia-react-ui-consumer',
  'themelia-components',
  'themelia-tokenization',
  'themelia-composition',
  'themelia-design',
]
const agentDirectories = ['.agents/skills', '.claude/skills']

function fixture(t) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'themelia-skills-test-')))
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
  fs.writeFileSync(
    path.join(cwd, 'CLAUDE.md'),
    '# Fixture policy\n\nKeep this policy.\n\n<!-- themelia-react-ui:start 2.0.1 -->\nOld guidance.\n<!-- themelia-react-ui:end -->\n\nKeep this footer.\n',
  )
  return cwd
}

function run(cwd, { write = false, skillDirectory } = {}) {
  const env = { ...process.env }
  delete env.THEMELIA_SKILL_DIR
  if (skillDirectory) env.THEMELIA_SKILL_DIR = skillDirectory
  return spawnSync(process.execPath, [script, ...(write ? ['--write'] : [])], {
    cwd,
    env,
    encoding: 'utf8',
  })
}

function succeeds(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function writeFile(cwd, name, text) {
  const file = path.join(cwd, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function snapshot(directory) {
  const files = {}
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      const key = path.relative(directory, file)
      if (entry.isSymbolicLink()) files[key] = `link:${fs.readlinkSync(file)}`
      else if (entry.isDirectory()) visit(file)
      else files[key] = fs.readFileSync(file).toString('base64')
    }
  }
  visit(directory)
  return files
}

test('publishes complete real sibling bundles for both project agents', (t) => {
  const cwd = fixture(t)
  succeeds(run(cwd, { write: true }))
  for (const agentDirectory of agentDirectories) {
    const destination = path.join(cwd, agentDirectory)
    assert.deepEqual(fs.readdirSync(destination).sort(), [...skillNames].sort())
    checkCopiedConsumerBundle({ packageRoot, destination })
    for (const name of skillNames)
      assert.equal(fs.lstatSync(path.join(destination, name, 'SKILL.md')).isFile(), true)
    const components = fs.readFileSync(path.join(destination, 'themelia-components/SKILL.md'), 'utf8')
    assert.match(components, /\]\(\.\.\/themelia-react-ui-consumer\/references\/installation\.md\)/)
    const composition = fs.readFileSync(path.join(destination, 'themelia-composition/SKILL.md'), 'utf8')
    assert.match(composition, /\]\(\.\.\/themelia-react-ui-consumer\/references\/screen-decisions\.md\)/)
    const design = fs.readFileSync(path.join(destination, 'themelia-design/SKILL.md'), 'utf8')
    assert.match(design, /\]\(\.\.\/themelia-react-ui-consumer\/references\/data-reading\.md\)/)
    assert.match(design, /\]\(\.\.\/themelia-react-ui-consumer\/references\/critique-rubric\.md\)/)
    assert.match(design, /\]\(\.\.\/themelia-react-ui-consumer\/agents\/themelia-ui-designer\.md\)/)
    const shared = path.join(destination, 'themelia-react-ui-consumer')
    for (const asset of ['references/data-reading.md', 'references/view-spec.md', 'references/view-craft.md', 'references/screen-decisions.md', 'references/critique-rubric.md'])
      assert.equal(fs.lstatSync(path.join(shared, asset)).isFile(), true)
    assert.match(fs.readFileSync(path.join(shared, 'references/critique-rubric.md'), 'utf8'), /## Census/)
    const designer = 'agents/themelia-ui-designer.md'
    assert.deepEqual(fs.readFileSync(path.join(shared, designer)), fs.readFileSync(path.join(packageRoot, 'docs/consumer-skill', designer)))
    const template = 'templates/admin-shell-template.tsx'
    assert.deepEqual(
      fs.readFileSync(path.join(destination, 'themelia-react-ui-consumer', template)),
      fs.readFileSync(path.join(packageRoot, template)),
    )
    assert.equal(Object.values(snapshot(destination)).some((content) => content.startsWith('link:')), false)
  }
  succeeds(run(cwd))
})

test('read-only checking rejects a stale focused skill without changing files', (t) => {
  const cwd = fixture(t)
  succeeds(run(cwd, { write: true }))
  const focusedSkill = '.claude/skills/themelia-tokenization/SKILL.md'
  const oldText = fs.existsSync(path.join(cwd, focusedSkill))
    ? fs.readFileSync(path.join(cwd, focusedSkill), 'utf8')
    : ''
  writeFile(cwd, focusedSkill, `${oldText}\nStale edit.\n`)
  const before = snapshot(cwd)
  const result = run(cwd)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /stale|refresh|setup:ui/i)
  assert.deepEqual(snapshot(cwd), before)
})

test('rejects stale design evidence assets and refreshes the whole sibling bundle', (t) => {
  const cwd = fixture(t)
  succeeds(run(cwd, { write: true }))
  const asset = '.claude/skills/themelia-react-ui-consumer/references/critique-rubric.md'
  const original = fs.readFileSync(path.join(cwd, asset), 'utf8')
  writeFile(cwd, asset, `${original}\nOld app-specific census edit.\n`)
  const before = snapshot(cwd)
  const result = run(cwd)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /stale|refresh|setup:ui/i)
  assert.deepEqual(snapshot(cwd), before)
  succeeds(run(cwd, { write: true }))
  assert.equal(fs.readFileSync(path.join(cwd, asset), 'utf8'), original)
  for (const agentDirectory of agentDirectories)
    checkCopiedConsumerBundle({ packageRoot, destination: path.join(cwd, agentDirectory) })
  assert.equal(fs.readdirSync(path.join(cwd, '.cache/themelia-skills-backups')).length, 1)
})

test('archives obsolete bundles outside discovery and keeps repeat setup idempotent', (t) => {
  const cwd = fixture(t)
  const obsolete = [
    'themelia-react-ui-consumer',
    'themelia-components',
    'themelia-tokenization.backup-123',
    'themelia-foundation',
    'themelia-forms.backup-456',
    'themelia-design',
    'themelia-design.backup-789',
  ]
  for (const agentDirectory of agentDirectories)
    for (const name of obsolete) writeFile(cwd, `${agentDirectory}/${name}/SKILL.md`, `Old ${name}\n`)
  succeeds(run(cwd, { write: true }))
  const backups = path.join(cwd, '.cache/themelia-skills-backups')
  assert.equal(fs.existsSync(backups), true)
  const generations = fs.readdirSync(backups)
  assert.equal(generations.length, 1)
  for (const agentDirectory of agentDirectories) {
    assert.deepEqual(fs.readdirSync(path.join(cwd, agentDirectory)).sort(), [...skillNames].sort())
    for (const name of obsolete)
      assert.equal(
        fs.readFileSync(path.join(backups, generations[0], agentDirectory, name, 'SKILL.md'), 'utf8'),
        `Old ${name}\n`,
      )
  }
  const before = snapshot(cwd)
  succeeds(run(cwd, { write: true }))
  assert.deepEqual(fs.readdirSync(backups), generations)
  assert.deepEqual(snapshot(cwd), before)
})

test('preserves unrelated skills including similarly named directories byte for byte', (t) => {
  const cwd = fixture(t)
  for (const agentDirectory of agentDirectories) {
    writeFile(cwd, `${agentDirectory}/zod/SKILL.md`, 'User skill\n')
    writeFile(cwd, `${agentDirectory}/themelia-components-custom/SKILL.md`, 'Custom skill\n')
  }
  const before = snapshot(cwd)
  succeeds(run(cwd, { write: true }))
  for (const [file, content] of Object.entries(before))
    if (file !== 'CLAUDE.md') assert.equal(snapshot(cwd)[file], content)
})

test('replaces the marked CLAUDE guidance while retaining application policy', (t) => {
  const cwd = fixture(t)
  succeeds(run(cwd, { write: true }))
  const instructions = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8')
  assert.match(instructions, /^# Fixture policy\n\nKeep this policy\./)
  assert.match(instructions, /Keep this footer\.\n$/)
  assert.equal(instructions.includes(`<!-- themelia-react-ui:start ${manifest.version} -->`), true)
  assert.equal((instructions.match(/<!-- themelia-react-ui:start/g) ?? []).length, 1)
  assert.equal(instructions.includes('Old guidance.'), false)
  assert.equal(fs.existsSync(path.join(cwd, 'AGENTS.md')), false)
  succeeds(run(cwd))
})

test('an explicit shared skill directory publishes only its containing skill bundle', (t) => {
  const cwd = fixture(t)
  const skillDirectory = path.join(cwd, 'configured/skills/themelia-react-ui-consumer')
  succeeds(run(cwd, { write: true, skillDirectory }))
  assert.deepEqual(fs.readdirSync(path.dirname(skillDirectory)).sort(), [...skillNames].sort())
  assert.equal(fs.existsSync(path.join(cwd, '.agents')), false)
  assert.equal(fs.existsSync(path.join(cwd, '.claude')), false)
  succeeds(run(cwd, { skillDirectory }))
})

test('rejects linked destination ancestors before writing either agent bundle', (t) => {
  const cwd = fixture(t)
  const outside = path.join(cwd, 'linked-target')
  fs.mkdirSync(outside)
  fs.symlinkSync(outside, path.join(cwd, '.claude'), 'dir')
  const before = snapshot(cwd)
  const result = run(cwd, { write: true })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /symlink|symbolic|linked/i)
  assert.equal(fs.existsSync(path.join(cwd, '.agents')), false)
  assert.deepEqual(snapshot(cwd), before)
})

test('rejects a filesystem root as the bundle destination', (t) => {
  const cwd = fixture(t)
  const result = run(cwd, {
    skillDirectory: path.join(path.parse(cwd).root, 'themelia-react-ui-consumer'),
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /filesystem root/i)
})
