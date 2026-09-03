import { serveExistingPage } from "./_shared/live-render.js";

const ASSET_VERSION = "20260903-1020";

export async function onRequestGet(context) {
  const response = await serveExistingPage(context, "services");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on('link[href*="services-polish.css"]', {
      element(element) {
        element.setAttribute("href", `/services-polish.css?v=${ASSET_VERSION}`);
      },
    })
    .on('link[href*="services-final-fixes.css"]', {
      element(element) {
        element.setAttribute("href", `/services-final-fixes.css?v=${ASSET_VERSION}`);
      },
    })
    .on('link[href*="full-width-fixes.css"]', {
      element(element) {
        element.setAttribute("href", `/full-width-fixes.css?v=${ASSET_VERSION}`);
      },
    })
    .on('link[href*="live-content.css"]', {
      element(element) {
        element.setAttribute("href", `/live-content.css?v=${ASSET_VERSION}`);
      },
    })
    .transform(response);
}
