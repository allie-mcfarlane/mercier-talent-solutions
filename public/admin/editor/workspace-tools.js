(() => {
  'use strict';

  const REPO = 'allie-mcfarlane/mercier-talent-solutions';
  const OWNER = 'allie-mcfarlane';
  const API = '/admin/api/github';
  const LEGACY_AUTH = 'token mts-cloudflare-access';
  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');
  const tool = document.body.dataset.tool || '';

  const state = {
    path: '',
    data: null,
    body: '',
    branch: '',
    pr: null,
    dirty: false,
    media: [],
    mediaFilter: '',
    replacePath: '',
  };

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const slugify = (value) => String(value || '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const authHeaders = async (base = {}) => {
    const headers = new Headers(base);
    let csrf = '';
    try { csrf = String(await window.MTSAdminSession?.getCsrf?.() || ''); } catch (_) {}
    if (csrf) {
      headers.set('X-MTS-CSRF', csrf);
      headers.set('Authorization', `token ${csrf}`);
    } else {
      headers.set('Authorization', LEGACY_AUTH);
    }
    return headers;
  };

  const api = async (path, options = {}) => {
    const headers = await authHeaders({
      Accept: 'application/vnd.github+json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    });
    const response = await fetch(`${API}/${path}`, { credentials: 'same-origin', ...options, headers });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const error = new Error(payload?.message || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const apiMaybe = async (path, options = {}) => {
    try { return await api(path, options); }
    catch (error) { if (error.status === 404) return null; throw error; }
  };

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input));
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  };

  const parseDocument = (text) => {
    const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: String(text || '') };
    return {
      data: window.jsyaml.load(match[1], { schema: window.jsyaml.JSON_SCHEMA }) || {},
      body: match[2] || '',
    };
  };

  const serializeDocument = (data, body = '') => {
    const yaml = window.jsyaml.dump(data || {}, {
      schema: window.jsyaml.JSON_SCHEMA,
      noRefs: true,
      lineWidth: -1,
      sortKeys: false,
      quotingType: '"',
      forceQuotes: false,
    });
    return `---\n${yaml}---${body ? `\n${body}` : ''}`;
  };

  const readFile = async (path, ref = 'main') => {
    const result = await apiMaybe(`repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`);
    if (!result) return null;
    return { text: decodeBase64(result.content), sha: result.sha };
  };

  const draftBranchFor = (path) => `cms/visual-${slugify(path.replace(/^src\/content\//, '').replace(/\.md$/i, ''))}`;
  const getMainRef = () => api(`repos/${REPO}/git/ref/heads/main`);
  const getBranchRef = (branch) => apiMaybe(`repos/${REPO}/git/ref/heads/${branch}`);

  const ensureBranch = async (branch) => {
    const existing = await getBranchRef(branch);
    if (existing) return existing;
    const main = await getMainRef();
    return api(`repos/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: main.object.sha }),
    });
  };

  const findDraftPr = async (branch) => {
    const pulls = await api(`repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${OWNER}:${branch}`)}&per_page=10`);
    return Array.isArray(pulls) ? pulls[0] || null : null;
  };

  const saveDraftFile = async (path, content, label) => {
    const branch = draftBranchFor(path);
    await ensureBranch(branch);
    const existing = await readFile(path, branch);
    await api(`repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Update ${label}`,
        content: encodeBase64(content),
        branch,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    });
    let pr = await findDraftPr(branch);
    if (!pr) {
      pr = await api(`repos/${REPO}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Draft: ${label}`,
          head: branch,
          base: 'main',
          body: 'Draft created in the Mercier visual website editor.',
          draft: true,
        }),
      });
    }
    state.branch = branch;
    state.pr = pr;
    return { branch, pr };
  };

  const publishDraftFile = async (path, content, label) => {
    const saved = await saveDraftFile(path, content, label);
    const result = await api(`repos/${REPO}/pulls/${saved.pr.number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash', commit_title: `Publish ${label}` }),
    });
    if (!result?.merged) throw new Error(result?.message || 'The draft could not be published.');
    try { await api(`repos/${REPO}/git/refs/heads/${saved.branch}`, { method: 'DELETE' }); } catch (_) {}
    state.branch = '';
    state.pr = null;
  };

  const toast = (message, error = false) => {
    if (!toastRoot) return;
    toastRoot.innerHTML = `<div class="ve-toast${error ? ' error' : ''}">${esc(message)}</div>`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
  };

  const statusMarkup = () => `<span id="mts-tool-status" class="mts-tool-status${state.dirty ? ' changed' : state.branch ? ' saved' : ''}">${state.dirty ? 'Unsaved changes' : state.branch ? 'Draft saved' : 'Current site'}</span>`;

  const setDirty = () => {
    state.dirty = true;
    const status = document.getElementById('mts-tool-status');
    if (status) { status.className = 'mts-tool-status changed'; status.textContent = 'Unsaved changes'; }
  };

  const loading = (label) => {
    app.innerHTML = `<div class="ve-shell"><main class="mts-tool-page"><div class="ve-loading"><div><div class="ve-spinner"></div>${esc(label)}</div></div></main></div>`;
  };

  const toolShell = ({ eyebrow, title, intro, actions = '', content = '' }) => `
    <div class="ve-shell">
      <main class="mts-tool-page">
        <header class="mts-tool-head">
          <div><span class="ve-eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(intro)}</p></div>
          <div class="mts-tool-actions">${statusMarkup()}${actions}</div>
        </header>
        ${content}
      </main>
    </div>`;

  const loadEditableDocument = async (path) => {
    const branch = draftBranchFor(path);
    const branchRef = await getBranchRef(branch);
    const source = await readFile(path, branchRef ? branch : 'main');
    if (!source) throw new Error('This website setting could not be found.');
    const parsed = parseDocument(source.text);
    state.path = path;
    state.data = parsed.data;
    state.body = parsed.body;
    state.branch = branchRef ? branch : '';
    state.pr = branchRef ? await findDraftPr(branch) : null;
    state.dirty = false;
  };

  const saveCurrent = async (publish, label) => {
    try {
      const buttons = document.querySelectorAll('[data-tool-save],[data-tool-publish]');
      buttons.forEach((button) => { button.disabled = true; });
      const content = serializeDocument(state.data, state.body);
      if (publish) {
        if (!confirm('Publish these changes to the live website?')) { buttons.forEach((button) => { button.disabled = false; }); return; }
        await publishDraftFile(state.path, content, label);
        state.dirty = false;
        toast('Published. Your live website is updating now.');
      } else {
        await saveDraftFile(state.path, content, label);
        state.dirty = false;
        toast('Draft saved. Nothing is live yet.');
      }
      const status = document.getElementById('mts-tool-status');
      if (status) { status.className = `mts-tool-status${publish ? '' : ' saved'}`; status.textContent = publish ? 'Published' : 'Draft saved'; }
      buttons.forEach((button) => { button.disabled = false; });
    } catch (error) {
      toast(error.message || 'Could not save these changes.', true);
      document.querySelectorAll('[data-tool-save],[data-tool-publish]').forEach((button) => { button.disabled = false; });
    }
  };

  const commonActions = () => '<button class="ve-button" type="button" data-tool-save>Save Draft</button><button class="ve-button primary" type="button" data-tool-publish>Publish</button>';

  const renderMenu = () => {
    const items = Array.isArray(state.data?.items) ? state.data.items : (state.data.items = []);
    app.innerHTML = toolShell({
      eyebrow: 'Website',
      title: 'Top Menu',
      intro: 'These are the links people see across the top of the website. Change the wording, page address or order, then Save Draft or Publish.',
      actions: commonActions(),
      content: `
        <section class="mts-tool-card">
          <div class="mts-tool-card-head"><div><h2>Menu links</h2><p class="mts-tool-note">Keep the menu short and clear. Drag-free controls make the order predictable.</p></div><button class="ve-button subtle" type="button" data-menu-add>Add menu item</button></div>
          <div class="mts-menu-list">
            ${items.map((item, index) => `<div class="mts-menu-row" data-menu-row="${index}">
              <label>Button text<input data-menu-label="${index}" value="${esc(item.label || '')}" /></label>
              <label>Page address<input data-menu-href="${index}" value="${esc(item.href || '')}" placeholder="/services/" /></label>
              <div class="mts-row-actions"><button class="ve-icon-button" type="button" data-menu-up="${index}" title="Move up">↑</button><button class="ve-icon-button" type="button" data-menu-down="${index}" title="Move down">↓</button><button class="ve-icon-button" type="button" data-menu-delete="${index}" title="Remove">×</button></div>
            </div>`).join('')}
          </div>
        </section>`,
    });
    bindMenu();
  };

  const bindMenu = () => {
    document.querySelector('[data-tool-save]')?.addEventListener('click', () => saveCurrent(false, 'Top Menu'));
    document.querySelector('[data-tool-publish]')?.addEventListener('click', () => saveCurrent(true, 'Top Menu'));
    document.querySelector('[data-menu-add]')?.addEventListener('click', () => { state.data.items.push({ label: 'New link', href: '/' }); setDirty(); renderMenu(); });
    document.querySelectorAll('[data-menu-label]').forEach((input) => input.addEventListener('input', () => { state.data.items[Number(input.dataset.menuLabel)].label = input.value; setDirty(); }));
    document.querySelectorAll('[data-menu-href]').forEach((input) => input.addEventListener('input', () => { state.data.items[Number(input.dataset.menuHref)].href = input.value; setDirty(); }));
    document.querySelectorAll('[data-menu-up]').forEach((button) => button.addEventListener('click', () => moveMenu(Number(button.dataset.menuUp), -1)));
    document.querySelectorAll('[data-menu-down]').forEach((button) => button.addEventListener('click', () => moveMenu(Number(button.dataset.menuDown), 1)));
    document.querySelectorAll('[data-menu-delete]').forEach((button) => button.addEventListener('click', () => { const index = Number(button.dataset.menuDelete); if (confirm(`Remove ${state.data.items[index]?.label || 'this menu item'}?`)) { state.data.items.splice(index, 1); setDirty(); renderMenu(); } }));
  };

  const moveMenu = (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= state.data.items.length) return;
    [state.data.items[index], state.data.items[next]] = [state.data.items[next], state.data.items[index]];
    setDirty(); renderMenu();
  };

  const DESIGN_DEFAULTS = {
    accentColor: '#45628e', darkColor: '#1a2b46', bodyTextColor: '#2b3036', mutedTextColor: '#66707c',
    bodyFontSize: 16, pageTitleSize: 'default', sectionTitleSize: 'default',
  };

  const designField = (name, label, note, type = 'color') => {
    const value = state.data?.[name] ?? DESIGN_DEFAULTS[name];
    if (type === 'select') return `<div class="mts-design-field"><label>${esc(label)}<select data-design="${name}"><option value="default"${value === 'default' ? ' selected' : ''}>Default</option><option value="smaller"${value === 'smaller' ? ' selected' : ''}>Slightly smaller</option><option value="larger"${value === 'larger' ? ' selected' : ''}>Slightly larger</option></select></label><p class="mts-tool-note">${esc(note)}</p></div>`;
    if (type === 'number') return `<div class="mts-design-field"><label>${esc(label)}<input type="number" min="14" max="22" step="1" data-design="${name}" value="${esc(value)}" /></label><p class="mts-tool-note">${esc(note)}</p></div>`;
    return `<div class="mts-design-field"><label>${esc(label)}<div class="mts-color-row"><input type="color" data-design-color="${name}" value="${esc(value)}" /><input data-design="${name}" value="${esc(value)}" /></div></label><p class="mts-tool-note">${esc(note)}</p></div>`;
  };

  const renderDesign = () => {
    app.innerHTML = toolShell({
      eyebrow: 'Website',
      title: 'Design',
      intro: 'A small set of safe design controls for the approved Mercier website. These settings adjust the existing design rather than redesigning the site.',
      actions: `${commonActions()}<button class="ve-button subtle" type="button" data-design-reset>Restore approved defaults</button>`,
      content: `
        <div class="mts-design-intro"><strong>Approved website defaults are protected.</strong> Keep changes restrained so the site stays consistent and readable across desktop and mobile.</div>
        <section class="mts-tool-card"><div class="mts-tool-card-head"><h2>Colors</h2></div><div class="mts-design-grid">
          ${designField('accentColor', 'Accent blue', 'Links, highlights and blue italic accents.')}
          ${designField('darkColor', 'Dark navy', 'Dark panels, buttons and navigation accents.')}
          ${designField('bodyTextColor', 'Main body text', 'Primary paragraph and content text.')}
          ${designField('mutedTextColor', 'Secondary text', 'Supporting copy and metadata.')}
        </div></section>
        <section class="mts-tool-card"><div class="mts-tool-card-head"><h2>Text sizing</h2></div><div class="mts-design-grid">
          ${designField('bodyFontSize', 'Body font size', 'Recommended range: 14–22 px.', 'number')}
          ${designField('pageTitleSize', 'Page title size', 'Adjust page hero titles without changing the typeface.', 'select')}
          ${designField('sectionTitleSize', 'Section heading size', 'Adjust section headings across the site.', 'select')}
        </div></section>`,
    });
    bindDesign();
  };

  const bindDesign = () => {
    document.querySelector('[data-tool-save]')?.addEventListener('click', () => saveCurrent(false, 'Design Settings'));
    document.querySelector('[data-tool-publish]')?.addEventListener('click', () => saveCurrent(true, 'Design Settings'));
    document.querySelector('[data-design-reset]')?.addEventListener('click', () => { if (!confirm('Restore all design controls to the approved Mercier defaults?')) return; state.data = { ...DESIGN_DEFAULTS }; setDirty(); renderDesign(); });
    document.querySelectorAll('[data-design]').forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      const key = input.dataset.design;
      state.data[key] = input.type === 'number' ? Number(input.value) : input.value;
      const color = document.querySelector(`[data-design-color="${key}"]`);
      if (color && /^#[0-9a-f]{6}$/i.test(input.value)) color.value = input.value;
      setDirty();
    }));
    document.querySelectorAll('[data-design-color]').forEach((input) => input.addEventListener('input', () => {
      const key = input.dataset.designColor;
      state.data[key] = input.value;
      const text = document.querySelector(`[data-design="${key}"]`);
      if (text) text.value = input.value;
      setDirty();
    }));
  };

  const mediaHeaders = async (base = {}) => authHeaders(base);

  const loadMedia = async () => {
    const headers = await mediaHeaders({ Accept: 'application/json' });
    const response = await fetch('/admin/api/media?prefix=images/', { credentials: 'same-origin', headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || 'Media Assets could not load.');
    state.media = Array.isArray(payload.items) ? payload.items : [];
  };

  const mediaItems = () => state.media.filter((item) => String(item.key || '').toLowerCase().includes(state.mediaFilter.toLowerCase()));

  const renderMedia = () => {
    const items = mediaItems();
    app.innerHTML = toolShell({
      eyebrow: 'Library',
      title: 'Media Assets',
      intro: 'Browse the images already used on the website, upload a new image, or replace an existing file visually.',
      actions: '<button class="ve-button primary" type="button" data-media-upload>Upload image</button>',
      content: `
        <section class="mts-tool-card">
          <div class="mts-media-toolbar"><input class="mts-media-search" type="search" value="${esc(state.mediaFilter)}" placeholder="Search images" data-media-search /><span class="mts-tool-note">${state.media.length} images</span></div>
          <div class="mts-media-grid">${items.length ? items.map((item) => `<article class="mts-media-card"><img src="${esc(item.url || `/${item.key}`)}" alt="" loading="lazy" /><div class="mts-media-card-copy"><strong title="${esc(item.key)}">${esc(String(item.key || '').replace(/^images\//, ''))}</strong><button class="ve-button subtle" type="button" data-media-replace="${esc(item.key)}">Replace image</button></div></article>`).join('') : '<div class="mts-media-empty">No images match that search.</div>'}</div>
          <p class="mts-upload-hint">Replacing an image keeps its existing website address, so pages that already use it continue to work.</p>
          <input id="mts-media-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif" hidden />
        </section>`,
    });
    bindMedia();
  };

  const cleanUploadName = (name) => {
    const match = String(name || '').match(/^(.*?)(\.[a-zA-Z0-9]+)$/);
    const base = slugify(match?.[1] || 'website-image') || 'website-image';
    const ext = (match?.[2] || '').toLowerCase();
    return `${base}${ext}`;
  };

  const uploadMedia = async (file, replacePath = '') => {
    if (!file) return;
    const path = replacePath || `images/${cleanUploadName(file.name)}`;
    try {
      const headers = await mediaHeaders({ 'Content-Type': file.type || 'application/octet-stream', Accept: 'application/json' });
      const response = await fetch(`/admin/api/media?path=${encodeURIComponent(path)}`, {
        method: 'POST', credentials: 'same-origin', headers, body: await file.arrayBuffer(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'The image could not be uploaded.');
      toast(replacePath ? 'Image replaced.' : 'Image uploaded.');
      await loadMedia();
      state.replacePath = '';
      renderMedia();
    } catch (error) { toast(error.message || 'The image could not be uploaded.', true); }
  };

  const bindMedia = () => {
    const input = document.getElementById('mts-media-file');
    document.querySelector('[data-media-upload]')?.addEventListener('click', () => { state.replacePath = ''; input?.click(); });
    document.querySelectorAll('[data-media-replace]').forEach((button) => button.addEventListener('click', () => { state.replacePath = button.dataset.mediaReplace; input?.click(); }));
    input?.addEventListener('change', () => { const file = input.files?.[0]; if (file) uploadMedia(file, state.replacePath); });
    document.querySelector('[data-media-search]')?.addEventListener('input', (event) => { state.mediaFilter = event.target.value; renderMedia(); document.querySelector('[data-media-search]')?.focus(); });
  };

  const start = async () => {
    if (!app) return;
    try {
      if (tool === 'menu') {
        loading('Opening Top Menu…');
        await loadEditableDocument('src/content/navigation/main.md');
        renderMenu();
        return;
      }
      if (tool === 'design') {
        loading('Opening Design…');
        await loadEditableDocument('src/content/settings/appearance.md');
        state.data = { ...DESIGN_DEFAULTS, ...(state.data || {}) };
        renderDesign();
        return;
      }
      if (tool === 'media') {
        loading('Opening Media Assets…');
        await loadMedia();
        renderMedia();
        return;
      }
      throw new Error('This editor tool is not configured.');
    } catch (error) {
      app.innerHTML = `<div class="ve-shell"><main class="mts-tool-page"><div class="ve-empty"><div><h2>Could not open this tool</h2><p>${esc(error.message || 'Please return to the editor dashboard and try again.')}</p><p style="margin-top:12px"><a class="ve-button" href="/admin/editor/#/">Back to Dashboard</a></p></div></div></main></div>`;
    }
  };

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  start();
})();