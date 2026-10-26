# NVL Light migration

Requires PHP 8.4 and Laravel 13. Replace old Actions, passive DTOs and fluent PDF/download wrappers with the native definition, lifecycle, assignment, reader and renderer services. Consumers own data, transport, view models and file/download responses.

Render services return bounded native domain output; queued work returns `TemplateRender`. Preserve version immutability, actor/owner admission, source/output restrictions, outer commit behavior, leases and recovery. PDF output remains binary.

Content, Media and mPDF are optional and explicitly enabled. Base models load without their interfaces. Register permitted Content groups and use the existing optional Media file adapter rather than direct table/filesystem writes. The deprecated Tenancy bridge is removed; populated native adoption and historical facts remain supported. See [service integration](README.md).
