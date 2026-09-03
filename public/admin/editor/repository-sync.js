(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const CONTENT_PATH = '/admin/api/content';
  const REPOSITORY_CONTENTS = '/admin/api/github/repos/allie-mcfarlane/mercier-talent-solutions/contents/';
  const MAIN_BRANCH = 'main';

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

  const parseJsonBody = (init = {}) => {
    if (typeof init.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch { return null; }
  };

  const requestHeaders = (input, init = {}) => {
    if (init.headers) return new Headers(init.headers);
    if (typeof Request !== 'undefined' && input instanceof Request) return new Headers(input.headers);
    return new Headers();
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input || ''));
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  };

  const serializeDocument = (data, body = '') => {
    if (!window.jsyaml?.dump) throw new Error('The editor could not prepare the repository copy.');
    const yaml = window.jsyaml.dump(data || {}, {
      schema: window.jsyaml.JSON_SCHEMA,
      noRefs: true,
      lineWidth: -1,
      sortKeys: false,
    });
    return `---\n${yaml}---\n${body || ''}`;
  };

  const repoPathForEntry = (type, slug) => {
    if (!slug) return '';
    if (type === 'page') return `src/content/pages/${slug}.md`;
    if (type === 'post') return `src/content/posts/${slug}.md`;
    if (type === 'whitepaper') return `src/content/white-papers/${slug}.md`;
    return '';
  };

  const authorizedFetch = (url, options, sourceHeaders) => {
    const headers = new Headers(options?.headers || {});
    const authorization = sourceHeaders.get('Authorization');
    if (authorization) headers.set('Authorization', authorization);
    if (!headers.has('Accept')) headers.set('Accept', 'application/vnd.github+json');
    if (options?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return nativeFetch(url, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
  };

  const loadDraft = async (branch, sourceHeaders) => {
    const response = await authorizedFetch(
      `${CONTENT_PATH}?branch=${encodeURIComponent(branch)}`,
      { method: 'GET' },
      sourceHeaders,
    );
    if (!response.ok) return { response, entry: null };
    const payload = await response.json().catch(() => ({}));
    return { response, entry: payload?.entry || null };
  };

  const syncToRepository = async ({ type, slug, data, body }, sourceHeaders) => {
    const repoPath = repoPathForEntry(type, slug);
    if (!repoPath) return { ok: false, message: 'This content does not have a valid repository location.' };

    const encodedPath = repoPath.split('/').map((part) => encodeURIComponent(part)).join('/');
    const endpoint = `${REPOSITORY_CONTENTS}${encodedPath}`;
    const existingResponse = await authorizedFetch(
      `${endpoint}?ref=${encodeURIComponent(MAIN_BRANCH)}`,
      { method: 'GET' },
      sourceHeaders,
    );

    let existingSha = '';
    if (existingResponse.ok) {
      const existing = await existingResponse.json().catch(() => ({}));
      existingSha = String(existing?.sha || '');
      if (!existingSha) return { ok: false, message: 'The repository copy could not be verified.' };
    } else if (existingResponse.status !== 404) {
      return { ok: false, message: 'The repository could not be checked before publishing.' };
    }

    const documentText = serializeDocument(data || {}, typeof body === 'string' ? body : '');
    const payload = {
      message: `Publish ${type}: ${slug}`,
      content: encodeBase64(documentText),
      branch: MAIN_BRANCH,
    };
    if (existingSha) payload.sha = existingSha;

    const publishResponse = await authorizedFetch(
      endpoint,
      { method: 'PUT', body: JSON.stringify(payload) },
      sourceHeaders,
    );

    if (!publishResponse.ok) {
      const details = await publishResponse.json().catch(() => ({}));
      return {
        ok: false,
        message: details?.message || 'The repository copy could not be updated. Your draft is still safe.',
      };
    }

    return { ok: true };
  };

  window.fetch = async (input, init = {}) => {
    let url;
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      url = new URL(raw, window.location.origin);
    } catch {
      return nativeFetch(input, init);
    }

    const inputMethod = typeof input !== 'string' && input?.method ? input.method : 'GET';
    const method = String(init.method || inputMethod || 'GET').toUpperCase();
    if (url.origin !== window.location.origin || url.pathname !== CONTENT_PATH || method !== 'PUT') {
      return nativeFetch(input, init);
    }

    const payload = parseJsonBody(init);
    if (!payload || String(payload.action || 'draft') !== 'publish') {
      return nativeFetch(input, init);
    }

    const sourceHeaders = requestHeaders(input, init);
    if (!sourceHeaders.get('Authorization')) return nativeFetch(input, init);

    let entry;
    if (payload.branch) {
      const stored = await loadDraft(String(payload.branch), sourceHeaders);
      if (!stored.response.ok || !stored.entry?.draft) {
        return jsonResponse({ message: 'The saved draft could not be verified. Nothing was published.' }, 409);
      }
      entry = {
        type: stored.entry.type,
        slug: stored.entry.slug,
        data: stored.entry.draft.data || {},
        body: typeof stored.entry.draft.body === 'string' ? stored.entry.draft.body : '',
      };
    } else {
      entry = {
        type: String(payload.type || ''),
        slug: String(payload.slug || ''),
        data: payload.data || {},
        body: typeof payload.body === 'string' ? payload.body : '',
      };
    }

    try {
      const repositoryResult = await syncToRepository(entry, sourceHeaders);
      if (!repositoryResult.ok) {
        return jsonResponse({
          message: repositoryResult.message || 'The repository copy could not be updated. Nothing was published.',
        }, 502);
      }
    } catch (error) {
      return jsonResponse({
        message: error?.message || 'The repository copy could not be updated. Nothing was published.',
      }, 502);
    }

    return nativeFetch(input, init);
  };
})();