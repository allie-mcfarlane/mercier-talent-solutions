(() => {
  if (!window.CMS || !window.createClass || !window.h) return;

  const { CMS, createClass, h } = window;
  const get = (entry, name, fallback) => entry.getIn(["data", name]) ?? fallback;

  const SettingsPreview = createClass({
    render() {
      const entry = this.props.entry;
      const accent = get(entry, "accentColor", "#45628e");
      const dark = get(entry, "darkColor", "#1a2b46");
      const text = get(entry, "bodyTextColor", "#2b3036");
      const muted = get(entry, "mutedTextColor", "#66707c");
      const bodySize = Number(get(entry, "bodyFontSize", 16));
      const pageSize = get(entry, "pageTitleSize", "default");
      const sectionSize = get(entry, "sectionTitleSize", "default");

      const pageSizes = { smaller: 48, default: 58, larger: 66 };
      const sectionSizes = { smaller: 31, default: 38, larger: 45 };

      return h("div", {
        style: {
          minHeight: "100vh",
          padding: "56px 40px",
          background: "#ffffff",
          color: text,
          fontFamily: "Manrope, Arial, sans-serif",
        },
      },
        h("div", { style: { maxWidth: "960px", margin: "0 auto" } },
          h("p", { style: { color: accent, fontSize: "13px", fontWeight: 700, letterSpacing: "4px", textTransform: "uppercase" } }, "Appearance Preview"),
          h("h1", { style: { margin: "20px 0", color: "#000", fontFamily: "Sora, Manrope, sans-serif", fontSize: `${pageSizes[pageSize] || pageSizes.default}px`, lineHeight: 1.05 } }, ["Let's do our best work ", h("em", { style: { color: accent, fontFamily: "Georgia, serif" } }, "together")]),
          h("p", { style: { maxWidth: "760px", color: text, fontSize: `${bodySize}px`, lineHeight: 1.65 } }, "This sample shows how the selected body text color and font size will appear across the website."),
          h("h2", { style: { margin: "48px 0 14px", color: dark, fontFamily: "Sora, Manrope, sans-serif", fontSize: `${sectionSizes[sectionSize] || sectionSizes.default}px`, lineHeight: 1.08 } }, "Section heading example"),
          h("p", { style: { maxWidth: "760px", color: muted, fontSize: `${bodySize}px`, lineHeight: 1.65 } }, "Secondary text uses the muted text color. The approved Mercier colors and sizes remain the default values until you intentionally change them."),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "38px" } },
            [["Accent", accent], ["Dark Navy", dark], ["Body Text", text], ["Secondary Text", muted]].map(([label, color]) =>
              h("div", { style: { minWidth: "150px", border: "1px solid #dddcd7", padding: "12px", background: "#fff" } },
                h("div", { style: { height: "56px", background: color, marginBottom: "8px" } }),
                h("strong", { style: { fontSize: "12px", color: "#111" } }, label),
                h("div", { style: { fontSize: "11px", color: "#66707c" } }, color),
              ),
            ),
          ),
        ),
      );
    },
  });

  CMS.registerPreviewTemplate("settings", SettingsPreview);
})();
