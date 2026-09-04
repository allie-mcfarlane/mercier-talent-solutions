import { serveLivePost } from "../_shared/live-render.js";

const ASSET_VERSION = "20260903-1020";
const getSlug = (params) => Array.isArray(params.slug) ? params.slug.join("/") : String(params.slug || "");

export async function onRequestGet(context) {
  const slug = getSlug(context.params).replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/")) return context.next();

  const response = await serveLivePost(context, slug);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const socialImage = new URL("/images/mts-mark.png", context.request.url).toString();
  const socialImageAlt = "Mercier Talent Solutions";
  let ogImageSeen = false;
  let ogSecureImageSeen = false;
  let ogImageAltSeen = false;
  let twitterImageSeen = false;
  let twitterImageAltSeen = false;

  return new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(element) {
        if (ogImageSeen) {
          element.remove();
          return;
        }
        ogImageSeen = true;
        element.setAttribute("content", socialImage);
      },
    })
    .on('meta[property="og:image:secure_url"]', {
      element(element) {
        if (ogSecureImageSeen) {
          element.remove();
          return;
        }
        ogSecureImageSeen = true;
        element.setAttribute("content", socialImage);
      },
    })
    .on('meta[property="og:image:alt"]', {
      element(element) {
        if (ogImageAltSeen) {
          element.remove();
          return;
        }
        ogImageAltSeen = true;
        element.setAttribute("content", socialImageAlt);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(element) {
        if (twitterImageSeen) {
          element.remove();
          return;
        }
        twitterImageSeen = true;
        element.setAttribute("content", socialImage);
      },
    })
    .on('meta[name="twitter:image:alt"]', {
      element(element) {
        if (twitterImageAltSeen) {
          element.remove();
          return;
        }
        twitterImageAltSeen = true;
        element.setAttribute("content", socialImageAlt);
      },
    })
    .on("head", {
      element(element) {
        element.append(`<script src="/article-pdf-download.js?v=${ASSET_VERSION}" defer></script><script src="/category-pills.js?v=${ASSET_VERSION}" defer></script>`, { html: true });
      },
    })
    .on('link[href*="article-final-fixes.css"]', {
      element(element) {
        element.setAttribute("href", `/article-final-fixes.css?v=${ASSET_VERSION}`);
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
    .on('script[src*="article-pdf-download.js"]', {
      element(element) {
        element.setAttribute("src", `/article-pdf-download.js?v=${ASSET_VERSION}`);
      },
    })
    .on('script[src*="category-pills.js"]', {
      element(element) {
        element.setAttribute("src", `/category-pills.js?v=${ASSET_VERSION}`);
      },
    })
    .transform(response);
}
