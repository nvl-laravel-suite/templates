# Upgrading NVL Templates

## Consumer contracts, committed events and runtime policy (5.x)

Prefer focused public interfaces in constructor injection; native implementations remain container defaults and host prebindings win. Returned models are documented identity/data handles: use package contracts for reads/writes and capability-specific batch readers instead of direct package queries. Enable the shipped Core PHPStan include in your host; do not invoke the suite workbench static audit command in a consumer.

Events now carry immutable schemaVersion=1 and scalar/DTO snapshots. Replace model-bearing event fields with the IDs listed in [events](docs/events.md); load only through an authorized public reader when needed. Only six declared legacy `*Event` names are retained as PHP aliases for major 5, removal no earlier than major 6. Migrate exact imports/listeners/fakes to canonical names, replace suffix wildcard patterns explicitly, drain old queued payloads, rebuild event caches and restart workers. Framework Verified/PasswordReset remain native classes. Source-connection callbacks are process-local after-commit publication, not a durable outbox or exactly-once delivery.

Package failures have a marker and optional response metadata. Opt into Core's JSON renderer deliberately; preserve existing host handlers and request-locale selection. Missing required host adapters produce `binding_required`/500; genuine configured authorization denial retains native handling. See the README error table and required-bindings section where applicable.

Factories ship in runtime package mappings for host tests. Ordinary make may persist parents; withoutParents()->make creates detached fixtures. Supply persisted native owners/parents and active tenants explicitly, retain source revisions, and never treat a factory row as a real storage/provider/workflow effect. Core's optional installer publishes common config without enabling features; strict Doctor and explicit deployment cache/worker steps belong in the host release process. The PHP 8.4/Laravel 13 local Dagger release gate and fresh public Composer installation passed for 5.0.0. Additional compatibility legs need separate evidence; hosts must verify their own adoption.


## Tenant adoption

Map each template/render root explicitly and derive versions and assignments
from their canonical template. Import platform templates through the catalog
copy Action so Content/Media copies, provenance, and rollback remain bounded.

## To 1.0

There is no supported pre-1.0 public API. Install the clean schema, register
source-controlled render definitions and Content block definitions, import
structural rows through package Actions, and publish versions explicitly.

Before an adoption cutover:

1. Disable `nvl-templates.migrations.enabled`.
2. Map existing keys, locales, revisions, assignments, strings, structured
   values, and binary assets.
3. Run `php artisan nvl:templates:doctor --strict --format=json`.
4. Import binaries through Media; model strings, structured values, and Media
   UUIDs as Content fields.
5. Place blocks on the `TemplateVersion` model’s reserved `document` Content
   group and publish immutable snapshots.
6. Compare row counts, snapshot hashes, and representative rendered output.
7. Enable package migrations only after table compatibility is proven.

Never persist executable PHP or arbitrary Blade source from an old system.
Do not recreate legacy version-translation or template-asset tables.
When adopting PDF templates, move executable views into application source,
map print options into source-controlled `renderer_options`, configure a
dedicated writable mPDF temp path, and explicitly allowlist every remote image
host. Do not import untrusted HTML as an executable template.

Direct rendering now uses `Nvl\Templates\Template` with `TemplateOptions` and
`RenderTemplateAction`. Database-backed rendering uses
`RenderStoredTemplateAction`, which resolves the stored publication and
delegates to the direct Action. Custom renderers receive
`TemplateRenderContext`, not the removed `TemplateRenderContextData`.

PDF header and footer overrides are trusted view names plus bounded data. Raw
`header_html` and `footer_html` are reserved for trusted, source-defined direct
or class templates and pass through the package HTML guard. Stored definitions
should use trusted header/footer views.
Synchronous render routes return the actual output body and MIME type. Clients
that previously expected JSON must consume the binary response or use the
queued-render API.

Durable render rows now include `profile`, encrypted `settings`,
`dispatch_generation`, `processing_token`, `lease_expires_at`, and `failed_at`.
Because there is no supported pre-1.0 schema, these fields and their recovery
indexes are consolidated into the clean render-table migration. Configure
`lease_seconds` above the job timeout, `unique_for` at least as long as the
lease, `pending_recovery_seconds` above `unique_for`, and the queue connection’s
`retry_after` above the timeout. Schedule `nvl:templates:renders:recover` to
redispatch stale pending records and expired processing leases.

Source definitions and PDF defaults now reject unknown keys. Payload-related
values must be JSON-only objects, and the built-in validator accepts only the
bounded schema keywords documented in the README. Replace unsupported schema
keywords or bind a custom `TemplatePayloadValidator`.

The opt-in render route group now includes authorized render history/status
endpoints. Its middleware list may not be empty. Non-system users can access
only records matching their requester identity, and all render responses send
private no-store cache directives.

Source-controlled class templates may migrate incrementally to
`Nvl\Templates\Templates\BaseTemplate` or
`Nvl\Templates\Templates\BasePdfTemplate`. The reusable fluent methods remain,
but constructors now receive rendering and asset contracts through the
container. Replace custom string/asset persistence with Content compositions
and Media identifiers. Bind `TemplateAssetResolver` only when frame, sticker,
or scoped asset handles are required. Keep application-specific template
subclasses and authorization in the consuming application.

## Shared owner registry compatibility

Declare owner classes in `nvl-core.owners`, for example `'owners' => [Article::class]`, and reference the same model class from each package capability. Laravel's `getMorphClass()` is the stored owner identity: it returns the host-authored morph alias or the FQCN when no map exists. Core declarations and package allowlists do not add or enforce a host morph map and do not grant authorization.

Legacy alias references remain read compatibility during major 5 and are removed in major 6. A legacy configured alias must agree with the model's current `getMorphClass()`; mismatches are diagnostics and require a host decision. Doctor can inspect declared package owner columns for stored-versus-current identities without rewriting them. If the host introduces or changes its morph map, review and convert only the affected stored columns and reconcile host relationships before cutover. No automatic owner-data conversion or `nvl:owners:upgrade` is provided. Rebuild configuration caches and restart workers after the coordinated change.

## Shared Doctor integration

The loaded package provider now contributes its existing inspection checks to Core's `nvl:doctor --strict --format=json`. The package command remains available. The shared gate fails errors and, in strict mode, warnings; no data upgrade is required for diagnostics.


## Infrastructure option inheritance

Move `rendering.connection` and `rendering.queue` to `queue.connection` and `queue.name`, or set canonical values to null to inherit Core/Laravel. Keep rendering retry, backoff, timeout, and lease settings. Configure `locks.store` for unique dispatch and overlap locks when a dedicated cache store is needed. Route middleware and `authorization.guard` may inherit Core; authorization remains host-owned. Compatibility inputs remain supported for one major cycle. Rebuild caches and restart workers after the cutover.

## Next major: isolated schema identities

This is a breaking schema identity change. Back up storage and migration history, pause writes/workers, install this code with automatic package migrations disabled, and select one owner for migrations (vendor or published).

```sh
php artisan nvl:doctor --strict --format=json
php artisan nvl:schema:upgrade --package=templates --claim-legacy --migration-owner=vendor --dry-run --format=json
php artisan nvl:schema:upgrade --package=templates --claim-legacy --migration-owner=vendor --format=json
```

The command validates released columns and relational keys plus creating migration history, renames owned legacy tables to the effective `tables.*` targets and rewrites exact package migration identities while retaining batches and unrelated host records. It refuses foreign/incomplete shapes and conflicting targets. Explicit old table mappings retain those names; remove them when choosing new defaults. A second run is empty.

Declare each published path and canonical identity explicitly in `nvl-core.migrations.published`; retimestamped history also needs an exact `legacy` mapping. Use `--migration-owner=vendor` after manually archiving declared copies outside loaded paths, or `--migration-owner=published` after manually replacing executable copies with current migration code and disabling vendor loading. The plan verifies ownership and preserves batches; checksums do not automatically claim files. Modified host copies remain host-owned. No migration files or stored morph types are rewritten.

DDL transactions are driver dependent and per connection. Inspect dry-run warnings for MySQL/MariaDB or split storage; after a failure, inspect completed steps before resuming. Schema-qualified rename targets require an explicit host schema move first. Re-enable your selected migration owner, run `nvl:schema:preflight` with the same selected paths and connection, then migrate remaining package changes and rerun Doctor before resuming writes. See the suite upgrade guide for shared owner/locale inputs, Core option defaults and one-major deprecation rules.

## Major 5 cache and lock identities

Render overlap locks use `nvl:templates:render-overlap:` while retaining Laravel release timing and the inherited cache store. Native Laravel dispatch uniqueness remains framework-owned and includes the job class. Generic foreign overlap locks are never acquired or removed.

Drain old mutation workers and maintenance processes, then wait for their outstanding lock leases to end before starting the new major across all nodes. Running old and new lock prefixes concurrently would create independent serialization domains. Restart workers after cutover; preserve host-selected stores and keys, and do not flush a shared cache to remove old NVL entries.

## Tagged consumer PHP boundary

Use source `@api` workflows, extension contracts, and value types for application integration. Direct use of untagged implementations or `@internal` members is unsupported. This classification keeps existing concrete Action signatures and runtime behavior; it does not authorize package model persistence, ad hoc queries, relation traversal, or generic model serialization. Returned models are identity/result handles with only the explicitly declared in-memory read fields described in the README.

The implementation Actions `AdoptTemplatesAction`, `ProcessTemplateRenderAction`, `RecoverStaleTemplateRendersAction` are explicitly internal. Run `nvl:templates:adopt` for reviewed legacy adoption and `nvl:templates:renders:recover` for stale work recovery. Queue through `QueueTemplateRenderAction` and let the package worker process the persisted render; use `RenderStoredTemplateAction` for synchronous rendering.

Migrate `MediaTemplateAssetRegistry::registerAdoptionAliases()` calls to durable `nvl-templates.assets.media.aliases` configuration. The method is an internal adoption helper.

## Application workflow contracts

Renderer, PDF, asset, owner, payload, and authorization extension contracts remain the existing APIs. Optional PDF installation and worker behavior are unchanged.

The supported workflow injection names are `AssignTemplateContract`, `CreateTemplateContract`, `CreateTemplateVersionContract`, `GetTemplateContract`, `GetTemplateRenderContract`, `GrantTemplateToTenantContract`, `ImportPlatformTemplateContract`, `ListTemplateRendersContract`, `ListTemplatesContract`, `PublishTemplateVersionContract`, `QueueTemplateRenderContract`, `RenderStoredTemplateContract`, `RenderTemplateContract`, `RevokeTemplateTenantGrantContract`, `SyncTemplateDefinitionsContract`, `UnassignTemplateContract`, `UpdateTemplateContract`, `UpdateTemplateVersionContract`.

Inject these contracts when application workflows need substitution. Native
concrete constructors and operation signatures remain available through major 5;
internal workflow chains are unchanged. Register host implementations before
package discovery or replace the contract before resolving a new host service.
See [Testing your app](README.md#testing-your-app) for native fixtures and the
shipped consumer-audit PHPStan configuration.
