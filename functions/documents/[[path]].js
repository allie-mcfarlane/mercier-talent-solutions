const getPath = (params) => Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");

export async function onRequestGet(context) {
  const { env, params } = context;
  if (!env.MEDIA_BUCKET) return context.next();
  const relative = getPath(params).replace(/^\/+/, "");
  if (!relative || relative.includes("..")) return context.next();

  const object = await env.MEDIA_BUCKET.get(`documents/${relative}`);
  if (!object) return context.next();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-disposition", `inline; filename="${relative.split("/").at(-1) || "document.pdf"}"`);
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
