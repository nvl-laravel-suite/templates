---
name: nvl-templates
description: Use when integrating nvl/templates document builders, versioned family variants, reusable resources, managed Media images, personalized email with CID attachments, PDF output, durable render requests or native Ownership installation in Laravel.
---

# NVL Templates

Use the native document/family services with an explicit actor last. The host owns controllers, routes, DTOs, business facts, private responses and mail delivery. Preserve portable `template-document` v1, `gct-template` and `urn:gct` values.

Read [usage](references/usage.md) for the complete integration sequence and examples. Use [API](references/api.md) to confirm exact signatures and native array keys; use [installation](references/installation.md) for Composer discovery, publish tags and migration ownership. Copy this entire skill tree when publishing it.

## Choose the workflow

| Need | Native entry point / usage section |
| --- | --- |
| New host and private retained bytes | [Dependencies and storage](references/usage.md#dependencies-and-storage) |
| Owned application graph | [Native Ownership](references/usage.md#native-ownership) |
| Publish React components and CSS | [React builder](references/usage.md#react-builder) |
| Shared server compiler | [Node compiler](references/usage.md#node-compiler) |
| Create, save, publish, reopen | `TemplateLifecycle`, `TemplateReader`; [documents](references/usage.md#document-lifecycle) |
| Family pins and structural variants | `TemplateFamilies`, `FamilyLifecycle`; [families](references/usage.md#families-and-structural-changes) |
| Bounded templates/families/assets and exact pins | `TemplateCatalog`; [catalogs](references/usage.md#bounded-catalogs) |
| Scoped reusable content/design | `ResourceManager`; [resources](references/usage.md#scoped-reusable-resources) |
| Import and authorize images | `TemplateAssets`; [assets](references/usage.md#managed-assets-and-private-routes) |
| Customer inputs, preview and rendering | `TemplateRenderer`; [rendering](references/usage.md#personalization-and-previews) |
| Deliver finalized email with CID bytes | [Mail handoff](references/usage.md#email-delivery-and-cid-attachments) |
| Durable HTML/email/PDF and maintenance | `RenderRequests`; [durable requests](references/usage.md#durable-renders-and-maintenance) |
| Custom PDF adapter callback | `PdfDriver`, provided `RenderedDocument`; [PDF adapters](references/usage.md#custom-pdf-adapters) |

All service classes above are in `Nvl\Templates\Services`. `nvl/media` is required. These workflows do not use Content blocks, Blade template definitions, assignments or the former stored-version lifecycle.

## Preserve authority and concurrency

- Bind `Nvl\Templates\Contracts\TemplateAuthorization`; default policy denies. Bind native Media policy separately. Persisted actors are reloaded; `SystemActor::Background` grants no permission by itself.
- Configure the concrete Template model before provider boot. Enter admitted native Ownership context when configured. Neither request `scope` nor descriptive `owner` data establishes authority.
- Save `TemplateReader::load()['source']` as raw authoring authority. Its `document` is a materialized preview, not replacement source. Keep exact family/resource revision pins and the server's draft `version` / `sourceChecksum` evidence.
- Review family conflicts explicitly; apply changes to the draft, then publish. A newer family never silently updates existing publications.
- Server loads trusted `facts`/`context`; customers supply only declared exposed `inputs`/`settings`. Browser preview HTML and data URLs are not delivery artifacts.
- Keep bounded byte limits, private Media identity/checksums and same-connection transactions. Existing Blade/Content data needs reviewed migration; fresh Ownership adoption is not a converter.
