const POST_CATEGORIES = new Set([
  "Insight",
  "Speaking",
  "White Paper",
  "Announcement",
  "News",
]);

const PAGE_SECTION_TYPES = new Set([
  "hero",
  "text",
  "imageText",
  "cards",
  "image",
  "callout",
  "html",
]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const isOptionalString = (value) => value === undefined || value === null || typeof value === "string";
const isValidDate = (value) => value instanceof Date || (typeof value === "string" && !Number.isNaN(new Date(value).valueOf()));

const unsafeAdvancedHtml = (value) => {
  const html = String(value || "");
  return /<(script|style|link|meta|base|iframe)\b/i.test(html)
    || /\son[a-z]+\s*=/i.test(html)
    || /javascript\s*:/i.test(html)
    || /@import\b/i.test(html);
};

const validateReferences = (references, errors) => {
  if (references === undefined || references === null) return;
  if (!Array.isArray(references)) {
    errors.push("References must be a list.");
    return;
  }
  references.forEach((reference, index) => {
    if (!isPlainObject(reference)) {
      errors.push(`Reference ${index + 1} is invalid.`);
      return;
    }
    if (!hasText(reference.text)) errors.push(`Reference ${index + 1} needs reference text.`);
    if (!hasText(reference.url)) errors.push(`Reference ${index + 1} needs a source URL.`);
  });
};

const validatePageSections = (sections, errors) => {
  if (sections === undefined || sections === null) return;
  if (!Array.isArray(sections)) {
    errors.push("Page sections must be a list.");
    return;
  }

  sections.forEach((section, index) => {
    if (!isPlainObject(section)) {
      errors.push(`Page section ${index + 1} is invalid.`);
      return;
    }
    const type = String(section.type || "text");
    if (!PAGE_SECTION_TYPES.has(type)) {
      errors.push(`Page section ${index + 1} has an unsupported section type.`);
      return;
    }
    if (type === "html" && unsafeAdvancedHtml(section.html)) {
      errors.push(
        `Advanced HTML section ${index + 1} contains page-wide code that is not allowed. Use section content only; scripts, styles, iframes, event handlers, and global imports are blocked.`,
      );
    }
    if (type === "cards" && section.items !== undefined && !Array.isArray(section.items)) {
      errors.push(`Cards section ${index + 1} must contain a card list.`);
    }
  });
};

export function validateContentPayload(type, data, body = "", { strict = false } = {}) {
  const errors = [];

  if (!isPlainObject(data)) {
    return { ok: false, errors: ["Content fields are invalid."] };
  }
  if (typeof body !== "string") errors.push("Body content must be text.");

  if (type === "post") {
    if (strict && !hasText(data.title)) errors.push("Article title is required.");
    if (strict && !hasText(data.author)) errors.push("Article author is required.");
    if (strict && !hasText(data.excerpt)) errors.push("Article summary is required.");
    if (strict && !isValidDate(data.pubDate)) errors.push("Publication date is required and must be valid.");
    if (strict && !POST_CATEGORIES.has(data.category)) errors.push("Article category is required and must use an approved category.");

    if (data.category !== undefined && !POST_CATEGORIES.has(data.category)) {
      errors.push("Article category is not recognized.");
    }
    if (data.pubDate !== undefined && !isValidDate(data.pubDate)) errors.push("Publication date is invalid.");
    if (data.updatedDate !== undefined && data.updatedDate !== null && data.updatedDate !== "" && !isValidDate(data.updatedDate)) {
      errors.push("Updated date is invalid.");
    }
    ["title", "subtitle", "author", "authorTitle", "authorImage", "authorImageAlt", "excerpt", "image", "imageAlt", "seoTitle", "seoDescription"].forEach((field) => {
      if (!isOptionalString(data[field])) errors.push(`${field} must be text.`);
    });
    validateReferences(data.references, errors);
  }

  if (type === "whitepaper") {
    if (strict && !hasText(data.title)) errors.push("White paper title is required.");
    if (strict && !hasText(data.number)) errors.push("White paper number is required.");
    if (strict && !hasText(data.description)) errors.push("White paper description is required.");
    if (strict && !isValidDate(data.date)) errors.push("White paper publication date is required and must be valid.");

    if (data.date !== undefined && !isValidDate(data.date)) errors.push("White paper publication date is invalid.");
    ["title", "number", "description", "document", "image", "imageAlt"].forEach((field) => {
      if (!isOptionalString(data[field])) errors.push(`${field} must be text.`);
    });
  }

  if (type === "page") {
    validatePageSections(data.sections, errors);
    if (data.visualStyles !== undefined && !isPlainObject(data.visualStyles)) {
      errors.push("Page design settings are invalid.");
    }
  }

  return { ok: errors.length === 0, errors };
}
