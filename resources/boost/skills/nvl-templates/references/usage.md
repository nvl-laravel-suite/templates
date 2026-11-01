# Template capability guide

Read [installation](installation.md) for providers/publication and [API](api.md) for complete constructor/options/mutation signatures. Service namespace is `Nvl\Templates\Services`. Distinguish the source-controlled `Nvl\Templates\Template` from the stored aggregate `Nvl\Templates\Models\Template`.

## Choose a template path

| Need | Capability |
| --- | --- |
| Render a host Blade view without persistence | Construct `Nvl\Templates\Template`; call `TemplateRenderer::render(template, context, options, actor)` |
| Register source definitions | `TemplateDefinitionRegistry::register(definition)`; deterministic `get` / `all` |
| Synchronize stored roots from code | `TemplateDefinitions::sync(actor, dryRun:false)` |
| Manage stored roots/drafts/publications | `TemplateLifecycle::create`, `update`, `delete`, `createVersion`, `updateVersion`, `publishVersion` |
| Choose template by host entity/profile | `TemplateAssignments::assign` / `unassign`, with registered owner resolver |
| Read approved state | `TemplateReader::get`, `paginate`, `getRender`, `renders` |
| Queue/render/recover durable requests | `TemplateRenderer::queue`, `process`, `recover` |
| Customize renderers/assets | Renderer contract/registry; `TemplateAssetResolver`; `MediaTemplateAssetRegistry` and native Media adapter |
| Adopt populated legacy data | `TemplateImporter::adopt(manifest, prepare:false, apply:false)` and guarded native commands |

## Authorization, ownership and locale

Bind `TemplateAuthorization::authorize(TemplateAbility, Authenticatable|SystemActor, array $context=[]): void` to host permission. The default denies. Human actors must be persisted Eloquent identities and are reloaded before policy; dirty identity/storage or stale attributes cannot grant privileges. Explicit background execution still requires permission. Policy contexts include the exact template/version, owner/profile, queue/recovery intent relevant to the operation.

Definition synchronization uses `TemplateAbility::Update` with `['operation'=>'synchronize_definitions','definitions'=>$validatedSnapshot]`, and persists exactly that admitted snapshot. Restrict source-sync grants to the registered code definitions and intended ownership scope rather than granting generic background updates.

Register assignment aliases with `TemplateOwnerRegistry::register(alias, resolverClass, owner:null)` or configured `owners`. Implement `TemplateOwnerResolver::alias(): string` and `resolve(string $identifier): ?Model`; return canonical persisted entities. Optional Core owner reference links constrain the exact host model. Assignment identity/profile is not caller-supplied native ownership. With Ownership enabled, register/adopt resources and enter current admitted scope. Use explicitly selected content locale; localized metadata is an allowed locale-to-title/description map.

## Verified source-controlled render

With a host view `resources/views/reports/greeting.blade.php` containing `<p>Hello {{ $name }}</p>` and a host-authorized persisted `$actor`:

```php
use Nvl\Templates\Template;
use Nvl\Templates\Services\TemplateRenderer;

$template = new Template(
    key: 'report.greeting',
    view: 'reports.greeting',
    data: ['name' => 'Ada'],
);
$output = app(TemplateRenderer::class)->render(
    $template,
    [],
    ['renderer' => 'blade', 'locale' => 'en'],
    $actor,
);
// $output['content'] is verified output bytes; the host chooses its response.
```

This requires neither a stored template row nor Content/Media/mPDF. The renderer returns `content`, `mime_type`, `renderer`, `byte_size`, `checksum`, nullable `subject`, nullable `suggested_filename`. PDF content is binary; do not JSON-encode it as ordinary text.

## Stored lifecycle and exact native fields

Register a definition with `key`, `renderer`, `view`, optional `profiles`, `schema`, `rendererOptions`, `subjectPath`, `requiredRegions`, `allowedContentDefinitions`. These registry fields are camelCase; source config uses its documented snake_case mapping. The renderer must be registered, view source-controlled, profiles unique, and schema supported. `TemplateDefinitions::sync` returns a Laravel collection of planned/applied definition facts.

Native lifecycle inputs:

- `create`: required `key`; optional `status`, `metadata`, `translations`. Renderer/schema come from the registered definition, not caller fields.
- `update`: required `status` and `expected_revision`; optional `metadata`, `translations`. Omission preserves; explicit `metadata:[]` clears; `translations:[]` clears only with default replacement mode. `TranslationSyncMode::Patch` retains unmentioned locales.
- `createVersion`: optional `metadata`; starts a new draft under the template lock.
- `updateVersion`: required `expected_revision`; optional `metadata`, preserving omission and allowing explicit `[]`.
- `publishVersion(version, expectedRevision, actor)`: requires enabled Content, a draft, active synchronized template and permitted Content regions/definitions. Publications/retirements become immutable.

All mutations reject unknown/protected keys. Metadata is bounded JSON object data; null is not an array-clearing shortcut. Each translation accepts only required `title` and optional nullable `description`; locale support is validated. Null description clears it. Stale revisions throw `StaleTemplateException`.

A complete draft metadata composition, requiring a registered `welcome` definition and host policies:

```php
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Services\TemplateLifecycle;

$lifecycle = app(TemplateLifecycle::class);
$template = $lifecycle->create([
    'key' => 'welcome',
    'metadata' => ['campaign' => 'welcome'],
    'translations' => ['en' => ['title' => 'Welcome', 'description' => null]],
], $actor);
$version = $lifecycle->createVersion($template, ['metadata' => ['draft' => true]], $actor);
$template = $lifecycle->update($template, [
    'status' => TemplateStatus::Inactive,
    'expected_revision' => $template->revision,
], $actor);
// Existing metadata and translations remain present.
```

Compose draft blocks through the enabled native Content services before `publishVersion`; do not insert snapshots or content tables yourself.

## Assignment, immediate stored render and queue

`assign(template, data, actor)` accepts `ownerType`, `ownerId`, optional `profile` (default `default`), nullable `versionId`, `settings`, `expected_revision` (zero for initial assignment). Profiles must be declared, owner aliases registered, template synchronized and selected versions admissible. Updating an assignment requires its current revision. `unassign(assignment, expectedRevision, actor)` removes exactly that admitted association.

Stored rendering/queue data accepts required `locale`, `payload`, optional paired `ownerType`/`ownerId`, `profile`, nullable `versionId`, nullable `idempotency_key`, `download`. `TemplateRenderer::render($stored, $payload, $options, $actor)` places context into `payload`; queue takes the full native array. Before queuing, install and configure `nvl/media`, set `nvl-templates.rendering.output.persist = true`, and select a configured private output disk. Missing persistence rejects requests before a render reservation or dispatch; disabling it while a job is in flight makes that job fail rather than discard output:

```php
use Nvl\Templates\Services\TemplateRenderer;

$render = app(TemplateRenderer::class)->queue($publishedTemplate, [
    'locale' => 'en',
    'payload' => ['name' => 'Ada'],
    'idempotency_key' => 'welcome-message-1042',
], $actor);
```

A published/synchronized stored version is required. Idempotency includes canonical request payload, template, locale and requester; changed facts under the same key reject. Queue dispatch follows the actual source outer commit; rollback discards it. Durable rows, processing tokens, dispatch generations and expiring leases support recovery. `process` belongs in the trusted worker boundary; it does not authorize an arbitrary HTTP caller by itself. Preserve captured owner context and recovery policies.

`TemplateReader::paginate` criteria are `status`, `renderer`, `sort`, `page`; render history uses `status`, `template`, `sort`, `page`. Page size is a bounded separate argument. Render access rechecks requester/owner facts; expose only intended transport-safe fields and approved output delivery. Raw render payload/settings/errors are not a public response contract.

## Optional engines, extensions and maintenance

`integrations.content=true` enables stored Content composition and explicit groups. `assets.driver='media'` enables revision-aware Media aliases (`key`, `mediaId`, optional `scope`, `type`, `variation`, `delivery`, `expected_revision`). `rendering.output.persist=true` requires native Media for private output lifecycle. Default assets driver is `null` and output persistence is false. Installation alone enables none of these paths.

PDF uses mPDF when installed and selected; unavailable requested PDF fails clearly. Use the API's exact `pdf`/renderer option shapes and enums. Preserve safe local roots/temp roots, HTML/output budgets, aggregate asset count/bytes, data-image limits and remote policy. Remote requests are disabled by default and require exact allowed hosts; nested reads retain the same policy. Never bypass the asset guard by forwarding arbitrary URLs or paths.

Choose a concrete stored Template subclass through `models.template` before boot. Preserve required native UUIDs, casts, ownership and canonical persistence/query capabilities. Configure source connection/tables as the graph requires; model replacement does not perform legacy adoption. Consumer view models and download wrappers remain application-owned.

Commands are `nvl:templates:sync --dry-run`, `nvl:templates:renders:recover`, `nvl:templates:views:publish`, `nvl:templates:doctor`, `nvl:templates:adopt`. Exact flags and migration/publication choices are in installation/API. Adoption plans precede prepare/apply and preserve populated versions, ownership and historical render facts. Host exception mapping handles validation, denial, stale revisions, dependency/resolution failure and idempotency conflict; never disclose renderer diagnostics publicly.
