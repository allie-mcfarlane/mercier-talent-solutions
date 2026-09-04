import {
  discardDraft,
  getContentEntry,
  getContentEntryByBranch,
  hasContentStore,
  jsonResponse,
  listContentEntries,
  publishDraft,
  saveDraft,
  validContentType,
  validSlug,
} from "../../_shared/content-store.js";
import { authorizeAdminRequest } from "../../_shared/admin-session.js";

const authorize = async (request, env) => {
  const auth = await authorizeAdminRequest(request, env);
  if (!auth.ok) {
    return { ok: false, response: jsonResponse({ message: auth.message }, auth.status) };
  }
  return { ok: true, email: auth.user.email };
};

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return auth.response;
  if (!hasContentStore(env)) {
    return jsonResponse({ configured: false, message: "D1 content publishing is not configured yet." }, 503);
  }

  const url = new URL(request.url);
  const branch = (url.searchParams.get("branch") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();

  try {
    if (branch) {
      const entry = await getContentEntryByBranch(env, branch);
      return jsonResponse({ configured: true, entry });
    }
    if (!validContentType(type)) return jsonResponse({ message: "Invalid content type." }, 400);
    if (slug) {
      if (!validSlug(slug)) return jsonResponse({ message: "Invalid content address." }, 400);
      const entry = await getContentEntry(env, type, slug);
      return jsonResponse({ configured: true, entry });
    }
    const entries = await listContentEntries(env, type, false);
    return jsonResponse({ configured: true, entries });
  } catch (error) {
    return jsonResponse({ message: error?.message || "Content storage could not be read." }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return auth.response;
  if (!hasContentStore(env)) {
    return jsonResponse({ configured: false, message: "D1 content publishing is not configured yet." }, 503);
  }

  let payload;
  try { payload = await request.json(); }
  catch { return jsonResponse({ message: "Invalid request body." }, 400); }

  const action = String(payload?.action || "draft");
  const type = String(payload?.type || "");
  const slug = String(payload?.slug || "");
  const branch = String(payload?.branch || "");

  try {
    if (action === "publish" && branch) {
      const entry = await publishDraft(env, { branch, user: auth.email });
      if (!entry) return jsonResponse({ message: "Saved draft not found." }, 404);
      return jsonResponse({ configured: true, entry, published: true });
    }

    if (!validContentType(type)) return jsonResponse({ message: "Invalid content type." }, 400);
    if (!validSlug(slug)) return jsonResponse({ message: "Invalid content address." }, 400);

    if (action === "publish") {
      const entry = await publishDraft(env, {
        type,
        slug,
        data: payload?.data || {},
        body: payload?.body || "",
        html: payload?.html || "",
        user: auth.email,
      });
      return jsonResponse({ configured: true, entry, published: true });
    }

    if (action !== "draft") return jsonResponse({ message: "Unsupported content action." }, 400);

    const entry = await saveDraft(env, {
      type,
      slug,
      data: payload?.data || {},
      body: payload?.body || "",
      html: payload?.html || "",
      branch,
      user: auth.email,
    });
    return jsonResponse({ configured: true, entry, published: false });
  } catch (error) {
    return jsonResponse({ message: error?.message || "Content could not be saved." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return auth.response;
  if (!hasContentStore(env)) {
    return jsonResponse({ configured: false, message: "D1 content publishing is not configured yet." }, 503);
  }
  const url = new URL(request.url);
  const branch = (url.searchParams.get("branch") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const slug = (url.searchParams.get("slug") || "").trim();
  try {
    const entry = await discardDraft(env, { branch, type, slug });
    return jsonResponse({ configured: true, entry });
  } catch (error) {
    return jsonResponse({ message: error?.message || "Draft could not be cleared." }, 500);
  }
}
