# Maintenance

This site should be updated through this GitHub repository.

Routine future workflow:

1. Pull the latest repository version.
2. Make the requested website change.
3. Preserve existing wording and images unless the owner approves a change.
4. Run a build check.
5. Commit with a clear message.
6. Push to GitHub.
7. Confirm the GitHub Actions build check passes.
8. Let the connected hosting service publish the update.

Never place private keys, passwords, email-service secrets, or Cloudflare Turnstile secret keys in the public site files.

## Privacy Compliance

The site must include visible privacy links, a privacy policy with a last-updated month and year, a privacy choices page for targeted advertising opt-out requests, and a clear way for visitors to submit privacy requests and appeals.

The privacy choices and data requests forms submit to `allie@merciertalentsolutions.com` through FormSubmit. After launch, send one test request from each form and click any FormSubmit confirmation email if prompted.

The contact form submits to `julia@merciertalentsolutions.com` through FormSubmit. Cloudflare Turnstile is ready to activate with `PUBLIC_TURNSTILE_SITE_KEY`; server-side token verification still depends on the final hosting/form handling choice.

Before launch, confirm:

- Whether the site uses visitor data for targeted advertising.
- Whether the site collects, uses, or sells personal data for large language model training.
- Whether any analytics or advertising tools need opt-out controls.
