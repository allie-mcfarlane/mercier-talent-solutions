(() => {
  if (!window.CMS || !window.createClass || !window.h) return;

  const { CMS, createClass, h } = window;

  const value = (entry, name, fallback = "") =>
    entry.getIn(["data", name]) || fallback;

  const formatDate = (input) => {
    if (!input) return "";
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.valueOf())) return String(input);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const PostPreview = createClass({
    render() {
      const entry = this.props.entry;
      const title = value(entry, "title", "Article title");
      const subtitle = value(entry, "subtitle");
      const author = value(entry, "author", "Julia Mercier");
      const authorTitle = value(entry, "authorTitle", "Principal");
      const category = value(entry, "category", "Insight");
      const pubDate = formatDate(value(entry, "pubDate"));
      const authorImage = value(entry, "authorImage", "/images/julia-mercier.jpg");
      const authorAsset = this.props.getAsset(authorImage);
      const referencesValue = entry.getIn(["data", "references"]);
      const references = referencesValue && typeof referencesValue.toJS === "function"
        ? referencesValue.toJS()
        : [];

      return h("article", { className: "admin-post-preview" },
        h("header", { className: "preview-article-hero" },
          h("div", { className: "preview-article-shell" },
            h("span", { className: "preview-pill" }, category),
            h("h1", { className: subtitle ? "has-subtitle" : "" }, title),
            subtitle ? h("p", { className: "preview-article-subtitle" }, subtitle) : null,
            h("div", { className: "preview-article-meta" },
              h("div", { className: "preview-author" },
                h("img", {
                  src: authorAsset ? authorAsset.toString() : "/images/julia-mercier.jpg",
                  alt: "",
                }),
                h("div", {},
                  h("strong", {}, author),
                  h("span", {}, authorTitle),
                ),
              ),
              pubDate ? h("time", {}, pubDate) : null,
            ),
          ),
        ),
        h("div", { className: "preview-article-content" },
          h("div", { className: "preview-article-body" },
            this.props.widgetFor("body"),
            references.length
              ? h("section", { className: "preview-references" },
                  h("h2", {}, "References"),
                  h("ol", {}, references.map((reference, index) =>
                    h("li", { key: index }, reference.text || reference.url || "Reference"),
                  )),
                )
              : null,
          ),
        ),
      );
    },
  });

  const WhitePaperPreview = createClass({
    render() {
      const entry = this.props.entry;
      const title = value(entry, "title", "White paper title");
      const number = value(entry, "number", "00");
      const description = value(entry, "description");
      const date = formatDate(value(entry, "date"));

      return h("article", { className: "admin-whitepaper-preview" },
        h("div", { className: "preview-paper-cover" },
          h("div", { className: "preview-paper-cover-inner" },
            h("div", { className: "preview-paper-cover-meta" },
              h("span", {}, "Mercier Talent Solutions"),
              h("span", {}, `White Paper No. ${number}`),
            ),
            h("h1", {}, title),
            h("div", { className: "preview-paper-orbits", "aria-hidden": "true" },
              h("span", {}),
              h("span", {}),
            ),
          ),
        ),
        h("div", { className: "preview-paper-copy" },
          date ? h("time", {}, date) : null,
          h("h2", {}, title),
          description ? h("p", { className: "preview-paper-subtitle" }, description) : null,
          h("div", { className: "preview-paper-body" }, this.props.widgetFor("body")),
        ),
      );
    },
  });

  CMS.registerPreviewTemplate("posts", PostPreview);
  CMS.registerPreviewTemplate("white-papers", WhitePaperPreview);
})();
