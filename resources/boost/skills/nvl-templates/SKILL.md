---
name: nvl-templates
description: Use when integrating source-controlled Blade/PDF templates, stored template lifecycle, localized versions, assignments, queued rendering, safe assets or template adoption with nvl/templates.
---

# NVL Templates

Templates targets PHP 8.4 and Laravel 13 and exposes native services and useful models.
Consumers own DTOs, Actions, controllers, routes, views and download/filesystem responses.
Blade-only rendering boots without Content, Media or mPDF.

## Portable references

- [Installation](references/installation.md): providers, exact publish tags, migration ownership and optional setup.
- [Native API](references/api.md): signatures, renderer/PDF shapes, contracts, models and domain values.
- [Usage](references/usage.md): class versus stored templates, allowed fields, policies and end-to-end examples.

Read usage for capability selection and API before constructing options or mutation arrays.
Read installation for a new host, published schema or adoption change.
The local reference tree remains complete after Laravel Boost publication.

## Choose the operation

- `Nvl\Templates\Template`: source-controlled view/data/options, requiring no stored-template row.
- `TemplateDefinitionRegistry` / `TemplateDefinitions`: register and synchronize code definitions.
- `TemplateLifecycle`: create/update/delete templates, create/update drafts and publish immutable versions.
- `TemplateAssignments`: assign/unassign registered host owners and profiles.
- `TemplateReader`: authorized aggregate/detail/pages and requester-scoped render history.
- `TemplateRenderer`: immediate bytes, durable queued render records, processing and recovery.
- Asset/renderer registries: integrate explicitly selected renderers and revision-aware Media aliases.
- `TemplateImporter`: plan/prepare/apply reviewed legacy adoption manifests.

## Supply explicit authorization

Bind `TemplateAuthorization`; register `TemplateOwnerResolver` capabilities when
using owner assignments or owner-based stored rendering.
Pass a persisted Eloquent actor or deliberately authorized SystemActor.
The native guard reloads Eloquent actors before policies; background identity grants nothing.
Code-definition synchronization uses `TemplateAbility::Update` with the exact context
`operation => synchronize_definitions` and `definitions => <validated registry snapshot>`.
That admitted snapshot is the persisted one; constrain the grant to source synchronization.
Native Ownership admission and assignment owner identity remain separate from business permission.

## Preserve native validation and revisions

Use exact native array keys, retaining camelCase owner/version fields and snake_case controls.
Unknown/protected fields reject, including unknown localized title/description fields.
Expected revisions are mandatory where declared; initial assignment revision is zero.
Omitted update metadata/translations retain stored values.
Explicit empty arrays clear metadata and, in replacement mode, translations.
Published/retired versions are immutable; publication requires synchronized Content composition.
Renderer/schema/profile checks remain enforced even for direct PHP calls.

## Keep rendering boundaries intact

Results are bounded arrays of content, MIME type, renderer, size, checksum and optional names/subject.
Queued results are TemplateRender models with durable identity, leases and recovery.
Preserve requester checks, source outer commit and idempotency digest conflicts.
Enable Content, Media assets/output and PDF capabilities explicitly.
Keep HTML/URL/asset/output limits, safe paths, remote host allowlists and private delivery guards.
Base models do not inherit optional integration interfaces.

## Models and operations

Configure `models.template` before boot using a compatible concrete stored Template subclass.
Retain native keys, casts, canonical ownership and query/persistence capabilities.
Use the package storage configuration for its source graph and reviewed adoption for existing data.
Operational commands include sync, render recovery, view publication, doctor and adoption.
The usage reference supplies exact command names and verified direct/native lifecycle examples.
The deprecated Tenancy bridge and forwarding/fluent PDF API are absent.
