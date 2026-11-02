import { z } from 'zod'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
export const IdentifierSchema = z
  .string()
  .regex(/^(?!constructor$|prototype$)[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/)
export const FieldPathSchema = z
  .string()
  .max(240)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/)

/** A deliberately portable JSON Schema subset; no executable validation expressions. */
export type DataSchema =
  | {
      type: 'string'
      format?: 'date' | 'date-time' | 'email' | 'uri'
      minLength?: number
      maxLength?: number
      enum?: string[]
    }
  | { type: 'number' | 'integer'; minimum?: number; maximum?: number }
  | { type: 'boolean' }
  | { type: 'array'; items: DataSchema; minItems?: number; maxItems?: number }
  | {
      type: 'object'
      properties: Record<string, DataSchema>
      required?: string[]
      additionalProperties: false
    }

export const DataSchemaSchema: z.ZodType<DataSchema> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        type: z.literal('string'),
        format: z.enum(['date', 'date-time', 'email', 'uri']).optional(),
        minLength: z.number().int().nonnegative().optional(),
        maxLength: z.number().int().nonnegative().optional(),
        enum: z.array(z.string()).min(1).optional(),
      })
      .strict(),
    z
      .object({
        type: z.enum(['number', 'integer']),
        minimum: z.number().finite().optional(),
        maximum: z.number().finite().optional(),
      })
      .strict(),
    z.object({ type: z.literal('boolean') }).strict(),
    z
      .object({
        type: z.literal('array'),
        items: DataSchemaSchema,
        minItems: z.number().int().nonnegative().optional(),
        maxItems: z.number().int().nonnegative().optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal('object'),
        properties: z.record(IdentifierSchema, DataSchemaSchema),
        required: z.array(IdentifierSchema).optional(),
        additionalProperties: z.literal(false),
      })
      .strict(),
  ]),
)

export const TemplateFieldSchema = z
  .object({
    id: IdentifierSchema,
    path: FieldPathSchema,
    label: z.string().min(1).max(120),
    description: z.string().max(1000).default(''),
    schema: DataSchemaSchema,
    required: z.boolean().default(true),
    editable: z.boolean().default(true),
    sample: JsonValueSchema.optional(),
    defaultValue: JsonValueSchema.optional(),
  })
  .strict()
export type TemplateField = z.infer<typeof TemplateFieldSchema>

export const TemplateValueSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('literal'), value: JsonValueSchema }).strict(),
  z.object({ source: z.literal('field'), fieldId: IdentifierSchema }).strict(),
  // An empty path addresses the current item, including primitive array items.
  z.object({ source: z.literal('item'), path: z.union([z.literal(''), FieldPathSchema]) }).strict(),
  z.object({ source: z.literal('prop'), name: IdentifierSchema }).strict(),
  z.object({ source: z.literal('asset'), assetId: IdentifierSchema }).strict(),
])
export type TemplateValue = z.infer<typeof TemplateValueSchema>
export const TextPartSchema = z
  .object({
    value: TemplateValueSchema,
    format: z.enum(['text', 'number', 'currency', 'date']).default('text'),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('EUR'),
  })
  .strict()
const nodeBase = {
  id: IdentifierSchema,
  name: z.string().max(120),
  permissions: z
    .object({ content: z.boolean().default(false), style: z.boolean().default(false) })
    .strict()
    .default({ content: false, style: false }),
}
export const HTML_TAGS = [
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'aside',
  'figure',
  'figcaption',
  'pre',
  'code',
  'b',
  'i',
  'u',
  's',
  'small',
  'p',
  'span',
  'strong',
  'em',
  'a',
  'img',
  'hr',
  'br',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
] as const
export const TemplateNodeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...nodeBase,
      kind: z.literal('element'),
      tag: z.enum(HTML_TAGS),
      classes: z.array(z.string().regex(/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/)).default([]),
      attributes: z.record(z.string(), z.string()).default({}),
      attributeBindings: z.record(z.string(), TemplateValueSchema).default({}),
      style: z.record(z.string(), z.string()).default({}),
      children: z.array(IdentifierSchema).default([]),
    })
    .strict(),
  z.object({ ...nodeBase, kind: z.literal('text'), parts: z.array(TextPartSchema).min(1) }).strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal('repeat'),
      binding: TemplateValueSchema,
      children: z.array(IdentifierSchema),
    })
    .strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal('condition'),
      binding: TemplateValueSchema,
      operator: z.enum(['truthy', 'equals']),
      value: JsonValueSchema.optional(),
      children: z.array(IdentifierSchema),
    })
    .strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal('block'),
      blockId: IdentifierSchema,
      version: z.number().int().positive(),
      props: z.record(IdentifierSchema, TemplateValueSchema).default({}),
      slots: z.record(IdentifierSchema, z.array(IdentifierSchema)).default({}),
    })
    .strict(),
  z
    .object({
      ...nodeBase,
      kind: z.literal('slot'),
      slot: IdentifierSchema,
      children: z.array(IdentifierSchema).default([]),
    })
    .strict(),
])
export type TemplateNode = z.infer<typeof TemplateNodeSchema>
export const TemplateBlockPropertyMetadataSchema = z.object({
  label: z.string().min(1).max(120),
  description: z.string().max(1000).default(''),
  defaultValue: JsonValueSchema.optional(),
  /** Optional authoring hint; a portable block never requires this field to exist. */
  fieldId: IdentifierSchema.optional(),
}).strict()
export type TemplateBlockPropertyMetadata = z.infer<typeof TemplateBlockPropertyMetadataSchema>
export const TemplateBlockSchema = z
  .object({
    id: IdentifierSchema,
    version: z.number().int().positive(),
    name: z.string().min(1),
    props: z.record(IdentifierSchema, DataSchemaSchema).default({}),
    propertyMetadata: z.record(IdentifierSchema, TemplateBlockPropertyMetadataSchema).optional(),
    requiredProps: z.array(IdentifierSchema).default([]),
    roots: z.array(IdentifierSchema).min(1),
    nodes: z.record(IdentifierSchema, TemplateNodeSchema),
    css: z.string().max(100000).default(''),
  })
  .strict()
export type TemplateBlock = z.infer<typeof TemplateBlockSchema>
export const TemplatePageSchema = z
  .object({
    widthMm: z.number().min(50).max(1000).default(210),
    heightMm: z.number().min(50).max(1000).default(297),
    margins: z
      .object({
        top: z.number().min(0).max(100),
        right: z.number().min(0).max(100),
        bottom: z.number().min(0).max(100),
        left: z.number().min(0).max(100),
      })
      .strict()
      .default({ top: 16, right: 16, bottom: 16, left: 16 }),
  })
  .strict()
export const TemplateDefinitionSchema = z
  .object({
    format: z.literal('gct-template'),
    schemaVersion: z.literal(1),
    id: IdentifierSchema,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(''),
    locale: z.string().min(2).max(40).default('en-GB'),
    page: TemplatePageSchema,
    roots: z.array(IdentifierSchema),
    nodes: z.record(IdentifierSchema, TemplateNodeSchema),
    fields: z.array(TemplateFieldSchema).default([]),
    blocks: z.array(TemplateBlockSchema).default([]),
    assets: z
      .array(
        z
          .object({
            id: IdentifierSchema,
            name: z.string().min(1),
            kind: z.enum(['image', 'font']),
            url: z.string().min(1),
            mimeType: z.string().min(1),
            fontFamily: z
              .string()
              .regex(/^[a-zA-Z][a-zA-Z0-9 -]{0,99}$/)
              .optional(),
          })
          .strict(),
      )
      .default([]),
    styles: z
      .object({ theme: z.string().max(100000).default(''), css: z.string().max(100000).default('') })
      .strict()
      .default({ theme: '', css: '' }),
  })
  .strict()
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>
export type TemplateDefinitionInput = z.input<typeof TemplateDefinitionSchema>
/** Dependency-complete, portable reusable block artifact. Existing template formats remain v1. */
export const TemplateBlockLibrarySchema = z.object({
  format: z.literal('gct-template-block-library'),
  schemaVersion: z.literal(1),
  entry: z.object({ blockId: IdentifierSchema, version: z.number().int().positive() }).strict(),
  blocks: z.array(TemplateBlockSchema).min(1),
  assets: TemplateDefinitionSchema.shape.assets,
  theme: z.string().max(100000).default(''),
}).strict()
export type TemplateBlockLibrary = z.infer<typeof TemplateBlockLibrarySchema>
export const TemplateRevisionSchema = z
  .object({
    format: z.literal('gct-template-revision'),
    schemaVersion: z.literal(1),
    templateId: IdentifierSchema,
    revision: z.number().int().positive(),
    publishedAt: z.string().datetime(),
    template: TemplateDefinitionSchema,
    dataContract: JsonObjectSchema,
  })
  .strict()
export type TemplateRevision = z.infer<typeof TemplateRevisionSchema>
export const TemplatePersonalizationSchema = z
  .object({
    format: z.literal('gct-personalization'),
    schemaVersion: z.literal(1),
    templateId: IdentifierSchema,
    revision: z.number().int().positive(),
    data: JsonObjectSchema,
    overrides: z
      .record(
        IdentifierSchema,
        z
          .object({ text: z.string().optional(), style: z.record(z.string(), z.string()).optional() })
          .strict(),
      )
      .default({}),
  })
  .strict()
export type TemplatePersonalization = z.infer<typeof TemplatePersonalizationSchema>
/** Portable document and personalization input for pure local rendering. */
export const TemplateRenderInputSchema = z
  .object({
    template: TemplateRevisionSchema,
    personalization: TemplatePersonalizationSchema,
  })
  .strict()
export type TemplateRenderInput = z.infer<typeof TemplateRenderInputSchema>

export interface TemplateIssue {
  path: string
  message: string
  code: string
}
export class TemplateError extends Error {
  constructor(
    readonly operation: 'validation' | 'permission' | 'render' | 'callback',
    message: string,
    readonly issues: TemplateIssue[] = [],
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'TemplateError'
  }
}

export const TEMPLATE_SCHEMA_VERSION = 1 as const
/** JSON Schemas are generated from these same runtime schemas, never maintained by hand. */
export function getTemplateJSONSchemas() {
  const options = { target: 'draft-2020-12', io: 'output', reused: 'ref' } as const
  return {
    'template-definition.v1': z.toJSONSchema(TemplateDefinitionSchema, options),
    'template-revision.v1': z.toJSONSchema(TemplateRevisionSchema, options),
    'template-personalization.v1': z.toJSONSchema(TemplatePersonalizationSchema, options),
    'template-field.v1': z.toJSONSchema(TemplateFieldSchema, options),
    'template-render-input.v1': z.toJSONSchema(TemplateRenderInputSchema, options),
    'template-block-library.v1': z.toJSONSchema(TemplateBlockLibrarySchema, options),
  }
}
