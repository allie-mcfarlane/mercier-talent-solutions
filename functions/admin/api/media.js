const ACCESS_TOKEN = "token mts-cloudflare-access";
const REPOSITORY = "allie-mcfarlane/mercier-talent-solutions";
const BRANCH = "main";
const ALLOWED_USERS = new Set([
  "allie@merciertalentsolutions.com",
  "julia@merciertalentsolutions.com",
]);
const MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

const authorize = (request) => {
  const email = (request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
  if (!ALLOWED_USERS.has(email)) return json({ message: "Access denied." }, 403);
  if (request.headers.get("authorization") !== ACCESS_TOKEN) return json({ message: "Invalid admin session." }, 401);
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin && origin !== requestUrl.origin) return json({ message: "Cross-origin request blocked." }, 403);
  return null;
};

const cleanPath = (value) => String(value || "")
  .replace(/^\/+/, "")
  .replace(/\\/g, "/")
  .split("/")
  .filter((part) => part && part !== "." && part !== "..")
  .join("/");

const allowedPath = (path) =>
  /^documents\/[a-zA-Z0-9._/-]+$/.test(path) ||
  /^images\/[a-zA-Z0-9._/-]+$/.test(path);

const mediaUrl = (key) => `/${key}`;

const githubHeaders = (env) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${env.GITHUB_ADMIN_TOKEN}`,
  "User-Agent": "Mercier-Talent-Solutions-Admin",
  "X-GitHub-Api-Version": "2022-11-28",
});

const githubContentsUrl = (repoPath, ref = "") => {
  const base = `https://api.github.com/repos/${REPOSITORY}/contents/${repoPath}`;
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
};

const encodeBase64 = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const getExisting = async (env, repoPath) => {
  const response = await fetch(githubContentsUrl(repoPath, BRANCH), {
    headers: githubHeaders(env),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Website media could not be checked (${response.status}).`);
  return response.json();
};

const listDirectory = async (env, prefix) => {
  const trimmed = prefix.replace(/\/+$/, "");
  const repoPath = `public/${trimmed || "images"}`;
  const response = await fetch(githubContentsUrl(repoPath, BRANCH), {
    headers: githubHeaders(env),
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Website media could not be read (${response.status}).`);
  const items = await response.json();
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.type === "file")
    .map((item) => ({
      key: item.path.replace(/^public\//, ""),
      size: item.size || 0,
      uploaded: null,
      url: mediaUrl(item.path.replace(/^public\//, "")),
    }));
};

export async function onRequestGet({ request, env }) {
  const denied = authorize(request);
  if (denied) return denied;
  if (!env.GITHUB_ADMIN_TOKEN) {
    return json({ configured: false, items: [], message: "Website media publishing is not configured yet." }, 503);
  }

  const url = new URL(request.url);
  const prefix = cleanPath(url.searchParams.get("prefix") || "images/");
  if (!prefix || !/^(images|documents)(\/|$)/.test(prefix)) {
    return json({ message: "Invalid media folder." }, 400);
  }

  try {
    const items = await listDirectory(env, prefix);
    return json({ configured: true, storage: "github", items });
  } catch (error) {
    return json({ message: error?.message || "Media storage could not be read." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = authorize(request);
  if (denied) return denied;
  if (!env.GITHUB_ADMIN_TOKEN) {
    return json({ configured: false, message: "Website media publishing is not configured yet." }, 503);
  }

  const url = new URL(request.url);
  const path = cleanPath(url.searchParams.get("path") || request.headers.get("x-media-path"));
  if (!path || !allowedPath(path)) return json({ message: "Invalid media path." }, 400);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return json({ message: "File is too large. Maximum size is 25 MB." }, 413);

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const isPdf = path.startsWith("documents/") && path.toLowerCase().endsWith(".pdf") && (contentType.includes("pdf") || contentType === "application/octet-stream");
  const isImage = path.startsWith("images/") && IMAGE_EXTENSIONS.test(path) && (contentType.startsWith("image/") || contentType === "application/octet-stream");
  if (!isPdf && !isImage) return json({ message: "Only PDF documents and image files are allowed." }, 415);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return json({ message: "File is too large. Maximum size is 25 MB." }, 413);

  const repoPath = `public/${path}`;
  try {
    const existing = await getExisting(env, repoPath);
    const payload = {
      message: existing ? `Replace website media: ${path}` : `Upload website media: ${path}`,
      content: encodeBase64(bytes),
      branch: BRANCH,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    };

    const response = await fetch(githubContentsUrl(repoPath), {
      method: "PUT",
      headers: {
        ...githubHeaders(env),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = `Website media upload failed (${response.status}).`;
      try {
        const details = await response.json();
        if (details?.message) message = details.message;
      } catch {}
      throw new Error(message);
    }

    return json({
      configured: true,
      storage: "github",
      key: path,
      url: mediaUrl(path),
    }, 201);
  } catch (error) {
    return json({ message: error?.message || "File could not be uploaded." }, 500);
  }
}
