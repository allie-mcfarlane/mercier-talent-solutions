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

export async function onRequestGet(context) {
  const relative = getPath(context.params).replace(/^\/+/, "");
  if (!relative || relative.includes("..")) return context.next();

  if (context.env.MEDIA_BUCKET) {
    const object = await context.env.MEDIA_BUCKET.get(`images/${relative}`);
    if (!object) return context.next();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=0, must-revalidate");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  }

  if (!hasR2S3(context.env)) return context.next();
  try {
    const response = await r2Get(context.env, `images/${relative}`);
    if (response.status === 404) return context.next();
    if (!response.ok) return context.next();
    return responseFromS3(response);
  } catch {
    return context.next();
  }
}
