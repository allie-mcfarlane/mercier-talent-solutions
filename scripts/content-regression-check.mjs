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
const staticWhitepapers = read('src/pages/whitepapers.astro');
const staticServices = read('src/pages/services.astro');
const visualPageEdits = read('src/components/VisualPageEdits.astro');
const categoryPills = read('public/category-pills.js');
const servicesFixes = read('public/services-final-fixes.css');
const editorHtml = read('public/admin/editor/index.html');
const directCanvas = read('public/admin/editor/direct-canvas.js');
const publishGuard = read('public/admin/editor/publish-guard.js');
const repositorySync = read('public/admin/editor/repository-sync.js');

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
expect(!liveRender.includes('/images/julia-mercier.jpg'), 'Runtime rendering contains a Julia headshot fallback.');

// Category parity: all supported article categories must map to their dedicated site pill classes.
expect(liveRender.includes('Announcement: "pill-announcement"'), 'Runtime Announcement category styling is missing.');
expect(liveRender.includes('News: "pill-news"'), 'Runtime News category styling is missing.');
expect(categoryPills.includes("Announcement: 'pill-announcement'"), 'Fallback Announcement pill normalization is missing.');
expect(categoryPills.includes("News: 'pill-news'"), 'Fallback News pill normalization is missing.');
expect(newsRoute.includes('/category-pills.js'), 'News route is missing fallback category normalization.');
expect(postRoute.includes('/category-pills.js'), 'Article route is missing fallback category normalization.');

// Runtime article parity: source renderer owns actions; route wrapper only loads supporting assets.
expect(liveRender.includes('data-download-article'), 'Runtime article source is missing Download article.');
expect(liveRender.includes('data-download-status'), 'Runtime article source is missing Download status feedback.');
expect(postRoute.includes('/article-pdf-download.js'), 'Runtime article PDF download code is not loaded.');
expect(!postRoute.includes('.live-article-actions [data-download-article]'), 'Article route is rebuilding the Download action instead of using source markup.');
expect(!postRoute.includes('.live-article-actions [data-download-status]'), 'Article route is rebuilding Download status instead of using source markup.');
expect(liveRender.includes('/images/mts-mark.png'), 'Runtime article source is missing the approved neutral social image.');
expect(postRoute.includes('/images/mts-mark.png'), 'Runtime article route is missing neutral social-image enforcement.');
expect(!postRoute.includes('/images/julia-mercier.jpg'), 'Runtime social preview route contains a Julia headshot fallback.');

// White-paper body formatting must remain rendered in both static Astro and runtime paths.
expect(liveRender.includes('paper.html || paragraphs(paper.body || "")'), 'Runtime white-paper body formatting can be flattened again.');
expect(liveRender.includes('<div class="paper-body">${bodyHtml}</div>'), 'Runtime white-paper body container no longer preserves rendered content.');
expect(staticWhitepapers.includes('(await paper.render()).Content'), 'Static White Papers no longer render Markdown through Astro content.');
expect(staticWhitepapers.includes('<Content />'), 'Static White Papers are missing rendered body content.');
expect(!staticWhitepapers.includes('<p class="paper-body">{paper.body}</p>'), 'Static White Papers can flatten Markdown to raw text again.');

// Visual editor formatting should survive nearby DOM changes by recovering the unique saved source record.
expect(visualPageEdits.includes('const matchingRecord = (scope, element, index)'), 'Public visual formatting no longer recovers from text-index shifts.');
expect(visualPageEdits.includes('matches.length === 1 ? matches[0] : null'), 'Public visual formatting source matching is not ambiguity-safe.');
expect(directCanvas.includes('const matchingRecord = (scope, element, index)'), 'Editor preview formatting no longer recovers from text-index shifts.');
expect(directCanvas.includes('const matched = matchingRecord(scope, element, index);'), 'Editor selection editing does not reuse the recovered formatting record.');

// Services numbers must render once from source; no later stylesheet should have to hide a duplicate layer.
expect(!staticServices.includes('.service-number::before'), 'Services source can render a duplicate number layer again.');
expect(staticServices.includes('text-shadow: none;'), 'Services source no longer explicitly prevents shadowed number lettering.');
expect(!servicesFixes.includes('main .service-number::before'), 'Services final-fixes stylesheet still hides a source-level duplicate number layer.');
expect(!servicesFixes.includes('main .service-number {'), 'Services final-fixes stylesheet still contains obsolete number suppression.');

// Editor publishing order: D1 direct publishing must capture the validated repository-sync fetch chain.
expect(editorHtml.includes('/admin/editor/repository-sync.js'), 'Repository synchronization is not loaded in the editor.');
expect(editorHtml.includes('/admin/editor/publish-guard.js'), 'Editor publishing safety guard is not loaded.');
expect(editorHtml.includes('/admin/editor/editor-d1-direct.js'), 'D1 direct publishing layer is not loaded in the editor.');
expect(
  editorHtml.indexOf('/admin/editor/access-fetch-fix.js') < editorHtml.indexOf('/admin/editor/repository-sync.js'),
  'Access credentials wrapper must load before repository synchronization.',
);
expect(
  editorHtml.indexOf('/admin/editor/repository-sync.js') < editorHtml.indexOf('/admin/editor/publish-guard.js'),
  'Repository synchronization must be wrapped by publish validation.',
);
expect(
  editorHtml.indexOf('/admin/editor/publish-guard.js') < editorHtml.indexOf('/admin/editor/editor-d1-direct.js'),
  'D1 publishing must load after and capture the validation/repository synchronization chain.',
);
expect(repositorySync.includes("String(payload.action || 'draft') !== 'publish'"), 'Repository synchronization is not restricted to publishing.');
expect(repositorySync.includes('loadDraft(String(payload.branch), sourceHeaders)'), 'Branch publishing no longer verifies the stored draft before repository synchronization.');
expect(repositorySync.includes('if (!repositoryResult.ok)'), 'Repository synchronization failure no longer blocks publication.');
expect(repositorySync.includes("if (type === 'post') return `src/content/posts/${slug}.md`;"), 'Blog post repository synchronization path is missing.');
expect(repositorySync.includes("if (type === 'whitepaper') return `src/content/white-papers/${slug}.md`;"), 'White paper repository synchronization path is missing.');
expect(repositorySync.includes("if (type === 'page') return `src/content/pages/${slug}.md`;"), 'Page repository synchronization path is missing.');
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

console.log('Content regression checks passed. Static/runtime parity, Services source cleanup, visual edit recovery, repository synchronization, and publishing safeguards are present.');
