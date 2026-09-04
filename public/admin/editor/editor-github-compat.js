(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const API_PREFIX = '/admin/api/github/';
  const CONTENT_API = '/admin/api/content';
  const MEDIA_API = '/admin/api/media';
  const REPO_PATH = 'repos/allie-mcfarlane/mercier-talent-solutions';
  const OWNER = 'allie-mcfarlane';
  const BRANCH_CACHE_KEY = 'mts-visual-draft-branches-v2';
  const PR_CACHE_KEY = 'mts-visual-draft-prs-v2';
  const BRANCH_PATH_KEY = 'mts-visual-draft-paths-v2';

  const readSession = (key, fallback) => {
    try {
      const value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeSession = (key, value) => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  };

  const branchCache = new Set(readSession(BRANCH_CACHE_KEY, []));
  const prByBranch = readSession(PR_CACHE_KEY, {});
  const pathByBranch = readSession(BRANCH_PATH_KEY, {});
  let d1Available = null;

  const saveCaches = () => {
    writeSession(BRANCH_CACHE_KEY, [...branchCache]);
    writeSession(PR_CACHE_KEY, prByBranch);
    writeSession(BRANCH_PATH_KEY, pathByBranch);
  };

  const clearBranch = (branch) => {
    branchCache.delete(branch);
    delete prByBranch[branch];
    delete pathByBranch[branch];
    saveCaches();
  };

  const isVisualBranch = (branch) => typeof branch === 'string' && branch.startsWith('cms/visual-');

  const stableNumber = (branch) => {
    let hash = 2166136261;
    for (const char of branch) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return 900000000 + ((hash >>> 0) % 90000000);
  };

  const ensureSyntheticPr = (branch) => {
    if (!prByBranch[branch]) prByBranch[branch] = stableNumber(branch);
    branchCache.add(branch);
    saveCaches();
    return {
      number: prByBranch[branch],
      state: 'open',
      draft: false,
      title: 'Website editor draft',
      head: { ref: branch, label: `${OWNER}:${branch}` },
      base: { ref: 'main' },
    };
  };

  const branchForPrNumber = (number) => Object.keys(prByBranch)
    .find((branch) => String(prByBranch[branch]) === String(number)) || '';

  const branchFromHead = (head) => {
    const prefix = `${OWNER}:`;
    return typeof head === 'string' && head.startsWith(prefix) ? head.slice(prefix.length) : '';
  };

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

  const requestMeta = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, window.location.origin);
    const inputMethod = typeof input !== 'string' && input?.method ? input.method : 'GET';
    return { url, method: String(init.method || inputMethod || 'GET').toUpperCase() };
  };

  const parseJsonBody = (init = {}) => {
    if (typeof init.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch { return null; }
  };

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const decodeBase64Text = (input) => new TextDecoder().decode(decodeBase64(input));

  const encodeBase64Text = (input) => {
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

  const contentRefFromRepoPath = (repoPath) => {
    let match = String(repoPath || '').match(/^src\/content\/pages\/([^/]+)\.md$/i);
    if (match) return { type: 'page', slug: match[1], path: repoPath };
    match = String(repoPath || '').match(/^src\/content\/posts\/([^/]+)\.md$/i);
    if (match) return { type: 'post', slug: match[1], path: repoPath };
    match = String(repoPath || '').match(/^src\/content\/white-papers\/([^/]+)\.md$/i);
    if (match) return { type: 'whitepaper', slug: match[1], path: repoPath };
    return null;
  };

  const repoPathForEntry = (entry) => {
    if (!entry?.type || !entry?.slug) return '';
    if (entry.type === 'page') return `src/content/pages/${entry.slug}.md`;
    if (entry.type === 'post') return `src/content/posts/${entry.slug}.md`;
    if (entry.type === 'whitepaper') return `src/content/white-papers/${entry.slug}.md`;
    return '';
  };

  const sessionHeaders = async (base = {}) => {
    const headers = new Headers(base || {});
    const csrf = await window.MTSAdminSession?.getCsrf?.();
    if (csrf) {
      headers.set('X-MTS-CSRF', csrf);
      headers.set('Authorization', `token ${csrf}`);
    }
    return headers;
  };

  const adminFetch = async (url, options = {}) => {
    const headers = await sessionHeaders(options.headers || {});
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await nativeFetch(url, { credentials: 'same-origin', ...options, headers });
    if (response.status === 503) d1Available = false;
    else if (response.ok) d1Available = true;
    return response;
  };

  const getStoredEntry = async ({ type, slug, branch }) => {
    const query = branch
      ? `?branch=${encodeURIComponent(branch)}`
      : `?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`;
    const response = await adminFetch(`${CONTENT_API}${query}`);
    if (!response.ok) return { response, entry: null };
    const payload = await response.json();
    return { response, entry: payload?.entry || null };
  };

  const listStoredEntries = async (type) => {
    const response = await adminFetch(`${CONTENT_API}?type=${encodeURIComponent(type)}`);
    if (!response.ok) return { response, entries: [] };
    const payload = await response.json();
    return { response, entries: payload?.entries || [] };
  };

  const checkD1 = async () => {
    if (d1Available !== null) return d1Available;
    try {
      const response = await adminFetch(`${CONTENT_API}?type=page&slug=home`);
      return response.ok;
    } catch {
      d1Available = false;
      return false;
    }
  };

  const synthContentResponse = (repoPath, selected, ref = 'main') => {
    const text = serializeDocument(selected?.data || {}, selected?.body || '');
    const name = repoPath.split('/').at(-1) || '';
    return jsonResponse({
      name,
      path: repoPath,
      sha: `d1-${selected?.publishedAt || selected?.branch || ref || 'content'}`,
      size: text.length,
      content: encodeBase64Text(text),
      encoding: 'base64',
      type: 'file',
    });
  };

  const syntheticDirectoryItem = (entry) => {
    const path = repoPathForEntry(entry);
    const name = path.split('/').at(-1) || `${entry.slug}.md`;
    return {
      name,
      path,
      sha: `d1-${entry.updatedAt || entry.publishedAt || entry.slug}`,
      size: 0,
      type: 'file',
      url: '',
      html_url: '',
      git_url: '',
      download_url: null,
      _links: {},
    };
  };

  const mergeDirectory = async (nativeResponse, type) => {
    if (!nativeResponse.ok) return nativeResponse;
    const stored = await listStoredEntries(type);
    if (!stored.response.ok) return nativeResponse;
    const nativeItems = await nativeResponse.clone().json();
    const map = new Map((Array.isArray(nativeItems) ? nativeItems : []).map((item) => [item.name, item]));
    stored.entries.forEach((entry) => {
      if (!entry?.draft && !entry?.published) return;
      const item = syntheticDirectoryItem(entry);
      if (!map.has(item.name)) map.set(item.name, item);
    });
    return jsonResponse([...map.values()]);
  };

  const uploadR2 = async (repoPath, githubPayload) => {
    const path = repoPath.replace(/^public\//, '');
    const bytes = decodeBase64(githubPayload?.content || '');
    const contentType = path.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : path.toLowerCase().endsWith('.png') ? 'image/png'
      : path.toLowerCase().match(/\.jpe?g$/) ? 'image/jpeg'
      : path.toLowerCase().endsWith('.webp') ? 'image/webp'
      : path.toLowerCase().endsWith('.gif') ? 'image/gif'
      : path.toLowerCase().endsWith('.svg') ? 'image/svg+xml'
      : 'application/octet-stream';
    const response = await adminFetch(`${MEDIA_API}?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: bytes,
    });
    return response;
  };

  const publishFallbackBranch = async (branch, input, init) => {
    const readHeaders = await sessionHeaders({ Accept: 'application/vnd.github+json' });
    const branchResponse = await nativeFetch(`${API_PREFIX}${REPO_PATH}/git/ref/heads/${encodeURIComponent(branch)}`, {
      headers: readHeaders,
      credentials: 'same-origin',
    });
    if (!branchResponse.ok) return jsonResponse({ merged: false, message: 'The saved draft could not be found.' });
    const branchData = await branchResponse.json();
    const branchSha = branchData?.object?.sha;
    const writeHeaders = await sessionHeaders({ Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' });
    const response = await nativeFetch(`${API_PREFIX}${REPO_PATH}/git/refs/heads/main`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: writeHeaders,
      body: JSON.stringify({ sha: branchSha, force: false }),
    });
    if (!response.ok) return jsonResponse({ merged: false, message: 'The website changed after this draft was started. Your draft is still safe.' });
    return jsonResponse({ merged: true, sha: branchSha, message: 'Published' });
  };

  window.fetch = async (input, init = {}) => {
    let meta;
    try { meta = requestMeta(input, init); } catch { return nativeFetch(input, init); }
    const { url, method } = meta;
    if (url.origin !== window.location.origin || !url.pathname.startsWith(API_PREFIX)) return nativeFetch(input, init);

    const path = decodeURIComponent(url.pathname.slice(API_PREFIX.length));
    const repoPrefixEscaped = REPO_PATH.replaceAll('/', '\\/');

    const branchRefMatch = path.match(new RegExp(`^${repoPrefixEscaped}\\/git\\/ref\\/heads\\/(.+)$`));
    if (method === 'GET' && branchRefMatch) {
      const branch = branchRefMatch[1];
      if (!isVisualBranch(branch)) return nativeFetch(input, init);
      if (branchCache.has(branch)) return jsonResponse({ ref: `refs/heads/${branch}`, object: { type: 'commit', sha: 'd1-visual-draft' } });
      try {
        const stored = await getStoredEntry({ branch });
        if (stored.response.ok && stored.entry?.draft) {
          branchCache.add(branch);
          pathByBranch[branch] = repoPathForEntry(stored.entry);
          saveCaches();
          return jsonResponse({ ref: `refs/heads/${branch}`, object: { type: 'commit', sha: 'd1-visual-draft' } });
        }
        if (d1Available) return jsonResponse({ message: 'Not Found' }, 404);
      } catch {}
      return nativeFetch(input, init);
    }

    if (method === 'POST' && path === `${REPO_PATH}/git/refs`) {
      const body = parseJsonBody(init);
      const ref = body?.ref || '';
      const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : '';
      if (isVisualBranch(branch) && await checkD1()) {
        branchCache.add(branch);
        saveCaches();
        return jsonResponse({ ref, object: { type: 'commit', sha: body?.sha || 'd1-visual-draft' } }, 201);
      }
      return nativeFetch(input, init);
    }

    const contentsMatch = path.match(new RegExp(`^${repoPrefixEscaped}\\/contents\\/(.+)$`));
    if (contentsMatch) {
      const repoPath = contentsMatch[1];
      const ref = url.searchParams.get('ref') || 'main';
      const contentRef = contentRefFromRepoPath(repoPath);

      if (method === 'GET' && contentRef) {
        try {
          const stored = await getStoredEntry({ type: contentRef.type, slug: contentRef.slug });
          if (stored.response.ok) {
            if (isVisualBranch(ref)) {
              if (stored.entry?.draft?.branch === ref) return synthContentResponse(repoPath, stored.entry.draft, ref);
              return jsonResponse({ message: 'Not Found' }, 404);
            }
            if (ref === 'main' && stored.entry?.published) return synthContentResponse(repoPath, stored.entry.published, ref);
          }
        } catch {}
        if (d1Available && isVisualBranch(ref)) return jsonResponse({ message: 'Not Found' }, 404);
        return nativeFetch(input, init);
      }

      if (method === 'GET' && ref === 'main' && ['src/content/posts', 'src/content/white-papers', 'src/content/pages'].includes(repoPath)) {
        const type = repoPath.endsWith('/posts') ? 'post' : repoPath.endsWith('/white-papers') ? 'whitepaper' : 'page';
        const nativeResponse = await nativeFetch(input, init);
        try { return await mergeDirectory(nativeResponse, type); } catch { return nativeResponse; }
      }

      if (method === 'PUT') {
        const body = parseJsonBody(init);
        const branch = body?.branch || '';
        if (isVisualBranch(branch) && contentRef && await checkD1()) {
          try {
            const text = decodeBase64Text(body?.content || '');
            const parsed = parseDocument(text);
            const response = await adminFetch(CONTENT_API, {
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
            if (!response.ok) return response;
            branchCache.add(branch);
            pathByBranch[branch] = repoPath;
            saveCaches();
            return jsonResponse({ content: { name: repoPath.split('/').at(-1), path: repoPath, sha: `d1-${Date.now()}` }, commit: { sha: `d1-${Date.now()}` } });
          } catch (error) {
            return jsonResponse({ message: error?.message || 'Draft could not be saved.' }, 500);
          }
        }

        if (isVisualBranch(branch) && /^public\/(documents|images)\//.test(repoPath) && await checkD1()) {
          try {
            const response = await uploadR2(repoPath, body);
            if (!response.ok) return response;
            return jsonResponse({ content: { name: repoPath.split('/').at(-1), path: repoPath, sha: `r2-${Date.now()}` }, commit: { sha: `r2-${Date.now()}` } });
          } catch (error) {
            return jsonResponse({ message: error?.message || 'File could not be uploaded.' }, 500);
          }
        }
      }
    }

    if (method === 'GET' && path === `${REPO_PATH}/pulls`) {
      const branch = branchFromHead(url.searchParams.get('head'));
      if (isVisualBranch(branch) && await checkD1()) {
        try {
          const stored = await getStoredEntry({ branch });
          if (stored.entry?.draft || branchCache.has(branch)) return jsonResponse([ensureSyntheticPr(branch)]);
          return jsonResponse([]);
        } catch { return jsonResponse(branchCache.has(branch) ? [ensureSyntheticPr(branch)] : []); }
      }
      return nativeFetch(input, init);
    }

    if (method === 'POST' && path === `${REPO_PATH}/pulls`) {
      const body = parseJsonBody(init);
      if (isVisualBranch(body?.head) && body?.body === 'Draft created in the Mercier visual website editor.' && await checkD1()) {
        return jsonResponse(ensureSyntheticPr(body.head), 201);
      }
      if (isVisualBranch(body?.head) && body?.body === 'Draft created in the Mercier visual website editor.' && body.draft === true) {
        body.draft = false;
        init = { ...init, body: JSON.stringify(body) };
      }
      return nativeFetch(input, init);
    }

    const mergeMatch = path.match(new RegExp(`^${repoPrefixEscaped}\\/pulls\\/(\\d+)\\/merge$`));
    if (method === 'PUT' && mergeMatch) {
      const branch = branchForPrNumber(mergeMatch[1]);
      if (!isVisualBranch(branch)) return nativeFetch(input, init);
      if (await checkD1()) {
        try {
          const response = await adminFetch(CONTENT_API, {
            method: 'PUT',
            body: JSON.stringify({ action: 'publish', branch }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return jsonResponse({ merged: false, message: payload?.message || 'The draft could not be published.' });
          clearBranch(branch);
          return jsonResponse({ merged: true, sha: `d1-${Date.now()}`, message: 'Published instantly' });
        } catch (error) {
          return jsonResponse({ merged: false, message: error?.message || 'The draft could not be published.' });
        }
      }
      return publishFallbackBranch(branch, input, init);
    }

    const deleteRefMatch = path.match(new RegExp(`^${repoPrefixEscaped}\\/git\\/refs\\/heads\\/(.+)$`));
    if (method === 'DELETE' && deleteRefMatch) {
      const branch = deleteRefMatch[1];
      if (isVisualBranch(branch) && await checkD1()) {
        try { await adminFetch(`${CONTENT_API}?branch=${encodeURIComponent(branch)}`, { method: 'DELETE' }); } catch {}
        clearBranch(branch);
        return new Response(null, { status: 204 });
      }
      return nativeFetch(input, init);
    }

    return nativeFetch(input, init);
  };
})();
