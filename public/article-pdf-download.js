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

  const normalizeText = (value) =>
    (value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();

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

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const loadLogoDataUrl = async () => {
    const response = await fetch("/images/mercier-logo-color.png", {
      cache: "force-cache",
    });
    if (!response.ok) throw new Error("Logo could not be loaded for the PDF.");
    return blobToDataUrl(await response.blob());
  };

  const createArticlePdf = async (JsPDF) => {
    const article = document.querySelector("[data-article-body]");
    if (!article) throw new Error("Article content is unavailable.");

    const title =
      normalizeText(document.querySelector(".article-hero h1")?.textContent) ||
      "Article";
    const category =
      normalizeText(document.querySelector(".article-hero .pill")?.textContent) ||
      "Insight";
    const author = normalizeText(
      document.querySelector(".author-copy strong")?.textContent,
    );
    const role = normalizeText(
      document.querySelector(".author-copy span")?.textContent,
    );
    const date = normalizeText(
      document.querySelector(".article-meta time")?.textContent,
    );

    const logoDataUrl = await loadLogoDataUrl();
    const doc = new JsPDF({
      unit: "pt",
      format: "letter",
      orientation: "portrait",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 54;
    const topMargin = 54;
    const bottomMargin = 58;
    const contentWidth = pageWidth - marginX * 2;
    let y = topMargin;

    const drawFirstPageHeader = () => {
      const props = doc.getImageProperties(logoDataUrl);
      const logoWidth = 145;
      const rawHeight = logoWidth * (props.height / props.width);
      const logoHeight = Math.min(42, rawHeight);
      const logoY = 38;

      doc.addImage(
        logoDataUrl,
        "PNG",
        marginX,
        logoY,
        logoWidth,
        logoHeight,
      );

      const label = category.toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      const labelWidth = doc.getTextWidth(label);
      const boxWidth = labelWidth + 20;
      const boxHeight = 22;
      const boxX = pageWidth - marginX - boxWidth;
      const boxY = 41;

      doc.setDrawColor(69, 98, 142);
      doc.setLineWidth(0.7);
      doc.rect(boxX, boxY, boxWidth, boxHeight);
      doc.setTextColor(69, 98, 142);
      doc.text(label, boxX + 10, boxY + 14.5);

      const ruleY = Math.max(88, logoY + logoHeight + 14);
      doc.setDrawColor(221, 220, 215);
      doc.setLineWidth(0.7);
      doc.line(marginX, ruleY, pageWidth - marginX, ruleY);
      y = ruleY + 31;
    };

    drawFirstPageHeader();

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

    const writeBodyHeading = (text, size, before, after) => {
      writeLines(text, {
        size,
        style: "bold",
        color: [69, 98, 142],
        lineHeight: 1.38,
        before,
        after,
      });
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
    y += 6;

    const meta = [author, role, date].filter(Boolean).join(" · ");
    if (meta) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(102, 112, 124);
      doc.text(meta, marginX, y);
      y += 26;
    }

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

    const renderQuote = (node) => {
      const quote = normalizeText(node.textContent);
      if (!quote) return;

      y += 8;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(26, 43, 70);

      const lines = doc.splitTextToSize(quote, contentWidth - 28);
      const lineStep = 14.5;
      const ruleHeight = Math.max(12, (Math.max(0, lines.length - 1) * lineStep) + 10);
      ensureSpace(Math.min(ruleHeight + 18, pageHeight - topMargin - bottomMargin));

      const startY = y - 6;
      const availableRuleHeight = Math.max(0, pageHeight - bottomMargin - startY);
      doc.setDrawColor(69, 98, 142);
      doc.setLineWidth(2);
      doc.line(
        marginX,
        startY,
        marginX,
        startY + Math.min(ruleHeight, availableRuleHeight),
      );

      lines.forEach((line) => {
        ensureSpace(lineStep + 2);
        doc.text(line, marginX + 16, y);
        y += lineStep;
      });

      // Keep paragraph spacing outside the quote rule instead of extending the rule into it.
      y += 12;
    };

    const renderNode = (node) => {
      if (!(node instanceof HTMLElement)) return;

      if (node.classList.contains("references")) {
        renderReferences(node);
        return;
      }

      const tag = node.tagName.toLowerCase();

      if (tag === "h2") {
        writeBodyHeading(node.textContent, 11.5, 15, 9);
        return;
      }
      if (tag === "h3") {
        writeBodyHeading(node.textContent, 10.8, 13, 8);
        return;
      }
      if (tag === "h4") {
        writeBodyHeading(node.textContent, 10.2, 11, 7);
        return;
      }
      if (tag === "p") {
        writeLines(node.textContent, {
          size: 11,
          after: 9,
          lineHeight: 1.5,
        });
        return;
      }
      if (tag === "blockquote") {
        renderQuote(node);
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
      doc.setDrawColor(221, 220, 215);
      doc.setLineWidth(0.5);
      doc.line(marginX, pageHeight - 40, pageWidth - marginX, pageHeight - 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(145, 145, 145);
      doc.text(
        `Mercier Talent Solutions · ${page} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 25,
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
        if (typeof JsPDF !== "function") {
          throw new Error("PDF library failed to load.");
        }

        const { doc, title } = await createArticlePdf(JsPDF);
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