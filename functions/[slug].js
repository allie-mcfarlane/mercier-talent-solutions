import { serveCustomPage } from "./_shared/live-render.js";

export function onRequestGet(context) {
  const slug = String(context.params.slug || "").replace(/^\/+|\/+$/g, "");
  return serveCustomPage(context, slug);
}
