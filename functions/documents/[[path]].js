import { hasR2S3, r2Get } from "../_shared/r2-s3.js";

const getPath = (params) => Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");

const responseFromS3 = (response, relative) => {
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (relative.toLowerCase().endsWith(".pdf")) headers.set("content-type", "application/pdf");
  headers.set("cache-control", "no-store");
  headers.set("content-disposition", `inline; filename="${relative.split("/").at(-1) || "document.pdf"}"`);
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: 200, headers });
};

// The published Astro build is the source of truth for documents committed
// to the repository. Older R2 copies must not shadow updated PDFs at the same URL.
const staticPdfResponse = async (context, relative) => {
  if (!relative.toLowerCase().endsWith(".pdf") || !context.env?.ASSETS?.fetch) return null;
  try {
    const asset = await context.env.ASSETS.fetch(context.request);
    if (!asset.ok || !/application\/pdf/i.test(asset.headers.get("content-type") || "")) return null;
    const headers = new Headers(asset.headers);
    headers.set("content-type", "application/pdf");
    headers.set("cache-control", "no-store");
    headers.set("content-disposition", `inline; filename="${relative.split("/").at(-1) || "document.pdf"}"`);
    headers.set("x-content-type-options", "nosniff");
    return new Response(asset.body, { status: asset.status, headers });
  } catch {
    return null;
  }
};

export async function onRequestGet(context) {
  const { env, params } = context;
  const relative = getPath(params).replace(/^\/+/, "");
  if (!relative || relative.includes("..")) return context.next();
  // The original Coaching Dividend URL must keep working after its revision.
  // Its revised PDF also exists under the new asset address. Route the old
  // public address to that verified copy instead of loading legacy R2 bytes.
  if (relative === "the-coaching-dividend-white-paper-1.pdf") {
    const revised = new URL("/documents/the-coaching-dividend.pdf", context.request.url);
    return Response.redirect(revised.toString(), 302);
  }

  const builtPdf = await staticPdfResponse(context, relative);
  if (builtPdf) return builtPdf;

  if (env.MEDIA_BUCKET) {
    const object = await env.MEDIA_BUCKET.get(`documents/${relative}`);
    if (!object) return context.next();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (relative.toLowerCase().endsWith(".pdf")) headers.set("content-type", "application/pdf");
    headers.set("cache-control", "no-store");
    headers.set("content-disposition", `inline; filename="${relative.split("/").at(-1) || "document.pdf"}"`);
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  }

  if (!hasR2S3(env)) return context.next();
  try {
    const response = await r2Get(env, `documents/${relative}`);
    if (response.status === 404) return context.next();
    if (!response.ok) return context.next();
    return responseFromS3(response, relative);
  } catch {
    return context.next();
  }
}
