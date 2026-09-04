(() => {
  'use strict';

  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');
  let scheduled = false;

  const PRIMARY_PAGES = [
    ['Home', '/admin/editor/#/page/home', 'Hero, intro cards, approach and homepage content'],
    ['About', '/admin/editor/#/page/about', 'Firm introduction, team bios and headshots'],
    ['Services', '/admin/editor/#/page/services', 'Services, focus areas, training and consulting'],
    ['News & Insights', '/admin/editor/#/page/news', 'Landing-page heading and introduction'],
    ['Contact', '/admin/editor/#/page/contact', 'Contact copy and contact details'],
    ['Careers', '/admin/editor/careers.html', 'Open roles, descriptions and application form'],
  ];

  const SECONDARY_PAGES = [
    ['White Papers page', '/admin/editor/#/page/whitepapers'],
    ['Privacy Policy', '/admin/editor/#/page/privacy'],
    ['Privacy Choices', '/admin/editor/#/page/privacy-choices'],
    ['Data Requests', '/admin/editor/#/page/data-requests'],
  ];

  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  };

  const editorLink = (href) => {
    if (window.location.pathname.endsWith('/index.html') || window.location.pathname.endsWith('/editor/') || window.location.pathname.endsWith('/editor')) {
      return href.replace('/admin/editor/', '');
    }
    return href;
  };

  const railMarkup = () => `
    <aside class="mts-admin-rail" aria-label="Website editor navigation">
      <div class="mts-admin-rail-brand">
        <a href="/admin/editor/#/" aria-label="Editor dashboard"><img src="/images/mercier-logo-color.png" alt="Mercier Talent Solutions" /></a>
        <div><strong>Website Editor</strong><span>Mercier Talent Solutions</span></div>
      </div>
      <a class="mts-admin-rail-view" href="/" target="_blank" rel="noopener">View live website <span>↗</span></a>
      <nav class="mts-admin-rail-nav">
        <a data-admin-nav="dashboard" href="/admin/editor/#/"><span class="mts-admin-nav-icon">⌂</span><span>Dashboard</span></a>
        <div class="mts-admin-nav-group">
          <span class="mts-admin-nav-label">Pages</span>
          ${PRIMARY_PAGES.map(([label, href]) => `<a data-admin-page="${label}" href="${href}">${label}</a>`).join('')}
          <details class="mts-admin-more-pages">
            <summary>More pages</summary>
            ${SECONDARY_PAGES.map(([label, href]) => `<a data-admin-page="${label}" href="${href}">${label}</a>`).join('')}
          </details>
          <a class="mts-admin-new-page" data-admin-nav="new-page" href="/admin/editor/#/new-page">+ Create new page</a>
        </div>
        <div class="mts-admin-nav-group">
          <span class="mts-admin-nav-label">Content</span>
          <a data-admin-nav="blog" href="/admin/editor/#/blog">Blog Posts</a>
          <a data-admin-nav="whitepapers" href="/admin/editor/whitepapers.html">White Papers</a>
          <a data-admin-nav="media" href="/admin/editor/media.html">Media Assets</a>
        </div>
        <div class="mts-admin-nav-group">
          <span class="mts-admin-nav-label">Website</span>
          <a data-admin-nav="menu" href="/admin/editor/menu.html">Top Menu</a>
          <a data-admin-nav="design" href="/admin/editor/design.html">Design</a>
        </div>
      </nav>
      <div class="mts-admin-rail-help"><strong>Drafts stay private</strong><span>Nothing changes on the live website until you choose Publish.</span></div>
    </aside>`;

  const ensureRail = () => {
    if (document.querySelector('.mts-admin-rail')) return;
    document.body.insertAdjacentHTML('afterbegin', railMarkup());
  };

  const rewriteLegacyLinks = () => {
    const replacements = new Map([
      ['/admin/#/collections/white-papers', '/admin/editor/whitepapers.html'],
      ['#/collections/white-papers', '/admin/editor/whitepapers.html'],
      ['/admin/#/media', '/admin/editor/media.html'],
      ['/admin/#/collections/navigation/entries/main', '/admin/editor/menu.html'],
      ['/admin/#/collections/settings/entries/appearance', '/admin/editor/design.html'],
    ]);
    replacements.forEach((replacement, href) => {
      document.querySelectorAll(`a[href="${href}"]`).forEach((link) => link.setAttribute('href', replacement));
    });
  };

  const enhanceDashboard = () => {
    const main = document.querySelector('.ve-main');
    const quickGrid = main?.querySelector('.ve-home-grid');
    if (!main || !quickGrid || main.querySelector('.ve-dashboard-pages')) return;

    quickGrid.querySelector('a[href="#/pages"]')?.remove();
    quickGrid.classList.add('ve-home-grid-compact');

    const pageSection = document.createElement('section');
    pageSection.className = 've-dashboard-pages';
    pageSection.innerHTML = `
      <div class="ve-dashboard-section-head">
        <div><span class="ve-eyebrow">Pages</span><h2>Edit a page</h2><p>Open the page you want directly. You do not need to go through another page first.</p></div>
        <a class="ve-button subtle" href="#/new-page">Create new page</a>
      </div>
      <div class="ve-dashboard-page-grid">
        ${PRIMARY_PAGES.map(([label, href, note]) => `<a href="${editorLink(href)}"><strong>${label}</strong><span>${note}</span><b>Edit →</b></a>`).join('')}
      </div>
      <details class="ve-dashboard-more-pages">
        <summary>Other website pages</summary>
        <div>${SECONDARY_PAGES.map(([label, href]) => `<a href="${editorLink(href)}">${label}<span>→</span></a>`).join('')}</div>
      </details>`;
    quickGrid.before(pageSection);

    const eyebrow = main.querySelector(':scope > .ve-eyebrow');
    const title = main.querySelector(':scope > .ve-title');
    const lede = main.querySelector(':scope > .ve-lede');
    if (eyebrow) eyebrow.textContent = 'Website Manager';
    if (title) title.textContent = 'Manage your website';
    if (lede) lede.textContent = 'Choose the page or content you want to update. Save Draft keeps changes private; Publish updates the live website.';

    const secondary = main.querySelector('.ve-secondary-tools');
    if (secondary) {
      secondary.querySelector('h2')?.replaceChildren(document.createTextNode('Website settings & files'));
    }
  };

  const setCurrentNavigation = () => {
    document.querySelectorAll('.mts-admin-rail a').forEach((link) => link.removeAttribute('aria-current'));
    const path = window.location.pathname;
    const hash = window.location.hash;
    let selector = '[data-admin-nav="dashboard"]';
    let pageLabel = '';

    if (path.endsWith('/whitepapers.html')) selector = '[data-admin-nav="whitepapers"]';
    else if (path.endsWith('/media.html')) selector = '[data-admin-nav="media"]';
    else if (path.endsWith('/menu.html')) selector = '[data-admin-nav="menu"]';
    else if (path.endsWith('/design.html')) selector = '[data-admin-nav="design"]';
    else if (path.endsWith('/careers.html')) pageLabel = 'Careers';
    else if (hash.startsWith('#/blog')) selector = '[data-admin-nav="blog"]';
    else if (hash.startsWith('#/new-page')) selector = '[data-admin-nav="new-page"]';
    else {
      const match = hash.match(/^#\/page\/([^/?]+)/);
      if (match) {
        const labels = {
          home: 'Home', about: 'About', services: 'Services', news: 'News & Insights',
          whitepapers: 'White Papers page', contact: 'Contact', privacy: 'Privacy Policy',
          'privacy-choices': 'Privacy Choices', 'data-requests': 'Data Requests',
        };
        pageLabel = labels[decodeURIComponent(match[1])] || '';
      }
    }

    const target = pageLabel
      ? [...document.querySelectorAll('[data-admin-page]')].find((link) => link.dataset.adminPage === pageLabel)
      : document.querySelector(selector);
    target?.setAttribute('aria-current', 'page');
    target?.closest('details')?.setAttribute('open', '');
  };

  const rewritePublishMessages = () => {
    document.querySelectorAll('.ve-toast').forEach((toast) => {
      if (/Cloudflare will update the (live )?website shortly/i.test(toast.textContent || '')) {
        toast.textContent = 'Published. Your live website is updating now.';
      }
    });
  };

  const scrollEditorTop = () => {
    const pane = document.querySelector('.ve-editor-pane');
    if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollPreviewTop = () => {
    const frame = document.getElementById('ve-preview');
    try { frame?.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
  };

  const ensurePreviewTopButton = () => {
    const bar = document.querySelector('.ve-preview-bar');
    if (!bar || bar.querySelector('.ve-preview-top')) return;
    const tools = document.createElement('div');
    tools.className = 've-preview-tools';
    const status = bar.querySelector('#ve-status,.ve-status');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 've-preview-top';
    button.textContent = 'Back to top ↑';
    button.addEventListener('click', scrollPreviewTop);
    tools.append(button);
    if (status) tools.append(status);
    bar.append(tools);
  };

  const ensureSaveExplanation = () => {
    const head = document.querySelector('.ve-editor-head');
    if (!head || head.querySelector('.ve-save-note')) return;
    const note = document.createElement('p');
    note.className = 've-save-note';
    note.innerHTML = '<strong>Save Draft</strong> keeps changes private. <strong>Publish</strong> updates the live website.';
    const copy = head.querySelector(':scope > div:first-child');
    copy?.append(note);
  };

  const wireSectionButtons = () => {
    document.querySelectorAll('[data-section-select]').forEach((button) => {
      if (button.dataset.veTopWired) return;
      button.dataset.veTopWired = 'true';
      button.addEventListener('click', () => setTimeout(scrollEditorTop, 30));
    });
  };

  const refresh = () => {
    ensureRail();
    rewriteLegacyLinks();
    enhanceDashboard();
    setCurrentNavigation();
    rewritePublishMessages();
    ensurePreviewTopButton();
    ensureSaveExplanation();
    wireSectionButtons();
  };

  if (app) new MutationObserver(scheduleRefresh).observe(app, { childList: true });
  if (toastRoot) new MutationObserver(scheduleRefresh).observe(toastRoot, { childList: true });
  window.addEventListener('hashchange', scheduleRefresh);
  window.addEventListener('load', scheduleRefresh);
  refresh();
})();