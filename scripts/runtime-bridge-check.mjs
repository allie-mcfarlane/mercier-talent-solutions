import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const {
  publishedMatchesSeed,
  runtimeEntryIsAhead,
} = await import('../functions/_shared/runtime-bridge.js');

const seedEntry = {
  slug: 'sample',
  data: {
    title: 'Sample',
    pubDate: '2026-09-01T00:00:00.000Z',
    category: 'Insight',
    author: 'Julia Mercier',
    authorTitle: 'Principal',
  },
  body: 'Body copy\n',
};
const matchingPublished = {
  data: {
    title: 'Sample',
    pubDate: '2026-09-01',
    category: 'Insight',
  },
  body: 'Body copy',
};

assert.equal(publishedMatchesSeed(matchingPublished, seedEntry), true, 'date normalization and real Astro schema defaults should still match');
assert.equal(publishedMatchesSeed({ ...matchingPublished, data: { ...matchingPublished.data, title: 'Changed' } }, seedEntry), false, 'changed published data must not match the built seed');
assert.equal(
  publishedMatchesSeed(matchingPublished, { ...seedEntry, data: { ...seedEntry.data, subtitle: 'Old subtitle' } }),
  false,
  'removing an optional published field must remain an instant D1 change until the build catches up',
);
assert.equal(
  publishedMatchesSeed(
    { data: { title: 'Careers', applicationForm: {} }, body: '' },
    { data: { title: 'Careers', applicationForm: { eyebrow: 'Apply', title: 'Submit your application', intro: '', submitLabel: 'Submit application', fields: [] } }, body: '' },
  ),
  true,
  'nested Astro application-form defaults should not keep D1 rendering active after the repository build matches',
);

const newerMismatch = {
  published: { ...matchingPublished, data: { ...matchingPublished.data, title: 'Newer' } },
  publishedAt: '2026-09-04T12:00:10.000Z',
};
const olderMismatch = {
  published: { ...matchingPublished, data: { ...matchingPublished.data, title: 'Older' } },
  publishedAt: '2026-09-04T11:59:50.000Z',
};
const builtAt = '2026-09-04T12:00:00.000Z';

assert.equal(runtimeEntryIsAhead(newerMismatch, seedEntry, builtAt), true, 'newer D1 content must bridge instantly while Astro is behind');
assert.equal(runtimeEntryIsAhead(olderMismatch, seedEntry, builtAt), false, 'older D1 content must never override a newer Astro build');
assert.equal(runtimeEntryIsAhead({ published: matchingPublished, publishedAt: '2026-09-04T12:00:10.000Z' }, seedEntry, builtAt), false, 'matching built content must fall back to Astro even when D1 has a later timestamp');
assert.equal(runtimeEntryIsAhead(newerMismatch, null, builtAt), true, 'new D1 content absent from the current build must bridge when it is newer');
assert.equal(runtimeEntryIsAhead(olderMismatch, null, builtAt), false, 'stale timestamped D1 content absent from a newer build must not be resurrected');
assert.equal(
  runtimeEntryIsAhead({ published: { ...matchingPublished, data: { ...matchingPublished.data, title: 'Legacy mismatch' } }, publishedAt: null }, seedEntry, builtAt),
  false,
  'an un-timestamped legacy D1 row must not override an existing newer static entry',
);
assert.equal(
  runtimeEntryIsAhead({ published: { ...matchingPublished, data: { ...matchingPublished.data, title: 'Legacy D1 only' } }, publishedAt: null }, null, builtAt),
  true,
  'legacy D1-only content without a timestamp must remain available until it is reconciled into the repository',
);

const routeExpectations = new Map([
  ['functions/about.js', 'serveBridgedExistingPage'],
  ['functions/contactus.js', 'serveBridgedExistingPage'],
  ['functions/data-requests.js', 'serveBridgedExistingPage'],
  ['functions/privacy.js', 'serveBridgedExistingPage'],
  ['functions/privacy-choices.js', 'serveBridgedExistingPage'],
  ['functions/services.js', 'serveBridgedExistingPage'],
  ['functions/news.js', 'serveBridgedExistingPage'],
  ['functions/whitepapers.js', 'serveBridgedExistingPage'],
  ['functions/index.js', 'serveBridgedExistingPage'],
  ['functions/post/[[slug]].js', 'serveBridgedPost'],
  ['functions/[slug].js', 'serveBridgedCustomPage'],
]);

for (const [path, helper] of routeExpectations) {
  const source = read(path);
  assert.match(source, /runtime-bridge\.js/, `${path} must use the D1 runtime bridge`);
  assert.ok(source.includes(helper), `${path} must call ${helper}`);
  assert.doesNotMatch(source, /from\s+["'].*live-render\.js["']/, `${path} must not bypass the bridge with a direct live-render import`);
}

const bridgeSource = read('functions/_shared/runtime-bridge.js');
assert.match(bridgeSource, /pageKey === "home"[\s\S]*"post"[\s\S]*"services"/, 'home must bridge page, post and services dependencies');
assert.match(bridgeSource, /pageKey === "news"[\s\S]*"post"/, 'news must bridge pending posts');
assert.match(bridgeSource, /pageKey === "whitepapers"[\s\S]*"whitepaper"/, 'whitepapers must bridge pending papers');
assert.match(bridgeSource, /getEntrySafe\(context\.env, "page", "about"\)/, 'article bridge must retain instant About/team author updates for D1-managed posts');
assert.match(bridgeSource, /return staticAsset\(context\)/, 'caught-up existing pages must return the built Astro asset');
assert.match(bridgeSource, /return context\.next\(\)/, 'caught-up post and custom-page routes must fall through to Astro');
assert.match(bridgeSource, /return serveExistingPage\(context, pageKey\)/, 'pending page content must retain instant D1 rendering');
assert.match(bridgeSource, /return serveLivePost\(context, slug\)/, 'pending posts must retain instant D1 rendering');
assert.match(bridgeSource, /return serveCustomPage\(context, slug\)/, 'pending custom pages must retain instant D1 rendering');
assert.match(bridgeSource, /if \(seedEntry && builtAt !== null\) return false;/, 'legacy rows with an existing built entry must fail safely to Astro when publish time is unknown');

console.log(`Runtime bridge checks passed for ${routeExpectations.size} public routes from ${root}. D1 remains the instant-update bridge while caught-up requests fall back to Astro.`);
