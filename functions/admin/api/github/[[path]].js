import { hasR2S3, r2Delete, r2Get, r2List, r2Put } from "../../../_shared/r2-s3.js";

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

const getUser = (request) => {
  const email = (request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
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

const mediaRoute = (path) => {
  const prefix = `${REPOSITORY_PREFIX}/contents/public/`;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const [kind, ...parts] = rest.split("/");
  if (!['images', 'documents'].includes(kind)) return null;
  return { kind, key: parts.join("/"), repoPath: `public/${rest}` };
};

const safeMediaKey = (value) => Boolean(value) && !String(value).includes("..") && /^[a-zA-Z0-9._/-]+$/.test(String(value));

const mediaContentType = (kind, key) => {
  const lower = String(key || "").toLowerCase();
  if (kind === "documents") return lower.endsWith(".pdf") ? "application/pdf" : "";
  if (lower.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  return "";
};

const decodeBase64 = (input) => {
  const binary = atob(String(input || "").replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encodeBase64 = (bytes) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const syntheticMediaItem = (requestUrl, object) => {
  const name = object.key.split("/").at(-1) || object.key;
  const self = `${requestUrl.origin}/admin/api/github/${REPOSITORY_PREFIX}/contents/public/${object.key}`;
  return {
    name,
    path: `public/${object.key}`,
    sha: `r2-${object.etag || object.uploaded || name}`,
    size: object.size || 0,
    type: "file",
    url: self,
    html_url: "",
    git_url: "",
    download_url: `${requestUrl.origin}/${object.key}`,
    _links: { self, git: "", html: "" },
  };
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
  const user = getUser(request);

  if (!user) {
    return json({ message: "Access denied." }, 403);
  }

  if (request.headers.get("authorization") !== ACCESS_TOKEN) {
    return json({ message: "Invalid admin session." }, 401);
  }

  if (!env.GITHUB_ADMIN_TOKEN) {
    return json({ message: "Website publishing is not configured yet." }, 503);
  }

  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) {
    return json({ message: "Method not allowed." }, 405);
  }

  const path = getPath(params);
  if (!path || !allowedPath(path, method, requestUrl)) {
    return json({ message: "GitHub API route not allowed." }, 403);
  }

  if (!["GET", "HEAD"].includes(method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== requestUrl.origin) {
      return json({ message: "Cross-origin request blocked." }, 403);
    }
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

  const media = mediaRoute(path);
  if (media && media.key && hasR2S3(env) && method === "PUT") {
    if (!safeMediaKey(media.key)) return json({ message: "Invalid media path." }, 400);
    const contentType = mediaContentType(media.kind, media.key);
    if (!contentType) return json({ message: "Only website images and PDF documents are allowed." }, 415);
    let payload;
    try { payload = await request.json(); }
    catch { return json({ message: "Invalid media upload." }, 400); }
    let bytes;
    try { bytes = decodeBase64(payload?.content || ""); }
    catch { return json({ message: "Media file could not be read." }, 400); }
    if (bytes.byteLength > 25 * 1024 * 1024) return json({ message: "File is too large. Maximum size is 25 MB." }, 413);
    try {
      const uploaded = await r2Put(env, `${media.kind}/${media.key}`, bytes, { contentType });
      if (!uploaded.ok) return json({ message: `R2 upload failed (${uploaded.status}).` }, 502);
      const stamp = Date.now();
      const item = syntheticMediaItem(requestUrl, {
        key: `${media.kind}/${media.key}`,
        size: bytes.byteLength,
        uploaded: new Date().toISOString(),
        etag: String(stamp),
      });
      return json({ content: item, commit: { sha: `r2-${stamp}` } }, 201);
    } catch (error) {
      return json({ message: error?.message || "Media file could not be uploaded." }, 500);
    }
  }

  if (media && media.key && hasR2S3(env) && method === "DELETE") {
    let payload = {};
    try { payload = await request.json(); } catch {}
    if (String(payload?.sha || "").startsWith("r2-")) {
      try {
        const removed = await r2Delete(env, `${media.kind}/${media.key}`);
        if (!removed.ok && removed.status !== 404) return json({ message: `R2 delete failed (${removed.status}).` }, 502);
        return json({ content: null, commit: { sha: `r2-${Date.now()}` } });
      } catch (error) {
        return json({ message: error?.message || "Media file could not be deleted." }, 500);
      }
    }
  }

  if (media && media.key && hasR2S3(env) && method === "GET") {
    try {
      const stored = await r2Get(env, `${media.kind}/${media.key}`);
      if (stored.ok) {
        const bytes = new Uint8Array(await stored.arrayBuffer());
        const item = syntheticMediaItem(requestUrl, {
          key: `${media.kind}/${media.key}`,
          size: bytes.byteLength,
          uploaded: stored.headers.get("last-modified") || "",
          etag: (stored.headers.get("etag") || "").replace(/^"|"$/g, ""),
        });
        return json({ ...item, content: encodeBase64(bytes), encoding: "base64" });
      }
    } catch {}
  }

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

  const init = {
    method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(method)) {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch {
    return json({ message: "GitHub could not be reached." }, 502);
  }

  if (media && !media.key && method === "GET" && upstream.ok && hasR2S3(env)) {
    try {
      const existing = await upstream.clone().json();
      const map = new Map((Array.isArray(existing) ? existing : []).map((item) => [item.name, item]));
      const stored = await r2List(env, `${media.kind}/`, 500);
      for (const object of stored) {
        const relative = object.key.slice(`${media.kind}/`.length);
        if (!relative || relative.includes("/")) continue;
        const item = syntheticMediaItem(requestUrl, object);
        map.set(item.name, item);
      }
      return json([...map.values()]);
    } catch {
      // If R2 listing fails, keep the existing GitHub media library available.
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: copyResponseHeaders(upstream.headers, requestUrl),
  });
}
