import { serveExistingPage } from "./_shared/live-render.js";

export function onRequestGet(context) {
  return serveExistingPage(context, "data-requests");
}
