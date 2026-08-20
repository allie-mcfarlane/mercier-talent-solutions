const getPath = (params) => Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");

export async function onRequestGet({ env, params }) {
  if (!env.MEDIA_BUCKET) return new Response("Not found", { status: 404 });
  const path = getPath(params).replace(/^\/+/, "");
  if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

  const object = await env.MEDIA_BUCKET.get(path);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
