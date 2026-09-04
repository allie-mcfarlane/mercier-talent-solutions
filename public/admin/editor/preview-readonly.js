(() => {
  'use strict';

  const host = window.location.hostname;
  const isBranchPreview = host.endsWith('.mercier-talent-solutions.pages.dev') && host !== 'mercier-talent-solutions.pages.dev';
  window.MTS_ADMIN_PREVIEW_READ_ONLY = isBranchPreview;
  if (!isBranchPreview) return;

  const previewStyle = document.createElement('style');
  previewStyle.textContent = `
    .mts-preview-mode{position:fixed;right:20px;bottom:18px;z-index:220;display:grid;gap:3px;max-width:430px;border:1px solid #cbd7e4;border-radius:12px;padding:11px 14px;background:rgba(255,255,255,.98);box-shadow:0 14px 36px rgba(26,43,70,.16);color:#53657b}
    .mts-preview-mode strong{color:#1a2b46;font-size:10px}
    .mts-preview-mode span{font-size:9px;line-height:1.45}
    .mts-preview-readonly button:disabled{opacity:.48;cursor:not-allowed}
    @media(max-width:760px){.mts-preview-mode{left:12px;right:12px;bottom:12px;max-width:none}}
  `;
  document.head.append(previewStyle);

  const downstreamFetch = window.fetch.bind(window);
  let snapshotPromise = null;

  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

  const loadSnapshot = () => {
    if (!snapshotPromise) {
      snapshotPromise = downstreamFetch('/admin/editor/preview-data.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('Preview data is unavailable.');
          return response.json();
        });
    }
    return snapshotPromise;
  };

  const encodeBase64 = (value) => {
    const bytes = new TextEncoder().encode(String(value || ''));
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  };

  const syntheticFile = (filePath, text) => ({
    name: filePath.split('/').at(-1) || '',
    path: filePath,
    sha: `preview-${filePath.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    size: new TextEncoder().encode(text).byteLength,
    content: encodeBase64(text),
    encoding: 'base64',
    type: 'file',
  });

  const handleGithubGet = async (url) => {
    const snapshot = await loadSnapshot();
    const prefix = '/admin/api/github/';
    const apiPath = decodeURIComponent(url.pathname.slice(prefix.length));
    const repoPrefix = 'repos/allie-mcfarlane/mercier-talent-solutions/';
    if (!apiPath.startsWith(repoPrefix)) return jsonResponse({ message: 'Not Found' }, 404);
    const relative = apiPath.slice(repoPrefix.length);

    if (relative === 'git/ref/heads/main') {
      return jsonResponse({ ref: 'refs/heads/main', object: { type: 'commit', sha: 'preview-main' } });
    }
    if (relative.startsWith('git/ref/heads/')) return jsonResponse({ message: 'Not Found' }, 404);
    if (relative.startsWith('pulls')) return jsonResponse([]);

    if (relative.startsWith('contents/')) {
      const filePath = relative.slice('contents/'.length);
      if (Object.prototype.hasOwnProperty.call(snapshot.files || {}, filePath)) {
        return jsonResponse(syntheticFile(filePath, snapshot.files[filePath]));
      }
      if (Array.isArray(snapshot.directories?.[filePath])) {
        return jsonResponse(snapshot.directories[filePath].map((item) => ({
          ...item,
          sha: `preview-${String(item.path || '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        })));
      }
      return jsonResponse({ message: 'Not Found' }, 404);
    }

    return jsonResponse({ message: 'Not Found' }, 404);
  };

  const handleMediaGet = async () => {
    const snapshot = await loadSnapshot();
    const items = (snapshot.directories?.['public/images'] || []).map((item) => ({
      key: String(item.path || '').replace(/^public\//, ''),
      size: item.size || 0,
      uploaded: null,
      url: `/${String(item.path || '').replace(/^public\//, '')}`,
    }));
    return jsonResponse({ configured: true, storage: 'preview', items });
  };

  window.fetch = async (input, init = {}) => {
    let url;
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      url = new URL(raw, window.location.href);
    } catch {
      return downstreamFetch(input, init);
    }

    const inputMethod = typeof input !== 'string' && input?.method ? input.method : 'GET';
    const method = String(init.method || inputMethod || 'GET').toUpperCase();
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin/api/')) {
      return downstreamFetch(input, init);
    }

    if (method !== 'GET') {
      return jsonResponse({ message: 'This temporary preview is read-only. Use the protected editor to save or publish.' }, 403);
    }

    try {
      if (url.pathname.startsWith('/admin/api/github/')) return await handleGithubGet(url);
      if (url.pathname === '/admin/api/media') return await handleMediaGet();
    } catch (error) {
      return jsonResponse({ message: error?.message || 'Preview data could not be loaded.' }, 500);
    }

    return downstreamFetch(input, init);
  };
})();
