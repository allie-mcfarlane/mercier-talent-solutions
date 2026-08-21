import { hasR2S3, r2Get } from "../_shared/r2-s3.js";

const getPath = (params) => Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");

const responseFromS3 = (response) => {
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: 200, headers });
};

export async function onRequestGet({ env, params }) {
  const path = getPath(params).replace(/^\/+/, "");
  if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

  if (env.MEDIA_BUCKET) {
    const object = await env.MEDIA_BUCKET.get(path);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=0, must-revalidate");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  }

  if (!hasR2S3(env)) return new Response("Not found", { status: 404 });
  try {
    const response = await r2Get(env, path);
    if (response.status === 404) return new Response("Not found", { status: 404 });
    if (!response.ok) return new Response("Media unavailable", { status: 502 });
    return responseFromS3(response);
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
}
