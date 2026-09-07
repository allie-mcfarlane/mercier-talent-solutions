import { serveBridgedExistingPage } from "./_shared/runtime-bridge.js";

export async function onRequestGet(context) {
  const response = await serveBridgedExistingPage(context, "news");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const articleHrefs = [];
  let linkIndex = 0;

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append('<link rel="stylesheet" href="/live-content.css"><script src="/category-pills.js" defer></script>', { html: true });
      },
    })
    .on(".other-news .news-item", {
      element(element) {
        if (element.tagName.toLowerCase() !== "a") {
          articleHrefs.push("");
          return;
        }

        articleHrefs.push(element.getAttribute("href") || "");
        element.tagName = "article";
        element.removeAttribute("href");
      },
    })
    .on(".other-news .news-item .pill", {
      element(element) {
        const classes = (element.getAttribute("class") || "pill").split(/\s+/).filter(Boolean);
        if (!classes.includes("live-article-pill")) classes.push("live-article-pill");
        element.setAttribute("class", classes.join(" "));
      },
    })
    .on(".other-news .news-item .item-link", {
      element(element) {
        const href = articleHrefs[linkIndex] || "";
        linkIndex += 1;

        if (element.tagName.toLowerCase() !== "a") {
          element.tagName = "a";
          if (href) element.setAttribute("href", href);
        }
      },
    })
    .transform(response);
}
