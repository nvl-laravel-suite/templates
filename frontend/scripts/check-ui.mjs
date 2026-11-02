import { getUIScope, uiStyles } from './ui-scope.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
import { classifyCompositionFindings } from './composition-output-exceptions.mjs'

const { targets } = getUIScope()
// The package checker follows direct Themelia imports. Also inspect our private
// callback adapters so wrapping Button/Input cannot conceal a second visual recipe.
const violations = []
let adapterCalls = 0
const controlOwner =
  /themelia-react-ui\/base\/(buttons|text-inputs|choice-inputs|forms-numeric|value-inputs)$|\/ui\/(button|input|textarea|slider|switch|popover|tabs)$|variants\/text$/
const controlSymbols =
  /^(Button|Input|Textarea|TextInput|DecimalInput|Select|Switch|Checkbox|Slider|SliderField|PillRadioGroup|ListRadioGroup|PopoverTrigger|TabsTrigger)$/
const visualOverride =
  /(?:^|:)(?:rounded(?:-|$)|p[xysetrbl]?-|h-(?:\d|control)|min-h-(?:\d|control)|bg-|border-(?!collapse)|text-(?:xs|pxs|sm|base|foreground|muted-foreground|primary|secondary|destructive|warning|success|accent|\[)|ring-|shadow-|opacity-|transition)/
for (const file of targets) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const owned = new Set()
  for (const entry of source.statements) {
    if (!ts.isImportDeclaration(entry) || !controlOwner.test(entry.moduleSpecifier.text)) continue
    for (const element of entry.importClause?.namedBindings?.elements ?? []) {
      if (controlSymbols.test((element.propertyName ?? element.name).text)) owned.add(element.name.text)
    }
  }
  function scan(node) {
    const jsx = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
    const render =
      jsx &&
      node.attributes.properties.find((attr) => ts.isJsxAttribute(attr) && attr.name.text === 'render')
        ?.initializer
    const renderedControl =
      render &&
      ts.isJsxExpression(render) &&
      render.expression &&
      (ts.isJsxSelfClosingElement(render.expression) || ts.isJsxElement(render.expression))
        ? ts.isJsxElement(render.expression)
          ? render.expression.openingElement
          : render.expression
        : null
    if (
      jsx &&
      (owned.has(node.tagName.getText(source)) ||
        (renderedControl && owned.has(renderedControl.tagName.getText(source))))
    ) {
      adapterCalls++
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || attr.name.text !== 'className' || !attr.initializer) continue
        const literals = []
        function strings(value) {
          if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
            literals.push(value.text)
          else ts.forEachChild(value, strings)
        }
        strings(attr.initializer)
        for (const token of literals
          .join(' ')
          .split(/\s+/)
          .filter((token) => visualOverride.test(token))) {
          const line = source.getLineAndCharacterOfPosition(attr.getStart()).line + 1
          violations.push(`${path.relative(process.cwd(), file)}:${line}: control recipe override ${token}`)
        }
      }
    }
    ts.forEachChild(node, scan)
  }
  scan(source)
}
const styles = uiStyles
for (const file of styles) {
  postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }).walkRules((rule) => {
    if (
      /\[(?:data-slot|data-state|role|aria-pressed)[=~|^$*]/.test(rule.selector) &&
      !rule.parent?.params?.includes('print')
    )
      violations.push(
        `${file}:${rule.source.start.line}: style targets library anatomy or state: ${rule.selector}`,
      )
  })
}
for (const violation of violations) console.error(violation)
console.log(
  `Adapter/CSS policy: ${adapterCalls} control uses, ${styles.length} stylesheets, ${violations.length} errors`,
)
const result = spawnSync(
  process.execPath,
  ['node_modules/themelia-react-ui/docs/consumer-skill/scripts/check-composition.mjs', ...targets.sort()],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
)
if (result.stderr) process.stderr.write(result.stderr)
try {
  if (result.error || result.signal || ![0, 1].includes(result.status))
    throw result.error ?? new Error(`Composition checker did not complete (${result.signal ?? result.status}).`)
  const original = JSON.parse(result.stdout)
  if (!Array.isArray(original.findings) ||
      original.errors !== original.findings.filter(item => item.severity === 'error').length ||
      original.warnings !== original.findings.filter(item => item.severity !== 'error').length ||
      result.status !== (original.errors ? 1 : 0))
    throw new Error('Composition checker returned an inconsistent report or exit status.')
  const report = classifyCompositionFindings(original)
  console.log(JSON.stringify(report, null, 2))
  console.log(`Composition policy: ${report.actionableErrors} actionable errors, ${report.actionableWarnings} warnings, ${report.authoredOutputExceptions.length} named authored-output exceptions. Original findings retained above.`)
  process.exitCode = violations.length || report.actionableErrors ? 1 : 0
} catch (error) {
  if (result.stdout) process.stdout.write(result.stdout)
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
