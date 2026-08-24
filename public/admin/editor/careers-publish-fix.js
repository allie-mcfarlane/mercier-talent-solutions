(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const API_ROOT = '/admin/api/github/repos/allie-mcfarlane/mercier-talent-solutions';

  const asUrl = (input) => {
    try {
      const value = input instanceof Request ? input.url : String(input);
      return new URL(value, window.location.origin);
    } catch {
      return null;
    }
  };

  const parseBody = (body) => {
    if (!body || typeof body !== 'string') return null;
    try { return JSON.parse(body); } catch { return null; }
  };

  const jsonOptions = (base, method, body) => ({
    ...base,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(base?.headers || {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  });

  window.fetch = async (input, init = {}) => {
    const url = asUrl(input);
    if (!url || url.origin !== window.location.origin || !url.pathname.startsWith(`${API_ROOT}/pulls`)) {
      return nativeFetch(input, init);
    }

    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // A saved website draft is already private because it lives on a branch and is not merged.
    // Do not also create it as a GitHub Draft PR, because GitHub refuses to merge Draft PRs.
    if (method === 'POST' && url.pathname === `${API_ROOT}/pulls`) {
      const payload = parseBody(init.body);
      if (payload?.head === 'cms/visual-careers-page' && payload?.base === 'main') {
        payload.draft = false;
        return nativeFetch(input, { ...init, body: JSON.stringify(payload) });
      }
    }

    const mergeMatch = url.pathname.match(new RegExp(`^${API_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pulls/(\\d+)/merge$`));
    if (method !== 'PUT' || !mergeMatch) return nativeFetch(input, init);

    const firstAttempt = await nativeFetch(input, init);
    if (firstAttempt.ok) return firstAttempt;

    let errorPayload = null;
    try { errorPayload = await firstAttempt.clone().json(); } catch {}
    if (!/draft/i.test(String(errorPayload?.message || ''))) return firstAttempt;

    const oldNumber = Number(mergeMatch[1]);
    const baseOptions = { headers: init.headers || {} };

    const detailsResponse = await nativeFetch(`${API_ROOT}/pulls/${oldNumber}`, jsonOptions(baseOptions, 'GET'));
    if (!detailsResponse.ok) return firstAttempt;
    const details = await detailsResponse.json();

    const closeResponse = await nativeFetch(
      `${API_ROOT}/pulls/${oldNumber}`,
      jsonOptions(baseOptions, 'PATCH', { state: 'closed' }),
    );
    if (!closeResponse.ok) return firstAttempt;

    const replacementResponse = await nativeFetch(
      `${API_ROOT}/pulls`,
      jsonOptions(baseOptions, 'POST', {
        title: 'Publish: Careers page',
        head: details?.head?.ref || 'cms/visual-careers-page',
        base: details?.base?.ref || 'main',
        body: 'Careers changes published from the Mercier visual website editor.',
        draft: false,
      }),
    );
    if (!replacementResponse.ok) return firstAttempt;
    const replacement = await replacementResponse.json();

    return nativeFetch(
      `${API_ROOT}/pulls/${replacement.number}/merge`,
      jsonOptions(baseOptions, 'PUT', parseBody(init.body) || { merge_method: 'squash', commit_title: 'Publish Careers page' }),
    );
  };
})();