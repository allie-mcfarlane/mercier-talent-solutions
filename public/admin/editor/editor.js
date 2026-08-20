(() => {
  'use strict';

  const REPO = 'allie-mcfarlane/mercier-talent-solutions';
  const OWNER = 'allie-mcfarlane';
  const API = '/admin/api/github';
  const AUTH = 'token mts-cloudflare-access';
  const THEMES = ['white', 'paper', 'navy'];
  const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

  const PAGES = [
    { key: 'home', label: 'Home', file: 'src/content/pages/home.md', route: '/', note: 'Hero, intro cards, approach, blog heading and extra sections.' },
    { key: 'about', label: 'About', file: 'src/content/pages/about.md', route: '/about/', note: 'Firm introduction, team bios, headshots and extra sections.' },
    { key: 'services', label: 'Services', file: 'src/content/pages/services.md', route: '/services/', note: 'Hero image, focus areas, services, training and consulting.' },
    { key: 'news', label: 'News & Insights', file: 'src/content/pages/news.md', route: '/news/', note: 'Landing-page heading, introduction and extra sections.' },
    { key: 'whitepapers', label: 'White Papers', file: 'src/content/pages/whitepapers.md', route: '/whitepapers/', note: 'White Paper library introduction and extra sections.' },
    { key: 'contact', label: 'Contact', file: 'src/content/pages/contact.md', route: '/contactus/', note: 'Page heading and direct contact details.' },
    { key: 'privacy', label: 'Privacy Policy', file: 'src/content/pages/privacy.md', route: '/privacy/', note: 'Privacy policy text and date.' },
    { key: 'privacy-choices', label: 'Privacy Choices', file: 'src/content/pages/privacy-choices.md', route: '/privacy-choices/', note: 'Privacy choices information.' },
    { key: 'data-requests', label: 'Data Requests', file: 'src/content/pages/data-requests.md', route: '/data-requests/', note: 'Data request page copy and form options.' },
  ];

  const PAGE_SECTIONS = {
    home: [
      ['hero', 'Top of page', 'Heading, intro, buttons and hero photo.'],
      ['proof', 'Intro cards', 'Three intro cards and scrolling focus areas.'],
      ['approach', 'Our approach', 'Approach heading, copy and bullet points.'],
      ['news', 'Blog heading', 'Heading above the homepage blog posts.'],
      ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.'],
    ],
    about: [
      ['hero', 'Top of page', 'Heading and introduction.'],
      ['firm', 'Firm introduction', 'The firm introduction block.'],
      ['team', 'Team & photos', 'Names, headshots, bios and contact details.'],
      ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.'],
    ],
    services: [
      ['hero', 'Page header & photo', 'Heading, introduction and main services photo.'],
      ['focus', 'Focus areas', 'The focus-area cards near the top of the page.'],
      ['services', 'Services & photos', 'Edit each service and its image.'],
      ['training', 'Training', 'Training groups and program descriptions.'],
      ['consulting', 'Consulting', 'Consulting items and descriptions.'],
      ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.'],
    ],
    news: [['content', 'Page introduction', 'Heading and introductory paragraphs.'], ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.']],
    whitepapers: [['content', 'Page introduction', 'Heading and introductory text.'], ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.']],
    contact: [['content', 'Top of page', 'Heading and introduction.'], ['contacts', 'Contact details', 'Names, email addresses, phone numbers and LinkedIn links.'], ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.']],
    privacy: [['content', 'Privacy policy', 'Title, last-updated date and policy text.'], ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.']],
    'privacy-choices': [['content', 'Page content', 'Heading and privacy choices copy.'], ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.']],
    'data-requests': [['content', 'Page content', 'Heading, request options and page copy.'], ['extra', 'Additional sections', 'Add, duplicate and reorder visual sections.']],
    custom: [['info', 'Page details', 'Page name and website address.'], ['extra', 'Page sections', 'Build the page from ready-made visual sections.']],
  };

  const state = {
    screen: 'home',
    page: null,
    pageSection: null,
    doc: null,
    data: null,
    body: '',
    path: '',
    route: '',
    branch: '',
    pr: null,
    isNew: false,
    dirty: false,
    previewTimer: null,
    media: null,
    mediaCallback: null,
    blogSlug: null,
    blogSection: 'details',
    team: [],
    savedRange: null,
  };

  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const slugify = (value) => String(value || '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const hashString = (value) => {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  const draftBranchFor = (path) => `cms/visual-${slugify(path.split('/').pop()?.replace(/\.md$/i, '') || 'content')}-${hashString(path).slice(0, 6)}`;

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input));
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const api = async (path, options = {}) => {
    const response = await fetch(`${API}/${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: AUTH,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const error = new Error(payload?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const apiMaybe = async (path, options = {}) => {
    try { return await api(path, options); }
    catch (error) { if (error.status === 404) return null; throw error; }
  };

  const readFile = async (path, ref = 'main') => {
    const result = await apiMaybe(`repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`);
    if (!result) return null;
    return { text: decodeBase64(result.content), sha: result.sha, path: result.path };
  };

  const listDir = (path, ref = 'main') => api(`repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`);

  const parseDocument = (text) => {
    const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: String(text || '') };
    const data = window.jsyaml.load(match[1], { schema: window.jsyaml.JSON_SCHEMA }) || {};
    return { data, body: match[2] || '' };
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
    return `---\n${yaml}---\n${body || ''}`;
  };

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

  const saveDraftFile = async (path, content, label = 'Website edit') => {
    const branch = draftBranchFor(path);
    await ensureBranch(branch);
    const existing = await readFile(path, branch);
    const payload = {
      message: `Update ${label}`,
      content: encodeBase64(content),
      branch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    };
    await api(`repos/${REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify(payload) });
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
    return { branch, pr };
  };

  const publishDraftFile = async (path, content, label) => {
    const saved = await saveDraftFile(path, content, label);
    const result = await api(`repos/${REPO}/pulls/${saved.pr.number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash', commit_title: label }),
    });
    if (!result?.merged) throw new Error(result?.message || 'GitHub did not merge the draft.');
    try { await api(`repos/${REPO}/git/refs/heads/${saved.branch}`, { method: 'DELETE' }); } catch (_) {}
    return result;
  };

  const getPath = (root, path) => String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], root);
  const setPath = (root, path, value) => {
    const parts = String(path).split('.');
    let target = root;
    parts.slice(0, -1).forEach((part, index) => {
      const next = parts[index + 1];
      if (target[part] == null) target[part] = /^\d+$/.test(next) ? [] : {};
      target = target[part];
    });
    target[parts.at(-1)] = value;
  };

  const toast = (message, error = false) => {
    toastRoot.innerHTML = `<div class="ve-toast${error ? ' error' : ''}">${esc(message)}</div>`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
  };

  const loading = (message = 'Loading editor…') => {
    app.innerHTML = `<div class="ve-loading"><div><div class="ve-spinner"></div>${esc(message)}</div></div>`;
  };

  const shell = (content, active = '') => `
    <div class="ve-shell">
      <header class="ve-topbar">
        <div class="ve-brand-row">
          <a class="ve-brand" href="/admin/editor/#/">
            <img src="/images/mercier-logo-color.png" alt="Mercier Talent Solutions" />
            <span class="ve-brand-copy"><strong>Website Editor</strong><span>Mercier Talent Solutions</span></span>
          </a>
          <div class="ve-actions">
            <span class="ve-draft-pill">Draft mode</span>
            <a href="/" target="_blank" rel="noopener">View Website ↗</a>
          </div>
        </div>
        <nav class="ve-nav" aria-label="Website editor navigation">
          <a class="${active === 'home' ? 'active' : ''}" href="#/">Home</a>
          <a class="${active === 'pages' ? 'active' : ''}" href="#/pages">Pages</a>
          <a class="${active === 'blog' ? 'active' : ''}" href="#/blog">Blog Posts</a>
          <a href="/admin/#/collections/white-papers">White Papers</a>
          <a href="/admin/#/media">Media Assets</a>
          <a href="/admin/#/collections/navigation/entries/main">Top Menu</a>
          <a href="/admin/#/collections/settings/entries/appearance">Design</a>
        </nav>
      </header>
      ${content}
    </div>`;

  const renderHome = () => {
    state.screen = 'home'; state.dirty = false;
    app.innerHTML = shell(`
      <main class="ve-main">
        <span class="ve-eyebrow">Website Editor</span>
        <h1 class="ve-title">What would you like to change?</h1>
        <p class="ve-lede">Choose a task. Work stays in draft until you publish, and page editing shows the website beside your changes.</p>
        <div class="ve-home-grid">
          <a class="ve-home-card" href="#/pages"><span class="ve-card-icon">1</span><strong>Edit a page</strong><p>Change text, replace photos, duplicate or add sections, and click the preview to jump to what you want to edit.</p><span class="ve-card-action">Choose a page →</span></a>
          <a class="ve-home-card" href="#/new-page"><span class="ve-card-icon">2</span><strong>Create a new page</strong><p>Build a page from ready-made Mercier sections without touching code.</p><span class="ve-card-action">Create page →</span></a>
          <a class="ve-home-card" href="#/blog"><span class="ve-card-icon">3</span><strong>Blog posts</strong><p>Write articles, insert images, reuse sources for citations, and preview the finished article.</p><span class="ve-card-action">Open Blog Posts →</span></a>
        </div>
        <section class="ve-secondary-tools">
          <h2>More website tools</h2>
          <div class="ve-tool-row">
            <a href="/admin/#/collections/white-papers"><strong>White Papers</strong><span>Manage PDFs and library entries</span></a>
            <a href="/admin/#/media"><strong>Media Assets</strong><span>Browse or upload website images</span></a>
            <a href="/admin/#/collections/navigation/entries/main"><strong>Top Menu</strong><span>Manage website navigation</span></a>
            <a href="/admin/#/collections/settings/entries/appearance"><strong>Design</strong><span>Approved colors and font sizes</span></a>
          </div>
        </section>
      </main>`, 'home');
  };

  const renderPages = () => {
    state.screen = 'pages';
    app.innerHTML = shell(`
      <main class="ve-main">
        <div class="ve-list-head"><div><span class="ve-eyebrow">Pages</span><h1 class="ve-title">Which page do you want to edit?</h1><p class="ve-lede">Choose a page, then click the part you want to change. The preview stays beside the editor.</p></div><a class="ve-button primary" href="#/new-page">Create new page</a></div>
        <div class="ve-page-grid">${PAGES.map((page) => `<a class="ve-page-card" href="#/page/${page.key}"><strong>${esc(page.label)}</strong><p>${esc(page.note)}</p><span class="ve-card-action">Edit page →</span></a>`).join('')}</div>
      </main>`, 'pages');
  };

  const loadDocument = async (path) => {
    const branch = draftBranchFor(path);
    const branchRef = await getBranchRef(branch);
    const source = await readFile(path, branchRef ? branch : 'main');
    if (!source) throw new Error('This content file could not be found.');
    const parsed = parseDocument(source.text);
    return { ...parsed, source, branch: branchRef ? branch : '', pr: branchRef ? await findDraftPr(branch) : null };
  };

  const field = (path, label, value, options = {}) => {
    const hint = options.hint ? `<small>${esc(options.hint)}</small>` : '';
    const type = options.type || 'text';
    if (type === 'textarea') return `<div class="ve-field"><label>${esc(label)}</label><textarea data-bind="${esc(path)}" rows="${options.rows || 4}">${esc(value ?? '')}</textarea>${hint}</div>`;
    if (type === 'select') return `<div class="ve-field"><label>${esc(label)}</label><select data-bind="${esc(path)}">${(options.options || []).map((item) => { const pair = typeof item === 'string' ? [item, item] : item; return `<option value="${esc(pair[1])}"${String(value ?? '') === String(pair[1]) ? ' selected' : ''}>${esc(pair[0])}</option>`; }).join('')}</select>${hint}</div>`;
    return `<div class="ve-field"><label>${esc(label)}</label><input type="${esc(type)}" data-bind="${esc(path)}" value="${esc(value ?? '')}" />${hint}</div>`;
  };

  const imageField = (path, label, altPath = null) => {
    const value = getPath(state.data, path) || '';
    const alt = altPath ? getPath(state.data, altPath) || '' : '';
    return `<div class="ve-field"><label>${esc(label)}</label><div class="ve-image-field"><div class="ve-image-current">${value ? `<img src="${esc(value)}" alt="" />` : '<div style="width:76px;height:54px;border-radius:7px;background:#edf0f3"></div>'}<div><strong>${value ? 'Current image' : 'No image selected'}</strong><span>${esc(value || 'Choose from Media Assets')}</span></div></div><button class="ve-button subtle" type="button" data-action="choose-image" data-target="${esc(path)}">${value ? 'Replace image' : 'Choose image'}</button>${altPath ? `<input data-bind="${esc(altPath)}" value="${esc(alt)}" placeholder="Image description" aria-label="Image description" />` : ''}</div></div>`;
  };

  const linesField = (path, label, values, hint = '') => field(path, label, Array.isArray(values) ? values.join('\n') : '', { type: 'textarea', rows: 6, hint, lines: true }).replace(`data-bind="${esc(path)}"`, `data-lines="${esc(path)}"`);

  const pageSectionMeta = (pageKey) => PAGE_SECTIONS[pageKey] || PAGE_SECTIONS.news;

  const duplicateFixedButton = (pageKey, sectionId) => {
    const allowed = (pageKey === 'home' && ['hero', 'approach'].includes(sectionId)) || (pageKey === 'about' && sectionId === 'firm') || (pageKey === 'services' && sectionId === 'hero');
    return allowed ? `<button class="ve-button subtle" type="button" data-action="copy-fixed" data-section="${esc(sectionId)}">Duplicate as new section</button>` : '';
  };

  const renderPageHero = (pageKey) => {
    if (pageKey === 'home') return `${field('eyebrow', 'Small label', state.data.eyebrow)}${field('title', 'Main heading', state.data.title)}${field('titleAccent', 'Blue italic words', state.data.titleAccent)}${field('lede', 'Intro text', state.data.lede, { type: 'textarea' })}${imageField('heroImage', 'Hero photo', 'heroImageAlt')}<div class="ve-group"><div class="ve-group-head"><h3>Primary button</h3></div><div class="ve-inline-fields">${field('primaryCta.label', 'Button text', state.data.primaryCta?.label)}${field('primaryCta.href', 'Link', state.data.primaryCta?.href)}</div></div><div class="ve-group"><div class="ve-group-head"><h3>Secondary button</h3></div><div class="ve-inline-fields">${field('secondaryCta.label', 'Button text', state.data.secondaryCta?.label)}${field('secondaryCta.href', 'Link', state.data.secondaryCta?.href)}</div></div>`;
    if (pageKey === 'services') return `${field('eyebrow', 'Small label', state.data.eyebrow)}${field('title', 'Main heading', state.data.title)}${field('titleAccent', 'Blue italic words', state.data.titleAccent)}${field('lede', 'Intro text', state.data.lede, { type: 'textarea' })}${imageField('heroImage', 'Main page photo', 'heroImageAlt')}${field('focusIntro', 'Focus area introduction', state.data.focusIntro, { type: 'textarea' })}`;
    return `${field('eyebrow', 'Small label', state.data.eyebrow)}${field('title', 'Main heading', state.data.title)}${field('titleAccent', 'Blue italic words', state.data.titleAccent)}${field('lede', 'Intro text', state.data.lede, { type: 'textarea' })}`;
  };

  const renderProof = () => `<div class="ve-list">${(state.data.proof || []).map((item, i) => `<div class="ve-list-item"><div class="ve-list-item-head"><strong>Card ${i + 1}</strong></div>${field(`proof.${i}.title`, 'Title', item.title)}${field(`proof.${i}.text`, 'Text', item.text, { type: 'textarea' })}</div>`).join('')}</div>${linesField('marqueeItems', 'Scrolling focus areas', state.data.marqueeItems, 'One item per line.')}`;
  const renderApproach = () => `${field('approach.eyebrow', 'Small label', state.data.approach?.eyebrow)}${field('approach.title', 'Heading', state.data.approach?.title)}${field('approach.text', 'Text', state.data.approach?.text, { type: 'textarea' })}${linesField('approach.items', 'Bullet points', state.data.approach?.items, 'One bullet per line.')}`;
  const renderNewsHeading = () => `${field('news.eyebrow', 'Small label', state.data.news?.eyebrow)}${field('news.title', 'Heading', state.data.news?.title)}`;
  const renderFirm = () => `${field('firm.eyebrow', 'Small label', state.data.firm?.eyebrow)}${field('firm.title', 'Heading', state.data.firm?.title)}${field('firm.text', 'Text', state.data.firm?.text, { type: 'textarea', rows: 6 })}`;

  const renderTeam = () => `<div class="ve-list">${(state.data.team || []).map((person, i) => `<details class="ve-list-item"${i === 0 ? ' open' : ''}><summary class="ve-list-item-head"><strong>${esc(person.name || `Team member ${i + 1}`)}</strong><span style="color:#7a8796;font-size:9px">Click to edit</span></summary><div class="ve-form" style="margin-top:10px">${field(`team.${i}.eyebrow`, 'Role', person.eyebrow)}${field(`team.${i}.name`, 'Name', person.name)}${imageField(`team.${i}.image`, 'Headshot', `team.${i}.imageAlt`)}${linesField(`team.${i}.paragraphs`, 'Bio paragraphs', person.paragraphs, 'Separate paragraphs with a new line.')}${field(`team.${i}.email`, 'Email', person.email, { type: 'email' })}${field(`team.${i}.phone`, 'Phone', person.phone)}${field(`team.${i}.linkedin`, 'LinkedIn', person.linkedin)}${field(`team.${i}.credentialsEyebrow`, 'Credentials heading', person.credentialsEyebrow)}${field(`team.${i}.credentials`, 'Credentials', person.credentials, { type: 'textarea' })}</div></details>`).join('')}</div>`;

  const renderFocus = () => `<div class="ve-list">${(state.data.focusAreas || []).map((item, i) => `<div class="ve-list-item"><div class="ve-list-item-head"><strong>${esc(item.title || `Focus area ${i + 1}`)}</strong></div>${field(`focusAreas.${i}.title`, 'Title', item.title)}${field(`focusAreas.${i}.text`, 'Text', item.text, { type: 'textarea' })}</div>`).join('')}</div>`;

  const renderServices = () => `<div class="ve-list">${(state.data.services || []).map((item, i) => `<details class="ve-list-item"${i === 0 ? ' open' : ''}><summary class="ve-list-item-head"><strong>${esc(item.number || `${i + 1}`)} · ${esc(item.title || 'Service')}</strong><span style="color:#7a8796;font-size:9px">Click to edit</span></summary><div class="ve-form" style="margin-top:10px"><div class="ve-inline-fields">${field(`services.${i}.number`, 'Number', item.number)}${field(`services.${i}.eyebrow`, 'Small label', item.eyebrow)}</div>${field(`services.${i}.title`, 'Service name', item.title)}${field(`services.${i}.summary`, 'Short summary', item.summary, { type: 'textarea' })}${field(`services.${i}.detail`, 'Full description', item.detail, { type: 'textarea', rows: 6 })}${imageField(`services.${i}.image`, 'Service photo', `services.${i}.imageAlt`)}</div></details>`).join('')}</div>`;

  const renderTraining = () => `${field('training.eyebrow', 'Small label', state.data.training?.eyebrow)}${field('training.title', 'Heading', state.data.training?.title, { type: 'textarea' })}<div class="ve-list">${(state.data.training?.groups || []).map((group, gi) => `<details class="ve-list-item"><summary class="ve-list-item-head"><strong>${esc(group.group || `Group ${gi + 1}`)}</strong><span style="color:#7a8796;font-size:9px">${group.items?.length || 0} programs</span></summary><div class="ve-form" style="margin-top:10px">${field(`training.groups.${gi}.group`, 'Group name', group.group)}${(group.items || []).map((item, ii) => `<div class="ve-group">${field(`training.groups.${gi}.items.${ii}.title`, 'Program title', item.title)}${field(`training.groups.${gi}.items.${ii}.text`, 'Description', item.text, { type: 'textarea' })}</div>`).join('')}</div></details>`).join('')}</div>`;

  const renderConsulting = () => `<div class="ve-list">${(state.data.consulting?.items || []).map((item, i) => { const obj = typeof item === 'string' ? { title: item, text: '' } : item; if (typeof item === 'string') state.data.consulting.items[i] = obj; return `<div class="ve-list-item">${field(`consulting.items.${i}.title`, 'Title', obj.title)}${field(`consulting.items.${i}.text`, 'Description', obj.text, { type: 'textarea' })}</div>`; }).join('')}</div>`;

  const themeButtons = (index, theme) => `<div class="ve-theme-row">${THEMES.map((value) => `<button type="button" class="ve-theme${theme === value ? ' active' : ''}" data-action="section-theme" data-index="${index}" data-theme="${value}"><i></i>${value === 'white' ? 'White' : value === 'paper' ? 'Soft gray' : 'Navy'}</button>`).join('')}</div>`;

  const builderTypeLabel = (type) => ({ hero: 'Hero / feature', text: 'Text', imageText: 'Image + text', cards: 'Cards / grid', image: 'Full-width image', callout: 'Call to action', html: 'Advanced HTML' }[type] || 'Section');

  const builderFields = (section, index) => {
    const prefix = `sections.${index}`;
    const common = `${themeButtons(index, section.theme || 'white')}`;
    if (section.type === 'hero') return `${common}${field(`${prefix}.eyebrow`, 'Small label', section.eyebrow)}${field(`${prefix}.title`, 'Heading', section.title)}${field(`${prefix}.titleAccent`, 'Blue italic words', section.titleAccent)}${field(`${prefix}.text`, 'Text', section.text, { type: 'textarea' })}${imageField(`${prefix}.image`, 'Image', `${prefix}.imageAlt`)}<div class="ve-inline-fields">${field(`${prefix}.buttonLabel`, 'Button text', section.buttonLabel)}${field(`${prefix}.buttonLink`, 'Button link', section.buttonLink)}</div>`;
    if (section.type === 'imageText') return `${common}${imageField(`${prefix}.image`, 'Image', `${prefix}.imageAlt`)}${field(`${prefix}.eyebrow`, 'Small label', section.eyebrow)}${field(`${prefix}.title`, 'Heading', section.title)}${field(`${prefix}.text`, 'Text', section.text, { type: 'textarea', rows: 6 })}<div class="ve-inline-fields">${field(`${prefix}.imagePosition`, 'Image position', section.imagePosition || 'left', { type: 'select', options: [['Left', 'left'], ['Right', 'right']] })}${field(`${prefix}.headingSize`, 'Heading size', section.headingSize || 'default', { type: 'select', options: [['Default', 'default'], ['Smaller', 'small'], ['Larger', 'large']] })}</div><div class="ve-inline-fields">${field(`${prefix}.buttonLabel`, 'Button text', section.buttonLabel)}${field(`${prefix}.buttonLink`, 'Button link', section.buttonLink)}</div>`;
    if (section.type === 'cards') return `${common}${field(`${prefix}.eyebrow`, 'Small label', section.eyebrow)}${field(`${prefix}.title`, 'Section heading', section.title)}${field(`${prefix}.columns`, 'Columns', section.columns || '3', { type: 'select', options: ['2', '3', '4'] })}<div class="ve-list">${(section.items || []).map((item, ii) => `<div class="ve-list-item">${field(`${prefix}.items.${ii}.title`, 'Card title', item.title)}${field(`${prefix}.items.${ii}.text`, 'Card text', item.text, { type: 'textarea' })}${imageField(`${prefix}.items.${ii}.image`, 'Card image', `${prefix}.items.${ii}.imageAlt`)}</div>`).join('')}<button class="ve-button subtle" data-action="add-card" data-index="${index}" type="button">Add card</button></div>`;
    if (section.type === 'image') return `${common}${imageField(`${prefix}.image`, 'Image', `${prefix}.imageAlt`)}${field(`${prefix}.caption`, 'Caption (optional)', section.caption)}`;
    if (section.type === 'callout') return `${common}${field(`${prefix}.eyebrow`, 'Small label', section.eyebrow)}${field(`${prefix}.title`, 'Heading', section.title)}${field(`${prefix}.text`, 'Text', section.text, { type: 'textarea' })}<div class="ve-inline-fields">${field(`${prefix}.buttonLabel`, 'Button text', section.buttonLabel)}${field(`${prefix}.buttonLink`, 'Button link', section.buttonLink)}</div>`;
    if (section.type === 'html') return `${common}${field(`${prefix}.html`, 'HTML', section.html, { type: 'textarea', rows: 12, hint: 'Advanced option. Use the visual section types whenever possible.' })}`;
    return `${common}${field(`${prefix}.eyebrow`, 'Small label', section.eyebrow)}${field(`${prefix}.title`, 'Heading', section.title)}${field(`${prefix}.text`, 'Text', section.text, { type: 'textarea', rows: 7 })}${field(`${prefix}.headingSize`, 'Heading size', section.headingSize || 'default', { type: 'select', options: [['Default', 'default'], ['Smaller', 'small'], ['Larger', 'large']] })}`;
  };

  const renderExtraSections = () => {
    const sections = state.data.sections || (state.data.sections = []);
    return `<div class="ve-form"><div class="ve-group"><div class="ve-group-head"><h3>Add a section</h3></div><div class="ve-add-menu">${[
      ['hero', 'Hero / feature', 'Large heading, text, button and optional image.'], ['text', 'Text', 'A clean text section.'], ['imageText', 'Image + text', 'Photo beside heading and copy.'], ['cards', 'Cards / grid', 'Two to four cards for services or features.'], ['image', 'Full-width image', 'A large image with optional caption.'], ['callout', 'Call to action', 'A focused closing section with a button.'],
    ].map(([type, title, note]) => `<button type="button" data-action="add-section" data-type="${type}"><strong>${title}</strong><span>${note}</span></button>`).join('')}</div></div>${sections.length ? sections.map((section, i) => `<div class="ve-section-card"><div class="ve-section-card-head"><div><strong>${i + 1}. ${esc(builderTypeLabel(section.type))}</strong><span>${esc(section.title || section.eyebrow || 'Untitled section')}</span></div><div class="ve-mini-actions"><button class="ve-icon-button" type="button" data-action="move-section-up" data-index="${i}" title="Move up">↑</button><button class="ve-icon-button" type="button" data-action="move-section-down" data-index="${i}" title="Move down">↓</button><button class="ve-icon-button" type="button" data-action="duplicate-section" data-index="${i}" title="Duplicate">Copy</button><button class="ve-icon-button" type="button" data-action="delete-section" data-index="${i}" title="Delete">×</button></div></div>${builderFields(section, i)}</div>`).join('') : '<div class="ve-empty"><div><h2>No additional sections yet</h2><p>Choose a section type above. You can duplicate it, reorder it, and choose White, Soft Gray or Navy.</p></div></div>'}</div>`;
  };

  const renderGenericContent = (pageKey) => {
    let html = `${field('eyebrow', 'Small label', state.data.eyebrow)}${field('title', 'Main heading', state.data.title)}${field('titleAccent', 'Blue italic words', state.data.titleAccent)}`;
    if ('lede' in state.data) html += field('lede', 'Intro text', state.data.lede, { type: 'textarea' });
    if (Array.isArray(state.data.paragraphs)) html += linesField('paragraphs', 'Intro paragraphs', state.data.paragraphs, 'One paragraph per line.');
    if (state.data.updated !== undefined) html += field('updated', 'Last updated', state.data.updated);
    if (['privacy', 'privacy-choices', 'data-requests'].includes(pageKey)) html += field('__body__', 'Page text', state.body, { type: 'textarea', rows: 18 });
    if (pageKey === 'data-requests') html += `${field('formSubject', 'Form email subject', state.data.formSubject)}${field('formName', 'Form name', state.data.formName)}${linesField('requestOptions', 'Request options', state.data.requestOptions, 'One option per line.')}`;
    return html;
  };

  const renderContacts = () => `<div class="ve-list">${(state.data.contacts || []).map((contact, i) => `<div class="ve-list-item"><div class="ve-list-item-head"><strong>${esc(contact.name || `Contact ${i + 1}`)}</strong></div>${field(`contacts.${i}.eyebrow`, 'Role', contact.eyebrow)}${field(`contacts.${i}.name`, 'Name', contact.name)}${field(`contacts.${i}.email`, 'Email', contact.email, { type: 'email' })}${field(`contacts.${i}.phone`, 'Phone', contact.phone)}${field(`contacts.${i}.linkedin`, 'LinkedIn', contact.linkedin)}</div>`).join('')}</div>`;

  const renderCurrentPageSection = () => {
    const key = state.page.key;
    const section = state.pageSection || pageSectionMeta(key)[0][0];
    if (section === 'extra') return renderExtraSections();
    if (section === 'hero') return renderPageHero(key);
    if (key === 'home' && section === 'proof') return renderProof();
    if (key === 'home' && section === 'approach') return renderApproach();
    if (key === 'home' && section === 'news') return renderNewsHeading();
    if (key === 'about' && section === 'firm') return renderFirm();
    if (key === 'about' && section === 'team') return renderTeam();
    if (key === 'services' && section === 'focus') return renderFocus();
    if (key === 'services' && section === 'services') return renderServices();
    if (key === 'services' && section === 'training') return renderTraining();
    if (key === 'services' && section === 'consulting') return renderConsulting();
    if (key === 'contact' && section === 'contacts') return renderContacts();
    return renderGenericContent(key);
  };

  const editorLayout = ({ active = 'pages', title, subtitle, backHref, sections, selected, formHtml, previewRoute, newPage = false }) => shell(`
    <main class="ve-editor">
      <aside class="ve-sidebar"><a class="ve-sidebar-back" href="${backHref}">← Back</a><h2>${esc(title)}</h2><p>${esc(subtitle)}</p><div class="ve-section-list">${sections.map(([id, label, note]) => `<button class="ve-section-button${selected === id ? ' active' : ''}" type="button" data-section-select="${esc(id)}"><strong>${esc(label)}</strong><span>${esc(note)}</span></button>`).join('')}</div></aside>
      <section class="ve-editor-pane"><div class="ve-editor-head"><div><span class="ve-eyebrow">${newPage ? 'New page' : active === 'blog' ? 'Blog post' : 'Edit page'}</span><h1>${esc(sections.find(([id]) => id === selected)?.[1] || title)}</h1><p>${esc(sections.find(([id]) => id === selected)?.[2] || '')}</p></div><div class="ve-editor-actions">${active === 'pages' && !newPage ? duplicateFixedButton(state.page.key, selected) : ''}<button class="ve-button" type="button" data-action="save-draft">Save draft</button><button class="ve-button primary" type="button" data-action="publish">Publish</button></div></div><div id="ve-form" class="ve-form">${formHtml}</div></section>
      <aside class="ve-preview-pane"><div class="ve-preview-bar"><div><strong>Website preview</strong><span>Click a section in the preview to edit it.</span></div><span id="ve-status" class="ve-status${state.dirty ? ' changed' : ''}">${state.dirty ? 'Unsaved changes' : state.branch ? 'Draft loaded' : 'Current site'}</span></div><iframe id="ve-preview" class="ve-preview-frame" src="${esc(previewRoute)}" title="Website preview"></iframe></aside>
    </main>`, active);

  const editPage = async (key) => {
    const page = PAGES.find((item) => item.key === key);
    if (!page) { location.hash = '#/pages'; return; }
    loading('Opening page…');
    try {
      const doc = await loadDocument(page.file);
      state.screen = 'page'; state.page = page; state.pageSection = pageSectionMeta(key)[0][0]; state.doc = doc; state.data = doc.data; state.body = doc.body; state.path = page.file; state.route = page.route; state.branch = doc.branch; state.pr = doc.pr; state.isNew = false; state.dirty = false;
      if (!Array.isArray(state.data.sections)) state.data.sections = [];
      renderPageEditor();
    } catch (error) { toast(error.message, true); renderPages(); }
  };

  const renderPageEditor = () => {
    const meta = pageSectionMeta(state.page.key);
    if (!meta.some(([id]) => id === state.pageSection)) state.pageSection = meta[0][0];
    app.innerHTML = editorLayout({ active: 'pages', title: state.page.label, subtitle: 'Choose a part of the page. Only that part is shown in the editor.', backHref: '#/pages', sections: meta, selected: state.pageSection, formHtml: renderCurrentPageSection(), previewRoute: state.route });
    bindEditorEvents();
    bindPreview('page');
  };

  const newBuilderSection = (type) => {
    const base = { type, theme: type === 'callout' ? 'navy' : 'white' };
    if (type === 'hero') return { ...base, eyebrow: '', title: 'New section', titleAccent: '', text: '', image: '', imageAlt: '', buttonLabel: '', buttonLink: '', align: 'left' };
    if (type === 'imageText') return { ...base, image: '', imageAlt: '', eyebrow: '', title: 'New section', text: '', imagePosition: 'left', headingSize: 'default', buttonLabel: '', buttonLink: '' };
    if (type === 'cards') return { ...base, eyebrow: '', title: 'New section', columns: '3', items: [{ title: 'Card title', text: '', image: '', imageAlt: '' }] };
    if (type === 'image') return { ...base, image: '', imageAlt: '', caption: '' };
    if (type === 'callout') return { ...base, eyebrow: '', title: 'Ready to get started?', text: '', buttonLabel: 'Contact us', buttonLink: '/contactus/', align: 'center' };
    if (type === 'html') return { ...base, html: '' };
    return { ...base, eyebrow: '', title: 'New section', text: '', headingSize: 'default', align: 'left' };
  };

  const copyFixedSection = (sectionId) => {
    const key = state.page.key;
    let section = null;
    if (key === 'home' && sectionId === 'hero') section = { type: 'hero', theme: 'white', eyebrow: state.data.eyebrow, title: state.data.title, titleAccent: state.data.titleAccent, text: state.data.lede, image: state.data.heroImage || '', imageAlt: state.data.heroImageAlt || '', buttonLabel: state.data.primaryCta?.label || '', buttonLink: state.data.primaryCta?.href || '', align: 'left' };
    if (key === 'home' && sectionId === 'approach') section = { type: 'text', theme: 'white', eyebrow: state.data.approach?.eyebrow || '', title: state.data.approach?.title || '', text: [state.data.approach?.text || '', ...(state.data.approach?.items || []).map((item) => `• ${item}`)].filter(Boolean).join('\n\n'), headingSize: 'default', align: 'left' };
    if (key === 'about' && sectionId === 'firm') section = { type: 'text', theme: 'white', eyebrow: state.data.firm?.eyebrow || '', title: state.data.firm?.title || '', text: state.data.firm?.text || '', headingSize: 'default', align: 'left' };
    if (key === 'services' && sectionId === 'hero') section = { type: 'hero', theme: 'white', eyebrow: state.data.eyebrow, title: state.data.title, titleAccent: state.data.titleAccent, text: state.data.lede, image: state.data.heroImage || '', imageAlt: state.data.heroImageAlt || '', align: 'left' };
    if (!section) return;
    state.data.sections ||= [];
    state.data.sections.push(section);
    markDirty(); state.pageSection = 'extra'; renderPageEditor(); toast('Copied into Additional sections. You can edit the copy without changing the original.');
  };

  const startNewPage = () => {
    state.screen = 'new-page'; state.page = { key: 'custom', label: 'New Page', route: '/' }; state.pageSection = 'info'; state.data = { pageBuilder: true, slug: '', navTitle: '', seoDescription: '', sections: [newBuilderSection('hero')] }; state.body = ''; state.path = ''; state.route = '/'; state.branch = ''; state.pr = null; state.isNew = true; state.dirty = true;
    renderNewPageEditor();
  };

  const renderNewPageEditor = () => {
    const meta = PAGE_SECTIONS.custom;
    const formHtml = state.pageSection === 'info'
      ? `${field('navTitle', 'Page name', state.data.navTitle, { hint: 'Example: Leadership Programs' })}${field('slug', 'Page address', state.data.slug, { hint: 'Example: leadership-programs. The website address will be /leadership-programs/.' })}${field('seoDescription', 'Search description (optional)', state.data.seoDescription, { type: 'textarea' })}`
      : renderExtraSections();
    app.innerHTML = editorLayout({ active: 'pages', title: 'Create a new page', subtitle: 'Start with the page name, then build it from ready-made sections.', backHref: '#/pages', sections: meta, selected: state.pageSection, formHtml, previewRoute: '/', newPage: true });
    bindEditorEvents(); bindPreview('custom');
  };

  const markDirty = () => {
    state.dirty = true;
    const status = document.getElementById('ve-status');
    if (status) { status.className = 've-status changed'; status.textContent = 'Unsaved changes'; }
    schedulePreview();
  };

  const readFormBody = () => {
    const editor = document.getElementById('ve-rich-editor');
    if (!editor) return;
    state.body = richHtmlToMarkdown(editor.innerHTML);
  };

  const currentSerialized = () => {
    if (state.screen === 'blog-edit') readFormBody();
    return serializeDocument(state.data, state.body);
  };

  const performSave = async (publish = false) => {
    try {
      if (state.isNew) {
        const slug = slugify(state.data.slug || state.data.navTitle);
        if (!slug) throw new Error('Add a page address before saving.');
        state.data.slug = slug;
        state.data.pageBuilder = true;
        state.path = `src/content/pages/${slug}.md`;
      }
      if (state.screen === 'blog-edit' && state.isNew) {
        const slug = slugify(state.data.title);
        if (!slug) throw new Error('Add a headline before saving.');
        state.path = `src/content/posts/${slug}.md`;
        state.blogSlug = slug;
      }
      if (!state.path) throw new Error('This item does not have a content file yet.');
      normalizeReferences();
      const content = currentSerialized();
      const label = state.screen === 'blog-edit' ? `Blog post: ${state.data.title || state.blogSlug}` : state.isNew ? `Page: ${state.data.navTitle || state.data.slug}` : `Page: ${state.page.label}`;
      const buttons = document.querySelectorAll('[data-action="save-draft"],[data-action="publish"]');
      buttons.forEach((button) => { button.disabled = true; });
      if (publish) {
        if (!confirm('Publish these changes to the live website?')) { buttons.forEach((button) => { button.disabled = false; }); return; }
        await publishDraftFile(state.path, content, `Publish ${label}`);
        state.branch = ''; state.pr = null; state.dirty = false; state.isNew = false; toast('Published. Cloudflare will update the website shortly.');
      } else {
        const saved = await saveDraftFile(state.path, content, label);
        state.branch = saved.branch; state.pr = saved.pr; state.dirty = false; state.isNew = false; toast('Draft saved. Nothing is live yet.');
      }
      const status = document.getElementById('ve-status');
      if (status) { status.className = 've-status saved'; status.textContent = publish ? 'Published' : 'Draft saved'; }
      buttons.forEach((button) => { button.disabled = false; });
    } catch (error) { toast(error.message || 'Could not save.', true); document.querySelectorAll('[data-action="save-draft"],[data-action="publish"]').forEach((button) => { button.disabled = false; }); }
  };

  const bindCommonInputs = () => {
    document.querySelectorAll('[data-bind]').forEach((input) => {
      const handler = () => {
        const path = input.dataset.bind;
        if (path === '__body__') state.body = input.value;
        else setPath(state.data, path, input.type === 'checkbox' ? input.checked : input.value);
        markDirty();
      };
      input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', handler);
    });
    document.querySelectorAll('[data-lines]').forEach((input) => input.addEventListener('input', () => {
      setPath(state.data, input.dataset.lines, input.value.split('\n').map((line) => line.trim()).filter(Boolean)); markDirty();
    }));
  };

  const bindEditorEvents = () => {
    document.querySelectorAll('[data-section-select]').forEach((button) => button.addEventListener('click', () => {
      if (state.screen === 'blog-edit') { state.blogSection = button.dataset.sectionSelect; renderBlogEditor(); }
      else { state.pageSection = button.dataset.sectionSelect; state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); }
    }));
    bindCommonInputs();
    document.querySelector('[data-action="save-draft"]')?.addEventListener('click', () => performSave(false));
    document.querySelector('[data-action="publish"]')?.addEventListener('click', () => performSave(true));
    document.querySelectorAll('[data-action="choose-image"]').forEach((button) => button.addEventListener('click', () => openMediaPicker((path) => { setPath(state.data, button.dataset.target, path); markDirty(); state.screen === 'blog-edit' ? renderBlogEditor() : state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); })));
    document.querySelectorAll('[data-action="add-section"]').forEach((button) => button.addEventListener('click', () => { state.data.sections ||= []; state.data.sections.push(newBuilderSection(button.dataset.type)); markDirty(); state.pageSection = 'extra'; state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); }));
    document.querySelectorAll('[data-action="duplicate-section"]').forEach((button) => button.addEventListener('click', () => { const i = Number(button.dataset.index); state.data.sections.splice(i + 1, 0, clone(state.data.sections[i])); markDirty(); state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); }));
    document.querySelectorAll('[data-action="delete-section"]').forEach((button) => button.addEventListener('click', () => { const i = Number(button.dataset.index); if (confirm('Delete this section from the draft?')) { state.data.sections.splice(i, 1); markDirty(); state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); } }));
    document.querySelectorAll('[data-action="move-section-up"]').forEach((button) => button.addEventListener('click', () => moveSection(Number(button.dataset.index), -1)));
    document.querySelectorAll('[data-action="move-section-down"]').forEach((button) => button.addEventListener('click', () => moveSection(Number(button.dataset.index), 1)));
    document.querySelectorAll('[data-action="section-theme"]').forEach((button) => button.addEventListener('click', () => { state.data.sections[Number(button.dataset.index)].theme = button.dataset.theme; markDirty(); state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); }));
    document.querySelectorAll('[data-action="add-card"]').forEach((button) => button.addEventListener('click', () => { const section = state.data.sections[Number(button.dataset.index)]; section.items ||= []; section.items.push({ title: 'New card', text: '', image: '', imageAlt: '' }); markDirty(); state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); }));
    document.querySelector('[data-action="copy-fixed"]')?.addEventListener('click', (event) => copyFixedSection(event.currentTarget.dataset.section));
  };

  const moveSection = (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= state.data.sections.length) return;
    [state.data.sections[index], state.data.sections[next]] = [state.data.sections[next], state.data.sections[index]];
    markDirty(); state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor();
  };

  const loadMedia = async () => {
    if (state.media) return state.media;
    const items = await listDir('public/images');
    state.media = items.filter((item) => item.type === 'file' && IMAGE_EXT.test(item.name)).map((item) => ({ name: item.name, path: `/images/${item.name}` })).sort((a, b) => a.name.localeCompare(b.name));
    return state.media;
  };

  const openMediaPicker = async (callback) => {
    state.mediaCallback = callback;
    modalRoot.innerHTML = `<div class="ve-modal-backdrop"><div class="ve-modal"><div class="ve-modal-head"><h2>Choose an image</h2><button type="button" data-close-modal>×</button></div><div class="ve-media-search"><input id="ve-media-search" placeholder="Search Media Assets" /></div><div id="ve-media-grid" class="ve-media-grid"><div class="ve-loading">Loading images…</div></div></div></div>`;
    modalRoot.querySelector('[data-close-modal]').addEventListener('click', closeModal);
    modalRoot.querySelector('.ve-modal-backdrop').addEventListener('click', (event) => { if (event.target.classList.contains('ve-modal-backdrop')) closeModal(); });
    try { const media = await loadMedia(); renderMediaGrid(media); document.getElementById('ve-media-search').addEventListener('input', (event) => renderMediaGrid(media.filter((item) => item.name.toLowerCase().includes(event.target.value.toLowerCase())))); }
    catch (error) { document.getElementById('ve-media-grid').innerHTML = `<div class="ve-empty"><div><h2>Media Assets could not load</h2><p>${esc(error.message)}</p></div></div>`; }
  };

  const renderMediaGrid = (items) => {
    const grid = document.getElementById('ve-media-grid'); if (!grid) return;
    grid.innerHTML = items.length ? items.map((item) => `<button class="ve-media-item" type="button" data-media-path="${esc(item.path)}"><img src="${esc(item.path)}" alt="" loading="lazy" /><span>${esc(item.name)}</span></button>`).join('') : '<div class="ve-empty"><div><p>No images match that search.</p></div></div>';
    grid.querySelectorAll('[data-media-path]').forEach((button) => button.addEventListener('click', () => { const callback = state.mediaCallback; closeModal(); callback?.(button.dataset.mediaPath); }));
  };

  const closeModal = () => { modalRoot.innerHTML = ''; state.mediaCallback = null; };

  const injectBuilderPreviewStyle = (doc) => {
    if (doc.getElementById('ve-builder-style')) return;
    const style = doc.createElement('style'); style.id = 've-builder-style'; style.textContent = `.ve-preview-builder{padding:clamp(4rem,7vw,6.5rem) 0}.ve-preview-builder.white{background:#fff}.ve-preview-builder.paper{background:#f5f5f3}.ve-preview-builder.navy{background:#1a2b46;color:#fff}.ve-preview-builder .ve-b-container{width:min(calc(100% - 4rem),1400px);margin:auto}.ve-preview-builder.navy h1,.ve-preview-builder.navy h2,.ve-preview-builder.navy h3,.ve-preview-builder.navy p{color:#fff!important}.ve-preview-builder h2,.ve-preview-builder h1{margin:.55rem 0 1.25rem}.ve-preview-builder .ve-b-split{display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center}.ve-preview-builder .ve-b-split.image-right .ve-b-image{order:2}.ve-preview-builder .ve-b-image img,.ve-preview-builder>div>img{width:100%;height:auto;max-height:720px;object-fit:cover}.ve-preview-builder .ve-b-cards{display:grid;gap:1.25rem;margin-top:2rem}.ve-preview-builder .ve-b-cards.c2{grid-template-columns:repeat(2,1fr)}.ve-preview-builder .ve-b-cards.c3{grid-template-columns:repeat(3,1fr)}.ve-preview-builder .ve-b-cards.c4{grid-template-columns:repeat(4,1fr)}.ve-preview-builder .ve-b-card{border:1px solid #dddcd7;padding:1.5rem;background:#fff;color:#2b3036}.ve-preview-builder.navy .ve-b-card{color:#2b3036}.ve-preview-builder[data-ve-section]{cursor:pointer}.ve-preview-builder[data-ve-section]:hover{outline:2px solid rgba(69,98,142,.6);outline-offset:-2px}@media(max-width:800px){.ve-preview-builder .ve-b-split,.ve-preview-builder .ve-b-cards.c2,.ve-preview-builder .ve-b-cards.c3,.ve-preview-builder .ve-b-cards.c4{grid-template-columns:1fr}}`;
    doc.head.append(style);
  };

  const renderBuilderPreview = (doc, sections, replaceMain = false) => {
    injectBuilderPreviewStyle(doc);
    doc.querySelectorAll('[data-ve-generated]').forEach((node) => node.remove());
    const main = doc.querySelector('main'); if (!main) return;
    if (replaceMain) main.replaceChildren();
    sections.forEach((section, index) => {
      const el = doc.createElement('section'); el.className = `ve-preview-builder ${section.theme || 'white'}`; el.dataset.veGenerated = 'true'; el.dataset.veSection = `extra-${index}`;
      const eyebrow = section.eyebrow ? `<p class="eyebrow">${esc(section.eyebrow)}</p>` : '';
      const titleTag = section.type === 'hero' ? 'h1' : 'h2';
      const title = section.title ? `<${titleTag}>${esc(section.title)}${section.titleAccent ? ` <em>${esc(section.titleAccent)}</em>` : ''}</${titleTag}>` : '';
      const textHtml = String(section.text || '').split(/\n\s*\n/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
      const button = section.buttonLabel && section.buttonLink ? `<a class="button" href="${esc(section.buttonLink)}">${esc(section.buttonLabel)}</a>` : '';
      if (section.type === 'imageText' || (section.type === 'hero' && section.image)) el.innerHTML = `<div class="ve-b-container ve-b-split ${section.imagePosition === 'right' ? 'image-right' : ''}"><div class="ve-b-image">${section.image ? `<img src="${esc(section.image)}" alt="${esc(section.imageAlt || '')}">` : ''}</div><div>${eyebrow}${title}${textHtml}${button}</div></div>`;
      else if (section.type === 'cards') el.innerHTML = `<div class="ve-b-container">${eyebrow}${title}<div class="ve-b-cards c${esc(section.columns || '3')}">${(section.items || []).map((item) => `<article class="ve-b-card">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.imageAlt || '')}">` : ''}<h3>${esc(item.title || '')}</h3>${item.text ? `<p>${esc(item.text)}</p>` : ''}</article>`).join('')}</div></div>`;
      else if (section.type === 'image') el.innerHTML = `<div class="ve-b-container">${section.image ? `<img src="${esc(section.image)}" alt="${esc(section.imageAlt || '')}">` : ''}${section.caption ? `<p>${esc(section.caption)}</p>` : ''}</div>`;
      else if (section.type === 'html') el.innerHTML = `<div class="ve-b-container">${window.DOMPurify.sanitize(section.html || '')}</div>`;
      else el.innerHTML = `<div class="ve-b-container">${eyebrow}${title}${textHtml}${button}</div>`;
      main.append(el);
    });
  };

  const patchPagePreview = (frame, custom = false) => {
    try {
      const doc = frame.contentDocument; if (!doc || doc.readyState === 'loading') return;
      if (custom) { renderBuilderPreview(doc, state.data.sections || [], true); wirePagePreviewClicks(doc, 'custom'); return; }
      const key = state.page.key;
      const text = (selector, value) => { const node = doc.querySelector(selector); if (node && value !== undefined) node.textContent = value ?? ''; };
      const heading = (selector, title, accent) => { const node = doc.querySelector(selector); if (!node) return; node.replaceChildren(doc.createTextNode(title || '')); if (accent) { node.append(doc.createTextNode(' ')); const em = doc.createElement('em'); em.textContent = accent; node.append(em); } };
      const image = (selector, path, alt = '') => { const node = doc.querySelector(selector); if (node && path) { node.removeAttribute('srcset'); node.removeAttribute('sizes'); node.src = path; node.alt = alt || ''; } };
      if (key === 'home') {
        text('.hero .eyebrow-link', state.data.eyebrow); heading('.hero h1', state.data.title, state.data.titleAccent); text('.hero .lede', state.data.lede); image('.hero-panel img', state.data.heroImage, state.data.heroImageAlt);
        const buttons = doc.querySelectorAll('.hero .button-row .button'); if (buttons[0]) { buttons[0].textContent = state.data.primaryCta?.label || ''; buttons[0].href = state.data.primaryCta?.href || '#'; } if (buttons[1]) { buttons[1].textContent = state.data.secondaryCta?.label || ''; buttons[1].href = state.data.secondaryCta?.href || '#'; }
        doc.querySelectorAll('.proof-grid article').forEach((card, i) => { if (!state.data.proof?.[i]) return; card.querySelector('h2').textContent = state.data.proof[i].title; card.querySelector('p').textContent = state.data.proof[i].text; });
        const approach = state.data.approach || {}; text('.approach .eyebrow-link', approach.eyebrow); text('.approach h2', approach.title); text('.approach .section-heading p', approach.text); doc.querySelectorAll('.approach li').forEach((node, i) => { if (approach.items?.[i] != null) node.textContent = approach.items[i]; });
        text('.news-band .eyebrow-link', state.data.news?.eyebrow); text('.news-band h2', state.data.news?.title);
      } else if (key === 'about') {
        text('.about-hero .eyebrow', state.data.eyebrow); heading('.about-hero h1', state.data.title, state.data.titleAccent); text('.about-hero-copy>p:not(.eyebrow)', state.data.lede); text('.firm-kicker .eyebrow', state.data.firm?.eyebrow); text('.firm-kicker h2', state.data.firm?.title); text('.firm-text', state.data.firm?.text);
        doc.querySelectorAll('.team-card').forEach((card, i) => { const person = state.data.team?.[i]; if (!person) return; image('.portrait img', person.image, person.imageAlt); const img = card.querySelector('.portrait img'); if (img && person.image) { img.removeAttribute('srcset'); img.src = person.image; img.alt = person.imageAlt || ''; } const e = card.querySelector('.team-copy>.eyebrow'); if (e) e.textContent = person.eyebrow || ''; const h2 = card.querySelector('.team-copy>h2'); if (h2) h2.textContent = person.name || ''; });
      } else if (key === 'services') {
        text('.services-hero .eyebrow', state.data.eyebrow); text('.services-hero h1 span', state.data.title); text('.services-hero h1 em', state.data.titleAccent); text('.services-hero .hero-copy>p:last-child', state.data.lede); image('.services-hero .hero-image img', state.data.heroImage, state.data.heroImageAlt); text('.coaching-copy-stack .service-detail-copy', state.data.focusIntro);
        doc.querySelectorAll('.focus-list article').forEach((node, i) => { if (!state.data.focusAreas?.[i]) return; node.querySelector('h3').textContent = state.data.focusAreas[i].title; node.querySelector('p').textContent = state.data.focusAreas[i].text; });
        doc.querySelectorAll('.service-section').forEach((node, i) => { const service = state.data.services?.[i]; if (!service) return; const num = node.querySelector('.service-number'); if (num) num.textContent = service.number; const h2 = node.querySelector('.service-heading-block h2'); if (h2) h2.textContent = service.title; const summary = node.querySelector('.service-summary'); if (summary) summary.textContent = service.summary || service.text || ''; const img = node.querySelector('.service-image img'); if (img && service.image) { img.removeAttribute('srcset'); img.src = service.image; img.alt = service.imageAlt || ''; } });
      } else {
        text('main .eyebrow', state.data.eyebrow); heading('main h1', state.data.title, state.data.titleAccent);
      }
      renderBuilderPreview(doc, state.data.sections || [], false); wirePagePreviewClicks(doc, key);
    } catch (_) {}
  };

  const pagePreviewMap = {
    home: [['.hero', 'hero'], ['.proof,.marquee-band', 'proof'], ['.approach', 'approach'], ['.news-band', 'news']],
    about: [['.about-hero', 'hero'], ['.firm-band', 'firm'], ['.team-band', 'team']],
    services: [['.services-hero', 'hero'], ['.focus-list,.coaching-focus', 'focus'], ['.training-section', 'training'], ['.consulting-section', 'consulting'], ['.service-section', 'services']],
    news: [['main', 'content']], whitepapers: [['main', 'content']], contact: [['main', 'content']], privacy: [['main', 'content']], 'privacy-choices': [['main', 'content']], 'data-requests': [['main', 'content']], custom: [],
  };

  const wirePagePreviewClicks = (doc, key) => {
    if (doc.documentElement.dataset.veClickWired === key) return;
    doc.documentElement.dataset.veClickWired = key;
    const style = doc.createElement('style'); style.textContent = `[data-ve-editable]{cursor:pointer!important}[data-ve-editable]:hover{outline:2px solid rgba(69,98,142,.6)!important;outline-offset:-2px!important}`; doc.head.append(style);
    (pagePreviewMap[key] || []).forEach(([selector, id]) => doc.querySelectorAll(selector).forEach((node) => node.dataset.veEditable = id));
    doc.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null; if (!target) return;
      const generated = target.closest('[data-ve-section]');
      if (generated) { event.preventDefault(); event.stopPropagation(); state.pageSection = 'extra'; state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor(); setTimeout(() => document.querySelectorAll('.ve-section-card')[Number(generated.dataset.veSection?.replace('extra-', ''))]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); return; }
      const editable = target.closest('[data-ve-editable]'); if (!editable) return;
      event.preventDefault(); event.stopPropagation(); state.pageSection = editable.dataset.veEditable; state.screen === 'new-page' ? renderNewPageEditor() : renderPageEditor();
    }, true);
  };

  const bindPreview = (mode) => {
    const frame = document.getElementById('ve-preview'); if (!frame) return;
    const sync = () => patchPagePreview(frame, mode === 'custom');
    frame.addEventListener('load', () => setTimeout(sync, 80)); setTimeout(sync, 120);
  };

  const schedulePreview = () => {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(() => {
      const frame = document.getElementById('ve-preview'); if (!frame) return;
      if (state.screen === 'blog-edit') patchBlogPreview(frame); else patchPagePreview(frame, state.screen === 'new-page');
    }, 140);
  };

  const loadBlogList = async () => {
    loading('Loading blog posts…');
    try {
      const files = (await listDir('src/content/posts')).filter((item) => item.type === 'file' && /\.md$/i.test(item.name));
      const posts = await Promise.all(files.map(async (item) => { try { const source = await readFile(item.path); const parsed = parseDocument(source.text); return { slug: item.name.replace(/\.md$/i, ''), title: parsed.data.title || item.name, date: parsed.data.pubDate || '', category: parsed.data.category || '' }; } catch { return { slug: item.name.replace(/\.md$/i, ''), title: item.name, date: '', category: '' }; } }));
      posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      state.screen = 'blog-list';
      app.innerHTML = shell(`<main class="ve-main"><div class="ve-list-head"><div><span class="ve-eyebrow">Blog Posts</span><h1 class="ve-title">Articles</h1><p class="ve-lede">Open an article to edit it, or create a new post. Images and citations can be inserted directly while writing.</p></div><a class="ve-button primary" href="#/blog/new">New blog post</a></div><div class="ve-blog-list">${posts.length ? posts.map((post) => `<a class="ve-blog-row" href="#/blog/${encodeURIComponent(post.slug)}"><div><strong>${esc(post.title)}</strong><span>${esc([post.category, post.date].filter(Boolean).join(' · '))}</span></div><b>Edit →</b></a>`).join('') : '<div class="ve-empty"><div><h2>No blog posts yet</h2><p>Create the first one using New blog post.</p></div></div>'}</div></main>`, 'blog');
    } catch (error) { toast(error.message, true); renderHome(); }
  };

  const loadTeam = async () => {
    if (state.team.length) return state.team;
    try { const about = await loadDocument('src/content/pages/about.md'); state.team = about.data.team || []; } catch { state.team = []; }
    return state.team;
  };

  const defaultPost = () => ({ title: '', subtitle: '', author: 'Julia Mercier', pubDate: new Date().toISOString().slice(0, 10), category: 'Insight', excerpt: '', image: '', imageAlt: '', references: [], seoTitle: '', seoDescription: '' });

  const editBlog = async (slug) => {
    loading(slug ? 'Opening blog post…' : 'Creating blog post…');
    try {
      await loadTeam();
      state.screen = 'blog-edit'; state.blogSection = 'details'; state.blogSlug = slug || null; state.isNew = !slug; state.dirty = !slug;
      if (slug) {
        const path = `src/content/posts/${slug}.md`; const doc = await loadDocument(path); state.doc = doc; state.data = doc.data; state.body = doc.body; state.path = path; state.branch = doc.branch; state.pr = doc.pr;
      } else { state.doc = null; state.data = defaultPost(); state.body = ''; state.path = ''; state.branch = ''; state.pr = null; }
      normalizeReferences(); renderBlogEditor();
    } catch (error) { toast(error.message, true); loadBlogList(); }
  };

  const normalizeReferences = () => {
    if (!state.data || !Array.isArray(state.data.references)) return;
    const used = new Set();
    state.data.references.forEach((ref, index) => {
      let id = slugify(ref.id || ref.text || `source-${index + 1}`) || `source-${index + 1}`;
      let candidate = id; let n = 2; while (used.has(candidate)) { candidate = `${id}-${n}`; n += 1; }
      ref.id = candidate; used.add(candidate);
    });
  };

  const BLOG_SECTIONS = [
    ['details', 'Article details', 'Headline, author, date and category.'],
    ['summary', 'Summary & image', 'Card summary and optional featured image.'],
    ['text', 'Article text', 'Write, format, insert images and cite sources.'],
    ['sources', 'Sources', 'Add each source once, then reuse it anywhere in the article.'],
    ['optional', 'Optional settings', 'Search wording and updated date. Usually leave these alone.'],
  ];

  const authorOptions = () => (state.team.length ? state.team.map((person) => [person.name, person.name]) : [['Julia Mercier', 'Julia Mercier'], ['Allie McFarlane', 'Allie McFarlane']]);

  const editorMarkdownToHtml = (markdown) => {
    const withCites = String(markdown || '').replace(/\[\[cite:([^\]]+)\]\]/g, (_, id) => `<sup class="editor-cite" data-cite="${esc(id)}">source</sup>`);
    return window.DOMPurify.sanitize(window.marked.parse(withCites), { ADD_ATTR: ['data-cite'] });
  };

  const richHtmlToMarkdown = (html) => {
    const turndown = new window.TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
    turndown.addRule('mercierCitation', { filter: (node) => node.nodeName === 'SUP' && node.dataset?.cite, replacement: (_content, node) => `[[cite:${node.dataset.cite}]]` });
    turndown.addRule('mercierImage', { filter: (node) => node.nodeName === 'FIGURE' && node.classList.contains('article-inline-image'), replacement: (_content, node) => { const img = node.querySelector('img'); const caption = node.querySelector('figcaption'); if (!img) return ''; return `\n\n<figure class="article-inline-image"><img src="${img.getAttribute('src') || ''}" alt="${(img.getAttribute('alt') || '').replaceAll('"', '&quot;')}">${caption?.textContent ? `<figcaption>${esc(caption.textContent)}</figcaption>` : ''}</figure>\n\n`; } });
    return turndown.turndown(html).trim() + '\n';
  };

  const blogForm = () => {
    if (state.blogSection === 'details') return `${field('title', 'Headline', state.data.title)}${field('subtitle', 'Subtitle (optional)', state.data.subtitle, { hint: 'Shown directly under the headline.' })}${field('author', 'Author', state.data.author, { type: 'select', options: authorOptions() })}<div class="ve-inline-fields">${field('pubDate', 'Publication date', String(state.data.pubDate || '').slice(0, 10), { type: 'date' })}${field('category', 'Category', state.data.category || 'Insight', { type: 'select', options: ['Insight', 'Speaking', 'White Paper', 'Announcement', 'News'] })}</div>`;
    if (state.blogSection === 'summary') return `${field('excerpt', 'Short summary', state.data.excerpt, { type: 'textarea', rows: 5, hint: 'Shown on the Blog Posts landing page and used as the default search description.' })}${imageField('image', 'Featured image (optional)', 'imageAlt')}`;
    if (state.blogSection === 'sources') return `<div class="ve-group"><div class="ve-group-head"><h3>Sources</h3><button class="ve-button subtle" type="button" data-action="add-source">Add source</button></div>${(state.data.references || []).length ? `<div class="ve-list">${state.data.references.map((ref, i) => `<div class="ve-list-item"><div class="ve-list-item-head"><strong>${esc(ref.text || `Source ${i + 1}`)}</strong><button class="ve-icon-button" type="button" data-action="remove-source" data-index="${i}">×</button></div>${field(`references.${i}.text`, 'Source name', ref.text)}${field(`references.${i}.url`, 'Source link', ref.url)}</div>`).join('')}</div>` : '<div class="ve-empty"><div><h2>No sources added</h2><p>Add a source once. In Article text, highlight the relevant wording and choose that source from the Cite source menu. You can reuse it as many times as needed.</p></div></div>'}</div>`;
    if (state.blogSection === 'optional') return `${field('updatedDate', 'Last updated (optional)', String(state.data.updatedDate || '').slice(0, 10), { type: 'date' })}${field('seoTitle', 'Search title (optional)', state.data.seoTitle)}${field('seoDescription', 'Search description (optional)', state.data.seoDescription, { type: 'textarea' })}`;
    return `<div class="ve-field"><label>Article text</label><small>Write like a normal document. Use Insert image to place a picture at the cursor. To cite a source, highlight the relevant text and choose the source from Cite source.</small><div class="ve-rich-toolbar"><button type="button" data-rich="bold"><b>B</b></button><button type="button" data-rich="italic"><i>I</i></button><button type="button" data-rich="h2">Heading</button><button type="button" data-rich="ul">Bullets</button><button type="button" data-rich="quote">Quote</button><button type="button" data-rich="image">Insert image</button><select id="ve-cite-select"><option value="">Cite source…</option>${(state.data.references || []).map((ref) => `<option value="${esc(ref.id)}">${esc(ref.text || ref.id)}</option>`).join('')}</select></div><div id="ve-rich-editor" class="ve-rich-editor" contenteditable="true">${editorMarkdownToHtml(state.body)}</div></div>`;
  };

  const blogPreviewRoute = () => state.blogSlug ? `/post/${state.blogSlug}/` : '/news/';

  const renderBlogEditor = () => {
    app.innerHTML = editorLayout({ active: 'blog', title: state.data.title || (state.isNew ? 'New blog post' : 'Blog post'), subtitle: 'Choose one part to work on. The rest stays out of the way.', backHref: '#/blog', sections: BLOG_SECTIONS, selected: state.blogSection, formHtml: blogForm(), previewRoute: blogPreviewRoute() });
    bindEditorEvents(); bindBlogActions(); bindBlogPreview();
  };

  const bindBlogActions = () => {
    document.querySelector('[data-action="add-source"]')?.addEventListener('click', () => { state.data.references ||= []; state.data.references.push({ id: `source-${state.data.references.length + 1}`, text: '', url: '' }); normalizeReferences(); markDirty(); renderBlogEditor(); });
    document.querySelectorAll('[data-action="remove-source"]').forEach((button) => button.addEventListener('click', () => { state.data.references.splice(Number(button.dataset.index), 1); normalizeReferences(); markDirty(); renderBlogEditor(); }));
    const editor = document.getElementById('ve-rich-editor');
    if (!editor) return;
    const rememberSelection = () => { const selection = window.getSelection(); if (!selection?.rangeCount) return; const range = selection.getRangeAt(0); if (editor.contains(range.commonAncestorContainer)) state.savedRange = range.cloneRange(); };
    document.addEventListener('selectionchange', rememberSelection);
    editor.addEventListener('input', () => { state.body = richHtmlToMarkdown(editor.innerHTML); markDirty(); });
    document.querySelectorAll('[data-rich]').forEach((button) => button.addEventListener('mousedown', (event) => event.preventDefault()));
    document.querySelectorAll('[data-rich]').forEach((button) => button.addEventListener('click', () => {
      editor.focus(); restoreRichSelection(editor);
      const action = button.dataset.rich;
      if (action === 'bold') document.execCommand('bold');
      if (action === 'italic') document.execCommand('italic');
      if (action === 'h2') document.execCommand('formatBlock', false, 'h2');
      if (action === 'ul') document.execCommand('insertUnorderedList');
      if (action === 'quote') document.execCommand('formatBlock', false, 'blockquote');
      if (action === 'image') openMediaPicker((path) => insertRichImage(editor, path));
      if (action !== 'image') { state.body = richHtmlToMarkdown(editor.innerHTML); markDirty(); }
    }));
    document.getElementById('ve-cite-select')?.addEventListener('change', (event) => { const id = event.target.value; if (!id) return; editor.focus(); restoreRichSelection(editor); const sup = document.createElement('sup'); sup.className = 'editor-cite'; sup.dataset.cite = id; sup.textContent = state.data.references.find((ref) => ref.id === id)?.text || 'source'; const selection = window.getSelection(); if (selection?.rangeCount) { const range = selection.getRangeAt(0); range.collapse(false); range.insertNode(sup); range.setStartAfter(sup); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); } state.body = richHtmlToMarkdown(editor.innerHTML); event.target.value = ''; markDirty(); });
  };

  const restoreRichSelection = (editor) => { const selection = window.getSelection(); if (state.savedRange && editor.contains(state.savedRange.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(state.savedRange); } else { const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); selection.removeAllRanges(); selection.addRange(range); } };

  const insertRichImage = (editor, path) => {
    editor.focus(); restoreRichSelection(editor);
    const figure = document.createElement('figure'); figure.className = 'article-inline-image'; figure.innerHTML = `<img src="${esc(path)}" alt=""><figcaption contenteditable="true">Add a caption if needed</figcaption>`;
    const selection = window.getSelection(); if (selection?.rangeCount) { const range = selection.getRangeAt(0); range.collapse(false); range.insertNode(figure); const p = document.createElement('p'); p.innerHTML = '<br>'; figure.after(p); range.setStart(p, 0); selection.removeAllRanges(); selection.addRange(range); }
    state.body = richHtmlToMarkdown(editor.innerHTML); markDirty(); schedulePreview();
  };

  const bindBlogPreview = () => { const frame = document.getElementById('ve-preview'); if (!frame) return; const sync = () => patchBlogPreview(frame); frame.addEventListener('load', () => setTimeout(sync, 80)); setTimeout(sync, 120); };

  const patchBlogPreview = (frame) => {
    try {
      const doc = frame.contentDocument; if (!doc || doc.readyState === 'loading') return;
      // If creating a new post, turn the News page into a clean article-shaped preview.
      if (!doc.querySelector('.article-page')) {
        const main = doc.querySelector('main'); if (!main) return;
        main.innerHTML = `<article class="article-page"><header class="article-hero"><div class="container article-shell"><span class="pill">${esc(state.data.category || 'Insight')}</span><h1></h1><p class="article-preview-subtitle"></p><div class="article-meta"><div class="author-block"><img class="author-photo" alt=""><div class="author-copy"><strong></strong><span></span></div></div><time></time></div></div></header><div class="article-content-section"><div class="container article-body"></div></div></article>`;
      }
      const text = (selector, value) => { const node = doc.querySelector(selector); if (node) node.textContent = value || ''; };
      text('.article-hero h1', state.data.title || 'Article headline');
      let subtitle = doc.querySelector('.article-preview-subtitle,.article-subtitle'); if (!subtitle) { subtitle = doc.createElement('p'); subtitle.className = 'article-preview-subtitle'; doc.querySelector('.article-hero h1')?.after(subtitle); }
      subtitle.textContent = state.data.subtitle || ''; subtitle.style.display = state.data.subtitle ? '' : 'none';
      text('.article-hero .pill', state.data.category || 'Insight'); text('.author-copy strong', state.data.author || 'Julia Mercier'); text('.article-meta time', String(state.data.pubDate || '').slice(0, 10));
      const person = state.team.find((item) => item.name === state.data.author) || {}; const photo = doc.querySelector('.author-photo'); if (photo && person.image) { photo.src = person.image; photo.alt = person.name || ''; } text('.author-copy span', person.eyebrow || person.role || '');
      const refs = state.data.references || [];
      let html = window.marked.parse(String(state.body || '').replace(/\[\[cite:([^\]]+)\]\]/g, (_, id) => { const index = refs.findIndex((ref) => ref.id === id); return index >= 0 ? `<sup class="reference-marker"><a href="#reference-${index + 1}">${index + 1}</a></sup>` : ''; }));
      html = window.DOMPurify.sanitize(html);
      const body = doc.querySelector('.article-body'); if (body) body.innerHTML = html;
      let references = doc.querySelector('.references'); if (references) references.remove();
      if (refs.length && body) { references = doc.createElement('section'); references.className = 'references'; references.innerHTML = `<h2>References</h2><ol>${refs.map((ref, i) => `<li id="reference-${i + 1}"><a href="${esc(ref.url || '#')}">${esc(ref.text || `Source ${i + 1}`)}</a></li>`).join('')}</ol>`; body.append(references); }
      const styleId = 've-blog-preview-style'; if (!doc.getElementById(styleId)) { const style = doc.createElement('style'); style.id = styleId; style.textContent = `.article-preview-subtitle{max-width:980px;margin:-1rem 0 1.8rem;color:#45628e;font-family:Georgia,serif;font-size:clamp(1.45rem,2.4vw,2.1rem);font-style:italic;font-weight:700}.article-inline-image{margin:2.4rem 0}.article-inline-image img{display:block;width:100%;height:auto}.article-inline-image figcaption{margin-top:.65rem;color:#66707c;font-size:13px}.article-hero,.article-body,.references{cursor:pointer}.article-hero:hover,.article-body:hover,.references:hover{outline:2px solid rgba(69,98,142,.55);outline-offset:-2px}`; doc.head.append(style); }
      if (!doc.documentElement.dataset.veBlogClicks) { doc.documentElement.dataset.veBlogClicks = 'true'; doc.addEventListener('click', (event) => { const target = event.target instanceof Element ? event.target : null; if (!target) return; let section = null; if (target.closest('.references')) section = 'sources'; else if (target.closest('.article-body')) section = 'text'; else if (target.closest('.article-hero')) section = 'details'; if (!section) return; event.preventDefault(); event.stopPropagation(); state.blogSection = section; renderBlogEditor(); }, true); }
    } catch (_) {}
  };

  const route = async () => {
    const hash = location.hash || '#/';
    if (state.dirty && state.screen && !route.ignoreDirty) {
      // hash navigation is initiated by the user; keep warning limited to leaving an active edit screen.
    }
    if (hash === '#/' || hash === '#') return renderHome();
    if (hash === '#/pages') return renderPages();
    if (hash === '#/new-page') return startNewPage();
    if (hash === '#/blog') return loadBlogList();
    if (hash === '#/blog/new') return editBlog(null);
    const pageMatch = hash.match(/^#\/page\/([^/?]+)/); if (pageMatch) return editPage(decodeURIComponent(pageMatch[1]));
    const blogMatch = hash.match(/^#\/blog\/([^/?]+)/); if (blogMatch) return editBlog(decodeURIComponent(blogMatch[1]));
    renderHome();
  };

  window.addEventListener('beforeunload', (event) => { if (!state.dirty) return; event.preventDefault(); event.returnValue = ''; });
  window.addEventListener('hashchange', route);
  route();
})();
