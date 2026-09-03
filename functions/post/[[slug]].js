import { serveLivePost } from "../_shared/live-render.js";

const getSlug = (params) => Array.isArray(params.slug) ? params.slug.join("/") : String(params.slug || "");

export async function onRequestGet(context) {
  const slug = getSlug(context.params).replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/")) return context.next();

  const response = await serveLivePost(context, slug);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append('<script src="/article-pdf-download.js" defer></script>', { html: true });
      },
    })
    .on(".live-article-actions [data-download-article]", {
      element(element) {
        element.remove();
      },
    })
    .on(".live-article-actions [data-download-status]", {
      element(element) {
        element.remove();
      },
    })
    .on(".live-article-actions .article-action.primary", {
      element(element) {
        element.before('<button class="article-action" type="button" data-download-article>Download article</button>', { html: true });
      },
    })
    .on(".live-article-actions", {
      element(element) {
        element.append('<p class="download-status" aria-live="polite" data-download-status></p>', { html: true });
      },
    })
    .transform(response);
}
