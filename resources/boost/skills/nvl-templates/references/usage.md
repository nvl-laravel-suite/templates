# Integrate the document builder into another Laravel app

This guide uses native `Nvl\Templates\Services` APIs, array inputs/results and an explicit `Illuminate\Contracts\Auth\Authenticatable|Nvl\Support\Enums\SystemActor` actor last. Returned persistence records expose IDs and revision counters; do not turn them into a public transport schema wholesale. The host supplies controllers, routes, DTOs, authenticated actor admission, business data and delivery.

Contents: [setup](#dependencies-and-storage), [Ownership](#native-ownership), [React](#react-builder), [compiler](#node-compiler), [documents](#document-lifecycle), [families](#families-and-structural-changes), [catalogs](#bounded-catalogs), [resources](#scoped-reusable-resources), [assets](#managed-assets-and-private-routes), [personalization/previews](#personalization-and-previews), [mail/CID](#email-delivery-and-cid-attachments), [durable requests](#durable-renders-and-maintenance), [errors](#consumer-checks-and-errors).

## Dependencies and storage

Use PHP 8.4+, Laravel 13 and compatible NVL 7.x packages. `composer require nvl/templates:^7.0` installs mandatory `nvl/core`, **`nvl/media`**, `nvl/translatable`, the JSON-schema validator and email inliner dependencies. Required PHP extensions are ctype, curl, DOM, fileinfo, filter, JSON, libxml and mbstring. Content and mPDF are not dependencies of the document lifecycle. `nvl/ownership` is optional native isolation, not an alternative asset store.

Composer discovers `Nvl\Templates\Providers\TemplatesServiceProvider`. Publish config with `php artisan vendor:publish --tag=nvl-templates-config --no-interaction`. Configure these before boot/migration:

- `nvl-templates.connection` and `nvl-templates.tables.*`; align Media's connection so retained writes use the **same actual database connection**, not two independently named connections to the same database.
- `nvl-templates.models.template`, `nvl-templates.authorization.class`, and `nvl-templates.media.disk` (otherwise `nvl-media.private_disk`). Use a private native Media disk with its normal allowed-disk/delivery configuration; bind `Nvl\Media\Contracts\MediaAuthorization` as well as Templates policy.
- Choose vendor-loaded document migrations, or publish `nvl-templates-migrations` once and disable `nvl-templates.migrations.enabled` before running your reviewed host copies. Keep applied migration history intact.

Templates retains immutable image and output identities through Media's private `retained_asset` / `retained_output` owner slots. Reads require current Templates grants plus Media access/Download grants and matching Media ID, revision, checksum, size and MIME. No `rendering.output.persist` switch is needed. A host URL/path is not retained-byte authority.

Implement `Nvl\Templates\Contracts\TemplateAuthorization::authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context=[]): void`; throw on denial. Native operation policies use `TemplateAbility::Manage`, `Read`, `Render` and `Copy` as appropriate, with `context['resource']` when a specific record is involved. The safe default denies. Bind the contract in a host provider or configure an implementing policy class before provider registration. Never copy an allow-all test policy into the app. A deliberately allowed `SystemActor::Background` remains policy-bound.

## Native Ownership

For company/tenant ownership, configure a real Template subclass **before boot**. Example host class declaration:

```php
use App\Models\Company;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;

class CompanyTemplate extends \Nvl\Templates\Models\Template
{
    public static function ownershipDefinition(): OwnershipDefinition
    {
        return OwnershipDefinition::column(Company::class, 'company_id');
    }
}
```

Set `nvl-templates.models.template` to this concrete class and configure a compatible concrete Media model with the same owner declaration through `nvl-media.models.media`. Register native owner identities (`nvl-core.owners`), actual owner columns/foreign keys and policy/admission bindings. Preserve native UUIDs, casts, query/persistence behavior and the source graph's connection. Root ownership accepts native column or concrete primary pivot strategies; inherited children/resources are registered by the package. Unscoped defaults do not imply tenant isolation.

Install `nvl/ownership`, set `nvl-ownership.enabled=true` with its own reviewed storage/migration setup, bind its `OwnerAccess` policy, then enter `app(Nvl\Ownership\Contracts\OwnershipRunner::class)->run($company, $actor, fn () => /* native operations using the same $actor */)`. The explicit actor must match the admitted ownership principal. No ambient Auth guard, request `scope_id`, or request owner field substitutes for this admission. For unscoped deployments `nvl-templates.scope` is trusted deployment configuration; never set it from request data.

The package registers `Nvl\Templates\Ownership\TemplatesAdoptionAdapter` under `templates` with the native coordinator. It is **fresh-only**: all resources must remain empty through prepare/backfill/verify/activate. Under real maintenance/adoption authorization, use `Nvl\Ownership\Services\OwnershipAdoptionCoordinator::prepare(['templates','media'], [], $operation)`, `backfill($plan, 100, $operation)`, `verify($plan)->passed()` and `activate($plan, $operation)`, with a deliberate `Nvl\Ownership\ValueObjects\OwnershipOperation(purpose: 'install-templates', actorType: 'operator', actorId: $reviewedOperatorId)`. Bind `Nvl\Ownership\Contracts\OwnershipAdoptionAccess::authorize(OwnershipOperation $operation): void` to the host installer policy; audit facts alone grant no authority. Media and each other selected adapter impose their own installation prerequisites. Never call the internal adapter directly or fabricate activation rows. Populated resources, legacy Blade/Content data and colliding old tables require a separately reviewed migration/mapping; document installation fails closed and does not convert them to JSON.

## React builder

Set `nvl-templates.frontend.path` to the exact final directory (default `resources/js/components/template-maker`). The command copies the builder contents directly there, without adding another `template-maker/` directory. Relative destinations resolve from the application base path. After editing a cached configuration, clear it before inspecting or publishing the destination:

```sh
php artisan config:clear
php artisan nvl:templates:frontend:publish --dry-run
php artisan nvl:templates:frontend:publish
```

The destination contains relative TypeScript entries, `src/`, `schemas/`, `styles.css`, `dependencies.json` and optional `integrations/laravel` examples. Identical files skip; differing files stop publication before writes. Review local changes before explicit `--force`; obsolete host files are not automatically deleted. Publishing does not write your routes, pages or npm manifest. For deployments that cache configuration, rebuild it after reviewed changes with `php artisan config:cache`, then restart long-lived workers.

Merge the published `dependencies.json` into the host's normal locked dependency setup: React/React DOM 19, one `themelia-react-ui` installation satisfying `^2.0.5`, its Base UI dependencies and all listed runtime dependencies. Use Tailwind 4 with `@tailwindcss/vite` and React types from the listed dev dependencies. Composer consumers install **no Template Maker npm package**. The private maintainer npm name is not a registry ownership claim.

Mount one `UIProvider` from `themelia-react-ui/ui-provider` at the app root. In a host Tailwind CSS entry at `resources/css/app.css`, for the default destination:

```css
@import 'tailwindcss';
@import '../js/components/template-maker/styles.css';
/* Host theme overrides follow. The published stylesheet supplies @source scanning. */
```

For a host component in `resources/js`, with the default publication destination:

```tsx
import { UIProvider } from 'themelia-react-ui/ui-provider'
import { TemplateWorkspace } from './components/template-maker/template-creator'
import {
  createTemplateDefinition, exportSharedTemplateDocument, type BindingDocument,
} from './components/template-maker/template-renderer'

const initialDocument = exportSharedTemplateDocument(createTemplateDefinition('Welcome'), {
  target: 'email', subject: 'Welcome', text: 'Welcome',
})

export function Authoring({ document = initialDocument, onExport }: {
  document?: BindingDocument
  onExport: (document: BindingDocument) => void
}) {
  return <UIProvider><TemplateWorkspace initialDocument={document} onExport={onExport} /></UIProvider>
}
```

Reuse the app's existing provider instead of nesting another. The host owns the shell, editor height and local buffering. `TemplateWorkspace.onDraftChange` carries incomplete authoring drafts (artifacts omitted); `onExport` supplies the complete publishable document. Preserve unfinished invalid local work; save the final export before publication. Create an initial portable source with public `createTemplateDefinition` / `exportSharedTemplateDocument` from `template-renderer`, or use a host-approved saved document.

Include the published source tree's `.d.ts` declarations in the host TypeScript project as well as its TS/TSX files; these include the local QR-code declaration. Use TypeScript bundler module resolution.

Use `GroupVariantWorkspace` for a raw variant: `initialDocument` is raw `source`, `effectiveDocument` is its materialization, `familyDocument` comes from the **exact pinned** `load()['family']['source']` (retaining declarations/references), and `onDraftChange`/`onExport` return raw variant authority. Use `sessionKey` when explicitly replacing identity/basis. `familyAuthoring` on `TemplateWorkspace` enables family declarations. `TemplateCreator`/`TemplateEditor` are lower-level pure builder/editor components. `template-schema` contains types/validation; `template-renderer` contains pure composition helpers. Core imports do not initiate HTTP/persistence. Optional Laravel screens/repository/session examples are explicit imports describing a **host-owned HTTP contract**; the package registers none of their routes.

Extend the complete workspace with `insertPresets` (use `getTemplatePresets()` from `template-renderer` for fresh built-ins) or a host-created `creator` controller. The lower-level `TemplateCreator` also exposes `workspacePanels`, `canvasControls` and `nodeInspector` for host controls. Keep extensions outside the generated directory. Import portable types/parsers and `getTemplateJSONSchemas()` from `template-schema`; use the published `schemas/*.schema.json` or installed `vendor/nvl/templates/resources/contracts/*.schema.json` for other languages. Semantic graph, permission and retained-Media checks still apply beyond JSON Schema validation.

## Node compiler

Shared rendering and runtime conditions/repeats use a configured trusted `Nvl\Templates\Contracts\DocumentCompiler`; `Nvl\Templates\Drivers\Compiler\LocalNodeCompiler` runs the bundled implementation. Every structural family variation, including node-style and typography changes, requires a trusted compiler for preview and publication. Configure a trusted server argument vector, not shell text and never request-provided executable/path/cwd. Example in host `config/nvl-templates.php`:

```php
return [
    'compiler' => [
        'driver' => \Nvl\Templates\Drivers\Compiler\LocalNodeCompiler::class,
        'command' => [
            env('TEMPLATES_NODE_BINARY', '/usr/local/bin/node'), // deployment's Node 24 executable
            base_path('vendor/nvl/templates/resources/runtime/renderer.mjs'),
        ],
        'cwd' => base_path(),
        'timeout' => 30,
        'identity' => 'host-template-runtime-v1',
    ],
];
```

Verify your configured binary is Node 24 and the installed worker path exists. The worker bundles its dependencies; the Composer host needs no Template Maker npm install or running render service. Retain third-party notices; update backend, generated source and worker together. Keep `limits.document_bytes`, `limits.output_bytes`, `limits.preview_bytes`, `limits.bindings` and `limits.depth` bounded. A missing compiler rejects shared rendering and structural-family preview/publication; valid raw structural drafts can still be saved. Native `bindings` HTML remains supported for qualified standalone documents and variants without structural variations. Keep source and artifacts matched; changing engine strings does not compile a document.

## Document lifecycle

All classes in examples below are imported from `Nvl\Templates\Services`; `$actor` is an authorized persisted identity in the admitted context. `$rawDocument` is a validated host/editor export, **not a resolved preview copied back as source**.

```php
use Nvl\Templates\Services\TemplateLifecycle;
use Nvl\Templates\Services\TemplateReader;

$lifecycle = app(TemplateLifecycle::class);
$template = $lifecycle->create(['key' => 'welcome', 'name' => 'Welcome'], $actor);
$draft = $lifecycle->saveDraft($template->id, $rawDocument, 0, $actor);
$revision = $lifecycle->publish($template->id, $draft->version, $actor);
$editor = app(TemplateReader::class)->load($template->id, $actor);
```

Initial draft version is `0`; save increments it. Use the latest returned draft version for every subsequent save/publish; `Template->version` is a **publication** counter, not the draft counter. Stale versions throw `Nvl\Templates\Exceptions\DraftConflict`; retain the user's work and reload/resolve deliberately. `TemplateReader::load()` returns `source`, effective `document`, `version`, `sourceChecksum`, `family`, `previewAssets`, `issues`, `familyChanges`, `hasProposedBasis`, `proposedGroupId`, `currentRevisionId`, `capabilities` and template identity. Do not replace raw source with `document` or swallow resource issues as a successful save. `get($id, $actor)` reads an authorized configured root.

`create` accepts exactly `key`, `name`, optional nullable `groupId`. It does not accept ownership, arbitrary metadata or former renderer/view/status fields. The wire envelope remains `format: template-document`, `schemaVersion: 1`, `target: document|email`. Standalone `source.definition` is the existing `gct-template` v1 graph. Published revisions retain immutable raw source, effective dependency snapshot and checksum. Do not write package snapshots/revision rows directly.

## Families and structural changes

`TemplateFamilies::create(['key'=>..., 'name'=>...], $actor)` returns a family root. `publish($groupId, $standaloneDocument, $expectedRevision, $actor)` creates an immutable source/dependency revision; initial expected revision is `0`. Families require standalone source. New family publications prepare eligible upgrade candidates; existing variants/publications stay pinned.

Create a member with `TemplateLifecycle::create(['key'=>'member','name'=>'Member','groupId'=>$group->id], $actor)`, then save its raw source:

```php
$rawVariant = [
    'format' => 'template-document', 'schemaVersion' => 1, 'target' => $familyDocument['target'],
    'source' => [
        'mode' => 'group-variant',
        'group' => ['id' => $group->id, 'revision' => $familyRevision->revision],
        'overrides' => [],
    ],
];
$draft = $lifecycle->saveDraft($member->id, $rawVariant, 0, $actor);
$publication = $lifecycle->publish($member->id, $draft->version, $actor);
```

Use the precise integer family revision, never “latest.” Keep only the pin plus declared overrides in a variant; the target must match its family. Overrides can hold `content`, `settingsDefaults`, narrowed `exposedInputs`/`exposedSettings`, and `variations`. Reset removes a local override to restore inheritance. Preserve omission versus empty values and content references versus resolved values.

Family `variationPoints` declare allowed `node-property`, `node-style`, `block-property`, `placement` and `children` changes. Children may address roots, element children or a block slot; bounds, required IDs, allowed node kinds and pinned registered blocks remain enforced. Use the existing creator controls to produce structural deltas. Every nonempty `source.overrides.variations` map, including node-style or typography overrides, requires a configured trusted `DocumentCompiler` for preview and publication. A browser `compiled` envelope checks source freshness and supports local preview; its artifacts are not family output authority and never replace server-authorized HTML, CSS, bindings or sidecars. A valid raw draft can still be saved without the compiler. Keep any `compiled.sourceKey` matched to the current raw source and preserve family authority.

For upgrade/rebase/detach/regroup, first save local work and read current `version`/`sourceChecksum` from `TemplateReader::load()`. Then use the exact signatures:

```php
use Nvl\Templates\Services\FamilyLifecycle;

$changes = app(FamilyLifecycle::class);
$candidate = $changes->prepare($member->id, 'upgrade', [
    'groupId' => $group->id, 'revision' => $newFamilyRevision,
], $editor['version'], $editor['sourceChecksum'], $actor);
// Host presents candidate conflicts; fill choices only from that candidate.
$choices = []; // conflict ID => 'local' or 'family', one for every conflict
$review = $changes->review($member->id, $candidate['id'], $choices,
    $editor['version'], $editor['sourceChecksum'], $actor);
$applied = $changes->apply($member->id, $candidate['id'], $choices,
    $editor['version'], $editor['sourceChecksum'], $actor);
$publication = $lifecycle->publish($member->id, $applied['version'], $actor);
```

`listing($templateId,$actor)` / `get($templateId,$candidateId,$actor)` reopen currently authorized candidates. `upgrade` and `rebase` require a newer revision of the same family; `regroup` requires a different family with exact `{groupId,revision}`; `detach` requires a null target and a current variant. Review computes a projection without changing authoring state. Resolve every conflict ID using its `choices`/`localAllowed`; never force `local` after a removed/narrowed permission. Display bounded typed `comparison` previews rather than parsing diagnostic messages or dumping graphs.

Apply rechecks version, source checksum, current grants and dependency evidence. It updates a **draft proposed basis**, not published membership; the returned `version`/`sourceChecksum`/`source` are the new authority. Publish separately to commit membership. Detach copies the authorized effective design/resources to standalone draft authority; unavailable dependencies fail closed. If source/evidence changed, prepare a fresh candidate and keep the newer local edits.

## Scoped reusable resources

The current public service is `Nvl\Templates\Services\ResourceManager`:

- `create($key,$name,$kind,$scope,$ownerId,$actor)`; kinds: `layout`, `partial`, `content`, `theme`, `settings`, `editor`.
- Scope `tenant` requires null owner ID; `group` requires the family ID; `template` requires the configured template ID. These catalog scopes do not grant native ownership or business permission.
- `publish($resourceId,$body,$expectedRevision,$actor)` creates an immutable body revision; initial revision is `0`.
- `catalog($templateId,?string $kind,$actor)` returns only readable, active resources visible to the authoring basis.
- `revisionFor($templateId,$resourceId,$revision,$actor)` reads one exact visible immutable revision.

A content reference is `['kind'=>'content','resourceId'=>$resource->id,'revision'=>$revision->revision,'path'=>'headline']`, where the published resource body actually contains that path. Preserve the reference in raw source; publication resolves/pins its dependency closure. Tenant-scoped resources cannot depend on narrower resources; group resources cannot depend on template-only resources. Cycles/depth violations reject. A proposed detach/regroup basis also affects catalog visibility. Do not replace this with unrestricted model enumeration.

For reusable design, publish a bounded JSON body with `ResourceManager::publish`, read its exact authorized revision with `revisionFor`, then copy it into the standalone authoring graph using the builder or a host adapter. Native PHP resource services retain bodies and resolve dependency evidence; they do not insert a partial or replace a layout automatically. The optional published controls use these body conventions:

| Kind | Authoring body and application |
| --- | --- |
| `partial` | A `gct-template-block-library` v1 from `exportTemplateBlock(definition, blockId, blockVersion)`, or `{library, managedAssets?}`. Parse with `parseTemplateBlockLibrary`, import through `creator.actions.importBlockLibrary(library)`, then insert its returned `{blockId, version}` with `creator.actions.insertBlock(blockId, version)`. Carry checked retained-image mappings separately. |
| `layout` | A parsed `TemplateDefinition` or standalone `BindingDocument`. Deliberately replace `source.definition`, retain the destination identity/name and carry the envelope's managed-image mappings; revalidate existing field values against the replacement. |
| `theme` | A theme input normalized by `createTemplateTheme(input)`; copy the resulting theme into the document. |
| `settings` | `{settingsSpec: PresentationSetting[]}`. Use `resolvePresentationSettings(spec, {}, false)` for checked defaults, retain the spec and exposed setting IDs, then regenerate the matching document schema during final export. These are appearance controls. |
| `editor` | Host-defined editor metadata; the optional resource controls provide no built-in application operation for this kind. |

`exportTemplateBlock`, `parseTemplateBlockLibrary`, `createTemplateTheme` and `resolvePresentationSettings` are public `template-renderer` exports. `createTemplateCreator` is a `template-creator` export; use its `getTemplate()` after commands and `destroy()` when discarding a host-owned controller. A block's pinned version is separate from the resource revision containing its library. Library imports deduplicate identical revisions and reject conflicting block/asset/theme identities.

The optional `integrations/laravel/laravel/resources.ts` provides `applyTemplateResource` and `referenceTemplateContent` examples. They consume the host's `ResourceRevision` projection (resource root ID, exact revision and body), not native Eloquent responses; they are neither PHP methods nor pure entry-point exports. A copied layout/partial/theme/settings keeps its authored values plus `{resourceId, revision}` in `dependencies`; newer resource publications do not replace those copies. Content keeps an explicit reference in raw source. After either edit, discard stale derived artifacts, preserve raw authority and exact pins, and obtain a complete workspace export before saving for publication.

## Bounded catalogs

Use `Nvl\Templates\Services\TemplateCatalog` instead of model-wide enumeration:

- `templates(array $query,$actor)` returns a native `Illuminate\Pagination\LengthAwarePaginator` of the configured Template models.
- `groups(array $query,$actor)` returns the same native paginator with TemplateGroup models.
- `assets(array $query,$actor)` returns a paginator of retained asset **metadata**, filtering unavailable/archived identities and target MIME types before pagination. It resolves no byte URLs.
- `groupRevision(string $groupId,int $revision,$actor)` reads one exact published TemplateGroupRevision after current family/revision authorization. Its `source` retains authoring references; `document` is the immutable effective snapshot.

The closed query shape accepts only strict integer `page` (1–1,000,000) and `per_page` (1–100); defaults are `1/25`, or `1/30` for assets. Only assets additionally accept `target: 'email'|'document'` (default `document`). Unknown filters, numeric strings and null controls reject. Validate/normalize HTTP query strings at the host boundary before native calls. Do not request a hidden unbounded “all” page.

Bare Read admission explicitly authorizes scoped pagination metadata. Per-record Read filtering may shorten a page; totals describe the scoped query **before** row policy filtering, not a policy-specific accessible count. Preserve that distinction in the host UI. The host projects paginator/model fields to its `TemplateRepository` contract (including camelCase identities and approved private routes); native models are not that HTTP response format. Catalog access never grants image byte access: use `TemplateAssets::contents` through the authorized private endpoint.

## Managed assets and private routes

Use `Nvl\Templates\Services\TemplateAssets`, actor last:

- `upload(UploadedFile $file,$actor)` imports a checked upload.
- `fromStorage($source,$key,$name,$actor)` imports from a server-registered `nvl-templates.imports.sources.<source>` map with `disk` and optional `prefix`. `key` is a safe relative object key.
- `fromUrl($url,$name,$actor)` imports only approved HTTPS hosts in `nvl-templates.imports.allowed_hosts`, with bounded `imports.timeout`, public pinned DNS and no redirects.
- `contents($assetId,$actor)` returns `[$asset,$rawBytes]` after current authorization, immutable Media identity and byte checks.
- `resolve($assetId,$target,$embedEmail,$actor)` returns `id`, `checksum`, `mimeType`, `url`, nullable `attachment`; targets are `document` or `email`. Email URL is `cid:...`; an embedded attachment contains base64 `content`.

Imports accept PNG/JPEG/WebP/GIF under `nvl-templates.storage.max_bytes` and image dimension limits. Email's supported baseline is **PNG/JPEG/GIF**, excluding WebP/SVG/fonts. Import a new identity for changed bytes; retained identities are not replaceable image paths.

Map builder definition asset IDs to retained TemplateAsset IDs with `managedAssets`; never save temporary preview/blob URLs as authority. For an application-owned private image endpoint, load the trusted actor, authorize the owning business/template association, call `contents`, then return raw bytes with checked MIME and private/no-store caching. An asset-ID-only URL is not a permission check. Register this route in the host; the package supplies no controller/route. Keep storage paths and Media internals out of responses.

## Personalization and previews

`TemplateRenderer::render($revisionId,$data,$actor)` renders one authorized immutable publication. `$data` accepts only `facts`, `context`, `inputs`, `settings` maps. Server-authorized business records supply **facts/context**; customers submit only selected input and appearance values. Do not pass `$request->all()` or customer facts/owner/compiled artifacts. Native schema, `exposedInputs` and `exposedSettings` reject widened paths; published `content` and hidden defaults remain server authority. Preview samples are not stored defaults. If using the `ContextProvider` contract in a host adapter, call it only after authorizing its business owner; native runtime maps still need trusted server construction.

- `prepare($revisionId,$data,$actor)` returns `revisionId`, effective `document`, checked `data` and `previewAssets` for opening a customer editor. It permits incomplete customer-required input while validating provided values; `render` requires the full runtime schema. Send only context/facts the customer may see.
- `preview($templateId,$rawDocument,$data,$actor)` validates/compiles an authoring preview using the exact family pin and current grants. It does not publish or send mail.
- `render(...)` / `preview(...)` return `html`, `css`, nullable `subject`/`text`, `revisionId`, `checksum`, `inlineAssets`. Their finalized email HTML is a **delivery artifact with CID URLs**.
- `previewForBrowser($templateId,$rawDocument,$data,$includeInlineAssets,$actor)` returns the same delivery fields plus `previewHtml`. The projection replaces only exact supported image CID sources with checked data URLs; delivery `html`/checksum remain unchanged. Use `previewHtml` only for a browser view. Pass `false` to omit returned `inlineAssets` from a preview-only response; such a response is no longer a complete mail bundle. The whole response, including duplicated images/base64, is bounded by `limits.preview_bytes`. Preserve exact CID identities and use the public renderer rather than internal compilation services.

Render browser content in a host-controlled sandboxed preview; no source-editor scripts belong in output. Email profile finalization enforces allowed elements/styles and inlines compatible CSS. Preserve conditional styles and delivery artifact identity. HTML/email output is bounded by `limits.output_bytes`; keep preview and image expansion bounded separately.

For PDF use `TemplateRenderer::pdf($revisionId,$data,$options,$actor)` on a `target: document` publication. Configure `nvl-templates.pdf.driver` to a `Nvl\Templates\Contracts\PdfDriver`, such as `Nvl\Templates\Drivers\Pdf\ChromiumPdfDriver`, with trusted `nvl-templates.pdf.url`, either `pdf.token` or `pdf.api_key`, and bounded `pdf.timeout` / `pdf.input_bytes`; rotate `pdf.identity` when changing the approved renderer. These `pdf.*` keys are all under `nvl-templates`. Options are only `filename`, `expectedPages`, `maxPages`. Return is validated `Nvl\Templates\ValueObjects\PdfOutput` (`bytes`, `filename`, `size`, `checksum`); the host chooses a private response. No fluent mPDF/Blade forwarding API is involved.

### Custom PDF adapters

Implement `Nvl\Templates\Contracts\PdfDriver` with its existing `render(Nvl\Templates\Rendering\RenderedDocument $result, array $document, array $options = []): Nvl\Templates\ValueObjects\PdfOutput` signature and configure its class as `pdf.driver`. Native admission supplies the finalized read-only callback value. Supported properties are `html`, `css`, nullable `subject`/`text`, `revisionId`, `checksum` and `inlineAssets`; `toArray()` projects the same fields, with inline asset entries containing `cid`, `name`, `mimeType` and base64 `content`.

Read the provided value and return validated `PdfOutput`; keep `RenderedDocument` construction and `fromArray()` inside native rendering. Ordinary render/preview services continue returning arrays. Preserve literal finalized placeholders, approved private assets, bounded page/byte options and trusted renderer/remote-fetch policy. A custom adapter is responsible for enforcing its selected renderer's transport and page limits; receiving this value grants no additional resource or network authority.

## Email delivery and CID attachments

A render call does **not** send email. For `target: email`, render with trusted facts/context and permitted inputs/settings. The native result's `inlineAssets` is:

```text
list<array{cid: string, name: string, mimeType: string, content: string}>
```

`content` is **base64-encoded complete image bytes**, not a URL, path or already-decoded binary string. Each `<img src="cid:CID">` needs a matching inline MIME part with Content-ID **CID without the `cid:` prefix**. Preserve its MIME/name; strict-base64-decode before attaching. Baseline MIME types are `image/png`, `image/jpeg`, `image/gif`. Keep the finalized HTML/subject/text and all inline assets together, including after durable retrieval.

Use the public `Nvl\Templates\Emails\RenderedTemplateMail` mailable. Its constructor accepts the native render array, validates finalized email HTML/subject and the complete aggregate byte budget, decodes/validates matching CID image MIME bytes and preserves the text part. It does not render a Blade view, choose a recipient or send by itself.

```php
use Illuminate\Support\Facades\Mail;
use Nvl\Templates\Emails\RenderedTemplateMail;

// $rendered is TemplateRenderer::render(...) or RenderRequests::result(...).
// $recipient is chosen and authorized by the host application.
Mail::to($recipient)->send(new RenderedTemplateMail($rendered));
```

The application owns its configured sender/transport, recipient policy, send retry/idempotency and any consuming mail-notifications integration. The mailable can be handed to the host's normal mail queue when appropriate; preserve the full native bundle across serialization. For another consuming transport, strict-base64-decode each `inlineAssets[*].content` and attach the raw bytes inline under its exact `cid`, `name` and `mimeType`, alongside `html`, `subject` and nullable `text`. Do not forward base64 strings as raw bytes or attach storage URLs. Use the native render array for mail delivery; `RenderedDocument` is supplied only to PDF adapters. Preserve inline assets and delivery HTML rather than browser data-URL projections. Rendering/publication have no hidden mail delivery side effect.

## Durable renders and maintenance

`Nvl\Templates\Services\RenderRequests` is the public durable request service, **not methods on TemplateRenderer**. Configure a private Media disk, encryption/app key and supported source storage. For queueing set `nvl-templates.rendering.queue.enabled=true`, `rendering.queue.connection`, `rendering.queue.name`; provision the host queue worker. All keys below are under `nvl-templates`.

```php
use Nvl\Templates\Services\RenderRequests;

$requests = app(RenderRequests::class);
$request = $requests->queue($revision->id, [
    'facts' => $trustedFacts, 'context' => $trustedContext,
    'inputs' => $permittedInputs, 'settings' => $permittedSettings,
    'output' => 'html',
    'idempotency_key' => 'welcome-order-1042-v1',
], $actor);
// In a later authorized host read, once status is completed:
$delivery = $requests->result($request->id, $actor);
```

Exact request controls are `facts?`, `context?`, `inputs?`, `settings?`, `output?: 'html'|'pdf'`, `options?: {filename?,expectedPages?,maxPages?}`, nullable `idempotency_key`, optional trusted `owner` map and nullable `request_identity` SHA-256. HTML requests require empty options; PDF needs a document publication/configured PDF driver. `owner` is trusted host evidence and does not choose native ownership. If supplied, the worker calls `Nvl\Templates\Contracts\ContextProvider::resolve(TemplateRevision $release, array $owner, Authenticatable|SystemActor $actor): array` to reauthorize the business owner before processing, passing the explicit freshly admitted actor rather than ambient Auth. Configure `nvl-templates.context_provider` to your implementing resolver (the default returns empty maps); this check does not replace accepted facts/context with newer values. The host must authorize/construct initial facts and authorize its result/delivery association too. Never forward client-controlled owner/execution/snapshot data. `request_identity` is a host-computed lowercase SHA-256 fingerprint when needed, not user authority.

`accept($revisionId,$data,$actor)` records a bounded snapshot without dispatch. `dispatch($id,$actor)` schedules it after the **actual source outer transaction commit**. `queue` performs both atomically. For explicit trusted in-process execution, `process($id,null,null,$actor)` processes the current generation; queue jobs carry captured actor/Ownership envelope and lease tokens. Do not expose generation/token/process operations as arbitrary user endpoints. Workers reload/re-admit identity and recheck grants, pins/assets and compiler identity. Same-key compatible replay returns the same request; changed accepted data/renderer identity conflicts with `RenderConflict`.

Use `get($id,$actor)` / `byKey($key,$actor)` for authorized status. `result($id,$actor)` returns the complete checked retained HTML/email array; `bytes($id,$actor)` returns checked JSON or binary PDF bytes. Completion alone does not grant delivery access: reads recheck current publication and asset/Media grants and expiry. Do not expose encrypted snapshots, processing tokens, raw paths or internal failure details. Retention stores a private Media artifact with immutable ID/revision/checksum, not Templates-owned output files.

Schedule bounded `recover($limit,$actor)` and `prune($limit,$actor)` batches (1–1000) per admitted scope. CLI equivalents are:

```sh
php artisan nvl:templates:renders:recover --limit=100
php artisan nvl:templates:renders:prune --limit=100
```

These commands use policy-bound `SystemActor::Background` in the current scope. For owned system maintenance, admit a trusted canonical `Nvl\Support\Ownership\ValueObjects\OwnerReference` with `app(Nvl\Ownership\Contracts\OwnershipRunner::class)->runSystem($ownerReference,$operation,$callback)`, allowlist the operation in `nvl-ownership.system_operations`, and bind `Nvl\Ownership\Contracts\OwnerSystemAccess` to authorize it. A human `run()` principal cannot be borrowed by the background actor; do not loop over raw owner IDs or set request scope configuration to bypass admission. Configure `rendering.attempts`, `backoff`, `lease_seconds`, `dispatch_timeout`, `retention_seconds`. Pruning expires payloads and delegates artifact deletion to Media. Run native Media recovery separately for its private artifact lifecycle; Templates exposes no orphan-file hook. Do not delete files or mutate completed records to manufacture retry/recovery.

## Consumer checks and errors

Run the read-only installation diagnostic after setup:

```sh
php artisan nvl:templates:doctor --strict --scope=all --format=json
```

`--scope` accepts `all`, `core` or `database`; `--format` accepts `text` or `json`. `--strict` fails when a required inspected check is unhealthy. It checks the configured graph/storage/capabilities and does not grant principal admission, mutate data, execute a browser, validate an email-client matrix or certify production delivery.

Qualify create/save/publish/load, denied/cross-owner/stale operations, raw family pin preservation, structural edits and review/apply/publication, scoped references, private image routes, exposed customer values, matching CID bytes, queue rollback/idempotency and expired output reads in the host. Keep compilation/backend/frontend worker versions aligned and restart long-lived workers after reviewed config changes.

Map `DraftConflict` and `RenderConflict` to host conflict responses, Laravel authorization/validation failures to host-safe errors, and `RenderUnavailable` to a retry/status/expiry response appropriate to its state. Preserve unfinished local input on conflicts. The host owns exception mapping; renderer diagnostics and persisted execution evidence are not public response contracts. Package fixtures/retired Blade APIs are not installable application integrations.
