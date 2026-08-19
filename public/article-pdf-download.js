(() => {
  const button = document.querySelector("[data-download-article]");
  if (!(button instanceof HTMLButtonElement)) return;

  const status = document.querySelector("[data-download-status]");
  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const slugify = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "article";

  const loadHtml2Pdf = () => {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-html2pdf-loader]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.html2pdf), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.async = true;
      script.dataset.html2pdfLoader = "true";
      script.onload = () => resolve(window.html2pdf);
      script.onerror = reject;
      document.head.append(script);
    });
  };

  const ensurePdfStyles = () => {
    if (document.getElementById("article-pdf-export-styles")) return;

    const style = document.createElement("style");
    style.id = "article-pdf-export-styles";
    style.textContent = `
      .article-pdf-export {
        position: fixed;
        top: 0;
        left: -100000px;
        z-index: -1;
        width: 760px;
        padding: 0;
        background: #fff;
        color: #111;
        font-family: Arial, sans-serif;
        line-height: 1.65;
      }
      .article-pdf-export h1 {
        margin: 0 0 12px;
        color: #000;
        font-family: Arial, sans-serif;
        font-size: 30px;
        line-height: 1.12;
      }
      .article-pdf-export .pdf-meta {
        margin: 0 0 30px;
        color: #66707c;
        font-size: 13px;
      }
      .article-pdf-export .pdf-body {
        color: #111;
        font-size: 14px;
        line-height: 1.7;
      }
      .article-pdf-export .pdf-body p {
        margin: 0 0 15px;
      }
      .article-pdf-export .pdf-body h2,
      .article-pdf-export .pdf-body h3,
      .article-pdf-export .pdf-body h4 {
        break-after: avoid;
        color: #000;
        font-family: Arial, sans-serif;
        line-height: 1.2;
      }
      .article-pdf-export .pdf-body h2 { margin: 28px 0 12px; font-size: 23px; }
      .article-pdf-export .pdf-body h3 { margin: 24px 0 12px; font-size: 20px; }
      .article-pdf-export .pdf-body h4 { margin: 20px 0 10px; font-size: 17px; }
      .article-pdf-export .pdf-body blockquote {
        margin: 22px 0;
        border-left: 3px solid #45628e;
        padding: 2px 0 2px 16px;
        color: #1a2b46;
        font-size: 14px;
        line-height: 1.6;
        break-inside: avoid;
      }
      .article-pdf-export .pdf-body ul,
      .article-pdf-export .pdf-body ol {
        margin: 0 0 16px;
        padding-left: 22px;
      }
      .article-pdf-export .pdf-body li {
        margin-bottom: 6px;
      }
      .article-pdf-export .pdf-body a {
        color: #1a2b46;
        text-decoration: underline;
      }
      .article-pdf-export .references {
        margin-top: 34px;
        border-top: 1px solid #dddcd7;
        padding-top: 16px;
      }
      .article-pdf-export .references h2 {
        margin: 0 0 10px;
        color: #45628e;
        font-size: 12px;
        letter-spacing: 1.8px;
        text-transform: uppercase;
      }
      .article-pdf-export .references li {
        color: #6680a5;
        font-size: 11px;
        font-style: italic;
        line-height: 1.45;
      }
      .article-pdf-export .reference-marker {
        font-size: .7em;
        vertical-align: super;
      }
    `;
    document.head.append(style);
  };

  const buildPdfNode = () => {
    const article = document.querySelector("[data-article-body]");
    if (!article) return null;

    ensurePdfStyles();

    const title = document.querySelector(".article-hero h1")?.textContent?.trim() || "Article";
    const author = document.querySelector(".author-copy strong")?.textContent?.trim() || "";
    const role = document.querySelector(".author-copy span")?.textContent?.trim() || "";
    const date = document.querySelector(".article-meta time")?.textContent?.trim() || "";

    const root = document.createElement("section");
    root.className = "article-pdf-export";
    root.setAttribute("aria-hidden", "true");

    const heading = document.createElement("h1");
    heading.textContent = title;
    root.append(heading);

    const meta = document.createElement("p");
    meta.className = "pdf-meta";
    meta.textContent = [author, role, date].filter(Boolean).join(" · ");
    root.append(meta);

    const body = article.cloneNode(true);
    body.className = "pdf-body";
    root.append(body);

    document.body.append(root);
    return { root, title };
  };

  button.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (button.disabled) return;
      button.disabled = true;
      setStatus("Preparing PDF…");

      let exportNode;

      try {
        const html2pdf = await loadHtml2Pdf();
        if (typeof html2pdf !== "function") throw new Error("PDF library failed to load.");

        exportNode = buildPdfNode();
        if (!exportNode) throw new Error("Article content is unavailable.");

        const filename = `${slugify(exportNode.title)}.pdf`;

        await html2pdf()
          .set({
            margin: [0.55, 0.6, 0.65, 0.6],
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              backgroundColor: "#ffffff",
              logging: false,
            },
            jsPDF: {
              unit: "in",
              format: "letter",
              orientation: "portrait",
            },
            pagebreak: { mode: ["css", "legacy"] },
            enableLinks: true,
          })
          .from(exportNode.root)
          .save();

        setStatus("PDF downloaded.");
      } catch (error) {
        console.error(error);
        setStatus("PDF download failed. Please try again.");
      } finally {
        exportNode?.root?.remove();
        button.disabled = false;
      }
    },
    { capture: true },
  );
})();
