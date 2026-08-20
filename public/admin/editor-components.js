(() => {
  if (!window.CMS) return;

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  window.CMS.registerEditorComponent({
    id: "article-inline-image",
    label: "Insert Image",
    fields: [
      { name: "image", label: "Image", widget: "image" },
      { name: "alt", label: "Image description", widget: "string", required: false },
      { name: "caption", label: "Caption (optional)", widget: "string", required: false },
    ],
    pattern: /<figure class="article-inline-image"><img src="([^"]*)" alt="([^"]*)">(?:<figcaption>(.*?)<\/figcaption>)?<\/figure>/s,
    fromBlock(match) {
      return {
        image: match[1] || "",
        alt: match[2] || "",
        caption: match[3] || "",
      };
    },
    toBlock(data) {
      const image = escapeHtml(data.image || "");
      const alt = escapeHtml(data.alt || "");
      const caption = data.caption ? `<figcaption>${escapeHtml(data.caption)}</figcaption>` : "";
      return `<figure class="article-inline-image"><img src="${image}" alt="${alt}">${caption}</figure>`;
    },
    toPreview(data, getAsset) {
      const source = data.image ? getAsset(data.image) : "";
      const caption = data.caption ? `<figcaption style="margin-top:8px;color:#66707c;font-size:13px;line-height:1.5">${escapeHtml(data.caption)}</figcaption>` : "";
      return `<figure class="article-inline-image" style="margin:32px 0"><img src="${escapeHtml(source)}" alt="${escapeHtml(data.alt || "")}" style="display:block;width:100%;height:auto">${caption}</figure>`;
    },
  });
})();
