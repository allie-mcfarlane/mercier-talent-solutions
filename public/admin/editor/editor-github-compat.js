(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init.method || 'GET').toUpperCase();
      const isVisualEditorPrCreate = method === 'POST' && /\/admin\/api\/github\/repos\/allie-mcfarlane\/mercier-talent-solutions\/pulls(?:\?|$)/.test(url);
      if (isVisualEditorPrCreate && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        if (body?.body === 'Draft created in the Mercier visual website editor.' && body.draft === true) {
          body.draft = false;
          init = { ...init, body: JSON.stringify(body) };
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };
})();
