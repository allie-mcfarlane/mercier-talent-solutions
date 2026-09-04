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

const DATE_KEYS = new Set(["date", "pubDate", "updatedDate"]);

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

const normalizedPath = (path = "") => path.replace(/\[\d+\]/g, "[]");

const isSeedDefault = (path, value) => {
  const key = normalizedPath(path);
  if (key === "author" && value === "Julia Mercier") return true;
  if (key === "authorTitle" && value === "Principal") return true;
  if (key === "roles[].description" && Array.isArray(value) && value.length === 0) return true;
  if (key === "applicationForm.eyebrow" && value === "Apply") return true;
  if (key === "applicationForm.title" && value === "Submit your application") return true;
  if (key === "applicationForm.intro" && value === "") return true;
  if (key === "applicationForm.submitLabel" && value === "Submit application") return true;
  if (key === "applicationForm.fields" && Array.isArray(value) && value.length === 0) return true;
  if (key === "applicationForm.fields[].required" && value === false) return true;
  return false;
};

const valuesMatch = (published, seed, path = "", key = "") => {
  if (Array.isArray(published) || Array.isArray(seed)) {
    if (!Array.isArray(published) || !Array.isArray(seed) || published.length !== seed.length) return false;
    return published.every((value, index) => valuesMatch(value, seed[index], `${path}[${index}]`, key));
  }

  const publishedObject = published && typeof published === "object";
  const seedObject = seed && typeof seed === "object";
  if (publishedObject || seedObject) {
    if (!publishedObject || !seedObject) return false;
    const publishedKeys = Object.keys(published).filter((childKey) => published[childKey] !== undefined);
    const seedKeys = Object.keys(seed).filter((childKey) => seed[childKey] !== undefined);
    const keys = new Set([...publishedKeys, ...seedKeys]);

    for (const childKey of keys) {
      const childPath = path ? `${path}.${childKey}` : childKey;
      const hasPublished = Object.prototype.hasOwnProperty.call(published, childKey) && published[childKey] !== undefined;
      const hasSeed = Object.prototype.hasOwnProperty.call(seed, childKey) && seed[childKey] !== undefined;

      if (!hasPublished) {
        if (hasSeed && isSeedDefault(childPath, seed[childKey])) continue;
        return false;
      }
      if (!hasSeed) return false;
      if (!valuesMatch(published[childKey], seed[childKey], childPath, childKey)) return false;
    }
    return true;
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
  return valuesMatch(published.data || {}, seedEntry.data || {})
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

  // A built static entry is the safer steady-state source when an old D1 row
  // has no reliable publish timestamp. D1-only legacy content is preserved.
  if (seedEntry && builtAt !== null) return false;
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
