import { getAccessEmail } from "../../../_shared/access-user.js";

const REPOSITORY = "allie-mcfarlane/mercier-talent-solutions";
const REPOSITORY_PREFIX = `repos/${REPOSITORY}`;
const ACCESS_TOKEN = "token mts-cloudflare-access";

const ALLOWED_USERS = new Map([
  ["allie@merciertalentsolutions.com", { login: "allie-mcfarlane", name: "Allie McFarlane" }],
  ["julia@merciertalentsolutions.com", { login: "julia", name: "Julia Mercier" }],
]);

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const getUser = async (request) => {
  const email = await getAccessEmail(request);
  const user = ALLOWED_USERS.get(email);
  return user ? { ...user, email } : null;
};

const getPath = (params) => {
  const value = params.path;
  if (Array.isArray(value)) return value.join("/");
  return typeof value === "string" ? value : "";
};

const isRepositorySearch = (url) => {
  const query = (url.searchParams.get("q") || "").toLowerCase();
  return query.includes(`repo:${REPOSITORY}`.toLowerCase());
};

const allowedPath = (path, method, url) => {
  if (path === "user") return method === "GET";
  if (path === "search/issues") return method === "GET" && isRepositorySearch(url);
  return path === REPOSITORY_PREFIX || path.startsWith(`${REPOSITORY_PREFIX}/`);
};

const copyResponseHeaders = (upstreamHeaders, requestUrl) => {
  const headers = new Headers();
  const allowed = [
    "content-type",
    "etag",
    "last-modified",
    "link",
    "location",
    "x-github-media-type",
    "x-poll-interval",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "x-ratelimit-resource",
    "x-ratelimit-used",
  ];
  const proxyRoot = `${requestUrl.origin}/admin/api/github`;

  for (const name of allowed) {
    const value = upstreamHeaders.get(name);
    if (!value) continue;
    const rewritten = name === "link" || name === "location"
      ? value.replaceAll("https://api.github.com", proxyRoot)
      : value;
    headers.set(name, rewritten);
  }

  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
};

export async function onRequest({ request, env, params }) {
  const method = request.method.toUpperCase();
  const requestUrl = new URL(request.url);
  const user = await getUser(request);

  if (!user) return json({ message: "Access denied." }, 403);
  if (request.headers.get("authorization") !== ACCESS_TOKEN) return json({ message: "Invalid admin session." }, 401);
  if (!env.GITHUB_ADMIN_TOKEN) return json({ message: "Website publishing is not configured yet." }, 503);
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) return json({ message: "Method not allowed." }, 405);

  const path = getPath(params);
  if (!path || !allowedPath(path, method, requestUrl)) return json({ message: "GitHub API route not allowed." }, 403);

  if (!["GET", "HEAD"].includes(method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== requestUrl.origin) return json({ message: "Cross-origin request blocked." }, 403);
  }

  if (path === "user" && method === "GET") {
    return json({
      login: user.login,
      name: user.name,
      email: user.email,
      id: user.login === "allie-mcfarlane" ? 1 : 2,
      avatar_url: `${requestUrl.origin}/images/mercier-logo-color.png`,
      type: "User",
      site_admin: false,
    });
  }

  // Website media is deliberately stored in the repository under public/images
  // and public/documents. Keeping media on the same secure GitHub publishing
  // bridge means uploads continue to work even when R2 is unavailable.
  const upstreamUrl = `https://api.github.com/${path}${requestUrl.search}`;
  const headers = new Headers();
  headers.set("Accept", request.headers.get("accept") || "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${env.GITHUB_ADMIN_TOKEN}`);
  headers.set("User-Agent", "Mercier-Talent-Solutions-Admin");
  headers.set("X-GitHub-Api-Version", "2022-11-28");

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  for (const conditionalHeader of ["if-match", "if-none-match"]) {
    const value = request.headers.get(conditionalHeader);
    if (value) headers.set(conditionalHeader, value);
  }

  const init = { method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(method)) init.body = await request.arrayBuffer();

  let upstream;
  try { upstream = await fetch(upstreamUrl, init); }
  catch { return json({ message: "GitHub could not be reached." }, 502); }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: copyResponseHeaders(upstream.headers, requestUrl),
  });
}
