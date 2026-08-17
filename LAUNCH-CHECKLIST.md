# Launch Checklist

This checklist tracks the remaining work before replacing the Wix site. Do not change GoDaddy DNS or retire Wix until every launch item is complete.

## Repository And Build

- [x] Existing GitHub repository is the source of truth.
- [x] Local production build passes.
- [x] GitHub Actions build check is configured.
- [ ] Confirm the GitHub Actions build passes on `main` after each push.
- [ ] Connect the production host to this GitHub repository.
- [ ] Confirm the production host builds with `pnpm install --frozen-lockfile` and `pnpm build`.

## Admin Publishing

- [x] `/admin/` is configured with Decap CMS.
- [x] Main pages, privacy pages, News & Insights, and White Papers are editable through the CMS config.
- [x] Admin preview styling is configured.
- [x] `/admin/` is blocked from search indexing.
- [ ] Connect production GitHub authentication/OAuth for Decap CMS.
- [ ] Test logging into `/admin/` on the production domain.
- [ ] Create a draft blog post in `/admin/`.
- [ ] Publish the draft and confirm it creates a GitHub commit.
- [ ] Confirm the production deployment rebuilds after the CMS commit.

## Forms And Privacy

- [x] Contact form is connected to `julia@merciertalentsolutions.com`.
- [x] Privacy Choices form is connected to `allie@merciertalentsolutions.com`.
- [x] Data Requests & Appeals form is connected to `allie@merciertalentsolutions.com`.
- [x] Honeypot fields are included.
- [x] Browser privacy preference signals are included in form submissions.
- [ ] Submit a live test through the contact form.
- [ ] Submit a live test through the Privacy Choices form.
- [ ] Submit a live test through the Data Requests & Appeals form.
- [ ] Complete any FormSubmit email confirmations required for each recipient.
- [ ] Finalize whether any site data is used for targeted advertising.
- [ ] Finalize whether any personal data is collected, used, or sold for large language model training.
- [ ] Finalize Connecticut privacy compliance language with owner/legal review.

## Cloudflare Turnstile

- [x] Turnstile-ready widget markup is present.
- [ ] Create Cloudflare Turnstile site key for the production domain.
- [ ] Add `PUBLIC_TURNSTILE_SITE_KEY` to the production host environment.
- [ ] Confirm the Turnstile widget appears on production forms.
- [ ] Choose the final form/backend handling path for server-side token verification.
- [ ] Add server-side Turnstile token verification.

## Domain Cutover

- [ ] Confirm the production deployment URL works.
- [ ] Confirm redirects work from legacy paths.
- [ ] Confirm sitemap and robots are reachable.
- [ ] Confirm final desktop, tablet, and mobile review.
- [ ] Confirm GoDaddy DNS target values from the production host.
- [ ] Schedule DNS cutover.
- [ ] Update GoDaddy DNS.
- [ ] Confirm `https://merciertalentsolutions.com` loads the new site.
- [ ] Confirm SSL certificate is active.
- [ ] Keep Wix online until the new domain resolves reliably.
- [ ] Retire Wix only after final approval.
