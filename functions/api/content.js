import {
  getContentEntry,
  hasContentStore,
  jsonResponse,
  listContentEntries,
  validContentType,
  validSlug,
} from "../_shared/content-store.js";

export async function onRequestGet({ request, env }) {
  if (!hasContentStore(env)) {
    return jsonResponse({ configured: false, entry: null, entries: [] }, 200, {
      "Cache-Control": "public, max-age=5",
    });
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!validContentType(type)) return jsonResponse({ message: "Invalid content type." }, 400);

  try {
    if (slug) {
      if (!validSlug(slug)) return jsonResponse({ message: "Invalid content address." }, 400);
      const entry = await getContentEntry(env, type, slug);
      return jsonResponse({
        configured: true,
        entry: entry?.published ? {
          type: entry.type,
          slug: entry.slug,
          ...entry.published,
          publishedAt: entry.publishedAt,
        } : null,
      }, 200, { "Cache-Control": "public, max-age=2, must-revalidate" });
    }

    const entries = (await listContentEntries(env, type, true)).map((entry) => ({
      type: entry.type,
      slug: entry.slug,
      ...entry.published,
      publishedAt: entry.publishedAt,
    }));
    return jsonResponse({ configured: true, entries }, 200, {
      "Cache-Control": "public, max-age=2, must-revalidate",
    });
  } catch (error) {
    return jsonResponse({ message: error?.message || "Content could not be read." }, 500);
  }
}
