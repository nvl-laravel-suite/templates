# Data contracts and rendering

Use `/template-schema` for portable template schemas, types, semantic parsers and data validation. Use `/template-renderer` for HTML/CSS compilation, class discovery, optional snapshot construction and explicit voucher conversion. Both entries run without React or a DOM and perform no transport or storage operations.

## Two document families

| Family | Format / version | Purpose |
|---|---|---|
| Voucher Project | Project or `gct-voucher`, `version: 2` envelope | Fixed A4, exactly three sections, original block types. V1 denormalized envelopes are accepted by the voucher importer with possible migration warnings. |
| Template definition | `gct-template`, `schemaVersion: 1` | Mutable authoring document with node graph, fields, assets, styles, and pinned reusable blocks. |
| Optional template snapshot | `gct-template-revision`, `schemaVersion: 1` | Complete definition, identity, positive version, historical `publishedAt` metadata and regenerated data contract. |
| Personalization | `gct-personalization`, `schemaVersion: 1` | Exact template ID/revision, runtime data, and permitted node overrides. |
| Render input | `{ template, personalization }` | Portable paired snapshot/personalization input for local compilation. The wire type is `TemplateRenderInput`. |
| Reusable block library | `gct-template-block-library`, `schemaVersion: 1` | Entry block ID/version plus embedded pinned dependencies, referenced images, fonts and authored theme. |

Revision identifies a template snapshot; `schemaVersion` identifies its JSON format. The Editor also accepts a plain definition directly, using a deterministic snapshot identity internally for personalization. There is no application publication lifecycle or revision counter. `createTemplateRevision(input, revision = 1, publishedAt = '1970-01-01T00:00:00.000Z')` constructs the optional envelope synchronously and uses caller-supplied metadata. Personalization identity must match its template; no automatic cross-version migration runs.

See the [six complete examples](README.md#verified-examples) and the generated [definition schema](../schemas/template-definition.v1.schema.json), [revision schema](../schemas/template-revision.v1.schema.json), [personalization schema](../schemas/template-personalization.v1.schema.json), [field schema](../schemas/template-field.v1.schema.json), [request schema](../schemas/template-render-input.v1.schema.json), and [block library schema](../schemas/template-block-library.v1.schema.json).

## Structural and semantic validation

The runtime Zod schemas normalize defaults and reject unknown keys in template wire objects. Generated JSON Schemas target Draft 2020-12 and describe **normalized output**: fields with runtime defaults are present in canonical stored/exported documents. An abbreviated object accepted by a Zod parser is not necessarily a canonical wire artifact accepted by the generated schema. Canonicalize before storing or sending it.

| API | Role |
|---|---|
| `TemplateDefinitionSchema`, `TemplateRevisionSchema`, `TemplatePersonalizationSchema`, `TemplateRenderInputSchema` | Structural validators. They do not alone enforce graph integrity or editing policy. |
| `DataSchemaSchema`, `TemplateFieldSchema`, `TemplateValueSchema`, `TemplateNodeSchema`, `TemplateBlockSchema`, `TemplatePageSchema`, `TextPartSchema` | Validators for nested parts of the model. |
| `JsonValueSchema`, `JsonObjectSchema`, `IdentifierSchema`, `FieldPathSchema` | Primitive JSON and naming contracts. |
| `parseTemplateDefinition(input)` | Structural parse plus fields, examples, graph ownership, bindings, block cycles/slots, locale, CSS, assets, and page checks. Throws `TemplateError`. |
| `parseTemplateDraft(input)` | Strict structural parsing/default normalization for repairable authoring drafts. Semantic issues remain available through `getTemplateIssues`; runtime rendering still requires valid composition/data. |
| `parseTemplateBlockLibrary(input)` | Structural and semantic validation of the entry revision, block dependencies, assets, property defaults and theme. |
| `getTemplateIssues(definition)` | Semantic issue list for an already structurally parsed definition; useful while authoring incomplete drafts. |
| `parseTemplateRevision(input)` | Validate snapshot, identity, and data-contract equality. JSON object key order does not matter. |
| `parseTemplatePersonalization(input, revision, options?)` | Validate revision identity and permitted overrides; inject/compare trusted application-owned values when supplied. Allows incomplete draft data. |
| `parseTemplateRenderInput(input, options?)` | Validate the full request, resolve defaults, enforce runtime data; return canonical complete data or throw. |
| `getTemplateDataSchema(definition)` | Build this template's closed, nested runtime-data schema. Reject conflicting/overlapping field paths. |
| `resolveTemplateData(definition, input?, mode?)` | Clone and resolve runtime defaults or authoring samples; return `{ data, issues }`. Runtime is the default mode. |
| `validateJSONData(schema, input)` | Strict Ajv validation; issue list, no coercion/default insertion/property stripping. Invalid schema compilation can throw. |
| `getTemplateJSONSchemas()` | All six generated wire schemas, keyed by versioned name. `TEMPLATE_SCHEMA_VERSION` is 1. |

The wire schemas are self-contained and portable to other languages; no external registry or vendor SDK is required. A separate contract implementation must preserve semantic checks as well as JSON shape. JSON Schema alone does not enforce graph references, override permissions or the contents of referenced media. The component library does not implement application authorization.

## Fields and data paths

Each field has `id`, `path`, `label`, `description`, `schema`, `required`, `editable`, optional `sample`, and optional `defaultValue`. IDs are used by bindings and hook setters. Paths address nested JSON objects, for example `customer.name`.

Paths contain alphabetic-leading segments followed by letters/digits/underscores, at most 16 segments and 240 characters; prototype-related segments are rejected. Paths may not duplicate or overlap another field (`customer` and `customer.name` conflict). Unknown runtime keys are rejected by closed object contracts, including intermediate parent objects.

| Data type | Supported constraints |
|---|---|
| string | `format`: date/date-time/email/uri; minLength/maxLength; non-empty enum of unique strings. |
| number / integer | minimum/maximum; impossible or integer-empty ranges are rejected. |
| boolean | true or false; absence is distinct from false. |
| array | `items` contract; minItems/maxItems. |
| object | `properties`, optional unique `required` names, `additionalProperties: false`. Required names must be declared. |

This is a deliberately limited JSON Schema vocabulary. `$ref`, pattern, oneOf, custom code, nullable unions, arbitrary schema keywords, and coercion are not field features. The complete wire artifacts themselves can use generated `$defs`/references. Schema nesting beyond 16 levels is rejected semantically.

Samples/defaults must satisfy the field schema. Contradictory string enums/formats/lengths and inverted numeric/array limits are rejected by semantic validation. A top-level field can be optional even when its object schema has required nested members: nested members become required only if that field value is supplied.

## Defaults and trusted data

- `sample` fills an absent authoring preview value. It never satisfies production data requirements.
- `defaultValue` fills an absent runtime value. An explicit null or a supplied malformed parent object is invalid, and defaults do not replace it.
- `editable: false` marks an application-owned field. Frontend setters reject writes. The host supplies those values through `initialData` or parser `trustedData`.
- `trustedData` must be a JSON object and also receives runtime defaults. A supplied read-only value must equal the authoritative value; omission is filled from the authoritative data. Malformed supplied or trusted parent objects are rejected rather than repaired.
- Fresh editors use `initialData` plus defaults. Restored editors use saved editable data plus defaults; read-only values come from `initialData` plus defaults. Editable `initialData` does not merge into a restored document.
- No validation API mutates the caller's source values. Internal path-setting commands may deliberately replace a malformed parent when the user explicitly supplies a field value to repair the draft.

`parseTemplatePersonalization` without `trustedData` checks override policy and snapshot identity; it cannot establish the authority of application-owned data. Where those values come from and how they are verified belongs to the host.

## Node graph and bindings

A definition has root IDs and an ID → node map. IDs must match map keys; all nodes must be reachable, have one parent, and form an acyclic tree. Every referenced node/field/asset/block revision must exist.

| Node kind | Contents |
|---|---|
| element | Allowed HTML tag, classes, attributes, attribute bindings, plain CSS style, child IDs. Image/line-break/rule elements are void and cannot have children. |
| text | One or more parts; each has a value binding, format, and optional currency. |
| repeat | Array binding and child IDs rendered for each item. |
| condition | Binding, operator truthy/equals, optional comparison value, children. Equals requires a value. |
| block | Block ID, pinned version, property bindings, named slot contents. |
| slot | Named block-definition placeholder with fallback children. Slot names are unique within a block. |

Value sources are literal JSON, field ID, repeater item path, block property name, and asset ID. An empty item path addresses the complete current item, including primitives. Nonempty paths address properties and are checked against declared array item schemas when available. Literal arrays have no separate item schema; property reads and nested item-bound arrays use runtime checks. All item bindings require a repeater context and safe paths. A nested repeater changes the current item context; there is no parent-item path syntax.

Text formats are text, number, currency, and date. Numeric formats require numeric bindings. Currency is a three-letter uppercase code. Date values are ISO strings, formatted with the template's valid language tag in UTC; text formats escape HTML. Object/array text values become escaped JSON. Conditions use JavaScript truthiness or JSON-value equality with object key order ignored.

Reusable definitions bind properties rather than template fields. Field-to-property conversion happens when saving a selection as a reusable block. Number properties accept integer bindings; other incompatible base types are rejected, and full property constraints are checked at runtime. Slots render supplied content or their fallback; pinned library revisions are unchanged by detaching instances.

Optional block `propertyMetadata` supplies each declared property's label, description, JSON runtime default and optional source-field ID hint. Defaults are validated against the property schema and apply only when a binding resolves to absence. They may satisfy a required block property; they never coerce null or malformed supplied values. Hints do not require that field to exist in another template. Legacy blocks without metadata remain supported. See the [extension compatibility rules](TEMPLATE_API.md#reusable-block-workflow).

An omitted optional repeater binding renders zero items in both preview and runtime. Explicit null or a non-array value remains invalid, and a missing required data field still fails the data contract. Optional array/object form values can be cleared to absence; an explicitly empty array/object must satisfy its own constraints.

`exportTemplateBlock` includes the selected pinned revision and its transitive block/asset dependencies. Import rejects conflicting immutable identities or themes and never replaces existing library revisions. Detachment rejects missing properties or optional dynamic bindings whose block fallback cannot be preserved in the standalone value model; provide a literal or required/defaulted field first. A rejection leaves the document/history unchanged.

Structural table/list child and row/cell/item parent rules are checked, including beneath transparent repeats/conditions. This prevents browser repair from relocating ordinary content outside those containers. This is not a general validator for every HTML content-model rule (for example all inline nesting or the eventual context of caller-supplied block slots). Reusable instances use a wrapper div; direct placement in a table/list structure is rejected. Save the enclosing table/list as the reusable definition.

## CSS, assets, and HTML

Classes use a restricted CSS identifier syntax. `compileTemplateCSS(css, scope?)` returns `{ css, issues, classes }`; `discoverTemplateClasses(definition)` reports class usage and sources. Theme, reusable-block, and template CSS are scoped to the document/block wrapper. Source order is theme → block → template, with normal specificity and inline style precedence.

Allowed at-rules are media, supports, layer, and page. Imports, arbitrary font-face declarations, CSS escapes, URL/expression declarations, and HTML opening delimiters are excluded. Plain style records permit ordinary/custom CSS properties but no executable expressions or arbitrary URL values. Managed font assets generate font-face rules.

Assets declare ID, name, image/font kind, URL, MIME type, and optional font family. The compiler can synchronously map an asset through `resolveAsset(asset)`. It validates supported URL syntax and does not fetch files, verify MIME contents, upload assets, sign URLs asynchronously, or enforce your storage/network allowlist. Links may use HTTP(S), relative paths, mailto, or tel; raster data images are supported. Protocol-relative URLs and executable protocols are rejected. Use usable image/font URLs for media, and enforce content/host policies in the application.

Supported attributes are id/title/alt/src/href/width/height/colspan/rowspan/target/rel/role/lang/dir and aria-/data- names. Event handlers, script tags, iframe nodes and arbitrary executable markup are outside the template model. New-window links receive noopener/noreferrer. Browser previews use a sandboxed iframe.

## Rendering and limits

`renderTemplate(definitionOrRevision, options?)` returns `{ html, css, data, issues }` and reports validation/render errors in issues. Runtime is the default and refuses invalid data. The returned HTML is a complete standalone document with escaped content, page styles, and the compiled CSS included in its head; `css` is also returned separately. Check both issues and non-empty HTML before producing output.

Options: `data`, `personalization`, `mode`, `useSamples`, `annotate`, `selectedNodeId` and synchronous `resolveAsset`. Explicit `data` wins over personalization data. Personalization is checked against the matching snapshot identity. Preview can show missing values; its sample default is on for authoring and off when personalization is supplied. An explicit `useSamples` overrides this preview default. Runtime never uses samples. Annotation adds selection IDs only to template-owned nodes, so clicking inside a reusable block selects its instance.

| Limit | Value |
|---|---|
| Page width / height | 50–1,000 mm each. |
| Each page margin | 0–100 mm; opposing margins must leave printable area. |
| Nodes per template/block graph | 5,000. |
| Node tree depth | 64; deeper graphs rejected. |
| Data schema / dotted path depth | 16. |
| Rendered nodes | 20,000. |
| Items in one rendered repeater | 1,000. |
| Each theme/template/block CSS string | 100,000 characters. |
| Cached compiled data validators | 100 schemas per process. |

These are local compiler/model guards. Application quotas and delivery limits are outside the package. Template forms render deeply nested data as JSON after their interactive control depth; the contract still governs validity.

Page width/height/margins use millimeters. Browser canvas measures and scales the document to its container; flowing content may exceed one page. Exported HTML includes print CSS. Any later printing, pagination or PDF conversion belongs to the host's chosen environment.

## Error shape and migration

`TemplateIssue` is `{ path, code, message }`. Structural/semantic paths identify definition properties (often `nodes.<id>` or `fields.<id>`); runtime data paths are JSON Pointers such as `/customer/name`. Trusted-parent issues can identify the dotted parent path. Do not parse English messages to identify a field; use path/code. Codes include schema validation keywords, reference/binding/permission/CSS checks, and render failures.

`TemplateError` carries an operation, issues and optional cause. Operations describe local validation, permissions, rendering or observer callbacks. Low-level Zod `.parse()` calls throw ZodError. Factory initial parsing can throw before a mounted error surface exists. Catch those errors at the host's input boundary and use `onError` for local operation/observer reporting.

`adaptVoucherProject(input)` explicitly converts supported voucher exports to a definition and returns `{ template, warnings, fieldPaths }`. It preserves supported HTML/CSS and maps dynamic keys to field paths; review warnings, unsupported SVG/QR/icon equivalents, style/layout differences, and edit permissions. This is not a lossless converter, an automatic editor migration, a generic HTML importer, or a Blade parser. Keep the original voucher if migration fidelity is not acceptable.
