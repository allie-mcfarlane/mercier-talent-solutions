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
    align-items: stretch !important;
    gap: clamp(1.6rem, 2vw, 2rem) !important;
    overflow-x: auto !important;
    scroll-snap-type: x mandatory;
  }

  .news-band .news-card,
  .news-band .news-card:first-child {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: auto auto auto auto !important;
    width: clamp(360px, 29vw, 430px) !important;
    min-width: clamp(360px, 29vw, 430px) !important;
    height: auto !important;
    min-height: 520px !important;
    flex: 0 0 clamp(360px, 29vw, 430px) !important;
    align-self: stretch !important;
    align-content: start !important;
    column-gap: 1rem !important;
    row-gap: clamp(1.25rem, 1.6vw, 1.55rem) !important;
    padding: clamp(1.75rem, 2vw, 2rem) !important;
    cursor: default;
  }

  .news-band .news-card::after {
    display: none !important;
    content: none !important;
  }

  .news-band .news-card .pill {
    grid-column: 1 !important;
    grid-row: 1 !important;
    align-self: center !important;
    justify-self: start !important;
  }

  .news-band .news-author,
  .news-band .news-card .meta-row {
    display: block !important;
    grid-column: 2 !important;
    grid-row: 1 !important;
    align-self: center !important;
    justify-self: end !important;
    margin: 0 !important;
    padding: 0 !important;
    color: var(--color-muted) !important;
    font-size: 12.5px !important;
    font-weight: 700 !important;
    line-height: 1.35 !important;
    text-align: right !important;
    text-decoration: none !important;
    white-space: nowrap !important;
  }

  .news-band .news-author img {
    display: none !important;
  }

  .news-band .news-card h3,
  .news-band .news-card:first-child h3 {
    display: block !important;
    grid-column: 1 / -1 !important;
    grid-row: 2 !important;
    overflow: visible !important;
    margin: 0 !important;
    font-size: clamp(1.3rem, 1.45vw, 1.65rem) !important;
    line-height: 1.25 !important;
    text-decoration: none !important;
    -webkit-box-orient: initial !important;
    -webkit-line-clamp: unset !important;
  }

  .news-band .news-card > p {
    display: block !important;
    grid-column: 1 / -1 !important;
    grid-row: 3 !important;
    overflow: visible !important;
    margin: 0 !important;
    color: var(--color-muted) !important;
    font-size: 15.5px !important;
    line-height: 1.6 !important;
    text-decoration: none !important;
    -webkit-box-orient: initial !important;
    -webkit-line-clamp: unset !important;
  }

  .news-band .home-news-read-more {
    display: inline-flex;
    grid-column: 1 / -1 !important;
    grid-row: 4 !important;
    width: max-content;
    align-items: center;
    align-self: start !important;
    gap: 0.65rem;
    margin: 0.15rem 0 0 !important;
    border-bottom: 1px solid var(--color-blue-dark);
    padding-bottom: 0.35rem;
    color: var(--color-blue-dark);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none !important;
    transition: gap 220ms var(--ease-soft), color 220ms ease, border-color 220ms ease;
  }

  .news-band .home-news-read-more:hover,
  .news-band .home-news-read-more:focus-visible {
    gap: 0.9rem;
    border-color: var(--color-blue);
    color: var(--color-blue);
  }

  .news-band .news-card.is-visible:hover,
  .news-band .news-card:focus-within {
    border-color: var(--color-line) !important;
    box-shadow: none !important;
    transform: none !important;
  }

  @media (max-width: 700px) {
    .news-band .news-card,
    .news-band .news-card:first-child {
      width: min(84vw, 390px) !important;
      min-width: min(84vw, 390px) !important;
      height: auto !important;
      min-height: 500px !important;
      flex-basis: min(84vw, 390px) !important;
      column-gap: 0.75rem !important;
      row-gap: 1.2rem !important;
      padding: 1.5rem !important;
    }

    .news-band .news-author,
    .news-band .news-card .meta-row {
      font-size: 11.5px !important;
    }
  }
</style>`;

export async function onRequestGet(context) {
  const response = await serveExistingPage(context, "home");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  // Pass 1: normalize every card before adding the single final action.
  // The source card href is preserved on the card, every nested/legacy link
  // is removed, author thumbnails are removed, and homepage metadata is reduced
  // to the publication date so every current and future card uses one layout.
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
    .on(".news-band .news-card a", {
      element(element) {
        element.remove();
      },
    })
    .on(".news-band .news-card .news-author img", {
      element(element) {
        element.remove();
      },
    })
    .on(".news-band .news-card .news-author span", {
      text(text) {
        const value = String(text.text || "");
        const separator = value.indexOf("·");
        text.replace(separator >= 0 ? value.slice(separator + 1).trimStart() : value);
      },
    })
    .transform(response);

  // Pass 2: now that every prior link is gone, add exactly one Read more link.
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
