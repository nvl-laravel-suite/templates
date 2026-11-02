import {
  TemplateDefinitionSchema,
  TemplateError,
  TemplateRevisionSchema,
  TemplatePersonalizationSchema,
  TemplateRenderInputSchema,
  JsonObjectSchema,
  type DataSchema,
  type JsonObject,
  type TemplateDefinition,
  type TemplateNode,
  type TemplateIssue,
  type TemplateValue,
  type TemplateRevision,
  type TemplatePersonalization,
  type TemplateRenderInput,
} from './schema'
import {
  getTemplateDataSchema,
  getValue,
  setValue,
  pathParts,
  stableJSONStringify,
  validateFieldExamples,
  validateJSONData,
  resolveTemplateData,
  invalidParentPath,
} from './contracts'
import { allowedAttribute, compileTemplateCSS, safeTemplateURL, styleIssues } from './styles'
import { templateHtmlChildAllowed, templateHtmlContext } from './html-structure'

export function childIds(node: TemplateNode): string[] {
  return 'children' in node ? node.children : node.kind === 'block' ? Object.values(node.slots).flat() : []
}
export function nodeValues(node: TemplateNode): TemplateValue[] {
  if (node.kind === 'text') return node.parts.map((part) => part.value)
  if (node.kind === 'element') return Object.values(node.attributeBindings)
  if (node.kind === 'block') return Object.values(node.props)
  return 'binding' in node ? [node.binding] : []
}
export function getTemplateIssues(template: TemplateDefinition): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  const add = (path: string, message: string, code = 'reference') => issues.push({ path, message, code })
  const fields = new Map(template.fields.map((field) => [field.id, field]))
  try {
    Intl.getCanonicalLocales(template.locale)
  } catch {
    add('locale', 'Use a valid language tag, such as en-GB or ar.', 'locale')
  }
  const assets = new Set<string>()
  if (fields.size !== template.fields.length) add('fields', 'Field IDs must be unique.')
  try {
    getTemplateDataSchema(template)
  } catch (error) {
    add('fields', (error as Error).message)
  }
  for (const field of template.fields) {
    issues.push(...getDataSchemaIssues(field.schema, `fields.${field.id}.schema`))
    try {
      issues.push(...validateFieldExamples(field))
      validateJSONData(field.schema, undefined)
    } catch (error) {
      add(`fields.${field.id}`, (error as Error).message, 'data-schema')
    }
  }
  for (const asset of template.assets) {
    if (assets.has(asset.id)) add(`assets.${asset.id}`, 'Asset IDs must be unique.')
    assets.add(asset.id)
    if (!safeTemplateURL(asset.url)) add(`assets.${asset.id}`, 'Use a supported asset URL.', 'unsafe-url')
    if (asset.kind === 'font' && !/^[a-zA-Z][a-zA-Z0-9 -]{0,99}$/.test(asset.fontFamily ?? asset.name))
      add(`assets.${asset.id}`, 'Provide a plain font family name.', 'font')
  }
  const library = new Map(template.blocks.map((block) => [`${block.id}@${block.version}`, block]))
  if (library.size !== template.blocks.length) add('blocks', 'Block ID/version pairs must be unique.')
  const validatedBlocks = new Set<string>()
  const schemaAt = (schema: DataSchema | undefined, path: string): DataSchema | undefined => {
    if (path === '') return schema
    try {
      for (const part of pathParts(path)) {
        if (schema?.type !== 'object') return
        schema = Object.hasOwn(schema.properties, part) ? schema.properties[part] : undefined
      }
      return schema
    } catch {
      return
    }
  }
  const validateGraph = (
    roots: string[],
    nodes: Record<string, TemplateNode>,
    path: string,
    props: Record<string, DataSchema>,
    stack: string[] = [],
  ): void => {
    const seen = new Set<string>()
    const slotNames = new Set<string>()
    const active = new Set<string>()
    if (Object.keys(nodes).length > 5000) {
      add(path, 'A document may contain at most 5,000 nodes.', 'limit')
      return
    }
    const bindingSchema = (value: TemplateValue, itemSchema?: DataSchema): DataSchema | undefined => {
      if (value.source === 'field') return fields.get(value.fieldId)?.schema
      if (value.source === 'prop') return props[value.name]
      if (value.source === 'item') return schemaAt(itemSchema, value.path)
      if (value.source === 'asset') return { type: 'string' }
      if (value.source === 'literal') {
        if (typeof value.value === 'string') return { type: 'string' }
        if (typeof value.value === 'number')
          return { type: Number.isInteger(value.value) ? 'integer' : 'number' }
        if (typeof value.value === 'boolean') return { type: 'boolean' }
      }
    }
    const visit = (id: string, inRepeat = false, depth = 0, itemSchema?: DataSchema, htmlParent?: string) => {
      const node = Object.hasOwn(nodes, id) ? nodes[id] : undefined
      if (!node) {
        add(`${path}.${id}`, 'Node reference does not exist.')
        return
      }
      if (depth > 64 || active.has(id)) {
        add(`${path}.${id}`, 'Cyclic or excessively deep node tree.')
        return
      }
      if (seen.has(id)) {
        add(`${path}.${id}`, 'A node may have only one parent.')
        return
      }
      seen.add(id)
      active.add(id)
      if (!templateHtmlChildAllowed(htmlParent, node))
        add(`${path}.${id}`, `This content cannot be placed directly inside ${htmlParent}. Use the appropriate list item, table row or cell. Save enclosing lists/tables as reusable blocks.`, 'html-structure')
      if (node.id !== id) add(`${path}.${id}`, 'Node ID must match its map key.')
      if (node.kind === 'slot' && path === 'nodes')
        add(`${path}.${id}`, 'Slots belong inside reusable blocks.')
      if (node.kind === 'slot') {
        if (slotNames.has(node.slot)) add(`${path}.${id}`, `Slot names must be unique: ${node.slot}`)
        slotNames.add(node.slot)
      }
      for (const value of nodeValues(node)) {
        if (value.source === 'field' && path.startsWith('blocks.'))
          add(`${path}.${id}`, 'Reusable block definitions must bind properties rather than template fields.')
        if (value.source === 'field' && !fields.has(value.fieldId))
          add(`${path}.${id}`, `Unknown field: ${value.fieldId}`)
        if (value.source === 'asset' && !assets.has(value.assetId))
          add(`${path}.${id}`, `Unknown asset: ${value.assetId}`)
        if (value.source === 'prop' && !Object.hasOwn(props, value.name))
          add(`${path}.${id}`, `Unknown block property: ${value.name}`)
        if (value.source === 'item') {
          if (!inRepeat) add(`${path}.${id}`, 'Item bindings require a repeater context.')
          else if (itemSchema && !schemaAt(itemSchema, value.path))
            add(
              `${path}.${id}`,
              `Item property is not declared in the array contract: ${value.path}`,
              'binding-type',
            )
          try {
            if (value.path !== '') pathParts(value.path)
          } catch (error) {
            add(`${path}.${id}`, (error as Error).message)
          }
        }
      }
      if (node.kind === 'condition' && node.operator === 'equals' && node.value === undefined)
        add(`${path}.${id}`, 'An equality condition requires a comparison value.')
      const repeatedSchema = node.kind === 'repeat' ? bindingSchema(node.binding, itemSchema) : undefined
      if (
        node.kind === 'repeat' &&
        repeatedSchema?.type !== 'array' &&
        !(node.binding.source === 'item' && inRepeat && itemSchema === undefined) &&
        !(node.binding.source === 'literal' && Array.isArray(node.binding.value))
      )
        add(`${path}.${id}`, 'Repeaters require a declared array field or property.', 'binding-type')
      if (node.kind === 'text')
        for (const part of node.parts) {
          const schema = bindingSchema(part.value, itemSchema)
          if (
            schema &&
            ['currency', 'number'].includes(part.format) &&
            !['number', 'integer'].includes(schema.type)
          )
            add(`${path}.${id}`, 'Number and currency formats require a numeric binding.', 'binding-type')
          if (schema && part.format === 'date' && schema.type !== 'string')
            add(`${path}.${id}`, 'Date formatting requires a string field.', 'binding-type')
        }
      if (node.kind === 'element') {
        if (node.tag === 'img' && !node.attributes.src && !node.attributeBindings.src)
          add(`${path}.${id}`, 'Choose an image asset or a source binding.')
        if (['img', 'br', 'hr'].includes(node.tag) && node.children.length)
          add(`${path}.${id}`, 'Void elements cannot contain children.')
        for (const name of [...Object.keys(node.attributes), ...Object.keys(node.attributeBindings)])
          if (!allowedAttribute(name)) add(`${path}.${id}`, `Unsupported attribute: ${name}`, 'attribute')
        for (const name of ['src', 'href'])
          if (node.attributes[name] && !safeTemplateURL(node.attributes[name]))
            add(`${path}.${id}`, `Unsupported ${name} URL.`, 'unsafe-url')
        issues.push(...styleIssues(node.style, `${path}.${id}.style`))
      }
      if (node.kind === 'block') {
        const key = `${node.blockId}@${node.version}`
        const block = library.get(key)
        if (!block) add(`${path}.${id}`, `Unknown reusable block revision: ${key}`)
        else if (stack.includes(key)) add(`${path}.${id}`, 'Reusable block dependency cycle.')
        else {
          for (const name of block.requiredProps)
            if (!Object.hasOwn(node.props, name) && block.propertyMetadata?.[name]?.defaultValue === undefined)
              add(`${path}.${id}`, `Missing block property: ${name}`)
          for (const name of Object.keys(node.props))
            if (!Object.hasOwn(block.props, name)) add(`${path}.${id}`, `Unknown block property: ${name}`)
          for (const [name, value] of Object.entries(node.props)) {
            const target = Object.hasOwn(block.props, name) ? block.props[name] : undefined
            const source = bindingSchema(value, itemSchema)
            if (
              target &&
              source &&
              source.type !== target.type &&
              !(source.type === 'integer' && target.type === 'number')
            )
              add(
                `${path}.${id}.props.${name}`,
                `Property ${name} requires ${target.type}; this binding supplies ${source.type}.`,
                'binding-type',
              )
            if (value.source === 'literal' && target) {
              try {
                issues.push(
                  ...validateJSONData(target, value.value).map((issue) => ({
                    ...issue,
                    path: `${path}.${id}.props.${name}`,
                  })),
                )
              } catch (error) {
                add(`${path}.${id}.props.${name}`, (error as Error).message, 'data-schema')
              }
            }
          }
          const slots = new Set(
            Object.values(block.nodes)
              .filter((n) => n.kind === 'slot')
              .map((n) => (n.kind === 'slot' ? n.slot : '')),
          )
          for (const name of Object.keys(node.slots))
            if (!slots.has(name)) add(`${path}.${id}`, `Unknown block slot: ${name}`)
          if (!validatedBlocks.has(key)) {
            validateGraph(block.roots, block.nodes, `blocks.${key}`, block.props, [...stack, key])
            validatedBlocks.add(key)
          }
        }
      }
      // Literal arrays have no declared item schema. A nested literal repeater
      // must not inherit the outer array's schema; runtime checks still apply.
      const childSchema = node.kind === 'repeat'
        ? repeatedSchema?.type === 'array' ? repeatedSchema.items : undefined
        : itemSchema
      childIds(node).forEach((child) =>
        visit(child, inRepeat || node.kind === 'repeat', depth + 1, childSchema, templateHtmlContext(node, htmlParent)),
      )
      active.delete(id)
    }
    roots.forEach((id) => visit(id, false, 0, undefined, path === 'nodes' ? 'main' : 'div'))
    for (const id of Object.keys(nodes))
      if (!seen.has(id)) add(`${path}.${id}`, 'Node is not reachable from a root.')
  }
  validateGraph(template.roots, template.nodes, 'nodes', {})
  for (const block of template.blocks) {
    const key = `${block.id}@${block.version}`
    if (new Set(block.requiredProps).size !== block.requiredProps.length)
      add(`blocks.${key}.requiredProps`, 'Required block properties must be unique.', 'data-schema')
    for (const [name, metadata] of Object.entries(block.propertyMetadata ?? {})) {
      if (!Object.hasOwn(block.props, name))
        add(`blocks.${key}.propertyMetadata.${name}`, 'Property metadata requires a declared property.')
      else if (metadata.defaultValue !== undefined) {
        try {
          issues.push(...validateJSONData(block.props[name], metadata.defaultValue).map(issue => ({
            ...issue, path: `blocks.${key}.propertyMetadata.${name}.defaultValue${issue.path}`,
          })))
        } catch (error) { add(`blocks.${key}.propertyMetadata.${name}`, (error as Error).message, 'data-schema') }
      }
    }
    for (const [name, schema] of Object.entries(block.props)) {
      issues.push(...getDataSchemaIssues(schema, `blocks.${key}.props.${name}`))
      try {
        validateJSONData(schema, undefined)
      } catch (error) {
        add(`blocks.${key}.props.${name}`, (error as Error).message, 'data-schema')
      }
    }
    if (!validatedBlocks.has(key)) {
      validateGraph(block.roots, block.nodes, `blocks.${key}`, block.props, [key])
      validatedBlocks.add(key)
    }
    for (const name of block.requiredProps)
      if (!Object.hasOwn(block.props, name)) add(`blocks.${key}`, `Required property is not declared: ${name}`)
    issues.push(...compileTemplateCSS(block.css).issues.map(issue => ({
      ...issue, path: issue.path.replace(/^styles/, `blocks.${key}.css`),
    })))
  }
  issues.push(
    ...compileTemplateCSS(template.styles.theme).issues,
    ...compileTemplateCSS(template.styles.css).issues,
  )
  if (
    template.page.margins.left + template.page.margins.right >= template.page.widthMm ||
    template.page.margins.top + template.page.margins.bottom >= template.page.heightMm
  )
    add('page.margins', 'Page margins leave no printable area.', 'page')
  return issues
}

/** Semantic checks stay separate from the portable wire schema. */
function getDataSchemaIssues(schema: DataSchema, path: string, depth = 0): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  const add = (message: string) => issues.push({ path, message, code: 'data-schema' })
  if (depth > 16) {
    add('Data schemas may be at most 16 levels deep.')
    return issues
  }
  if (schema.type === 'string') {
    if ((schema.minLength ?? 0) > (schema.maxLength ?? Infinity))
      add('Minimum length must not exceed maximum length.')
    if (schema.enum) {
      if (new Set(schema.enum).size !== schema.enum.length) add('Allowed values must be unique.')
      const { enum: values, ...constraints } = schema
      for (const value of values)
        if (validateJSONData(constraints, value).length)
          add(`Allowed value ${JSON.stringify(value)} does not satisfy the string constraints.`)
    }
  } else if (schema.type === 'number' || schema.type === 'integer') {
    const minimum = schema.minimum ?? -Infinity
    const maximum = schema.maximum ?? Infinity
    if (minimum > maximum) add('Minimum value must not exceed maximum value.')
    else if (schema.type === 'integer' && Math.ceil(minimum) > Math.floor(maximum))
      add('This range does not contain an integer.')
  } else if (schema.type === 'array') {
    if ((schema.minItems ?? 0) > (schema.maxItems ?? Infinity))
      add('Minimum items must not exceed maximum items.')
    issues.push(...getDataSchemaIssues(schema.items, `${path}.items`, depth + 1))
  } else if (schema.type === 'object') {
    if (new Set(schema.required).size !== schema.required?.length && schema.required)
      add('Required properties must be unique.')
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(schema.properties, key)) add(`Required property is not declared: ${key}`)
    for (const [key, value] of Object.entries(schema.properties))
      issues.push(...getDataSchemaIssues(value, `${path}.properties.${key}`, depth + 1))
  }
  return issues
}
function structuralError(error: { issues: { path: PropertyKey[]; message: string; code: string }[] }) {
  return new TemplateError(
    'validation',
    'The template contract is invalid.',
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message, code: issue.code })),
  )
}
/** Restore a structurally valid authoring draft while allowing incomplete content to be repaired. */
export function parseTemplateDraft(input: unknown): TemplateDefinition {
  const parsed = TemplateDefinitionSchema.safeParse(input)
  if (!parsed.success) throw structuralError(parsed.error)
  return parsed.data
}
export function parseTemplateDefinition(input: unknown): TemplateDefinition {
  const template = parseTemplateDraft(input)
  const issues = getTemplateIssues(template)
  if (issues.length) throw new TemplateError('validation', issues[0].message, issues)
  return template
}
export function parseTemplateRevision(input: unknown): TemplateRevision {
  const parsed = TemplateRevisionSchema.safeParse(input)
  if (!parsed.success) throw structuralError(parsed.error)
  const template = parseTemplateDefinition(parsed.data.template)
  if (
    parsed.data.templateId !== template.id ||
    stableJSONStringify(parsed.data.dataContract) !== stableJSONStringify(getTemplateDataSchema(template))
  )
    throw new TemplateError('validation', 'Published revision and data contract must match the template.')
  return { ...parsed.data, template }
}
export function parseTemplatePersonalization(
  input: unknown,
  revision: TemplateRevision,
  options: { trustedData?: JsonObject } = {},
): TemplatePersonalization {
  const result = TemplatePersonalizationSchema.safeParse(input)
  if (!result.success) throw structuralError(result.error)
  const value = result.data
  const issues: TemplateIssue[] = []
  if (value.templateId !== revision.templateId || value.revision !== revision.revision)
    throw new TemplateError('validation', 'Personalization belongs to a different template revision.')
  if (options.trustedData !== undefined) {
    const trusted = JsonObjectSchema.safeParse(options.trustedData)
    if (!trusted.success)
      throw new TemplateError(
        'validation',
        'Trusted data must be a JSON object.',
        trusted.error.issues.map((issue) => ({
          path: ['trustedData', ...issue.path].join('.'),
          code: issue.code,
          message: issue.message,
        })),
      )
    const trustedData = resolveTemplateData(revision.template, trusted.data).data
    for (const field of revision.template.fields)
      if (!field.editable) {
        const malformed =
          invalidParentPath(value.data, field.path) ?? invalidParentPath(trustedData, field.path)
        if (malformed) {
          issues.push({ path: malformed, code: 'type', message: `${malformed} must be an object.` })
          continue
        }
        const supplied = getValue(value.data, field.path)
        const trusted = getValue(trustedData, field.path)
        if (supplied !== undefined && stableJSONStringify(supplied) !== stableJSONStringify(trusted))
          issues.push({
            path: field.path,
            code: 'permission',
            message: `${field.label} is supplied by the application.`,
          })
        setValue(value.data, field.path, trusted)
      }
  }
  for (const [id, override] of Object.entries(value.overrides)) {
    const node = Object.hasOwn(revision.template.nodes, id) ? revision.template.nodes[id] : undefined
    if (!node) issues.push({ path: `overrides.${id}`, code: 'reference', message: 'Unknown node.' })
    else {
      if (
        override.text !== undefined &&
        (node.kind !== 'text' ||
          !node.permissions.content ||
          node.parts.some((part) => part.value.source !== 'literal'))
      )
        issues.push({
          path: `overrides.${id}.text`,
          code: 'permission',
          message: 'This text is controlled by the template.',
        })
      if (override.style && (node.kind !== 'element' || !node.permissions.style))
        issues.push({
          path: `overrides.${id}.style`,
          code: 'permission',
          message: 'This style is controlled by the template.',
        })
      if (override.style) issues.push(...styleIssues(override.style, `overrides.${id}.style`))
    }
  }
  if (issues.length)
    throw new TemplateError(
      issues.some((issue) => issue.code === 'type') ? 'validation' : 'permission',
      issues[0].message,
      issues,
    )
  return value
}

export function parseTemplateRenderInput(
  input: unknown,
  options: { trustedData?: JsonObject } = {},
): TemplateRenderInput {
  const result = TemplateRenderInputSchema.safeParse(input)
  if (!result.success) throw structuralError(result.error)
  const template = parseTemplateRevision(result.data.template)
  const personalization = parseTemplatePersonalization(result.data.personalization, template, options)
  const resolved = resolveTemplateData(template.template, personalization.data)
  if (resolved.issues.length)
    throw new TemplateError(
      'validation',
      'Render data does not match the template contract.',
      resolved.issues,
    )
  personalization.data = resolved.data
  return { template, personalization }
}
