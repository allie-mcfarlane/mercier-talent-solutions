import { serveExistingPage } from "./_shared/live-render.js";

const safePostHref = (value = "") => {
  const href = String(value || "").trim();
  return /^\/post\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]+\/?$/.test(href) ? href : "/news/";
};

const homepageNewsStyles = `
<style>
  .news-band .news-list[data-news-carousel] {
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: flex-start !important;
    gap: clamp(1.5rem, 2vw, 2rem) !important;
    overflow-x: auto !important;
    scroll-snap-type: x mandatory;
  }

  .news-band .news-card {
    width: clamp(320px, 34vw, 460px) !important;
    min-width: 320px !important;
    min-height: 0 !important;
    height: auto !important;
    flex: 0 0 clamp(320px, 34vw, 460px) !important;
    align-self: flex-start !important;
    align-content: start !important;
    gap: 1rem !important;
    cursor: default;
  }

  .news-band .news-card:first-child {
    width: clamp(390px, 48vw, 650px) !important;
    min-width: 390px !important;
    flex-basis: clamp(390px, 48vw, 650px) !important;
  }

  .news-band .news-card h3,
  .news-band .news-card p,
  .news-band .news-card .news-author {
    text-decoration: none !important;
  }

  .news-band .news-author {
    gap: 0 !important;
    align-items: center;
  }

  .news-band .news-card.is-visible:hover {
    border-color: var(--color-line) !important;
    box-shadow: none !important;
    transform: none !important;
  }

  .news-band .home-news-read-more {
    display: inline-flex;
    width: max-content;
    align-items: center;
    gap: 0.65rem;
    margin-top: 0.25rem;
    border-bottom: 1px solid var(--color-blue-dark);
    padding-bottom: 0.35rem;
    color: var(--color-blue-dark);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    transition: gap 220ms var(--ease-soft), color 220ms ease, border-color 220ms ease;
  }

  .news-band .home-news-read-more:hover,
  .news-band .home-news-read-more:focus-visible {
    gap: 0.9rem;
    border-color: var(--color-blue);
    color: var(--color-blue);
  }

  @media (max-width: 700px) {
    .news-band .news-card,
    .news-band .news-card:first-child {
      width: min(86vw, 390px) !important;
      min-width: min(86vw, 320px) !important;
      flex-basis: min(86vw, 390px) !important;
    }
  }
</style>`;

export async function onRequestGet(context) {
  const response = await serveExistingPage(context, "home");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  // First pass: normalize every homepage news card to a non-linked article,
  // remember its destination, remove all legacy/duplicate Read more links,
  // and remove author thumbnails. This makes the operation idempotent.
  const normalized = new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(homepageNewsStyles, { html: true });
      },
    })
    .on(".news-band .news-card", {
      element(element) {
        if (element.tagName.toLowerCase() === "a") {
          const href = safePostHref(element.getAttribute("href"));
          element.tagName = "article";
          element.removeAttribute("href");
          element.setAttribute("data-post-href", href);
          return;
        }

        const existingHref = safePostHref(element.getAttribute("data-post-href"));
        element.setAttribute("data-post-href", existingHref);
      },
    })
    .on(".news-band .news-card .home-news-read-more", {
      element(element) {
        element.remove();
      },
    })
    .on(".news-band .news-card .read-more", {
      element(element) {
        element.remove();
      },
    })
    .on(".news-band .news-card .news-author img", {
      element(element) {
        element.remove();
      },
    })
    .transform(response);

  // Second pass: after every old/duplicate link is gone, add exactly one.
  return new HTMLRewriter()
    .on(".news-band .news-card", {
      element(element) {
        const href = safePostHref(element.getAttribute("data-post-href"));
        element.removeAttribute("data-post-href");
        element.append(
          `<a class="home-news-read-more" href="${href}">Read more <span aria-hidden="true">→</span></a>`,
          { html: true },
        );
      },
    })
    .transform(normalized);
}
