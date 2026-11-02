# Email templates

Email and printable documents share the JSON graph, editor, bindings, typed inputs, assets, reusable blocks and family lifecycle. Email uses the conservative `email-safe/1` profile, its own preset catalog and finalized HTML. A browser/Chromium preview is an authoring approximation; it does not certify an email client.

## Start and consume

```tsx
import { TemplateWorkspace } from '@nicolasvlachos/voucher-builder/template-creator'
import {
  createEmailTemplate, exportBindingDocument, exportSharedTemplateDocument,
  getEmailPresets, getEmailTemplateIssues, EMAIL_PROFILE,
} from '@nicolasvlachos/voucher-builder/template-renderer'

const document = exportBindingDocument(createEmailTemplate('Order notification'), {
  target: 'email', subject: 'Your order is ready', text: 'Your order is ready.',
})

<TemplateWorkspace initialDocument={document} onDraftChange={saveLocalDraft} onExport={consumeDocument} />
```

The callbacks above belong to the consuming application; the package sends no requests. Retain source JSON for editing; use the paired compiler/host resolver for runtime HTML. Use `exportSharedTemplateDocument` for repeaters, conditions and dynamic block properties, as with document templates. Draft/source exports preserve unfinished work; final email compilation rejects profile errors.

The demo is available at `?workspace=email`. `TemplateWorkspace` chooses the email catalog from the document's target. The direct Creator/Editor also select email controls using `previewTarget="email"`; their built-in HTML export finalizes email output. Preview transforms remain preview-only and do not alter saved source. Pure controller/render APIs remain generic HTML APIs; module compilation selects the actual output channel.

## Components and settings

The email catalog provides header, footer, section, button, spacer, divider, one-to-four columns, sidebar/content columns, headings, text, links, images, formatted values, lists, data tables, conditions and repeaters. Blocks remain ordinary portable graph nodes and canonical commands retain undo/guards.

- Email sections are presentation tables with content inside cells. Use them instead of HTML5 `section`, `article`, `header`, `footer` or `main` elements; those tags are outside this profile.
- Email column spacing is cell padding, with explicit percentage width/vertical alignment attributes. Reducing the column count preserves content in the last retained cell. `setColumnLayout(id, { stackOnMobile: false })` retains columns on small screens; the default is stacking at 480px where width queries work. Nested tables retain their own policy.
- Customer settings use the same declared/exposed field rules. Email accepts the profile's typography, color, alignment, padding, margin and corner-radius properties, with px, %, or unitless values. Width/height settings and document units are excluded; column widths remain explicit authoring controls.
- Paper dimensions and gap/display controls are omitted from normal email editing. Advanced JSON/CSS remains available to staff; unsupported changes remain editable but block final output. Reusable definitions, custom catalogs and family variations receive the same checks.
- `Email checks` reports errors and fallback warnings. Rounded corners, clipping, dark-mode colors and font metrics can differ between clients. Explicit empty image alt text is accepted for decorative images.

## CSS and output

The compiler creates a 600px presentation-table shell, moves essential CSS into inline styles, removes print geometry, and retains supported media rules in the head. The result is complete HTML; the email output's separate `css` field is empty. Clients ignoring responsive rules retain the desktop table layout.

The restricted CSS grammar supports element, class, ID, exact/existence attribute, descendant and child selectors. CSS selector namespaces, case flags, arbitrary pseudo-classes, nesting, flex/grid, positioning, layout functions, CSS variables, external stylesheets and font loading are outside the profile. Use px, %, and unitless values. CSS color functions are supported; gradients and `calc`/`min`/`max` are excluded.

Responsive rules must be top-level width queries and explicitly use `!important` to override inlined declarations:

```css
@media screen and (max-width:620px) {
  .message { font-size:18px!important; }
}
```

Static selectors respect specificity, source order, existing inline styles and importance. Inlining is bounded at 100,000 expanded declarations. The generated responsive column selector addresses each table's own cells, preserving nested policy. Finalization is idempotent. `data-email-shell` and `data-email-profile` belong to generated output and cannot be authored as source attributes.

## Media and links

Use retained PNG, JPEG or GIF assets for the baseline. WebP, SVG and managed fonts are excluded. The frontend may use local/private/data image URLs for preview; those URLs do not become delivery URLs. Shared runtime compilation accepts authorized CID mappings supplied by the host. Laravel resolves retained images to CID attachments and returns `inlineAssets`; the host must attach them with their exact content IDs. External delivery image URLs must be stable HTTPS destinations. Avoid expiring preview URLs and authentication-dependent links.

Links require absolute HTTP(S), mailto or tel destinations. Content and destination remain separate typed bindings, including value/link primitives. HTML-escaped values are substituted once. Essential text should remain understandable with images disabled. Supply both an HTML message and a deliberate plain-text alternative using the subject/text sidecars and the host mail adapter.

## Laravel and upgrades

Deploy the updated frontend compiler/worker and Laravel module together. No database migration is needed. The module bundles the same profile JSON and validates effective source after resource/family resolution, compiled binding artifacts, and resolved runtime output. Unsupported raw API HTML/CSS does not bypass the profile. The fixed binding engine stays native PHP; shared composition uses the existing configured compiler. PHP uses the existing `tijsverkoyen/css-to-inline-styles` dependency with an importance-aware inline merge. Sending, SMTP, attachments and provider configuration remain host responsibilities.

Existing email drafts remain editable. Imported/published legacy email output using unsupported CSS, HTML5 layout tags, print units or relative links may be rejected when exported, republished or rendered. Repair those templates using email sections, cell spacing and typed settings. Switching a printable template to Email reports incompatible content; it never silently rewrites the saved graph. Printable document behavior remains available under the document target.

The profile is shipped as `schemas/email-profile.v1.json` in the package and `resources/contracts/email-profile.v1.json` in the module. When changing it, update both copies; a contract regression verifies their equality. Use `getEmailTemplateIssues` and `getEmailSettingIssues` for host checks, and `EMAIL_PROFILE` to inspect the baseline/rules. Compatibility reports do not replace source/security validation.

## Qualification before sending

Test representative messages in Gmail, Apple Mail, Outlook web/new Outlook and classic Outlook for Windows, including mobile, dark mode, disabled images, long content and repeaters. Test the host's actual CID attachment and link handling. No real inbox-client screenshots or deliverability certification are provided by the local browser/test suite.

Primary references: [Gmail CSS support](https://developers.google.com/workspace/gmail/design/css), [Mailchimp email development guidance](https://templates.mailchimp.com/getting-started/html-email-basics/). MJML remains a possible future compiler adapter; it is not a dependency or stored source format in this implementation.
