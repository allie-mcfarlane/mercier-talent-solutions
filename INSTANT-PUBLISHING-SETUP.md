# Instant Publishing Setup

The visual editor now supports near-instant publishing through Cloudflare D1 and R2. GitHub remains the source of truth for website code and design, while routine page, Blog Post and White Paper content can publish without rebuilding the Astro site.

## Cloudflare resources

Create these resources in the same Cloudflare account as the Pages project:

1. D1 database: `mercier-website-content`
2. R2 bucket: `mercier-website-media`

No manual database tables are required. The Pages Functions create the content tables automatically on first use.

## Pages bindings

In Workers & Pages > mercier-talent-solutions > Settings > Bindings add:

- D1 database binding
  - Variable name: `CONTENT_DB`
  - Database: `mercier-website-content`
- R2 bucket binding
  - Variable name: `MEDIA_BUCKET`
  - Bucket: `mercier-website-media`

Add both bindings to Production. If Preview is used for testing, add the same binding names there as well.

After adding or changing bindings, redeploy the current `main` deployment once so the Functions receive them.

## Publishing behavior

When `CONTENT_DB` is available:

- Save Draft stores the private draft in D1.
- Publish copies the draft to the published D1 content immediately.
- Routine page and article publishing does not create a GitHub content branch or require a Cloudflare production rebuild.
- Existing Astro content remains the fallback until an item has been published through the visual editor.
- New Blog Posts published through the editor are served dynamically at `/post/<slug>/`.
- New one-segment visual-builder pages are served dynamically at `/<slug>/`.

When `MEDIA_BUCKET` is available:

- New White Paper PDF uploads are stored in R2.
- `/documents/...` serves R2 PDFs first and falls back to existing static PDFs.
- R2 image assets can be served through `/media-store/...` or the `/images/...` fallback route where applicable.

If the D1 binding is missing, the editor intentionally falls back to the previous GitHub publishing workflow so existing editing is not broken during setup.

## Security

The D1 and R2 write APIs are under `/admin/api/` and require both Cloudflare Access identity and the existing Mercier admin session token. Only the two approved Mercier editor email addresses are accepted. D1 and R2 credentials are bindings and must never be committed to GitHub.
