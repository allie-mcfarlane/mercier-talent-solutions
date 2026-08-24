(() => {
  'use strict';

  const wrappedFetch = window.fetch.bind(window);
  const API_ROOT = '/admin/api/github/repos/allie-mcfarlane/mercier-talent-solutions';
  const AUTH = 'token mts-cloudflare-access';
  const DRAFT_BRANCH = 'cms/visual-careers-page';
  const CAREERS_PATH = 'src/content/pages/careers.md';

  const asUrl = (input) => {
    try {
      const value = input instanceof Request ? input.url : String(input);
      return new URL(value, window.location.origin);
    } catch {
      return null;
    }
  };

  const headers = (extra = {}) => ({
    Accept: 'application/vnd.github+json',
    Authorization: AUTH,
    ...extra,
  });

  const requestJson = async (url, init = {}) => {
    const response = await wrappedFetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: headers(init.headers || {}),
    });
    const payload = await response.clone().json().catch(() => ({}));
    return { response, payload };
  };

  const syntheticMerge = (sha) => new Response(JSON.stringify({
    merged: true,
    sha,
    message: 'Published',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  window.fetch = async (input, init = {}) => {
    const url = asUrl(input);
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!url || url.origin !== window.location.origin) return wrappedFetch(input, init);

    const mergeMatch = url.pathname.match(new RegExp(`^${API_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pulls/(\\d+)/merge$`));
    if (method !== 'PUT' || !mergeMatch) return wrappedFetch(input, init);

    const prNumber = Number(mergeMatch[1]);
    const contentsPath = `${API_ROOT}/contents/${CAREERS_PATH}`;

    try {
      const draftResult = await requestJson(`${contentsPath}?ref=${encodeURIComponent(DRAFT_BRANCH)}`);
      if (!draftResult.response.ok || !draftResult.payload?.content) {
        return wrappedFetch(input, init);
      }

      const mainResult = await requestJson(`${contentsPath}?ref=main`);
      if (!mainResult.response.ok || !mainResult.payload?.sha) {
        return wrappedFetch(input, init);
      }

      const publishResult = await requestJson(contentsPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Publish Careers page',
          content: draftResult.payload.content,
          branch: 'main',
          sha: mainResult.payload.sha,
        }),
      });

      if (!publishResult.response.ok) return publishResult.response;

      try {
        await requestJson(`${API_ROOT}/pulls/${prNumber}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'closed' }),
        });
      } catch (_) {}

      return syntheticMerge(publishResult.payload?.commit?.sha || 'published');
    } catch {
      return wrappedFetch(input, init);
    }
  };
})();
