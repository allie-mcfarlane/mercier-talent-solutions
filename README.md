# Mercier Talent Solutions Website

This repository contains the rebuild of the Mercier Talent Solutions website.

The Wix Studio site is the source for copy, content, images, and design direction:

https://allie637.wixstudio.com/my-site

## Current Status

First build foundation and content migration in progress.

Included so far:

- Astro project setup
- Main page routes
- Shared header, footer, layout, and styles
- Homepage, About, Services, News & Insights, White Papers, contact, and privacy routes
- Wix reference imagery copied into `public/images`
- Current white paper PDFs copied into `public/documents`
- Markdown-backed News & Insights and White Paper collections
- Static post detail routes for current Wix feed entries with migrated article bodies
- Decap admin configuration for posts and white papers
- CMS-editable homepage content under `/admin/` → Site Pages → Home Page
- Responsive optimized image derivatives in `public/images/optimized`
- Contact and privacy forms wired with honeypots and Cloudflare Turnstile-ready markup
- Canonical, Open Graph, Twitter card, robots, sitemap, and redirect groundwork
- Starter documentation

## Commands

```bash
pnpm install
pnpm dev
pnpm build
```

## Content Rule

Do not rewrite, shorten, polish, or correct site wording unless the owner approves it. Possible copy issues belong in `CONTENT-AUDIT.md`.

## Admin And Blog Workflow

The admin area lives at `/admin/` and is configured with Decap CMS.

- News & Insights posts are Markdown files in `src/content/posts`.
- White papers are Markdown files in `src/content/white-papers`.
- Homepage copy is editable in `src/content/pages/home.md`.
- Uploaded images and documents go through the CMS media library.
- `publish_mode: editorial_workflow` keeps draft/review/publish stages available.
- Publishing through the CMS commits to `main`; the production deployment should rebuild automatically from GitHub once deployment is connected.

GitHub authentication/OAuth still needs to be completed before production admin publishing will work. The CMS config is ready for the existing GitHub repository and includes local preview styling that matches the site typography.

## Privacy Requirement

The site must include a visible privacy policy, privacy choices/opt-out page, and data requests/appeals page. The policy must show the month and year when it was last updated and disclose whether data is used for targeted advertising or large language model training.

The contact form submits to `julia@merciertalentsolutions.com`. The privacy choices and data requests forms submit to `allie@merciertalentsolutions.com` through FormSubmit. After the site is live, submit one test request from each form and confirm the email route.

Cloudflare Turnstile markup is in place. Add `PUBLIC_TURNSTILE_SITE_KEY` in the deployment environment to show the widget. Keep the Turnstile secret key out of this public repository.
