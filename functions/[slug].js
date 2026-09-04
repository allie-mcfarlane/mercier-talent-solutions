import { serveBridgedCustomPage } from "./_shared/runtime-bridge.js";

export function onRequestGet(context) {
  const slug = String(context.params.slug || "").replace(/^\/+|\/+$/g, "");
  return serveBridgedCustomPage(context, slug);
}
