const CONTENT_TYPES = new Set(["page", "post", "whitepaper"]);

let schemaReadyPromise;

export const hasContentStore = (env) => Boolean(env?.CONTENT_DB);

export const validContentType = (type) => CONTENT_TYPES.has(String(type || ""));

export const validSlug = (slug) => /^[a-z0-9][a-z0-9-]{0,119}$/.test(String(slug || ""));

export const jsonResponse = (value, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });

export async function ensureContentSchema(env) {
  if (!hasContentStore(env)) return false;
  if (!schemaReadyPromise) {
    schemaReadyPromise = env.CONTENT_DB.batch([
      env.CONTENT_DB.prepare(`
        CREATE TABLE IF NOT EXISTS content_entries (
          type TEXT NOT NULL,
          slug TEXT NOT NULL,
          draft_data TEXT,
          draft_body TEXT,
          draft_html TEXT,
          draft_branch TEXT,
          published_data TEXT,
          published_body TEXT,
          published_html TEXT,
          updated_at TEXT NOT NULL,
          published_at TEXT,
          updated_by TEXT,
          PRIMARY KEY (type, slug)
        )
      `),
      env.CONTENT_DB.prepare("CREATE INDEX IF NOT EXISTS idx_content_entries_type ON content_entries(type)"),
      env.CONTENT_DB.prepare("CREATE INDEX IF NOT EXISTS idx_content_entries_branch ON content_entries(draft_branch)"),
      env.CONTENT_DB.prepare("CREATE INDEX IF NOT EXISTS idx_content_entries_published ON content_entries(type, published_at)"),
    ]).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  await schemaReadyPromise;
  return true;
}

const parseJson = (value) => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
};

export const rowToEntry = (row) => row ? ({
  type: row.type,
  slug: row.slug,
  draft: row.draft_data ? {
    data: parseJson(row.draft_data) || {},
    body: row.draft_body || "",
    html: row.draft_html || "",
    branch: row.draft_branch || "",
  } : null,
  published: row.published_data ? {
    data: parseJson(row.published_data) || {},
    body: row.published_body || "",
    html: row.published_html || "",
  } : null,
  updatedAt: row.updated_at || null,
  publishedAt: row.published_at || null,
  updatedBy: row.updated_by || null,
}) : null;

export async function getContentEntry(env, type, slug) {
  await ensureContentSchema(env);
  const row = await env.CONTENT_DB.prepare(`
    SELECT type, slug, draft_data, draft_body, draft_html, draft_branch,
           published_data, published_body, published_html,
           updated_at, published_at, updated_by
    FROM content_entries
    WHERE type = ?1 AND slug = ?2
    LIMIT 1
  `).bind(type, slug).first();
  return rowToEntry(row);
}

export async function getContentEntryByBranch(env, branch) {
  await ensureContentSchema(env);
  const row = await env.CONTENT_DB.prepare(`
    SELECT type, slug, draft_data, draft_body, draft_html, draft_branch,
           published_data, published_body, published_html,
           updated_at, published_at, updated_by
    FROM content_entries
    WHERE draft_branch = ?1
    LIMIT 1
  `).bind(branch).first();
  return rowToEntry(row);
}

export async function listContentEntries(env, type, publishedOnly = false) {
  await ensureContentSchema(env);
  const query = publishedOnly
    ? `SELECT type, slug, draft_data, draft_body, draft_html, draft_branch,
              published_data, published_body, published_html,
              updated_at, published_at, updated_by
       FROM content_entries
       WHERE type = ?1 AND published_data IS NOT NULL`
    : `SELECT type, slug, draft_data, draft_body, draft_html, draft_branch,
              published_data, published_body, published_html,
              updated_at, published_at, updated_by
       FROM content_entries
       WHERE type = ?1`;
  const result = await env.CONTENT_DB.prepare(query).bind(type).all();
  return (result.results || []).map(rowToEntry);
}

export async function saveDraft(env, { type, slug, data, body = "", html = "", branch = "", user = "" }) {
  await ensureContentSchema(env);
  const now = new Date().toISOString();
  await env.CONTENT_DB.prepare(`
    INSERT INTO content_entries (
      type, slug, draft_data, draft_body, draft_html, draft_branch,
      updated_at, updated_by
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(type, slug) DO UPDATE SET
      draft_data = excluded.draft_data,
      draft_body = excluded.draft_body,
      draft_html = excluded.draft_html,
      draft_branch = excluded.draft_branch,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).bind(type, slug, JSON.stringify(data || {}), String(body || ""), String(html || ""), String(branch || ""), now, user).run();
  return getContentEntry(env, type, slug);
}

export async function publishDraft(env, { type, slug, branch = "", data, body, html, user = "" }) {
  await ensureContentSchema(env);
  let targetType = type;
  let targetSlug = slug;
  let source = null;

  if (branch) {
    source = await getContentEntryByBranch(env, branch);
    targetType = source?.type;
    targetSlug = source?.slug;
  } else if (type && slug) {
    source = await getContentEntry(env, type, slug);
  }

  if (!targetType || !targetSlug) return null;

  const nextData = data ?? source?.draft?.data ?? source?.published?.data;
  const nextBody = body ?? source?.draft?.body ?? source?.published?.body ?? "";
  const nextHtml = html ?? source?.draft?.html ?? source?.published?.html ?? "";
  if (!nextData) return null;

  const now = new Date().toISOString();
  await env.CONTENT_DB.prepare(`
    INSERT INTO content_entries (
      type, slug, published_data, published_body, published_html,
      updated_at, published_at, updated_by
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
    ON CONFLICT(type, slug) DO UPDATE SET
      published_data = excluded.published_data,
      published_body = excluded.published_body,
      published_html = excluded.published_html,
      draft_data = NULL,
      draft_body = NULL,
      draft_html = NULL,
      draft_branch = NULL,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      updated_by = excluded.updated_by
  `).bind(targetType, targetSlug, JSON.stringify(nextData), String(nextBody || ""), String(nextHtml || ""), now, user).run();
  return getContentEntry(env, targetType, targetSlug);
}

export async function discardDraft(env, { type, slug, branch = "" }) {
  await ensureContentSchema(env);
  let targetType = type;
  let targetSlug = slug;
  if (branch) {
    const source = await getContentEntryByBranch(env, branch);
    targetType = source?.type;
    targetSlug = source?.slug;
  }
  if (!targetType || !targetSlug) return null;
  await env.CONTENT_DB.prepare(`
    UPDATE content_entries
    SET draft_data = NULL,
        draft_body = NULL,
        draft_html = NULL,
        draft_branch = NULL,
        updated_at = ?3
    WHERE type = ?1 AND slug = ?2
  `).bind(targetType, targetSlug, new Date().toISOString()).run();
  return getContentEntry(env, targetType, targetSlug);
}

export async function loadStaticSeed(env, request) {
  if (!env?.ASSETS) return { pages: [], posts: [], whitepapers: [] };
  try {
    const url = new URL("/content-seed.json", request.url);
    const response = await env.ASSETS.fetch(url);
    if (!response.ok) return { pages: [], posts: [], whitepapers: [] };
    return await response.json();
  } catch {
    return { pages: [], posts: [], whitepapers: [] };
  }
}

export const mergeSeedWithPublished = (seedItems = [], storedEntries = []) => {
  const map = new Map();
  for (const item of seedItems || []) {
    if (item?.slug) map.set(item.slug, { ...item, source: "static" });
  }
  for (const entry of storedEntries || []) {
    if (!entry?.slug || !entry.published) continue;
    map.set(entry.slug, {
      slug: entry.slug,
      data: entry.published.data || {},
      body: entry.published.body || "",
      html: entry.published.html || "",
      source: "d1",
      publishedAt: entry.publishedAt,
    });
  }
  return [...map.values()];
};
