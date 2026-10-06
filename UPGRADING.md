# Upgrading NVL Templates

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
