# Migrating to the document engine

This is a breaking replacement of the previous NVL Blade/Content template architecture. The new package owns portable documents, families, scoped resources, immutable revisions, native Media assets and durable render requests. Read the [integration guide](README.md) before changing an existing application.

## Existing installations

1. Pin the existing release and back up its database, uploaded files and queued work. Inventory executable published migrations, configuration, code definitions, assignments, Content snapshots, Media associations, render receipts and listeners.
2. Drain or deliberately retire old jobs using the old runtime. Do not deserialize them into the new job implementation. Preserve historical receipts and private files until their retention and business requirements have been resolved.
3. Stage the new engine in unused, explicitly configured tables/database alongside the old release or export. Templates and Media must use the same actual connection. Select one vendor/published migration owner; review Core declarations before enabling migrations.
4. Rebuild documents through the new authoring contract and services. Map business template identifiers, family pins, resource revisions and retained asset identities explicitly. Import assets through native Media; old disk/path values are not immutable Media evidence. Verify both source and rendered output for representative personalized email/documents.
5. Activate fresh Ownership graphs with the native coordinator before importing records. Populated ownership adoption needs a separately reviewed host migration; the fresh-only adapter deliberately refuses it. Switch host repositories, policies, context providers, queues, scheduler and delivery mappings together.
6. Validate the host, then retire old code/tables through a separate reviewed rollout. Keep backups and the pinned old runtime for rollback.

The original eight legacy migration files (six in `database/migrations`, two in `database/tenancy-migrations`) are retained byte-for-byte as legacy history. The provider loads only the three new `database/document-migrations` files. The active Core schema identities describe the new graph; old published migration declarations require explicit review. Existing target tables stop document installation before writes. Never mark the new migrations as applied merely because old migration names or table names exist. Never replay or roll back old executable migrations using the new runtime as an adoption shortcut.

There is no automatic Blade/Content snapshot conversion. A renderer change, SQL rename or checksum rewrite does not prove equivalent source authority, media ownership or personalized output.

## Application code

Replace code definitions, the fluent `Template`, `TemplateDefinitions`, assignments, version/renderer registries and old importer with the focused native services documented in [README.md](README.md). There is no compatibility facade, package HTTP layer or package-owned application UI.

Use `TemplateLifecycle::create/saveDraft/publish`, `TemplateFamilies`, `FamilyLifecycle`, `ResourceManager`, `TemplateCatalog`, `TemplateReader`, `TemplateAssets`, `TemplateRenderer` and `RenderRequests`. Native services take explicit actors; results use native models/enums/documented arrays. PDF output remains a validated binary domain value. The native-array `RenderedTemplateMail` is optional delivery adaptation.

Bind Template and Media authorization before boot. Pass a persisted canonical actor; mutable in-memory attributes and ambient Auth guards do not grant privileges. `ContextProvider::resolve($revision,$owner,$actor)` receives an explicit actor for business reauthorization; accepted facts remain snapshotted. Scope and owner references are server authority, not user-submitted facts.

Persist raw family pins/overrides, expected draft versions and source checksums. Review/apply is separate from publication. Configure the shared compiler for structural features and a PDF driver when needed. Browser-generated family artifacts no longer supply publication HTML: the trusted compiler derives structural variants from the exact family definition and allowed overrides, including style-only variations. Raw drafts can still save without it; plain binding variants retain their inherited artifacts and use the native PHP renderer. Publish the matching React source and retain host extensions outside generated files. `frontend.path` is the exact final component directory; the default is `resource_path('js/components/template-maker')`. For any `frontend.path` retained from an earlier document-engine build, including its published default, append the old implicit `template-maker` suffix once to preserve the existing location. The new default already includes that suffix. Clear cached configuration before republishing, then rebuild it for deployment.

Remove old `integrations.content`, Blade/mPDF renderer/view settings, owner assignments and `rendering.output.persist/disk` switches. Media is required; `nvl-templates.media.disk` selects retained private storage. Use `rendering.queue.*`, attempts/backoff/lease/dispatch/retention controls for durable requests. Media owns orphan recovery; Templates prunes its expired retained requests.

The previous Blade lifecycle's named `TemplateChanged`/`TemplateRendered` events are not a contract of the new engine. Move listeners to explicit host workflows or the documented Laravel/Core commit boundaries; review captured owner/actor authorization and avoid dispatching delivery before an outer transaction commits.

## Fresh installations

Configure native storage/models/policies, migrate once, publish React source, and follow the [portable integration recipe](resources/boost/skills/nvl-templates/references/usage.md). Qualify your database driver, Media disk, worker process, queue/scheduler, PDF service and target email clients in the consuming application. Local SQLite/native Media tests are not certification of those external services.
