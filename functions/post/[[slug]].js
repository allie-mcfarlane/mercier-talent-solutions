import { serveLivePost } from "../_shared/live-render.js";

const getSlug = (params) => Array.isArray(params.slug) ? params.slug.join("/") : String(params.slug || "");

export function onRequestGet(context) {
  const slug = getSlug(context.params).replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/")) return context.next();
  return serveLivePost(context, slug);
}
