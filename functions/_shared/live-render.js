import {
  getContentEntry,
  hasContentStore,
  listContentEntries,
  loadStaticSeed,
  mergeSeedWithPublished,
} from "./content-store.js";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const safeUrl = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(text)) return escapeHtml(text);
  return "";
};

const asArray = (value) => Array.isArray(value) ? value : [];

const titleWithAccent = (title, accent, tag = "h1") =>
  `<${tag}>${escapeHtml(title || "")}${accent ? ` <em>${escapeHtml(accent)}</em>` : ""}</${tag}>`;

const paragraphs = (text) => String(text || "")
  .split(/\n\s*\n/)
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => `<p>${escapeHtml(value)}</p>`)
  .join("");

const formatDate = (value) => {
  const date = new Date(value || "");
  if (Number.isNaN(date.valueOf())) return String(value || "");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const postTimestamp = (item) => new Date(item?.data?.pubDate || 0).valueOf() || 0;
const paperTimestamp = (item) => new Date(item?.data?.date || 0).valueOf() || 0;

const categoryClass = (category) => {
  if (category === "Speaking") return "pill-speaking";
  if (category === "White Paper") return "pill-whitepaper";
  return "pill-insight";
};

const indexed = (items, callback) => {
  let index = 0;
  return {
    element(element) {
      const item = items?.[index];
      callback(element, item, index);
      index += 1;
    },
  };
};

const setText = (rewriter, selector, value) => {
  if (value === undefined) return rewriter;
  return rewriter.on(selector, { element: (element) => element.setInnerContent(String(value ?? "")) });
};

const setHeading = (rewriter, selector, title, accent) =>
  rewriter.on(selector, {
    element(element) {
      element.setInnerContent(`${escapeHtml(title || "")}${accent ? ` <em>${escapeHtml(accent)}</em>` : ""}`, { html: true });
    },
  });

const setImage = (rewriter, selector, src, alt = "") => {
  if (!src) return rewriter;
  return rewriter.on(selector, {
    element(element) {
      element.setAttribute("src", String(src));
      element.setAttribute("alt", String(alt || ""));
      element.removeAttribute("srcset");
      element.removeAttribute("sizes");
    },
  });
};

const addRuntimeStyles = (rewriter) => rewriter.on("head", {
  element(element) {
    element.append('<link rel="stylesheet" href="/live-content.css">', { html: true });
  },
});

export const renderBuilderSections = (sections = []) => asArray(sections).map((section) => {
  const type = section?.type || "text";
  const theme = section?.theme || "white";
  const align = section?.align || "left";
  const classes = `builder-section builder-${escapeHtml(type)} builder-theme-${escapeHtml(theme)} builder-align-${escapeHtml(align)}`;
  const eyebrow = section?.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : "";
  const headingSize = `builder-heading-${escapeHtml(section?.headingSize || "default")}`;
  const button = section?.buttonLabel && section?.buttonLink
    ? `<a class="button${type === "imageText" ? " secondary" : ""}" href="${safeUrl(section.buttonLink)}">${escapeHtml(section.buttonLabel)}</a>`
    : "";

  if (type === "hero") {
    return `<section class="${classes}"><div class="container builder-hero-grid ${section.image ? "has-image" : ""}"><div class="builder-copy">${eyebrow}${titleWithAccent(section.title, section.titleAccent, "h1")}${paragraphs(section.text)}${button}</div>${section.image ? `<div class="media-frame builder-hero-image"><img src="${safeUrl(section.image)}" alt="${escapeHtml(section.imageAlt || "")}" loading="lazy"></div>` : ""}</div></section>`;
  }
  if (type === "imageText") {
    return `<section class="${classes}"><div class="container builder-image-text ${section.imagePosition === "right" ? "image-right" : ""}"><div class="media-frame builder-image-frame">${section.image ? `<img src="${safeUrl(section.image)}" alt="${escapeHtml(section.imageAlt || "")}" loading="lazy">` : ""}</div><div class="builder-copy">${eyebrow}${section.title ? `<h2 class="${headingSize}">${escapeHtml(section.title)}</h2>` : ""}${paragraphs(section.text)}${button}</div></div></section>`;
  }
  if (type === "cards") {
    return `<section class="${classes}"><div class="container"><div class="section-heading">${eyebrow}${section.title ? `<h2 class="${headingSize}">${escapeHtml(section.title)}</h2>` : ""}</div><div class="builder-card-grid columns-${escapeHtml(section.columns || "3")}">${asArray(section.items).map((item) => `<article class="card">${item.image ? `<img class="builder-card-image" src="${safeUrl(item.image)}" alt="${escapeHtml(item.imageAlt || "")}" loading="lazy">` : ""}<h3>${escapeHtml(item.title || "")}</h3>${item.text ? `<p>${escapeHtml(item.text)}</p>` : ""}${item.buttonLabel && item.buttonLink ? `<a class="button text" href="${safeUrl(item.buttonLink)}">${escapeHtml(item.buttonLabel)}</a>` : ""}</article>`).join("")}</div></div></section>`;
  }
  if (type === "image") {
    return section.image ? `<section class="${classes}"><div class="container builder-image-only"><div class="media-frame"><img src="${safeUrl(section.image)}" alt="${escapeHtml(section.imageAlt || "")}" loading="lazy"></div>${section.caption ? `<p class="builder-caption">${escapeHtml(section.caption)}</p>` : ""}</div></section>` : "";
  }
  if (type === "callout") {
    return `<section class="${classes}"><div class="container builder-callout">${eyebrow}${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}${button}</div></section>`;
  }
  if (type === "html") {
    return `<section class="${classes}"><div class="container builder-html">${String(section.html || "")}</div></section>`;
  }
  return `<section class="${classes}"><div class="container builder-reading">${eyebrow}${section.title ? `<h2 class="${headingSize}">${escapeHtml(section.title)}</h2>` : ""}<div class="builder-prose">${paragraphs(section.text)}</div></div></section>`;
}).join("");

async function getPublishedOverride(env, type, slug) {
  if (!hasContentStore(env)) return null;
  try {
    const entry = await getContentEntry(env, type, slug);
    return entry?.published ? { ...entry.published, publishedAt: entry.publishedAt } : null;
  } catch {
    return null;
  }
}

async function getMergedCollection(context, type, seedKey) {
  if (!hasContentStore(context.env)) return { items: [], hasOverrides: false };
  let stored = [];
  try { stored = await listContentEntries(context.env, type, true); }
  catch { return { items: [], hasOverrides: false }; }
  if (!stored.length) return { items: [], hasOverrides: false };
  const seed = await loadStaticSeed(context.env, context.request);
  return {
    items: mergeSeedWithPublished(seed?.[seedKey] || [], stored),
    hasOverrides: true,
  };
}

async function getMergedPage(context, slug) {
  const stored = await getPublishedOverride(context.env, "page", slug);
  if (stored) return { slug, data: stored.data || {}, body: stored.body || "", html: stored.html || "", source: "d1" };
  const seed = await loadStaticSeed(context.env, context.request);
  return (seed.pages || []).find((item) => item.slug === slug) || null;
}

const authorMap = (aboutPage) => Object.fromEntries(asArray(aboutPage?.data?.team).map((person) => [person.name, person]));

const renderHomePosts = (posts, authors) => posts.slice(0, 8).map((post) => {
  const data = post.data || {};
  const author = authors[data.author] || {};
  const avatar = author.image || data.image || "/images/julia-mercier.jpg";
  return `<a class="card news-card" href="/post/${encodeURIComponent(post.slug)}/"><span class="pill">${escapeHtml(data.category || "Insight")}</span><h3>${escapeHtml(data.title || "")}</h3><p>${escapeHtml(data.excerpt || "")}</p><span class="meta-row news-author"><img src="${safeUrl(avatar)}" alt="" loading="lazy"><span>${escapeHtml(data.author || "")} · ${escapeHtml(formatDate(data.pubDate))}</span></span></a>`;
}).join("");

const renderOtherNews = (posts) => posts.map((post) => {
  const data = post.data || {};
  return `<a class="news-item is-visible" data-reveal href="/post/${encodeURIComponent(post.slug)}/"><div class="meta-row item-meta"><span class="pill ${categoryClass(data.category)}">${escapeHtml(data.category || "Insight")}</span><time datetime="${escapeHtml(String(data.pubDate || ""))}">${escapeHtml(formatDate(data.pubDate))}</time></div><h3>${escapeHtml(data.title || "")}</h3><p>${escapeHtml(data.excerpt || "")}</p><span class="read-more item-link">Read more <span aria-hidden="true">→</span></span></a>`;
}).join("");

const renderWhitePapers = (papers) => papers.map((paper, index) => {
  const data = paper.data || {};
  return `<article class="paper-row ${index % 2 === 1 ? "paper-row-reverse" : ""} is-visible" data-wp-reveal><div class="paper-cover"><div class="cover-inner"><div class="cover-meta"><span>Mercier Talent Solutions</span><span>White Paper No. ${escapeHtml(data.number || "")}</span></div><h2>${escapeHtml(data.title || "")}</h2><div class="cover-orbits" aria-hidden="true"><span class="a"></span><span class="b"></span></div></div></div><div class="paper-content"><time datetime="${escapeHtml(String(data.date || ""))}">${escapeHtml(formatDate(data.date))}</time><h3>${escapeHtml(data.title || "")}</h3><p class="paper-subtitle">${escapeHtml(data.description || "")}</p><p class="paper-body">${escapeHtml(paper.body || "")}</p>${data.document ? `<a class="paper-action" href="${safeUrl(data.document)}" target="_blank" rel="noopener noreferrer">Download the Paper <span aria-hidden="true">→</span></a>` : ""}</div></article>`;
}).join("");

const applyBuilderOverride = (rewriter, page) => {
  if (!page) return rewriter;
  rewriter.on(".builder-section", { element: (element) => element.remove() });
  rewriter.on("#main-content", {
    element(element) {
      const html = renderBuilderSections(page.data?.sections || []);
      if (html) element.append(html, { html: true });
    },
  });
  return addRuntimeStyles(rewriter);
};

function applyHome(rewriter, page) {
  const data = page?.data || {};
  setText(rewriter, ".hero .eyebrow-link", data.eyebrow);
  setHeading(rewriter, ".hero h1", data.title, data.titleAccent);
  setText(rewriter, ".hero .lede", data.lede);
  setImage(rewriter, ".hero-panel img", data.heroImage, data.heroImageAlt);
  if (data.primaryCta || data.secondaryCta) {
    rewriter.on(".hero .button-row .button", indexed([data.primaryCta, data.secondaryCta], (element, item) => {
      if (!item) return;
      element.setInnerContent(String(item.label || ""));
      if (item.href) element.setAttribute("href", String(item.href));
    }));
  }
  if (Array.isArray(data.proof)) {
    rewriter.on(".proof-grid article", indexed(data.proof, (element, item) => {
      if (!item) return;
      element.setInnerContent(`<h2>${escapeHtml(item.title || "")}</h2><p>${escapeHtml(item.text || "")}</p>`, { html: true });
    }));
  }
  if (Array.isArray(data.marqueeItems)) {
    const values = [...data.marqueeItems, ...data.marqueeItems];
    rewriter.on(".marquee-track", { element: (element) => element.setInnerContent(values.map((item) => `<span>${escapeHtml(item)}</span>`).join(""), { html: true }) });
  }
  if (data.approach) {
    setText(rewriter, ".approach .eyebrow-link", data.approach.eyebrow);
    setText(rewriter, ".approach h2", data.approach.title);
    setText(rewriter, ".approach .section-heading p", data.approach.text);
    if (Array.isArray(data.approach.items)) {
      rewriter.on(".approach ul", { element: (element) => element.setInnerContent(data.approach.items.map((item) => `<li>${escapeHtml(item)}</li>`).join(""), { html: true }) });
    }
  }
  if (data.news) {
    setText(rewriter, ".news-band .eyebrow-link", data.news.eyebrow);
    setText(rewriter, ".news-band h2", data.news.title);
  }
  return rewriter;
}

function applyAbout(rewriter, page) {
  const data = page?.data || {};
  setText(rewriter, ".about-hero .eyebrow", data.eyebrow);
  setHeading(rewriter, ".about-hero h1", data.title, data.titleAccent);
  setText(rewriter, ".about-hero-copy > p:not(.eyebrow)", data.lede);
  if (data.firm) {
    setText(rewriter, ".firm-kicker .eyebrow", data.firm.eyebrow);
    setText(rewriter, ".firm-kicker h2", data.firm.title);
    setText(rewriter, ".firm-text", data.firm.text);
  }
  if (Array.isArray(data.team)) {
    const teamHtml = data.team.map((person, index) => {
      const credentials = String(person.credentials || "").split(" · ").map((item) => item.trim()).filter(Boolean);
      return `<article class="team-card person-${index + 1} is-visible" data-reveal><div class="media-frame portrait"><img src="${safeUrl(person.image)}" alt="${escapeHtml(person.imageAlt || person.name || "")}" loading="lazy"></div><div class="team-copy"><p class="eyebrow">${escapeHtml(person.eyebrow || "")}</p><h2>${escapeHtml(person.name || "")}</h2>${asArray(person.paragraphs).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<div class="meta-row">${person.email ? `<a href="mailto:${escapeHtml(person.email)}">${escapeHtml(person.email)}</a>` : ""}${person.phone ? `<a href="tel:${escapeHtml(String(person.phone).replace(/[^\d+]/g, ""))}">${escapeHtml(person.phone)}</a>` : ""}${person.linkedin ? `<a href="${safeUrl(person.linkedin)}">LinkedIn</a>` : ""}</div><div class="credentials"><p class="eyebrow">${escapeHtml(person.credentialsEyebrow || "")}</p><div class="credential-list">${credentials.map((credential) => `<span>${escapeHtml(credential)}</span>`).join("")}</div></div></div></article>`;
    }).join("");
    rewriter.on(".team-list", { element: (element) => element.setInnerContent(teamHtml, { html: true }) });
  }
  return rewriter;
}

function applyServices(rewriter, page) {
  const data = page?.data || {};
  setText(rewriter, ".services-hero .eyebrow", data.eyebrow);
  setText(rewriter, ".services-hero h1 span", data.title);
  setText(rewriter, ".services-hero h1 em", data.titleAccent);
  setText(rewriter, ".services-hero .hero-copy > p:last-child", data.lede);
  setImage(rewriter, ".services-hero .hero-image img", data.heroImage, data.heroImageAlt);

  if (Array.isArray(data.services)) {
    rewriter.on(".service-strip-inner", { element: (element) => element.setInnerContent(data.services.map((service) => `<a href="#${escapeHtml(String(service.title || "").toLowerCase().replaceAll(" ", "-"))}">${escapeHtml(service.title || "")}</a>`).join(""), { html: true }) });
    const [coaching, assessments, trainingService, consultingService] = data.services;
    const patchService = (prefix, service) => {
      if (!service) return;
      setText(rewriter, `${prefix} .service-number`, service.number);
      setText(rewriter, `${prefix} .service-heading-block h2`, service.title);
      setImage(rewriter, `${prefix} .service-image img`, service.image, service.imageAlt);
    };
    patchService(".coaching-section", coaching);
    patchService(".split-section", assessments);
    patchService(".training-section", trainingService);
    patchService(".consulting-section", consultingService);
    if (coaching) setText(rewriter, ".coaching-section .service-summary", coaching.summary);
    if (data.focusIntro !== undefined) setText(rewriter, ".coaching-section .service-detail-copy", data.focusIntro);
    if (assessments) setText(rewriter, ".split-section .assessment-intro", assessments.detail);
    if (trainingService) setText(rewriter, ".training-section .service-summary", [trainingService.summary, trainingService.detail].filter(Boolean).join(" "));
    if (consultingService) setText(rewriter, ".consulting-section .consulting-intro", consultingService.detail);
  }
  if (Array.isArray(data.focusAreas)) {
    rewriter.on(".focus-list", { element: (element) => element.setInnerContent(data.focusAreas.map((item) => `<article><h3>${escapeHtml(item.title || "")}</h3><p>${escapeHtml(item.text || "")}</p></article>`).join(""), { html: true }) });
  }
  if (Array.isArray(data.training?.groups)) {
    rewriter.on(".program-groups", { element: (element) => element.setInnerContent(data.training.groups.map((group) => `<article><h3>${escapeHtml(group.group || "")}</h3><div class="program-list">${asArray(group.items).map((item) => `<div class="program-item"><span>${escapeHtml(item.title || "")}</span><p>${escapeHtml(item.text || "")}</p></div>`).join("")}</div></article>`).join(""), { html: true }) });
  }
  if (Array.isArray(data.consulting?.items)) {
    rewriter.on(".consulting-list", { element: (element) => element.setInnerContent(data.consulting.items.map((item) => { const value = typeof item === "string" ? { title: item, text: "" } : item; return `<article><h3>${escapeHtml(value?.title || "")}</h3>${value?.text ? `<p>${escapeHtml(value.text)}</p>` : ""}</article>`; }).join(""), { html: true }) });
  }
  return rewriter;
}

function applyNewsPage(rewriter, page) {
  const data = page?.data || {};
  setText(rewriter, ".news-hero .eyebrow", data.eyebrow);
  setHeading(rewriter, ".news-hero h1", data.title, data.titleAccent);
  if (Array.isArray(data.paragraphs)) setText(rewriter, ".news-hero .hero-intro", data.paragraphs.join(" "));
  else if (data.lede !== undefined) setText(rewriter, ".news-hero .hero-intro", data.lede);
  return rewriter;
}

function applyWhitepapersPage(rewriter, page) {
  const data = page?.data || {};
  setText(rewriter, ".wp-hero .eyebrow", data.eyebrow);
  setText(rewriter, ".wp-hero h1 span", data.title);
  setText(rewriter, ".wp-hero h1 em", data.titleAccent);
  setText(rewriter, ".wp-lede", data.lede);
  return rewriter;
}

function applyContact(rewriter, page) {
  const data = page?.data || {};
  setText(rewriter, ".contact-hero .eyebrow", data.eyebrow);
  setHeading(rewriter, ".contact-hero h1", data.title, data.titleAccent);
  if (Array.isArray(data.contacts)) {
    const roles = ["Principal", "Practice Manager"];
    rewriter.on(".direct-list", { element: (element) => element.setInnerContent(data.contacts.map((person, index) => `<div class="contact-person"><p class="person-role">${escapeHtml(person.eyebrow || roles[index] || "")}</p><strong>${escapeHtml(person.name || "")}</strong>${person.email ? `<a href="mailto:${escapeHtml(person.email)}">${escapeHtml(person.email)}</a>` : ""}${person.phone ? `<a href="tel:${escapeHtml(String(person.phone).replace(/[^\d+]/g, ""))}">${escapeHtml(person.phone)}</a>` : ""}${person.linkedin ? `<a href="${safeUrl(person.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ""}</div>`).join(""), { html: true }) });
  }
  return rewriter;
}

function applyPrivacy(rewriter, page) {
  const data = page?.data || {};
  const bodyHtml = page?.html || paragraphs(page?.body || "");
  rewriter.on(".policy", { element: (element) => element.setInnerContent(`<p class="eyebrow">${escapeHtml(data.eyebrow || "")}</p>${titleWithAccent(data.title, data.titleAccent)}${data.updated ? `<p class="updated">${escapeHtml(data.updated)}</p>` : ""}${bodyHtml}`, { html: true }) });
  return rewriter;
}

function applyPrivacyChoices(rewriter, page) {
  const data = page?.data || {};
  const bodyHtml = page?.html || paragraphs(page?.body || "");
  rewriter.on(".privacy-grid > div:first-child", { element: (element) => element.setInnerContent(`<p class="eyebrow">${escapeHtml(data.eyebrow || "")}</p>${titleWithAccent(data.title, data.titleAccent)}<div class="intro">${bodyHtml}</div>`, { html: true }) });
  return rewriter;
}

function applyDataRequests(rewriter, page) {
  applyPrivacyChoices(rewriter, page);
  const data = page?.data || {};
  if (data.formSubject !== undefined) rewriter.on('input[name="_subject"]', { element: (element) => element.setAttribute("value", String(data.formSubject || "")) });
  if (data.formName !== undefined) rewriter.on('input[name="form_name"]', { element: (element) => element.setAttribute("value", String(data.formName || "")) });
  if (Array.isArray(data.requestOptions)) rewriter.on('select[name="request_type"]', { element: (element) => element.setInnerContent(`<option value="">Select one</option>${data.requestOptions.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}`, { html: true }) });
  return rewriter;
}

const pageAppliers = {
  home: applyHome,
  about: applyAbout,
  services: applyServices,
  news: applyNewsPage,
  whitepapers: applyWhitepapersPage,
  contact: applyContact,
  privacy: applyPrivacy,
  "privacy-choices": applyPrivacyChoices,
  "data-requests": applyDataRequests,
};

export async function serveExistingPage(context, pageKey) {
  const assetPromise = context.env.ASSETS.fetch(context.request);
  if (!hasContentStore(context.env)) return assetPromise;

  const [page, postsResult, papersResult, servicesPage] = await Promise.all([
    getPublishedOverride(context.env, "page", pageKey),
    ["home", "news"].includes(pageKey) ? getMergedCollection(context, "post", "posts") : Promise.resolve({ items: [], hasOverrides: false }),
    pageKey === "whitepapers" ? getMergedCollection(context, "whitepaper", "whitepapers") : Promise.resolve({ items: [], hasOverrides: false }),
    pageKey === "home" ? getPublishedOverride(context.env, "page", "services") : Promise.resolve(null),
  ]);

  if (!page && !postsResult.hasOverrides && !papersResult.hasOverrides && !servicesPage) return assetPromise;
  const asset = await assetPromise;
  if (!asset.ok || !(asset.headers.get("content-type") || "").includes("text/html")) return asset;

  let rewriter = new HTMLRewriter();
  if (page) {
    rewriter = pageAppliers[pageKey]?.(rewriter, page) || rewriter;
    rewriter = applyBuilderOverride(rewriter, page);
  }

  if (pageKey === "home" && servicesPage?.data?.services) {
    rewriter.on(".services-preview .service-grid .card", indexed(servicesPage.data.services.slice(0, 4), (element, service) => {
      if (!service) return;
      element.setInnerContent(`<p class="eyebrow">${escapeHtml(service.eyebrow || "")}</p><h3>${escapeHtml(service.title || "")}</h3><p>${escapeHtml(service.text || service.summary || "")}</p><a class="button text" href="/services/">LEARN MORE</a>`, { html: true });
    }));
  }

  if (pageKey === "home" && postsResult.hasOverrides) {
    const about = await getMergedPage(context, "about");
    const authors = authorMap(about);
    const posts = postsResult.items.sort((a, b) => postTimestamp(b) - postTimestamp(a));
    rewriter.on(".news-list[data-news-carousel]", { element: (element) => element.setInnerContent(renderHomePosts(posts, authors), { html: true }) });
  }

  if (pageKey === "news" && postsResult.hasOverrides) {
    const posts = postsResult.items.sort((a, b) => postTimestamp(b) - postTimestamp(a));
    const [featured, ...other] = posts;
    if (featured) {
      const data = featured.data || {};
      setText(rewriter, ".featured-copy .pill", data.category || "Insight");
      rewriter.on(".featured-copy .pill", { element: (element) => element.setAttribute("class", `pill ${categoryClass(data.category)}`) });
      setText(rewriter, ".featured-copy time", formatDate(data.pubDate));
      rewriter.on(".featured-copy time", { element: (element) => element.setAttribute("datetime", String(data.pubDate || "")) });
      setText(rewriter, ".featured-copy h2", data.title || "");
      setText(rewriter, ".featured-copy > p", data.excerpt || "");
      rewriter.on(".featured-copy .read-more", { element: (element) => element.setAttribute("href", `/post/${encodeURIComponent(featured.slug)}/`) });
    }
    rewriter.on(".other-news .news-list", { element: (element) => element.setInnerContent(renderOtherNews(other), { html: true }) });
  }

  if (pageKey === "whitepapers" && papersResult.hasOverrides) {
    const papers = papersResult.items.sort((a, b) => paperTimestamp(b) - paperTimestamp(a));
    rewriter.on(".paper-list", { element: (element) => element.setInnerContent(renderWhitePapers(papers), { html: true }) });
  }

  return rewriter.transform(asset);
}

const linkCitations = (html, references) => String(html || "").replace(/\[(\d+)\]/g, (match, number) => {
  const index = Number(number) - 1;
  if (!references?.[index]) return match;
  return `<sup class="reference-marker live-reference-marker"><a href="#reference-${number}" aria-label="Reference ${number}">${number}</a></sup>`;
});

const renderArticle = (post, author) => {
  const data = post.data || {};
  const references = asArray(data.references);
  const bodyHtml = linkCitations(post.html || paragraphs(post.body || ""), references);
  const image = author?.image || data.authorImage || "/images/julia-mercier.jpg";
  const imageAlt = author?.imageAlt || data.authorImageAlt || data.author || "";
  const role = author?.eyebrow || author?.role || data.authorTitle || "Principal";
  const referencesHtml = references.length ? `<section class="references live-references" aria-labelledby="references-heading"><h2 id="references-heading">References</h2><ol>${references.map((reference, index) => `<li id="reference-${index + 1}"><a href="${safeUrl(reference.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(reference.text || `Source ${index + 1}`)}</a></li>`).join("")}</ol></section>` : "";
  const canonical = `https://merciertalentsolutions.com/post/${encodeURIComponent(post.slug)}/`;
  return `<article class="article-page live-article-page"><header class="article-hero live-article-hero"><div class="container article-shell live-article-shell"><a class="back-link live-article-back" href="/news/">← Back to News & Insights</a><span class="pill live-article-pill ${categoryClass(data.category)}">${escapeHtml(data.category || "Insight")}</span><h1>${escapeHtml(data.title || "")}</h1>${data.subtitle ? `<p class="article-subtitle live-article-subtitle">${escapeHtml(data.subtitle)}</p>` : ""}<div class="article-meta live-article-meta"><div class="author-block live-author-block"><img class="author-photo live-author-photo" src="${safeUrl(image)}" alt="${escapeHtml(imageAlt)}" loading="eager" decoding="async"><div class="author-copy live-author-copy"><strong>${escapeHtml(data.author || "")}</strong><span>${escapeHtml(role)}</span></div></div><time datetime="${escapeHtml(String(data.pubDate || ""))}">${escapeHtml(formatDate(data.pubDate))}</time></div></div></header><div class="article-content-section live-article-content-section"><div class="container article-body live-article-body" data-article-body>${bodyHtml}${referencesHtml}</div><div class="container article-actions live-article-actions"><span class="actions-label">Article options</span><div class="action-buttons"><button class="article-action" type="button" onclick="window.print()">Print</button><a class="article-action primary" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer">Post to LinkedIn</a></div></div></div></article>`;
};

export async function serveLivePost(context, slug) {
  if (!hasContentStore(context.env)) return context.next();
  const post = await getPublishedOverride(context.env, "post", slug);
  if (!post) return context.next();

  const about = await getMergedPage(context, "about");
  const author = authorMap(about)[post.data?.author] || null;
  const shellUrl = new URL("/news/", context.request.url);
  const asset = await context.env.ASSETS.fetch(shellUrl);
  if (!asset.ok) return new Response("Article template unavailable.", { status: 500 });

  const title = `${post.data?.seoTitle || post.data?.title || "Article"} | Mercier Talent Solutions`;
  const description = post.data?.seoDescription || post.data?.excerpt || "";
  const canonical = new URL(`/post/${slug}/`, context.request.url).toString();
  const image = post.data?.image ? new URL(post.data.image, context.request.url).toString() : "";

  let rewriter = new HTMLRewriter()
    .on("title", { element: (element) => element.setInnerContent(title) })
    .on('meta[name="description"]', { element: (element) => element.setAttribute("content", description) })
    .on('link[rel="canonical"]', { element: (element) => element.setAttribute("href", canonical) })
    .on('meta[property="og:title"]', { element: (element) => element.setAttribute("content", title) })
    .on('meta[property="og:description"]', { element: (element) => element.setAttribute("content", description) })
    .on('meta[property="og:url"]', { element: (element) => element.setAttribute("content", canonical) })
    .on('meta[name="twitter:title"]', { element: (element) => element.setAttribute("content", title) })
    .on('meta[name="twitter:description"]', { element: (element) => element.setAttribute("content", description) })
    .on("head", { element(element) { element.append('<link rel="stylesheet" href="/live-content.css"><link rel="stylesheet" href="/article-final-fixes.css">', { html: true }); if (image) element.append(`<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:image" content="${escapeHtml(image)}">`, { html: true }); } })
    .on("#main-content", { element: (element) => element.setInnerContent(renderArticle({ slug, ...post }, author), { html: true }) });

  return rewriter.transform(asset);
}

export async function serveCustomPage(context, slug) {
  if (!hasContentStore(context.env) || slug.includes(".")) return context.next();
  const page = await getPublishedOverride(context.env, "page", slug);
  if (!page?.data?.pageBuilder) return context.next();

  const asset = await context.env.ASSETS.fetch(new URL("/", context.request.url));
  if (!asset.ok) return context.next();
  const title = `${page.data.navTitle || page.data.title || slug} | Mercier Talent Solutions`;
  const description = page.data.seoDescription || page.data.lede || "";
  const canonical = new URL(`/${slug}/`, context.request.url).toString();
  return new HTMLRewriter()
    .on("title", { element: (element) => element.setInnerContent(title) })
    .on('meta[name="description"]', { element: (element) => element.setAttribute("content", description) })
    .on('link[rel="canonical"]', { element: (element) => element.setAttribute("href", canonical) })
    .on('meta[property="og:title"]', { element: (element) => element.setAttribute("content", title) })
    .on('meta[property="og:description"]', { element: (element) => element.setAttribute("content", description) })
    .on('meta[property="og:url"]', { element: (element) => element.setAttribute("content", canonical) })
    .on("head", { element: (element) => element.append('<link rel="stylesheet" href="/live-content.css">', { html: true }) })
    .on("#main-content", { element: (element) => element.setInnerContent(renderBuilderSections(page.data.sections || []), { html: true }) })
    .transform(asset);
}
