import { serveLivePost } from "../_shared/live-render.js";

const getSlug = (params) => Array.isArray(params.slug) ? params.slug.join("/") : String(params.slug || "");

const downloadScript = `
<script>
(() => {
  const button = document.querySelector(".live-article-actions [data-download-article]");
  if (!button || button.dataset.downloadReady === "true") return;
  button.dataset.downloadReady = "true";

  button.addEventListener("click", () => {
    const article = document.querySelector("[data-article-body]");
    if (!article) return;

    const title = document.querySelector(".article-hero h1")?.textContent?.trim() || "Article";
    const author = document.querySelector(".author-copy strong")?.textContent?.trim() || "";
    const role = document.querySelector(".author-copy span")?.textContent?.trim() || "";
    const date = document.querySelector(".article-meta time")?.textContent?.trim() || "";
    const escapeHtml = (value) => String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

    const fileContent = '<!doctype html>' +
      '<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' +
      'body{max-width:860px;margin:48px auto;padding:0 24px;color:#111;font-family:Arial,sans-serif;line-height:1.7}' +
      'h1{font-size:2.2rem;line-height:1.12;margin-bottom:12px}h2,h3{line-height:1.25}' +
      '.meta{color:#66707c;margin-bottom:32px}blockquote{margin:28px 0;border-left:3px solid #45628e;padding-left:18px;color:#1a2b46;font-size:1rem}' +
      'a{color:#1a2b46}.references{margin-top:40px;border-top:1px solid #dddcd7;padding-top:18px}' +
      '.references li{margin-bottom:8px;font-size:.85rem;font-style:italic;color:#6680a5}' +
      '</style></head><body>' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      '<p class="meta">' + escapeHtml(author) + (role ? ' · ' + escapeHtml(role) : '') + (date ? ' · ' + escapeHtml(date) : '') + '</p>' +
      article.innerHTML +
      '</body></html>';

    const blob = new Blob([fileContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "article";

    link.href = url;
    link.download = filename + ".html";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    const status = document.querySelector("[data-download-status]");
    if (status) status.textContent = "Article downloaded.";
  });
})();
</script>`;

export async function onRequestGet(context) {
  const slug = getSlug(context.params).replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("/")) return context.next();

  const response = await serveLivePost(context, slug);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on(".live-article-actions .article-action.primary", {
      element(element) {
        element.before('<button class="article-action" type="button" data-download-article>Download article</button>', { html: true });
      },
    })
    .on(".live-article-actions", {
      element(element) {
        element.append('<p class="download-status" aria-live="polite" data-download-status></p>' + downloadScript, { html: true });
      },
    })
    .transform(response);
}
