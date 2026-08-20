const ACCESS_TOKEN = "token mts-cloudflare-access";
const ALLOWED_USERS = new Set([
  "allie@merciertalentsolutions.com",
  "julia@merciertalentsolutions.com",
]);
const MAX_BYTES = 25 * 1024 * 1024;

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

export async function onRequestGet({ request, env }) {
  const denied = authorize(request);
  if (denied) return denied;
  if (!env.MEDIA_BUCKET) return json({ configured: false, items: [], message: "R2 media storage is not configured yet." }, 503);

  const url = new URL(request.url);
  const prefix = cleanPath(url.searchParams.get("prefix") || "images/");
  try {
    const listed = await env.MEDIA_BUCKET.list({ prefix, limit: 500 });
    const items = listed.objects.map((object) => ({
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      url: object.key.startsWith("documents/")
        ? `/${object.key}`
        : `/media-store/${object.key}`,
    }));
    return json({ configured: true, items });
  } catch (error) {
    return json({ message: error?.message || "Media storage could not be read." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = authorize(request);
  if (denied) return denied;
  if (!env.MEDIA_BUCKET) return json({ configured: false, message: "R2 media storage is not configured yet." }, 503);

  const url = new URL(request.url);
  const path = cleanPath(url.searchParams.get("path") || request.headers.get("x-media-path"));
  if (!path || !allowedPath(path)) return json({ message: "Invalid media path." }, 400);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return json({ message: "File is too large. Maximum size is 25 MB." }, 413);

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const isPdf = path.startsWith("documents/") && contentType.includes("pdf");
  const isImage = path.startsWith("images/") && contentType.startsWith("image/");
  if (!isPdf && !isImage) return json({ message: "Only PDF documents and image files are allowed." }, 415);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return json({ message: "File is too large. Maximum size is 25 MB." }, 413);

  try {
    await env.MEDIA_BUCKET.put(path, bytes, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        uploadedBy: (request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase(),
      },
    });
    return json({
      configured: true,
      key: path,
      url: path.startsWith("documents/") ? `/${path}` : `/media-store/${path}`,
    }, 201);
  } catch (error) {
    return json({ message: error?.message || "File could not be uploaded." }, 500);
  }
}
