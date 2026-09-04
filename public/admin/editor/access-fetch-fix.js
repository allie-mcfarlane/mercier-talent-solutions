(() => {
  'use strict';

  const previousFetch = window.fetch.bind(window);
  const SESSION_ENDPOINT = '/admin/api/session';
  const CSRF_COOKIE = '__Secure-mts_admin_csrf';
  let sessionPromise = null;
  let sessionToken = '';

  const readCookie = (name) => {
    const prefix = `${name}=`;
    const part = String(document.cookie || '')
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : '';
  };

  const bootstrapSession = async () => {
    if (sessionToken) return sessionToken;
    if (sessionPromise) return sessionPromise;

    sessionPromise = (async () => {
      const response = await previousFetch(SESSION_ENDPOINT, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return '';
      const payload = await response.json().catch(() => ({}));
      sessionToken = String(payload?.csrf || readCookie(CSRF_COOKIE) || '');
      return sessionToken;
    })();

    try { return await sessionPromise; }
    finally { sessionPromise = null; }
  };

  window.MTSAdminSession = Object.freeze({
    getCsrf: bootstrapSession,
  });

  window.fetch = async (input, init = {}) => {
    let url;
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      url = new URL(raw, window.location.href);
    } catch {
      return previousFetch(input, init);
    }

    const isProtectedAdminRequest =
      url.origin === window.location.origin &&
      (url.pathname.startsWith('/admin/api/') ||
        url.pathname.startsWith('/admin/auth'));

    if (!isProtectedAdminRequest || url.pathname === SESSION_ENDPOINT) {
      return previousFetch(input, init);
    }

    const headers = new Headers(
      init.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined),
    );
    const csrf = await bootstrapSession();
    if (csrf) {
      headers.set('X-MTS-CSRF', csrf);
      headers.set('Authorization', `token ${csrf}`);
    }

    return previousFetch(input, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
  };
})();
