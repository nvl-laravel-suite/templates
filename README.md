# NVL Templates

A portable document engine and React template builder for Laravel. Create standalone templates or families with pinned variants; compose layouts, blocks, partials and reusable content; publish immutable revisions; then render personalized email or document HTML. The application chooses its mail transport and PDF service.

Requires PHP 8.4+, Laravel 13 and NVL 7.x. **NVL Media is required** for retained assets and durable output. The package owns validation, authorization, revision integrity, ownership, transactions, output bounds and render recovery. Applications own controllers, routes, request/response objects, business data, sender policy and delivery.

This replaces the former Blade/Content template lifecycle. Existing installations must follow [UPGRADING.md](UPGRADING.md) before enabling migrations. Applied legacy migration files remain unchanged; they are not the new document schema.

## Install and configure

```sh
composer require nvl/templates:^7.0
php artisan vendor:publish --tag=nvl-templates-config
```

Discovery registers `TemplatesServiceProvider`. Configure connections, tables and any `models.template` extension **before boot and migration**. Templates and Media must share the same actual database connection for atomic asset/output composition. Configure `nvl-templates.media.disk`, or use Media's private disk; use Media's native delivery and maintenance configuration.

Vendor migrations load from `database/document-migrations`. To own published migrations instead, publish `nvl-templates-migrations`, disable `nvl-templates.migrations.enabled`, and maintain the exact Core migration declarations. Use one migration owner. The first document migration refuses existing target tables before creating any document tables.

Bind `Nvl\Templates\Contracts\TemplateAuthorization` and Media's authorization contract in your application provider's `register()` method. Defaults deny. Every domain service takes an explicit persisted Eloquent actor or explicitly permitted `SystemActor`; actor attributes are reloaded from canonical storage. Neither a background identity nor an asset ID grants access.

For NVL Ownership, configure compatible Template and Media subclasses, declare native owners/foreign keys, and use the real coordinator to activate the fresh graph before creating records. The package's fresh-only adapter refuses populated graphs. Ownership admission and business permissions are separate checks; request-supplied owner IDs or scope strings do not replace admission.

Run the chosen migrations after configuring the host. Complete fresh Ownership activation before creating package records.

```sh
php artisan migrate
```

## Publish the React builder

Set the exact destination in the published `config/nvl-templates.php`:

```php
'frontend' => ['path' => resource_path('js/components/template-maker')],
```

Then publish the complete source directly into that directory:

```sh
php artisan config:clear
php artisan nvl:templates:frontend:publish --dry-run
php artisan nvl:templates:frontend:publish
```

The default destination is `resources/js/components/template-maker`. `nvl-templates.frontend.path` accepts an absolute path or a path relative to the Laravel application; it names the final folder, with no extra `template-maker` directory appended. Source-overlapping destinations and symlinks are rejected. Publication skips identical files and rejects differing files before writes; review changes before using `--force`. Your application builds this source. Install the exact dependencies listed in the published `dependencies.json`, including React 19, Themelia and Tailwind 4, and include the published declaration files in TypeScript.

Mount Themelia's `UIProvider` once. Import the published `styles.css` through your Tailwind pipeline. Import `TemplateWorkspace`, `GroupVariantWorkspace`, `TemplateCreator` or `TemplateEditor` from `template-maker/template-creator`; focused schema/rendering/headless entries are available too. The existing complete builder components are used directly. Adjust these host imports when choosing a different destination. Rebuild configuration caches after configuration changes during deployment.

The application supplies documents, preview assets, permissions and callbacks. Persist the creator's exported contract with its expected draft version. For variants, preserve the raw family pin and override source; the effective materialized document is a projection. `TemplateReader::load()` returns both forms. Keep host extensions outside the generated folder.

The optional published `integrations/laravel` screens/repository describe a host-owned HTTP contract. Adapt native service results to that interface; the package does not register its routes or an application shell. It also works with other backends.

## Create, publish and personalize

```php
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateRenderer;

$lifecycle = app(TemplateLifecycle::class);
$template = $lifecycle->create([
    'key' => 'gift-voucher',
    'name' => 'Gift voucher',
], $actor);

// $document is the exported template-document v1 contract.
$draft = $lifecycle->saveDraft($template->id, $document, 0, $actor);
$revision = $lifecycle->publish($template->id, $draft->version, $actor);

$output = app(TemplateRenderer::class)->render($revision->id, [
    'facts' => $authorizedBusinessFacts,
    'context' => $trustedContext,
    'inputs' => $customerInputs,
    'settings' => $customerSettings,
], $actor);
```

`html`, `css`, nullable `subject`/`text`, `revisionId`, `checksum` and `inlineAssets` form the native output array. Values are schema-checked; only exposed inputs/settings can be personalized. Settings are presentation controls, distinct from content. Obtain facts/context from authorized server data, never directly from a public request.

Simple exported bindings render in PHP. Structural layouts, repeaters and shared compilation use `DocumentCompiler`. Every structural family variation, including style or typography changes, requires the trusted compiler for preview and publication. Browser compilation is preview metadata; family output is derived from the pinned definition and allowed overrides. Raw drafts can still be saved before that compiler is configured. For the bundled Node worker configure `LocalNodeCompiler`, a trusted command argument array containing your Node 24 executable and the installed `resources/runtime/renderer.mjs`, plus a deployment identity under `nvl-templates.compiler`. Keep PHP, published frontend, schemas and worker from the same build. No Blade files are generated or evaluated from stored template data.

`preview()` compiles authoring output. `previewForBrowser($id,$document,$data,$includeInlineAssets,$actor)` additionally produces `previewHtml` with CID images resolved for browser display and enforces the complete preview response limit. Omitting attachments makes that response preview-only. `prepare()` returns checked published browser data; `TemplateReader::load()` returns bounded editor state.

## Families, resources and catalogs

- `TemplateFamilies`: create families and publish immutable bases. `TemplateLifecycle::create()` accepts an optional `groupId`.
- `FamilyLifecycle`: prepare, inspect, review and apply upgrade/rebase/detach/regroup candidates. Carry draft versions and source checksums; resolve conflicts explicitly. Applying a candidate changes the draft. Publishing is a separate operation.
- `ResourceManager`: create/publish reusable content, partials, layouts and assets references at partition, family or template scope; resolve exact pinned revisions with current access checks.
- `TemplateCatalog`: bounded native paginators for templates, families and assets, plus exact family revision reads. Use integer `page`/`per_page`; asset `target=email` filters unsupported formats before pagination. Catalog admission includes scoped pagination metadata; per-record policies can shorten a page.
- `TemplateAssets`: upload or import from configured storage sources/allowed URLs, then resolve retained identities. The host serves `contents($id,$actor)` through an authorized private response; it decides response URLs and cache headers.

Published revisions retain their document, dependency pins and immutable asset evidence. Current grants and Media identity/bytes are checked again when rendering or reading durable output. Imported image formats are PNG/JPEG/GIF/WebP; email permits PNG/JPEG/GIF. Media owns storage and deletion.

## Email and PDF delivery

Author email templates with `target=email` and the `email-safe/1` profile. Use the supplied email layouts/blocks and checks: table-based structure, supported CSS, safe URLs and supported image types. Server transformation validates the profile and inlines CSS. Previewing in Chromium is not a substitute for testing actual target email clients.

```php
use Illuminate\Support\Facades\Mail;
use Nvl\Templates\Emails\RenderedTemplateMail;

Mail::to($recipient)->send(new RenderedTemplateMail($output));
```

The optional native-array Mailable preserves finalized HTML, plain text, Unicode subjects, CID images and normal host attachments. Each `inlineAssets` entry contains `cid`, `name`, `mimeType` and base64 `content`; keep those CIDs paired with the HTML when using another delivery service. Construction does not send. Applications choose sender, recipients, scheduling and mail transport, and may use their normal Laravel Mail/Blade workflows for other messages.

For PDFs configure a `PdfDriver` such as `ChromiumPdfDriver` and call `TemplateRenderer::pdf()`. It returns validated binary `PdfOutput`; the host supplies the download/storage response. Raw PDF bytes are not a JSON body.

## Durable rendering and maintenance

`RenderRequests::accept()` captures immutable accepted evidence. `queue()` also schedules after the source outer commit when `rendering.queue.enabled=true`. Supply trusted data and a stable `idempotency_key`; incompatible replays conflict. Workers restore the captured actor/owner, recheck access and renderer/asset evidence, and use generations/leases for retries and recovery.

Read authorized state with `get()`/`byKey()`, retained HTML/email with `result()`, and JSON/PDF bytes with `bytes()`. Expiry, revoked access and altered assets still reject after completion. Do not serialize the model's private snapshot, token or internal failure data as a public response.

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('nvl:templates:renders:recover --limit=100')->everyMinute()->withoutOverlapping();
Schedule::command('nvl:templates:renders:prune --limit=100')->hourly()->withoutOverlapping();
```

Provision Laravel's scheduler and queue worker in the host. These commands use policy-bound `SystemActor::Background` in the current scope. Owned applications run maintenance through admitted system-owner operations; see the [complete integration recipe](resources/boost/skills/nvl-templates/references/usage.md). Schedule Media's native recovery/purge separately.

Run `php artisan nvl:templates:doctor --strict --format=json` for read-only configuration/schema diagnostics. The package also contributes to Core Doctor.

The [portable skill](resources/boost/skills/nvl-templates/SKILL.md), [API reference](resources/boost/skills/nvl-templates/references/api.md), [security policy](SECURITY.md) and [contributor guide](CONTRIBUTING.md) cover exact contracts and extension rules.
