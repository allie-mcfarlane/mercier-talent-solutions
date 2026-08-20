(() => {
  if (!window.CMS || !window.createClass || !window.h) return;

  const { CMS, createClass, h } = window;

  const value = (entry, name, fallback = "") =>
    entry.getIn(["data", name]) ?? fallback;

  const toJS = (input, fallback = []) => {
    if (!input) return fallback;
    return typeof input.toJS === "function" ? input.toJS() : input;
  };

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

  const assetUrl = (component, path, fallback = "") => {
    if (!path) return fallback;
    const asset = component.props.getAsset(path);
    return asset ? asset.toString() : path;
  };

  const paragraphs = (text) =>
    String(text || "")
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const heading = (title, accent, className = "") =>
    h("h1", { className }, title || "Page title", accent ? [" ", h("em", { key: "accent" }, accent)] : null);

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
      const references = toJS(entry.getIn(["data", "references"]));

      return h("article", { className: "admin-post-preview" },
        h("header", { className: "preview-article-hero" },
          h("div", { className: "preview-article-shell" },
            h("span", { className: "preview-pill" }, category),
            h("h1", { className: subtitle ? "has-subtitle" : "" }, title),
            subtitle ? h("p", { className: "preview-article-subtitle" }, subtitle) : null,
            h("div", { className: "preview-article-meta" },
              h("div", { className: "preview-author" },
                h("img", {
                  src: assetUrl(this, authorImage, "/images/julia-mercier.jpg"),
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
      const image = value(entry, "image");

      return h("article", { className: "admin-whitepaper-preview" },
        h("div", { className: "preview-paper-cover" },
          image
            ? h("img", { className: "preview-paper-image", src: assetUrl(this, image), alt: "" })
            : h("div", { className: "preview-paper-cover-inner" },
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

  const ExistingPagePreview = createClass({
    render() {
      const entry = this.props.entry;
      const title = value(entry, "title", "Page title");
      const accent = value(entry, "titleAccent");
      const eyebrow = value(entry, "eyebrow", "Mercier Talent Solutions");
      const lede = value(entry, "lede");
      const proof = toJS(entry.getIn(["data", "proof"]));
      const team = toJS(entry.getIn(["data", "team"]));
      const services = toJS(entry.getIn(["data", "services"]));
      const focusAreas = toJS(entry.getIn(["data", "focusAreas"]));
      const contacts = toJS(entry.getIn(["data", "contacts"]));
      const updated = value(entry, "updated");
      const requestOptions = toJS(entry.getIn(["data", "requestOptions"]));

      if (team.length) {
        const firm = toJS(entry.getIn(["data", "firm"]), {});
        return h("div", { className: "admin-site-preview preview-about-page" },
          h("section", { className: "preview-site-hero navy" },
            h("div", { className: "preview-site-container" },
              h("p", { className: "preview-eyebrow" }, eyebrow),
              heading(title, accent),
              lede ? h("p", { className: "preview-lede" }, lede) : null,
            ),
          ),
          firm && (firm.title || firm.text) ? h("section", { className: "preview-site-section" },
            h("div", { className: "preview-site-container preview-firm-grid" },
              h("div", {}, h("p", { className: "preview-eyebrow" }, firm.eyebrow || "The firm"), h("h2", {}, firm.title || "")),
              h("p", {}, firm.text || ""),
            ),
          ) : null,
          h("section", { className: "preview-site-section paper" },
            h("div", { className: "preview-site-container preview-team-list" },
              team.map((person, index) => h("article", { className: "preview-team-card", key: index },
                h("img", { src: assetUrl(this, person.image), alt: person.imageAlt || "" }),
                h("div", {},
                  h("p", { className: "preview-eyebrow" }, person.eyebrow || ""),
                  h("h2", {}, person.name || "Team member"),
                  (person.paragraphs || []).map((paragraph, pIndex) => h("p", { key: pIndex }, paragraph)),
                  h("p", { className: "preview-contact-line" }, [person.email, person.phone].filter(Boolean).join(" · ")),
                ),
              )),
            ),
          ),
        );
      }

      if (services.length) {
        const heroImage = value(entry, "heroImage");
        return h("div", { className: "admin-site-preview preview-services-page" },
          h("section", { className: "preview-site-hero split" },
            h("div", { className: "preview-site-container preview-split-grid" },
              h("div", {}, h("p", { className: "preview-eyebrow" }, eyebrow), heading(title, accent), lede ? h("p", { className: "preview-lede" }, lede) : null),
              heroImage ? h("img", { className: "preview-main-image", src: assetUrl(this, heroImage), alt: "" }) : null,
            ),
          ),
          focusAreas.length ? h("section", { className: "preview-site-section paper" },
            h("div", { className: "preview-site-container preview-mini-grid" },
              focusAreas.map((item, index) => h("article", { className: "preview-mini-card", key: index }, h("h3", {}, item.title || ""), h("p", {}, item.text || ""))),
            ),
          ) : null,
          h("section", { className: "preview-site-section" },
            h("div", { className: "preview-site-container preview-service-list" },
              services.map((service, index) => h("article", { className: "preview-service-row", key: index },
                h("div", {}, h("p", { className: "preview-eyebrow" }, service.eyebrow || service.number || ""), h("h2", {}, service.title || "Service"), h("p", {}, service.detail || service.summary || service.text || "")),
                service.image ? h("img", { src: assetUrl(this, service.image), alt: service.imageAlt || "" }) : null,
              )),
            ),
          ),
        );
      }

      if (proof.length) {
        const approach = toJS(entry.getIn(["data", "approach"]), {});
        return h("div", { className: "admin-site-preview preview-home-page" },
          h("section", { className: "preview-site-hero" },
            h("div", { className: "preview-site-container" },
              h("p", { className: "preview-eyebrow" }, eyebrow),
              heading(title, accent),
              lede ? h("p", { className: "preview-lede" }, lede) : null,
            ),
          ),
          h("section", { className: "preview-site-section paper" },
            h("div", { className: "preview-site-container preview-proof-grid" },
              proof.map((item, index) => h("article", { key: index }, h("h2", {}, item.title || ""), h("p", {}, item.text || ""))),
            ),
          ),
          approach && (approach.title || approach.text) ? h("section", { className: "preview-site-section" },
            h("div", { className: "preview-site-container preview-reading" },
              h("p", { className: "preview-eyebrow" }, approach.eyebrow || "Our approach"),
              h("h2", {}, approach.title || ""),
              h("p", {}, approach.text || ""),
            ),
          ) : null,
        );
      }

      if (contacts.length) {
        return h("div", { className: "admin-site-preview" },
          h("section", { className: "preview-site-hero" }, h("div", { className: "preview-site-container" }, h("p", { className: "preview-eyebrow" }, eyebrow), heading(title, accent))),
          h("section", { className: "preview-site-section paper" },
            h("div", { className: "preview-site-container preview-mini-grid" },
              contacts.map((contact, index) => h("article", { className: "preview-mini-card", key: index }, h("h3", {}, contact.name || ""), h("p", {}, contact.email || ""), h("p", {}, contact.phone || ""))),
            ),
          ),
        );
      }

      if (updated || requestOptions.length) {
        return h("div", { className: "admin-site-preview" },
          h("section", { className: "preview-site-section" },
            h("div", { className: "preview-site-container preview-reading" },
              h("p", { className: "preview-eyebrow" }, eyebrow),
              heading(title, accent),
              updated ? h("p", { className: "preview-updated" }, updated) : null,
              this.props.widgetFor("body"),
              requestOptions.length ? h("div", { className: "preview-request-box" },
                h("strong", {}, "Request Type"),
                h("ul", {}, requestOptions.map((item, index) => h("li", { key: index }, item))),
              ) : null,
            ),
          ),
        );
      }

      return h("div", { className: "admin-site-preview" },
        h("section", { className: "preview-site-hero" }, h("div", { className: "preview-site-container" }, h("p", { className: "preview-eyebrow" }, eyebrow), heading(title, accent), lede ? h("p", { className: "preview-lede" }, lede) : null)),
        h("section", { className: "preview-site-section" }, h("div", { className: "preview-site-container preview-reading" }, this.props.widgetFor("body"))),
      );
    },
  });

  const CustomPagePreview = createClass({
    renderSection(section, index) {
      const theme = section.theme || "white";
      const classes = `preview-builder-section theme-${theme} align-${section.align || "left"}`;
      const copy = [];
      if (section.eyebrow) copy.push(h("p", { className: "preview-eyebrow", key: "eyebrow" }, section.eyebrow));
      if (section.title) copy.push(h(section.type === "hero" ? "h1" : "h2", { key: "title" }, [section.title, section.titleAccent ? [" ", h("em", { key: "accent" }, section.titleAccent)] : null]));
      paragraphs(section.text).forEach((paragraph, pIndex) => copy.push(h("p", { key: `p-${pIndex}` }, paragraph)));
      if (section.buttonLabel) copy.push(h("span", { className: "preview-button", key: "button" }, section.buttonLabel));

      if (section.type === "imageText" || (section.type === "hero" && section.image)) {
        return h("section", { className: classes, key: index },
          h("div", { className: `preview-site-container preview-builder-split ${section.imagePosition === "right" ? "image-right" : ""}` },
            h("div", { className: "preview-builder-image" }, section.image ? h("img", { src: assetUrl(this, section.image), alt: "" }) : null),
            h("div", { className: "preview-builder-copy" }, copy),
          ),
        );
      }

      if (section.type === "cards") {
        return h("section", { className: classes, key: index },
          h("div", { className: "preview-site-container" },
            h("div", { className: "preview-builder-copy" }, copy),
            h("div", { className: `preview-builder-cards columns-${section.columns || "3"}` },
              (section.items || []).map((item, itemIndex) => h("article", { className: "preview-mini-card", key: itemIndex },
                item.image ? h("img", { className: "preview-card-image", src: assetUrl(this, item.image), alt: "" }) : null,
                h("h3", {}, item.title || "Card"),
                item.text ? h("p", {}, item.text) : null,
              )),
            ),
          ),
        );
      }

      if (section.type === "image") {
        return h("section", { className: classes, key: index },
          h("div", { className: "preview-site-container" },
            section.image ? h("img", { className: "preview-full-image", src: assetUrl(this, section.image), alt: "" }) : null,
            section.caption ? h("p", { className: "preview-caption" }, section.caption) : null,
          ),
        );
      }

      if (section.type === "html") {
        return h("section", { className: classes, key: index },
          h("div", { className: "preview-site-container preview-builder-html", dangerouslySetInnerHTML: { __html: section.html || "" } }),
        );
      }

      return h("section", { className: classes, key: index },
        h("div", { className: "preview-site-container preview-builder-copy" }, copy),
      );
    },

    render() {
      const entry = this.props.entry;
      const sections = toJS(entry.getIn(["data", "sections"]));
      return h("div", { className: "admin-site-preview admin-builder-preview" },
        sections.length
          ? sections.map((section, index) => this.renderSection(section, index))
          : h("section", { className: "preview-site-section" }, h("div", { className: "preview-site-container" }, h("p", {}, "Add a section to begin building this page."))),
      );
    },
  });

  CMS.registerPreviewTemplate("pages", ExistingPagePreview);
  CMS.registerPreviewTemplate("custom-pages", CustomPagePreview);
  CMS.registerPreviewTemplate("posts", PostPreview);
  CMS.registerPreviewTemplate("white-papers", WhitePaperPreview);
})();
