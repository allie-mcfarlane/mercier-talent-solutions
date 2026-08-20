(() => {
  if (!window.CMS || !window.createClass || !window.h) return;

  const { CMS, createClass, h } = window;

  const value = (component, name, fallback = "") =>
    component.props.entry.getIn(["data", name]) ?? fallback;

  const toJS = (input, fallback = []) => {
    if (!input) return fallback;
    return typeof input.toJS === "function" ? input.toJS() : input;
  };

  const assetUrl = (component, path) => {
    if (!path) return "";
    const asset = component.props.getAsset(path);
    return asset ? asset.toString() : path;
  };

  const text = (doc, selector, content) => {
    const node = doc.querySelector(selector);
    if (node && content !== undefined && content !== null) node.textContent = String(content);
  };

  const link = (doc, selector, label, href) => {
    const node = doc.querySelector(selector);
    if (!node) return;
    if (label !== undefined && label !== null) node.textContent = String(label);
    if (href) node.setAttribute("href", String(href));
  };

  const headingWithAccent = (doc, selector, title, accent) => {
    const node = doc.querySelector(selector);
    if (!node) return;
    node.replaceChildren();
    node.append(document.createTextNode(String(title || "")));
    if (accent) {
      node.append(document.createTextNode(" "));
      const em = doc.createElement("em");
      em.textContent = String(accent);
      node.append(em);
    }
  };

  const image = (component, doc, selector, path, alt = "") => {
    const node = doc.querySelector(selector);
    if (!node || !path) return;
    node.removeAttribute("srcset");
    node.removeAttribute("sizes");
    node.src = assetUrl(component, path);
    node.alt = alt || "";
  };

  const replaceDirectParagraphs = (doc, parent, paragraphs, beforeNode) => {
    if (!parent || !beforeNode) return;
    [...parent.children].forEach((child) => {
      if (child.tagName === "P" && !child.classList.contains("eyebrow")) child.remove();
    });
    (paragraphs || []).forEach((paragraph) => {
      const p = doc.createElement("p");
      p.textContent = paragraph;
      parent.insertBefore(p, beforeNode);
    });
  };

  const patchHome = (component, doc) => {
    const entry = component.props.entry;
    text(doc, ".hero .eyebrow-link", value(component, "eyebrow"));
    headingWithAccent(doc, ".hero h1", value(component, "title"), value(component, "titleAccent"));
    text(doc, ".hero .lede", value(component, "lede"));

    const primary = toJS(entry.getIn(["data", "primaryCta"]), {});
    const secondary = toJS(entry.getIn(["data", "secondaryCta"]), {});
    link(doc, ".hero .button-row .button:nth-child(1)", primary.label, primary.href);
    link(doc, ".hero .button-row .button:nth-child(2)", secondary.label, secondary.href);

    const proof = toJS(entry.getIn(["data", "proof"]));
    [...doc.querySelectorAll(".proof-grid article")].forEach((card, index) => {
      if (!proof[index]) return;
      text(card, "h2", proof[index].title);
      text(card, "p", proof[index].text);
    });

    const marquee = toJS(entry.getIn(["data", "marqueeItems"]));
    const marqueeNodes = [...doc.querySelectorAll(".marquee-track span")];
    if (marquee.length && marqueeNodes.length) {
      marqueeNodes.forEach((node, index) => {
        node.textContent = marquee[index % marquee.length] || "";
      });
    }

    const approach = toJS(entry.getIn(["data", "approach"]), {});
    text(doc, ".approach .section-heading .eyebrow-link", approach.eyebrow);
    text(doc, ".approach .section-heading h2", approach.title);
    text(doc, ".approach .section-heading p", approach.text);
    [...doc.querySelectorAll(".approach ul li")].forEach((node, index) => {
      if (approach.items?.[index] !== undefined) node.textContent = approach.items[index];
    });

    const news = toJS(entry.getIn(["data", "news"]), {});
    text(doc, ".news-band .section-heading .eyebrow-link", news.eyebrow);
    text(doc, ".news-band .section-heading h2", news.title);
  };

  const patchAbout = (component, doc) => {
    const entry = component.props.entry;
    text(doc, ".about-hero .eyebrow", value(component, "eyebrow"));
    headingWithAccent(doc, ".about-hero h1", value(component, "title"), value(component, "titleAccent"));
    text(doc, ".about-hero-copy > p:not(.eyebrow)", value(component, "lede"));

    const firm = toJS(entry.getIn(["data", "firm"]), {});
    text(doc, ".firm-kicker .eyebrow", firm.eyebrow);
    text(doc, ".firm-kicker h2", firm.title);
    text(doc, ".firm-text", firm.text);

    const team = toJS(entry.getIn(["data", "team"]));
    const cards = [...doc.querySelectorAll(".team-card")];
    cards.forEach((card, index) => {
      const person = team[index];
      if (!person) return;
      image(component, card, ".portrait img", person.image, person.imageAlt);
      text(card, ".team-copy > .eyebrow", person.eyebrow);
      text(card, ".team-copy > h2", person.name);
      const copy = card.querySelector(".team-copy");
      const meta = card.querySelector(".meta-row");
      replaceDirectParagraphs(doc, copy, person.paragraphs, meta);
      const links = card.querySelectorAll(".meta-row a");
      if (links[0]) { links[0].textContent = person.email || ""; links[0].href = `mailto:${person.email || ""}`; }
      if (links[1]) { links[1].textContent = person.phone || ""; links[1].href = `tel:${String(person.phone || "").replace(/[^\d+]/g, "")}`; }
      if (links[2] && person.linkedin) links[2].href = person.linkedin;
      text(card, ".credentials .eyebrow", person.credentialsEyebrow);
      const list = card.querySelector(".credential-list");
      if (list && person.credentials !== undefined) {
        list.replaceChildren();
        String(person.credentials || "").split(" · ").filter(Boolean).forEach((credential) => {
          const span = doc.createElement("span");
          span.textContent = credential.trim();
          list.append(span);
        });
      }
    });
  };

  const patchServices = (component, doc) => {
    const entry = component.props.entry;
    text(doc, ".services-hero .eyebrow", value(component, "eyebrow"));
    const heroHeading = doc.querySelector(".services-hero h1");
    if (heroHeading) {
      text(heroHeading, "span", value(component, "title"));
      text(heroHeading, "em", value(component, "titleAccent"));
    }
    text(doc, ".services-hero .hero-copy > p:last-child", value(component, "lede"));
    image(component, doc, ".services-hero .hero-image img", value(component, "heroImage"), value(component, "heroImageAlt"));

    const services = toJS(entry.getIn(["data", "services"]));
    const sections = [...doc.querySelectorAll(".service-section")];
    sections.forEach((section, index) => {
      const service = services[index];
      if (!service) return;
      text(section, ".service-number", service.number);
      text(section, ".service-heading-block h2", service.title);
      const summary = section.querySelector(".service-summary");
      if (summary) summary.textContent = service.summary || service.text || "";
      const detail = section.querySelector(".service-detail-copy");
      if (detail && index !== 0) detail.textContent = service.detail || service.summary || "";
      const img = section.querySelector(".service-image img");
      if (img && service.image) image(component, section, ".service-image img", service.image, service.imageAlt);
    });

    const focusAreas = toJS(entry.getIn(["data", "focusAreas"]));
    [...doc.querySelectorAll(".focus-list article")].forEach((item, index) => {
      if (!focusAreas[index]) return;
      text(item, "h3", focusAreas[index].title);
      text(item, "p", focusAreas[index].text);
    });
    text(doc, ".coaching-copy-stack .service-detail-copy", value(component, "focusIntro"));
  };

  const patchSimpleHeading = (component, doc) => {
    const eyebrow = value(component, "eyebrow");
    const title = value(component, "title");
    const accent = value(component, "titleAccent");
    const eyebrowNode = doc.querySelector("main .eyebrow");
    if (eyebrowNode) eyebrowNode.textContent = eyebrow || eyebrowNode.textContent;
    const h1 = doc.querySelector("main h1");
    if (h1 && title) headingWithAccent(doc, "main h1", title, accent);
  };

  const makePreview = (route, patcher) => createClass({
    componentDidMount() {
      this.syncPreview();
    },
    componentDidUpdate() {
      this.syncPreview();
    },
    syncPreview() {
      const frame = this.previewFrame;
      if (!frame) return;
      clearTimeout(this.previewTimer);
      this.previewTimer = setTimeout(() => {
        try {
          const doc = frame.contentDocument;
          if (!doc || doc.readyState === "loading") return;
          patcher(this, doc);
        } catch (error) {
          console.warn("Mercier preview could not update", error);
        }
      }, 40);
    },
    render() {
      return h("div", { className: "mts-live-preview" },
        h("div", { className: "mts-live-preview-bar" },
          h("div", {},
            h("strong", {}, "Website preview"),
            h("span", {}, "This is the real site layout. Your unsaved edits are shown here before publishing."),
          ),
          h("span", { className: "mts-live-preview-status" }, "Preview only"),
        ),
        h("iframe", {
          className: "mts-live-site-frame",
          src: route,
          title: "Website preview",
          ref: (node) => { this.previewFrame = node; },
          onLoad: () => this.syncPreview(),
        }),
      );
    },
  });

  CMS.registerPreviewTemplate("home", makePreview("/", patchHome));
  CMS.registerPreviewTemplate("about", makePreview("/about/", patchAbout));
  CMS.registerPreviewTemplate("services-page", makePreview("/services/", patchServices));
  CMS.registerPreviewTemplate("news-page", makePreview("/news/", patchSimpleHeading));
  CMS.registerPreviewTemplate("whitepapers-page", makePreview("/whitepapers/", patchSimpleHeading));
  CMS.registerPreviewTemplate("contact", makePreview("/contactus/", patchSimpleHeading));
  CMS.registerPreviewTemplate("privacy", makePreview("/privacy/", patchSimpleHeading));
  CMS.registerPreviewTemplate("privacy-choices", makePreview("/privacy-choices/", patchSimpleHeading));
  CMS.registerPreviewTemplate("data-requests", makePreview("/data-requests/", patchSimpleHeading));
})();