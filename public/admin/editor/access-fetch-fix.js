(() => {
  'use strict';

  const previousFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
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

    if (!isProtectedAdminRequest) return previousFetch(input, init);

    return previousFetch(input, {
      ...init,
      credentials: 'same-origin',
    });
  };
})();
