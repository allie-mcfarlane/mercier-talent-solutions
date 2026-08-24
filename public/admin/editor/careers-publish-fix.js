(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const API_ROOT = '/admin/api/github/repos/allie-mcfarlane/mercier-talent-solutions';
  const DRAFT_BRANCH = 'cms/visual-careers-page';
  const DRAFT_REF_PATH = `${API_ROOT}/git/ref/heads/${DRAFT_BRANCH}`;
  const DRAFT_UPDATE_PATH = `${API_ROOT}/git/refs/heads/${DRAFT_BRANCH}`;
  const MAIN_REF_PATH = `${API_ROOT}/git/ref/heads/main`;
  const OPEN_PULLS_PATH = `${API_ROOT}/pulls?state=open&head=${encodeURIComponent(`allie-mcfarlane:${DRAFT_BRANCH}`)}&per_page=10`;
  let initialBranchProbeHandled = false;

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

  const notFoundResponse = () => new Response(JSON.stringify({ message: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

  window.fetch = async (input, init = {}) => {
    const url = asUrl(input);
    if (!url || url.origin !== window.location.origin || !url.pathname.startsWith(API_ROOT)) {
      return nativeFetch(input, init);
    }

    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // If the old draft branch still exists but no open Careers PR exists, reset that
    // workspace to current main and make the editor open the published page instead.
    if (method === 'GET' && url.pathname === DRAFT_REF_PATH && !initialBranchProbeHandled) {
      initialBranchProbeHandled = true;
      const branchResponse = await nativeFetch(input, init);
      if (!branchResponse.ok) return branchResponse;

      const baseOptions = { headers: init.headers || {} };
      const pullsResponse = await nativeFetch(OPEN_PULLS_PATH, jsonOptions(baseOptions, 'GET'));
      if (!pullsResponse.ok) return branchResponse;

      const pulls = await pullsResponse.json();
      if (Array.isArray(pulls) && pulls.length) return branchResponse;

      const mainResponse = await nativeFetch(MAIN_REF_PATH, jsonOptions(baseOptions, 'GET'));
      if (mainResponse.ok) {
        const main = await mainResponse.json();
        const mainSha = main?.object?.sha;
        if (mainSha) {
          await nativeFetch(
            DRAFT_UPDATE_PATH,
            jsonOptions(baseOptions, 'PATCH', { sha: mainSha, force: true }),
          );
        }
      }

      return notFoundResponse();
    }

    // A saved website draft is already private because it lives on a branch and is not merged.
    // Do not also create it as a GitHub Draft PR, because GitHub refuses to merge Draft PRs.
    if (method === 'POST' && url.pathname === `${API_ROOT}/pulls`) {
      const payload = parseBody(init.body);
      if (payload?.head === DRAFT_BRANCH && payload?.base === 'main') {
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
        head: details?.head?.ref || DRAFT_BRANCH,
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