(() => {
  'use strict';

  const downstreamFetch = window.fetch.bind(window);
  const CONTENT_PATH = '/admin/api/content';
  const POST_CATEGORIES = new Set(['Insight', 'Speaking', 'White Paper', 'Announcement', 'News']);
  const PAGE_SECTION_TYPES = new Set(['hero', 'text', 'imageText', 'cards', 'image', 'callout', 'html']);

  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  const optionalText = (value) => value === undefined || value === null || typeof value === 'string';
  const validDate = (value) => value instanceof Date || (typeof value === 'string' && !Number.isNaN(new Date(value).valueOf()));

  const unsafeAdvancedHtml = (value) => {
    const html = String(value || '');
    return /<(script|style|link|meta|base|iframe)\b/i.test(html)
      || /\son[a-z]+\s*=/i.test(html)
      || /javascript\s*:/i.test(html)
      || /@import\b/i.test(html);
  };

  const validateReferences = (references, errors) => {
    if (references === undefined || references === null) return;
    if (!Array.isArray(references)) {
      errors.push('References must be a list.');
      return;
    }
    references.forEach((reference, index) => {
      if (!isObject(reference)) {
        errors.push(`Reference ${index + 1} is invalid.`);
        return;
      }
      if (!hasText(reference.text)) errors.push(`Reference ${index + 1} needs reference text.`);
      if (!hasText(reference.url)) errors.push(`Reference ${index + 1} needs a source URL.`);
    });
  };

  const validateSections = (sections, errors) => {
    if (sections === undefined || sections === null) return;
    if (!Array.isArray(sections)) {
      errors.push('Page sections must be a list.');
      return;
    }

    sections.forEach((section, index) => {
      if (!isObject(section)) {
        errors.push(`Page section ${index + 1} is invalid.`);
        return;
      }
      const type = String(section.type || 'text');
      if (!PAGE_SECTION_TYPES.has(type)) {
        errors.push(`Page section ${index + 1} has an unsupported section type.`);
        return;
      }
      if (type === 'html' && unsafeAdvancedHtml(section.html)) {
        errors.push(
          `Advanced HTML section ${index + 1} contains page-wide code. Scripts, style sheets, iframes, event handlers, and global imports are blocked so one section cannot change the rest of the site.`,
        );
      }
      if (type === 'cards' && section.items !== undefined && !Array.isArray(section.items)) {
        errors.push(`Cards section ${index + 1} must contain a card list.`);
      }
    });
  };

  const validate = (type, data, body, strict) => {
    const errors = [];
    if (!isObject(data)) return ['Content fields are invalid.'];
    if (typeof body !== 'string') errors.push('Body content must be text.');

    if (type === 'post') {
      if (strict && !hasText(data.title)) errors.push('Article title is required.');
      if (strict && !hasText(data.author)) errors.push('Article author is required.');
      if (strict && !hasText(data.excerpt)) errors.push('Article summary is required.');
      if (strict && !validDate(data.pubDate)) errors.push('Publication date is required and must be valid.');
      if (strict && !POST_CATEGORIES.has(data.category)) errors.push('Article category is required and must use an approved category.');

      if (data.category !== undefined && !POST_CATEGORIES.has(data.category)) errors.push('Article category is not recognized.');
      if (data.pubDate !== undefined && !validDate(data.pubDate)) errors.push('Publication date is invalid.');
      if (data.updatedDate !== undefined && data.updatedDate !== null && data.updatedDate !== '' && !validDate(data.updatedDate)) {
        errors.push('Updated date is invalid.');
      }
      ['title', 'subtitle', 'author', 'authorTitle', 'authorImage', 'authorImageAlt', 'excerpt', 'image', 'imageAlt', 'seoTitle', 'seoDescription'].forEach((field) => {
        if (!optionalText(data[field])) errors.push(`${field} must be text.`);
      });
      validateReferences(data.references, errors);
    }

    if (type === 'whitepaper') {
      if (strict && !hasText(data.title)) errors.push('White paper title is required.');
      if (strict && !hasText(data.number)) errors.push('White paper number is required.');
      if (strict && !hasText(data.description)) errors.push('White paper description is required.');
      if (strict && !validDate(data.date)) errors.push('White paper publication date is required and must be valid.');

      if (data.date !== undefined && !validDate(data.date)) errors.push('White paper publication date is invalid.');
      ['title', 'number', 'description', 'document', 'image', 'imageAlt'].forEach((field) => {
        if (!optionalText(data[field])) errors.push(`${field} must be text.`);
      });
    }

    if (type === 'page') {
      validateSections(data.sections, errors);
      if (data.visualStyles !== undefined && !isObject(data.visualStyles)) errors.push('Page design settings are invalid.');
    }

    return errors;
  };

  const blockedResponse = (errors, status = 400) => new Response(JSON.stringify({
    message: errors[0] || 'This content cannot be published safely.',
    errors,
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

  const parseBody = (init) => {
    if (typeof init?.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch { return null; }
  };

  const loadBranchDraft = async (branch, init) => {
    const headers = new Headers(init?.headers || {});
    const response = await downstreamFetch(`${CONTENT_PATH}?branch=${encodeURIComponent(branch)}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.entry || null;
  };

  window.fetch = async (input, init = {}) => {
    let url;
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      url = new URL(raw, window.location.origin);
    } catch {
      return downstreamFetch(input, init);
    }

    const inputMethod = typeof input !== 'string' && input?.method ? input.method : 'GET';
    const method = String(init.method || inputMethod || 'GET').toUpperCase();
    if (url.origin !== window.location.origin || url.pathname !== CONTENT_PATH || method !== 'PUT') {
      return downstreamFetch(input, init);
    }

    const payload = parseBody(init);
    if (!payload) return blockedResponse(['The editor could not verify this save request. Nothing was published.']);

    const action = String(payload.action || 'draft');
    let type = String(payload.type || '');
    let data = payload.data || {};
    let body = typeof payload.body === 'string' ? payload.body : '';

    if (action === 'publish' && payload.branch) {
      const entry = await loadBranchDraft(String(payload.branch), init);
      if (!entry?.draft) {
        return blockedResponse(['The saved draft could not be verified. Nothing was published. Reload the editor and try again.'], 409);
      }
      type = String(entry.type || '');
      data = entry.draft.data || {};
      body = typeof entry.draft.body === 'string' ? entry.draft.body : '';
    }

    const errors = validate(type, data, body, action === 'publish');
    if (errors.length) return blockedResponse(errors);

    return downstreamFetch(input, init);
  };
})();
