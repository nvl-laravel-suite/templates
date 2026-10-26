---
name: nvl-templates
description: Integrate native template lifecycle, assignment and rendering services.
---

# NVL Templates

PHP 8.4 and Laravel 13. Consumers own DTOs, Actions, controllers, routes, view models and download/filesystem wrappers.

Use TemplateDefinitions, TemplateLifecycle, TemplateAssignments, TemplateReader and TemplateRenderer. Services own complete validation/authorization, canonical ownership, immutable versions, revisions, atomic writes, outer-commit delivery, leases and durable recovery. Render results are documented bounded arrays; queued results are TemplateRender models.

Blade-only boots without Content, Media or mPDF. Enable each optional integration explicitly. Keep URL/HTML/asset/output limits and private delivery guards. Base models do not inherit optional-package interfaces. Content integration registers explicit groups; Media integration uses its native file lifecycle.

Background actors need explicit host policy grants. The deprecated Tenancy bridge and forwarding/fluent PDF API are removed. Consumers compose native services and project models/results themselves. Consult the shipped README and PHPDoc for concrete signatures and result shapes.
