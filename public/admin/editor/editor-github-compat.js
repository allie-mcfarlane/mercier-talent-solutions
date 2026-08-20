(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const API_PREFIX = '/admin/api/github/';
  const REPO_PATH = 'repos/allie-mcfarlane/mercier-talent-solutions';
  const OWNER = 'allie-mcfarlane';
  const BRANCH_CACHE_KEY = 'mts-visual-draft-branches-v1';
  const PR_CACHE_KEY = 'mts-visual-draft-prs-v1';

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

  const saveCaches = () => {
    writeSession(BRANCH_CACHE_KEY, [...branchCache]);
    writeSession(PR_CACHE_KEY, prByBranch);
  };

  const isVisualBranch = (branch) => typeof branch === 'string' && branch.startsWith('cms/visual-');

  const branchFromHead = (head) => {
    const prefix = `${OWNER}:`;
    return typeof head === 'string' && head.startsWith(prefix) ? head.slice(prefix.length) : '';
  };

  const stableNumber = (branch) => {
    let hash = 2166136261;
    for (const char of branch) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return 900000000 + ((hash >>> 0) % 90000000);
  };

  const ensureSyntheticPr = (branch) => {
    if (!prByBranch[branch]) {
      prByBranch[branch] = stableNumber(branch);
      saveCaches();
    }
    return {
      number: prByBranch[branch],
      state: 'open',
      draft: false,
      title: 'Website editor draft',
      head: { ref: branch, label: `${OWNER}:${branch}` },
      base: { ref: 'main' },
    };
  };

  const branchForPrNumber = (number) => Object.keys(prByBranch).find((branch) => String(prByBranch[branch]) === String(number)) || '';

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

  const requestMeta = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, window.location.origin);
    const inputMethod = typeof input !== 'string' && input?.method ? input.method : 'GET';
    return {
      url,
      method: String(init.method || inputMethod || 'GET').toUpperCase(),
    };
  };

  const requestHeaders = (input, init = {}) => {
    const headers = new Headers(typeof input !== 'string' && input?.headers ? input.headers : undefined);
    new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
    if (!headers.has('Accept')) headers.set('Accept', 'application/vnd.github+json');
    if (!headers.has('Authorization')) headers.set('Authorization', 'token mts-cloudflare-access');
    return headers;
  };

  const nativeApi = (path, options = {}, input = null, init = {}) => {
    const headers = requestHeaders(input, init);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return nativeFetch(`${API_PREFIX}${path}`, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
  };

  const parseJsonBody = (init = {}) => {
    if (typeof init.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch { return null; }
  };

  const clearBranch = (branch) => {
    branchCache.delete(branch);
    delete prByBranch[branch];
    saveCaches();
  };

  window.fetch = async (input, init = {}) => {
    let meta;
    try { meta = requestMeta(input, init); } catch { return nativeFetch(input, init); }

    const { url, method } = meta;
    if (url.origin !== window.location.origin || !url.pathname.startsWith(API_PREFIX)) {
      return nativeFetch(input, init);
    }

    const path = url.pathname.slice(API_PREFIX.length);

    const branchRefMatch = path.match(new RegExp(`^${REPO_PATH.replaceAll('/', '\\/')}\\/git\\/ref\\/heads\\/(.+)$`));
    if (method === 'GET' && branchRefMatch) {
      const branch = decodeURIComponent(branchRefMatch[1]);
      if (isVisualBranch(branch) && branchCache.has(branch)) {
        return jsonResponse({ ref: `refs/heads/${branch}`, object: { type: 'commit', sha: 'cached-visual-draft' } });
      }
      const response = await nativeFetch(input, init);
      if (response.ok && isVisualBranch(branch)) {
        branchCache.add(branch);
        saveCaches();
      }
      return response;
    }

    if (method === 'POST' && path === `${REPO_PATH}/git/refs`) {
      const body = parseJsonBody(init);
      const response = await nativeFetch(input, init);
      const ref = body?.ref || '';
      const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : '';
      if (response.ok && isVisualBranch(branch)) {
        branchCache.add(branch);
        saveCaches();
      }
      return response;
    }

    if (method === 'PUT' && path.startsWith(`${REPO_PATH}/contents/`)) {
      const body = parseJsonBody(init);
      const response = await nativeFetch(input, init);
      if (response.ok && isVisualBranch(body?.branch)) {
        branchCache.add(body.branch);
        saveCaches();
      }
      return response;
    }

    if (method === 'GET' && path === `${REPO_PATH}/pulls`) {
      const branch = branchFromHead(url.searchParams.get('head'));
      if (isVisualBranch(branch)) {
        return jsonResponse([ensureSyntheticPr(branch)]);
      }
      return nativeFetch(input, init);
    }

    if (method === 'POST' && path === `${REPO_PATH}/pulls`) {
      const body = parseJsonBody(init);
      if (isVisualBranch(body?.head) && body?.body === 'Draft created in the Mercier visual website editor.') {
        return jsonResponse(ensureSyntheticPr(body.head), 201);
      }
      return nativeFetch(input, init);
    }

    const mergeMatch = path.match(new RegExp(`^${REPO_PATH.replaceAll('/', '\\/')}\\/pulls\\/(\\d+)\\/merge$`));
    if (method === 'PUT' && mergeMatch) {
      const branch = branchForPrNumber(mergeMatch[1]);
      if (!isVisualBranch(branch)) return nativeFetch(input, init);

      const branchResponse = await nativeApi(`${REPO_PATH}/git/ref/heads/${branch}`, { method: 'GET' }, input, init);
      if (!branchResponse.ok) {
        return jsonResponse({ merged: false, message: 'The saved draft could not be found. Save the draft again and retry.' });
      }

      const branchData = await branchResponse.json();
      const branchSha = branchData?.object?.sha;
      if (!branchSha) {
        return jsonResponse({ merged: false, message: 'The saved draft did not have a publishable version.' });
      }

      const publishResponse = await nativeApi(`${REPO_PATH}/git/refs/heads/main`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: branchSha, force: false }),
      }, input, init);

      if (!publishResponse.ok) {
        let message = 'The website changed after this draft was started. Your draft is still safe. Reopen it and publish again.';
        try {
          const payload = await publishResponse.json();
          if (publishResponse.status !== 422 && payload?.message) message = payload.message;
        } catch (_) {}
        return jsonResponse({ merged: false, message });
      }

      return jsonResponse({ merged: true, sha: branchSha, message: 'Published' });
    }

    const deleteRefMatch = path.match(new RegExp(`^${REPO_PATH.replaceAll('/', '\\/')}\\/git\\/refs\\/heads\\/(.+)$`));
    if (method === 'DELETE' && deleteRefMatch) {
      const branch = decodeURIComponent(deleteRefMatch[1]);
      const response = await nativeFetch(input, init);
      if (response.ok && isVisualBranch(branch)) clearBranch(branch);
      return response;
    }

    return nativeFetch(input, init);
  };
})();
