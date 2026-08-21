(() => {
  'use strict';

  const downstreamFetch = window.fetch.bind(window);
  const API_PREFIX = '/admin/api/github/';
  const CONTENT_API = '/admin/api/content';
  const REPO_PATH = 'repos/allie-mcfarlane/mercier-talent-solutions';
  const OWNER = 'allie-mcfarlane';
  const AUTH = 'token mts-cloudflare-access';
  const activeBranches = new Set();
  const branchByPr = new Map();

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

  const isVisualBranch = (branch) => typeof branch === 'string' && branch.startsWith('cms/visual-');

  const stableNumber = (branch) => {
    let hash = 2166136261;
    for (const char of String(branch || '')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return 800000000 + ((hash >>> 0) % 100000000);
  };

  const contentRefFromRepoPath = (repoPath) => {
    let match = String(repoPath || '').match(/^src\/content\/pages\/([^/]+)\.md$/i);
    if (match) return { type: 'page', slug: match[1] };
    match = String(repoPath || '').match(/^src\/content\/posts\/([^/]+)\.md$/i);
    if (match) return { type: 'post', slug: match[1] };
    match = String(repoPath || '').match(/^src\/content\/white-papers\/([^/]+)\.md$/i);
    if (match) return { type: 'whitepaper', slug: match[1] };
    return null;
  };

  const parseJsonBody = (init = {}) => {
    if (typeof init.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch { return null; }
  };

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input || ''));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  };

  const parseDocument = (text) => {
    const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: String(text || '') };
    try {
      return {
        data: window.jsyaml?.load(match[1], { schema: window.jsyaml.JSON_SCHEMA }) || {},
        body: match[2] || '',
      };
    } catch {
      return { data: {}, body: match[2] || '' };
    }
  };

  const serializeDocument = (data, body = '') => {
    const yaml = window.jsyaml?.dump(data || {}, {
      schema: window.jsyaml.JSON_SCHEMA,
      noRefs: true,
      lineWidth: -1,
      sortKeys: false,
    }) || '';
    return `---\n${yaml}---\n${body || ''}`;
  };

  const renderMarkdown = (body) => {
    try {
      const html = window.marked?.parse(String(body || '')) || '';
      return window.DOMPurify?.sanitize(html, { ADD_ATTR: ['style'] }) || html;
    } catch {
      return '';
    }
  };

  const contentFetch = async (query = '', options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', AUTH);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return downstreamFetch(`${CONTENT_API}${query}`, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
  };

  const getDraftByBranch = async (branch) => {
    const response = await contentFetch(`?branch=${encodeURIComponent(branch)}`);
    if (!response.ok) return { response, entry: null };
    const payload = await response.json().catch(() => ({}));
    return { response, entry: payload?.entry || null };
  };

  const syntheticPr = (branch) => {
    const number = stableNumber(branch);
    branchByPr.set(String(number), branch);
    return {
      number,
      state: 'open',
      draft: false,
      title: 'Website editor draft',
      mergeable: true,
      mergeable_state: 'clean',
      head: { ref: branch, label: `${OWNER}:${branch}` },
      base: { ref: 'main' },
    };
  };

  const syntheticFile = (repoPath, selected, ref) => {
    const text = serializeDocument(selected?.data || {}, selected?.body || '');
    return jsonResponse({
      name: repoPath.split('/').at(-1) || '',
      path: repoPath,
      sha: `d1-${selected?.branch || ref || Date.now()}`,
      size: text.length,
      content: encodeBase64(text),
      encoding: 'base64',
      type: 'file',
    });
  };

  const branchFromHead = (head) => {
    const prefix = `${OWNER}:`;
    return typeof head === 'string' && head.startsWith(prefix) ? head.slice(prefix.length) : '';
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

    if (url.origin !== window.location.origin || !url.pathname.startsWith(API_PREFIX)) {
      return downstreamFetch(input, init);
    }

    const path = decodeURIComponent(url.pathname.slice(API_PREFIX.length));
    const repoEscaped = REPO_PATH.replaceAll('/', '\\/');

    const branchRef = path.match(new RegExp(`^${repoEscaped}\\/git\\/ref\\/heads\\/(.+)$`));
    if (method === 'GET' && branchRef && isVisualBranch(branchRef[1])) {
      const branch = branchRef[1];
      if (activeBranches.has(branch)) {
        return jsonResponse({ ref: `refs/heads/${branch}`, object: { type: 'commit', sha: 'd1-direct-draft' } });
      }
      const stored = await getDraftByBranch(branch);
      if (stored.response.ok && stored.entry?.draft) {
        activeBranches.add(branch);
        return jsonResponse({ ref: `refs/heads/${branch}`, object: { type: 'commit', sha: 'd1-direct-draft' } });
      }
      return jsonResponse({ message: 'Not Found' }, 404);
    }

    if (method === 'POST' && path === `${REPO_PATH}/git/refs`) {
      const body = parseJsonBody(init);
      const ref = String(body?.ref || '');
      const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : '';
      if (isVisualBranch(branch)) {
        activeBranches.add(branch);
        return jsonResponse({ ref, object: { type: 'commit', sha: body?.sha || 'd1-direct-draft' } }, 201);
      }
    }

    const contentsMatch = path.match(new RegExp(`^${repoEscaped}\\/contents\\/(.+)$`));
    if (contentsMatch) {
      const repoPath = contentsMatch[1];
      const ref = url.searchParams.get('ref') || 'main';
      const contentRef = contentRefFromRepoPath(repoPath);

      if (method === 'GET' && isVisualBranch(ref) && contentRef) {
        const stored = await getDraftByBranch(ref);
        if (stored.response.ok && stored.entry?.draft) {
          activeBranches.add(ref);
          return syntheticFile(repoPath, stored.entry.draft, ref);
        }
        return jsonResponse({ message: 'Not Found' }, 404);
      }

      if (method === 'PUT' && contentRef) {
        const body = parseJsonBody(init);
        const branch = String(body?.branch || '');
        if (isVisualBranch(branch)) {
          let text;
          try { text = decodeBase64(body?.content || ''); }
          catch { return jsonResponse({ message: 'Draft content could not be read.' }, 400); }
          const parsed = parseDocument(text);
          const response = await contentFetch('', {
            method: 'PUT',
            body: JSON.stringify({
              action: 'draft',
              type: contentRef.type,
              slug: contentRef.slug,
              data: parsed.data,
              body: parsed.body,
              html: renderMarkdown(parsed.body),
              branch,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return jsonResponse({ message: payload?.message || 'Draft could not be saved.' }, response.status);
          activeBranches.add(branch);
          const stamp = Date.now();
          return jsonResponse({
            content: { name: repoPath.split('/').at(-1), path: repoPath, sha: `d1-${stamp}` },
            commit: { sha: `d1-${stamp}` },
          });
        }
      }
    }

    if (method === 'GET' && path === `${REPO_PATH}/pulls`) {
      const branch = branchFromHead(url.searchParams.get('head'));
      if (isVisualBranch(branch)) {
        const stored = await getDraftByBranch(branch);
        if (stored.response.ok && stored.entry?.draft) {
          activeBranches.add(branch);
          return jsonResponse([syntheticPr(branch)]);
        }
        return jsonResponse(activeBranches.has(branch) ? [syntheticPr(branch)] : []);
      }
    }

    if (method === 'POST' && path === `${REPO_PATH}/pulls`) {
      const body = parseJsonBody(init);
      const branch = String(body?.head || '');
      if (isVisualBranch(branch)) {
        activeBranches.add(branch);
        return jsonResponse(syntheticPr(branch), 201);
      }
    }

    const mergeMatch = path.match(new RegExp(`^${repoEscaped}\\/pulls\\/(\\d+)\\/merge$`));
    if (method === 'PUT' && mergeMatch) {
      const branch = branchByPr.get(mergeMatch[1]);
      if (branch && isVisualBranch(branch)) {
        const response = await contentFetch('', {
          method: 'PUT',
          body: JSON.stringify({ action: 'publish', branch }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return jsonResponse({ merged: false, message: payload?.message || 'The draft could not be published.' });
        }
        activeBranches.delete(branch);
        branchByPr.delete(mergeMatch[1]);
        return jsonResponse({ merged: true, sha: `d1-${Date.now()}`, message: 'Published instantly' });
      }
    }

    const deleteRef = path.match(new RegExp(`^${repoEscaped}\\/git\\/refs\\/heads\\/(.+)$`));
    if (method === 'DELETE' && deleteRef && isVisualBranch(deleteRef[1])) {
      const branch = deleteRef[1];
      try { await contentFetch(`?branch=${encodeURIComponent(branch)}`, { method: 'DELETE' }); } catch (_) {}
      activeBranches.delete(branch);
      return new Response(null, { status: 204 });
    }

    return downstreamFetch(input, init);
  };
})();
