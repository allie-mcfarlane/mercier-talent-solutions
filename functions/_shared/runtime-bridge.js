import {
  getContentEntry,
  hasContentStore,
  listContentEntries,
  loadStaticSeed,
} from "./content-store.js";
import {
  serveCustomPage,
  serveExistingPage,
  serveLivePost,
} from "./live-render.js";

const SEED_KEYS = {
  page: "pages",
  post: "posts",
  whitepaper: "whitepapers",
};

const DATE_KEYS = new Set(["date", "pubDate"]);

const normalizeBody = (value = "") => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .trim();

const normalizeScalar = (value, key = "") => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return value;

  const text = value.replace(/\r\n?/g, "\n");
  if (DATE_KEYS.has(key) && text.trim()) {
    const date = new Date(text);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return text;
};

const subsetMatches = (published, seed, key = "") => {
  if (Array.isArray(published)) {
    if (!Array.isArray(seed) || published.length !== seed.length) return false;
    return published.every((value, index) => subsetMatches(value, seed[index], key));
  }

  if (published && typeof published === "object") {
    if (!seed || typeof seed !== "object" || Array.isArray(seed)) return false;
    return Object.keys(published).every((childKey) => {
      if (published[childKey] === undefined) return true;
      if (!Object.prototype.hasOwnProperty.call(seed, childKey)) return false;
      return subsetMatches(published[childKey], seed[childKey], childKey);
    });
  }

  const left = normalizeScalar(published, key);
  const right = normalizeScalar(seed, key);
  if (Object.is(left, right)) return true;
  if ((typeof left === "number" && typeof right === "string") || (typeof left === "string" && typeof right === "number")) {
    return String(left) === String(right);
  }
  return false;
};

export const publishedMatchesSeed = (published, seedEntry) => {
  if (!published || !seedEntry) return false;
  return subsetMatches(published.data || {}, seedEntry.data || {})
    && normalizeBody(published.body || "") === normalizeBody(seedEntry.body || "");
};

const parsedTime = (value) => {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : null;
};

export const runtimeEntryIsAhead = (entry, seedEntry, generatedAt) => {
  if (!entry?.published) return false;
  if (publishedMatchesSeed(entry.published, seedEntry)) return false;

  const publishedAt = parsedTime(entry.publishedAt);
  const builtAt = parsedTime(generatedAt);
  if (publishedAt !== null && builtAt !== null) return publishedAt > builtAt;

  // If either timestamp is unavailable, preserve the existing runtime behavior.
  return true;
};

const findSeedEntry = (seed, type, slug) => {
  const seedKey = SEED_KEYS[type];
  const values = Array.isArray(seed?.[seedKey]) ? seed[seedKey] : [];
  return values.find((item) => item?.slug === slug || item?.data?.slug === slug) || null;
};

const getEntrySafe = async (env, type, slug) => {
  try {
    return await getContentEntry(env, type, slug);
  } catch {
    return null;
  }
};

const listEntriesSafe = async (env, type) => {
  try {
    return await listContentEntries(env, type, true);
  } catch {
    return [];
  }
};

const pageHasPendingRuntime = async (context, seed, slug) => {
  const entry = await getEntrySafe(context.env, "page", slug);
  return runtimeEntryIsAhead(entry, findSeedEntry(seed, "page", slug), seed?.generatedAt);
};

const collectionHasPendingRuntime = async (context, seed, type) => {
  const entries = await listEntriesSafe(context.env, type);
  return entries.some((entry) => runtimeEntryIsAhead(
    entry,
    findSeedEntry(seed, type, entry.slug),
    seed?.generatedAt,
  ));
};

const staticAsset = (context) => {
  if (context.env?.ASSETS?.fetch) return context.env.ASSETS.fetch(context.request);
  return context.next();
};

export async function serveBridgedExistingPage(context, pageKey) {
  if (!hasContentStore(context.env)) return staticAsset(context);

  const seed = await loadStaticSeed(context.env, context.request);
  const checks = [pageHasPendingRuntime(context, seed, pageKey)];

  if (pageKey === "home") {
    checks.push(collectionHasPendingRuntime(context, seed, "post"));
    checks.push(pageHasPendingRuntime(context, seed, "services"));
  } else if (pageKey === "news") {
    checks.push(collectionHasPendingRuntime(context, seed, "post"));
  } else if (pageKey === "whitepapers") {
    checks.push(collectionHasPendingRuntime(context, seed, "whitepaper"));
  }

  const pending = (await Promise.all(checks)).some(Boolean);
  if (!pending) return staticAsset(context);
  return serveExistingPage(context, pageKey);
}

export async function serveBridgedPost(context, slug) {
  if (!hasContentStore(context.env)) return context.next();

  const seed = await loadStaticSeed(context.env, context.request);
  const [postEntry, aboutEntry] = await Promise.all([
    getEntrySafe(context.env, "post", slug),
    getEntrySafe(context.env, "page", "about"),
  ]);

  if (!postEntry?.published) return context.next();

  const postAhead = runtimeEntryIsAhead(
    postEntry,
    findSeedEntry(seed, "post", slug),
    seed?.generatedAt,
  );
  const authorDataAhead = runtimeEntryIsAhead(
    aboutEntry,
    findSeedEntry(seed, "page", "about"),
    seed?.generatedAt,
  );

  if (!postAhead && !authorDataAhead) return context.next();
  return serveLivePost(context, slug);
}

export async function serveBridgedCustomPage(context, slug) {
  if (!hasContentStore(context.env) || slug.includes(".")) return context.next();

  const seed = await loadStaticSeed(context.env, context.request);
  const entry = await getEntrySafe(context.env, "page", slug);
  if (!runtimeEntryIsAhead(entry, findSeedEntry(seed, "page", slug), seed?.generatedAt)) {
    return context.next();
  }
  return serveCustomPage(context, slug);
}
