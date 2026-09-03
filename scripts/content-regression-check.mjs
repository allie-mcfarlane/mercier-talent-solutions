import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const liveRender = read('functions/_shared/live-render.js');
const homeRoute = read('functions/index.js');
const newsRoute = read('functions/news.js');
const postRoute = read('functions/post/[[slug]].js');
const whitepapersRoute = read('functions/whitepapers.js');
const servicesFixes = read('public/services-final-fixes.css');
const editorHtml = read('public/admin/editor/index.html');
const publishGuard = read('public/admin/editor/publish-guard.js');

// Publishing isolation: content collections must only be loaded by the pages that own them.
expect(
  liveRender.includes('["home", "news"].includes(pageKey) ? getMergedCollection(context, "post", "posts")'),
  'Post overrides are no longer isolated to Home and News.',
);
expect(
  liveRender.includes('pageKey === "whitepapers" ? getMergedCollection(context, "whitepaper", "whitepapers")'),
  'White paper overrides are no longer isolated to the White Papers page.',
);
expect(
  liveRender.includes('pageKey === "home" ? getPublishedOverride(context.env, "page", "services")'),
  'Services preview content is no longer isolated to Home.',
);
expect(newsRoute.includes('serveExistingPage(context, "news")'), 'News route no longer targets only the News page.');
expect(whitepapersRoute.includes('serveExistingPage(context, "whitepapers")'), 'White Papers route no longer targets only White Papers.');

// Homepage article cards: only Read more should be interactive and author thumbnails stay hidden.
expect(homeRoute.includes('element.tagName = "article"'), 'Homepage news cards can become whole-card links again.');
expect(homeRoute.includes('.news-band .news-card a'), 'Homepage news-card nested-link cleanup is missing.');
expect(homeRoute.includes('.news-band .news-card .news-author img'), 'Homepage news-card author-image cleanup is missing.');
expect(homeRoute.includes('class="home-news-read-more"'), 'Homepage news cards are missing the single Read more action.');

// Runtime article parity: Download must exist, PDF logic must load, and social preview must use the approved neutral image.
expect(postRoute.includes('data-download-article'), 'Runtime articles are missing Download article.');
expect(postRoute.includes('/article-pdf-download.js'), 'Runtime article PDF download code is not loaded.');
expect(postRoute.includes('/images/mts-mark.png'), 'Runtime social preview image is no longer the approved neutral Mercier image.');
expect(!postRoute.includes('/images/julia-mercier.jpg'), 'Runtime social preview route contains a Julia headshot fallback.');

// Services duplicate-number/shadow regression remains explicitly suppressed until source styles are consolidated.
expect(servicesFixes.includes('.service-number::before'), 'Services duplicate number-layer protection is missing.');
expect(servicesFixes.includes('text-shadow: none'), 'Services shadow-letter protection is missing.');

// Editor publish guard must be last in the data-layer chain and must prevent page-wide Advanced HTML injection.
expect(editorHtml.includes('/admin/editor/publish-guard.js'), 'Editor publishing safety guard is not loaded.');
expect(
  editorHtml.indexOf('/admin/editor/publish-guard.js') > editorHtml.indexOf('/admin/editor/access-fetch-fix.js'),
  'Editor publishing safety guard must load after the data/access fetch layers.',
);
expect(publishGuard.includes("type === 'html'"), 'Advanced HTML safety validation is missing.');
expect(publishGuard.includes("<(script|style|link|meta|base|iframe)"), 'Advanced HTML page-wide element blocking is missing.');
expect(publishGuard.includes("action === 'publish'"), 'Publish-time strict validation is missing.');
expect(publishGuard.includes("type === 'post'"), 'Article validation is missing.');
expect(publishGuard.includes("type === 'whitepaper'"), 'White paper validation is missing.');

if (failures.length) {
  console.error('\nContent regression checks failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Content regression checks passed. Article and white-paper publishing safeguards are present.');
