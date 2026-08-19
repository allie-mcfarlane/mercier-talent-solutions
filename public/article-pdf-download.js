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

  const loadJsPdf = () => {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-jspdf-loader]');
      if (existing) {
        if (window.jspdf?.jsPDF) {
          resolve(window.jspdf.jsPDF);
          return;
        }
        existing.addEventListener("load", () => resolve(window.jspdf?.jsPDF), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.async = true;
      script.dataset.jspdfLoader = "true";
      script.onload = () => resolve(window.jspdf?.jsPDF);
      script.onerror = reject;
      document.head.append(script);
    });
  };

  const normalizeText = (value) =>
    (value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();

  const createArticlePdf = (JsPDF) => {
    const article = document.querySelector("[data-article-body]");
    if (!article) throw new Error("Article content is unavailable.");

    const title = normalizeText(document.querySelector(".article-hero h1")?.textContent) || "Article";
    const author = normalizeText(document.querySelector(".author-copy strong")?.textContent);
    const role = normalizeText(document.querySelector(".author-copy span")?.textContent);
    const date = normalizeText(document.querySelector(".article-meta time")?.textContent);

    const doc = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 54;
    const topMargin = 58;
    const bottomMargin = 58;
    const contentWidth = pageWidth - marginX * 2;
    let y = topMargin;

    const ensureSpace = (heightNeeded = 18) => {
      if (y + heightNeeded <= pageHeight - bottomMargin) return;
      doc.addPage();
      y = topMargin;
    };

    const writeLines = (text, options = {}) => {
      const {
        size = 11,
        style = "normal",
        color = [17, 17, 17],
        lineHeight = 1.45,
        indent = 0,
        before = 0,
        after = 9,
        maxWidth = contentWidth - indent,
      } = options;

      const clean = normalizeText(text);
      if (!clean) return;

      y += before;
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);

      const lines = doc.splitTextToSize(clean, maxWidth);
      const lineStep = size * lineHeight;

      lines.forEach((line) => {
        ensureSpace(lineStep + 2);
        doc.text(line, marginX + indent, y);
        y += lineStep;
      });

      y += after;
    };

    const writeRule = () => {
      ensureSpace(16);
      doc.setDrawColor(221, 220, 215);
      doc.setLineWidth(0.7);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 16;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(title, contentWidth);
    titleLines.forEach((line) => {
      ensureSpace(28);
      doc.text(line, marginX, y);
      y += 27;
    });
    y += 4;

    const meta = [author, role, date].filter(Boolean).join(" · ");
    if (meta) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(102, 112, 124);
      doc.text(meta, marginX, y);
      y += 22;
    }

    writeRule();

    const renderList = (list, ordered = false) => {
      Array.from(list.children).forEach((item, index) => {
        const marker = ordered ? `${index + 1}.` : "•";
        const text = normalizeText(item.textContent);
        if (!text) return;
        ensureSpace(28);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(17, 17, 17);
        doc.text(marker, marginX + 4, y);
        const lines = doc.splitTextToSize(text, contentWidth - 28);
        lines.forEach((line, lineIndex) => {
          if (lineIndex > 0) ensureSpace(16);
          doc.text(line, marginX + 24, y);
          y += 16;
        });
        y += 5;
      });
      y += 3;
    };

    const renderReferences = (section) => {
      y += 14;
      writeRule();
      writeLines("REFERENCES", {
        size: 9,
        style: "bold",
        color: [69, 98, 142],
        lineHeight: 1.2,
        after: 10,
      });

      const items = section.querySelectorAll("li");
      items.forEach((item, index) => {
        const anchor = item.querySelector("a[href]");
        const text = normalizeText(anchor?.textContent || item.textContent);
        const url = anchor?.href || "";
        if (!text) return;

        ensureSpace(26);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.8);
        doc.setTextColor(102, 128, 165);
        doc.text(`${index + 1}.`, marginX + 2, y);

        const lines = doc.splitTextToSize(text, contentWidth - 26);
        lines.forEach((line) => {
          ensureSpace(13);
          doc.text(line, marginX + 20, y);
          y += 12.5;
        });

        if (url) {
          ensureSpace(14);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.4);
          doc.setTextColor(69, 98, 142);
          doc.textWithLink("Source", marginX + 20, y, { url });
          y += 13;
        }

        y += 5;
      });
    };

    const renderNode = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains("references")) {
        renderReferences(node);
        return;
      }

      const tag = node.tagName.toLowerCase();

      if (tag === "h2") {
        writeLines(node.textContent, { size: 17, style: "bold", before: 14, after: 10, lineHeight: 1.25 });
        return;
      }
      if (tag === "h3") {
        writeLines(node.textContent, { size: 14.5, style: "bold", before: 11, after: 9, lineHeight: 1.28 });
        return;
      }
      if (tag === "h4") {
        writeLines(node.textContent, { size: 12.5, style: "bold", before: 9, after: 7, lineHeight: 1.3 });
        return;
      }
      if (tag === "p") {
        writeLines(node.textContent, { size: 11, after: 9, lineHeight: 1.5 });
        return;
      }
      if (tag === "blockquote") {
        const quote = normalizeText(node.textContent);
        if (!quote) return;
        y += 8;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10.5);
        doc.setTextColor(26, 43, 70);
        const lines = doc.splitTextToSize(quote, contentWidth - 28);
        const lineStep = 15.5;
        const blockHeight = Math.max(26, lines.length * lineStep + 8);
        ensureSpace(Math.min(blockHeight, pageHeight - topMargin - bottomMargin));
        const startY = y - 6;
        doc.setDrawColor(69, 98, 142);
        doc.setLineWidth(2);
        doc.line(marginX, startY, marginX, startY + Math.min(blockHeight - 2, pageHeight - bottomMargin - startY));
        lines.forEach((line) => {
          ensureSpace(lineStep + 2);
          doc.text(line, marginX + 16, y);
          y += lineStep;
        });
        y += 10;
        return;
      }
      if (tag === "ul") {
        renderList(node, false);
        return;
      }
      if (tag === "ol") {
        renderList(node, true);
        return;
      }
      if (tag === "hr") {
        writeRule();
        return;
      }

      Array.from(node.children).forEach(renderNode);
    };

    Array.from(article.children).forEach(renderNode);

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(145, 145, 145);
      doc.text(
        `Mercier Talent Solutions · ${page} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 26,
        { align: "center" },
      );
    }

    return { doc, title };
  };

  button.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (button.disabled) return;
      button.disabled = true;
      setStatus("Preparing PDF…");

      try {
        const JsPDF = await loadJsPdf();
        if (typeof JsPDF !== "function") throw new Error("PDF library failed to load.");

        const { doc, title } = createArticlePdf(JsPDF);
        const filename = `${slugify(title)}.pdf`;
        const blob = doc.output("blob");

        if (!(blob instanceof Blob) || blob.size < 1000) {
          throw new Error("Generated PDF was unexpectedly empty.");
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        setStatus("PDF downloaded.");
      } catch (error) {
        console.error(error);
        setStatus("PDF download failed. Please try again.");
      } finally {
        button.disabled = false;
      }
    },
    { capture: true },
  );
})();