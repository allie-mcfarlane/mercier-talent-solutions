(() => {
  const pageKey = () => {
    const hash = window.location.hash || "";
    const match = hash.match(/^#\/collections\/pages\/entries\/([^/?]+)/);
    if (match) return match[1];
    if (/^#\/collections\/posts\/(entries\/|new)/.test(hash)) return "blog-post";
    return null;
  };

  const maps = {
    home: [
      [".hero", 0],
      [".proof, .marquee-band", 1],
      [".approach", 2],
      [".news-band", 3],
    ],
    about: [
      [".about-hero", 0],
      [".firm-band", 1],
      [".team-band", 2],
    ],
    "services-page": [
      [".services-hero", 0],
      [".coaching-focus, .focus-list", 1],
      [".training-section", 3],
      [".consulting-section", 4],
      [".service-section", 2],
    ],
    "news-page": [["main", 0]],
    "whitepapers-page": [["main", 0]],
    contact: [["main", 0]],
    privacy: [["main", 0]],
    "privacy-choices": [["main", 0]],
    "data-requests": [["main", 0]],
    "blog-post": [
      [".preview-references", 3],
      [".preview-article-body", 2],
      [".preview-article-hero", 0],
    ],
  };

  const openGroup = (index) => {
    const selector = pageKey() === "blog-post" ? `[data-blog-group="${index}"]` : `[data-mts-group="${index}"]`;
    const button = document.querySelector(selector);
    if (!button) return;
    button.click();
    button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  const addHintStyle = (doc, selectors) => {
    if (!doc?.head || doc.getElementById("mts-preview-click-style")) return;
    const style = doc.createElement("style");
    style.id = "mts-preview-click-style";
    style.textContent = `${selectors.join(",")}{cursor:pointer!important;transition:outline-color .15s ease,box-shadow .15s ease}${selectors.join(",")}:hover{outline:2px solid rgba(69,98,142,.55)!important;outline-offset:-2px!important;box-shadow:inset 0 0 0 9999px rgba(69,98,142,.018)!important}`;
    doc.head.append(style);
  };

  const wireDocument = (doc, key) => {
    if (!doc || doc.documentElement?.dataset.mtsClickSync === key) return;
    const map = maps[key];
    if (!map?.length) return;
    doc.documentElement.dataset.mtsClickSync = key;
    addHintStyle(doc, map.map(([selector]) => selector));

    doc.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      for (const [selector, index] of map) {
        if (target.closest(selector)) {
          event.preventDefault();
          event.stopPropagation();
          openGroup(index);
          break;
        }
      }
    }, true);
  };

  const wireFrame = (frame) => {
    try {
      const key = pageKey();
      if (!key) return;
      const doc = frame.contentDocument;
      if (!doc) return;

      // Blog previews render directly in Decap's preview iframe.
      if (key === "blog-post") wireDocument(doc, key);

      // Existing page previews contain a second same-origin iframe with the real website.
      const inner = doc.querySelector("iframe.mts-live-site-frame");
      if (inner) {
        const wireInner = () => {
          try { wireDocument(inner.contentDocument, key); } catch (_) {}
        };
        inner.addEventListener("load", wireInner, { once: false });
        wireInner();
      }
    } catch (_) {}
  };

  const refresh = () => {
    document.querySelectorAll("iframe").forEach((frame) => {
      if (!frame.dataset.mtsOuterClickSync) {
        frame.dataset.mtsOuterClickSync = "true";
        frame.addEventListener("load", () => setTimeout(() => wireFrame(frame), 80));
      }
      wireFrame(frame);
    });
  };

  new MutationObserver(() => setTimeout(refresh, 50)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(refresh, 120));
  window.addEventListener("load", refresh);
  refresh();
})();
