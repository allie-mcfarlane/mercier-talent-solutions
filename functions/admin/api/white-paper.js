import { ensureContentSchema, hasContentStore, validSlug } from "../../_shared/content-store.js";
import { authorizeAdminRequest } from "../../_shared/admin-session.js";

const REPOSITORY = "allie-mcfarlane/mercier-talent-solutions";
const BRANCH = "main";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

const githubHeaders = (env) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${env.GITHUB_ADMIN_TOKEN}`,
  "User-Agent": "Mercier-Talent-Solutions-Admin",
  "X-GitHub-Api-Version": "2022-11-28",
});

const contentsUrl = (slug) =>
  `https://api.github.com/repos/${REPOSITORY}/contents/src/content/white-papers/${encodeURIComponent(slug)}.md`;

export async function onRequestDelete({ request, env }) {
  const auth = await authorizeAdminRequest(request, env);
  if (!auth.ok) return json({ message: auth.message }, auth.status);
  if (!env.GITHUB_ADMIN_TOKEN) {
    return json({ message: "Website publishing is not configured yet." }, 503);
  }

  const url = new URL(request.url);
  const slug = String(url.searchParams.get("slug") || "").trim().toLowerCase();
  if (!validSlug(slug)) return json({ message: "Invalid White Paper address." }, 400);

  let githubDeleted = false;
  let d1Deleted = false;

  try {
    const existingResponse = await fetch(`${contentsUrl(slug)}?ref=${encodeURIComponent(BRANCH)}`, {
      headers: githubHeaders(env),
    });

    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      const deleteResponse = await fetch(contentsUrl(slug), {
        method: "DELETE",
        headers: {
          ...githubHeaders(env),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Delete White Paper: ${slug}`,
          sha: existing.sha,
          branch: BRANCH,
        }),
      });

      if (!deleteResponse.ok) {
        let message = `White Paper could not be deleted (${deleteResponse.status}).`;
        try {
          const details = await deleteResponse.json();
          if (details?.message) message = details.message;
        } catch {}
        return json({ message }, deleteResponse.status);
      }
      githubDeleted = true;
    } else if (existingResponse.status !== 404) {
      return json({ message: `White Paper could not be checked (${existingResponse.status}).` }, existingResponse.status);
    }

    if (hasContentStore(env)) {
      await ensureContentSchema(env);
      const result = await env.CONTENT_DB.prepare(
        "DELETE FROM content_entries WHERE type = 'whitepaper' AND slug = ?1"
      ).bind(slug).run();
      d1Deleted = Number(result?.meta?.changes || 0) > 0;
    }

    if (!githubDeleted && !d1Deleted) {
      return json({ message: "White Paper was not found." }, 404);
    }

    return json({ deleted: true, slug, githubDeleted, d1Deleted });
  } catch (error) {
    return json({ message: error?.message || "White Paper could not be deleted." }, 500);
  }
}
