import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// These paragraphs are authored document captions, not application display copy.
// Match their complete current class and binding so changed markup needs review.
const authoredCaptions = new Map([
  ['src/voucher-builder/blocks/renderers/primitives/image-block.tsx', {
    id: 'authored-image-caption-spacing', binding: 'block.content.caption',
    reason: 'The image caption margin belongs to the authored document preview; replacing it with app layout would change the design.',
  }],
  ['src/voucher-builder/blocks/renderers/primitives/qr-code-block.tsx', {
    id: 'authored-qr-label-spacing', binding: 'block.content.label',
    reason: 'The QR label margin belongs to the authored document preview; it is not application copy spacing.',
  }],
])
const captionClass = 'mt-2 text-center text-xs text-muted-foreground'

export function classifyCompositionFindings(report, { root = process.cwd(), readSource = file => fs.readFileSync(file, 'utf8') } = {}) {
  const sources = new Map()
  const authoredOutputExceptions = []
  const acknowledged = new Set()
  for (const finding of report.findings) {
    if (finding.rule !== 'copy-margin' || finding.severity !== 'error') continue
    const file = path.relative(root, finding.file).replaceAll('\\', '/')
    const decision = authoredCaptions.get(file)
    if (!decision || acknowledged.has(decision.id)) continue
    if (!sources.has(file)) {
      const text = readSource(finding.file)
      sources.set(file, typeof text === 'string' ? ts.createSourceFile(finding.file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) : null)
    }
    const source = sources.get(file)
    if (!source) continue
    let matches = false
    function scan(node) {
      const position = ts.isJsxElement(node) ? source.getLineAndCharacterOfPosition(node.openingElement.getStart()) : null
      if (position && ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'p' &&
        position.line + 1 === finding.line && position.character + 1 === finding.column) {
        const classes = node.openingElement.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.text === 'className')?.initializer
        const content = node.children.filter(child => !ts.isJsxText(child) || child.text.trim())
        matches ||= Boolean(classes && ts.isStringLiteral(classes) && classes.text === captionClass &&
          content.length === 1 && ts.isJsxExpression(content[0]) && content[0].expression?.getText(source) === decision.binding)
      }
      ts.forEachChild(node, scan)
    }
    scan(source)
    if (matches) {
      acknowledged.add(decision.id)
      authoredOutputExceptions.push({ id: decision.id, reason: decision.reason, finding })
    }
  }
  return {
    ...report,
    authoredOutputExceptions,
    actionableErrors: report.errors - authoredOutputExceptions.length,
    actionableWarnings: report.warnings,
  }
}
