(() => {
  'use strict';

  const ADMIN_LINKS = {
    home: '/admin/editor/#/',
    currentPages: '/admin/editor/#/pages',
    newPage: '/admin/editor/#/new-page',
    blog: '/admin/editor/#/blog',
    whitepapers: '/admin/editor/whitepapers.html',
    menu: '#/collections/navigation/entries/main',
    media: '#/media',
    design: '#/collections/settings/entries/appearance',
  };

  let refreshQueued = false;

  const closeMenus = (except) => {
    document.querySelectorAll('.mts-editor-menu[open]').forEach((menu) => {
      if (menu !== except) menu.removeAttribute('open');
    });
  };

  const ensureShell = () => {
    if (document.querySelector('.mts-editor-shell')) return;

    const shell = document.createElement('div');
    shell.className = 'mts-editor-shell';
    shell.innerHTML = `
      <div class="mts-editor-brandbar">
        <a class="mts-editor-brand" href="${ADMIN_LINKS.home}" aria-label="Mercier Website Editor home">
          <img src="/images/mercier-logo-color.png" alt="Mercier Talent Solutions" />
          <span class="mts-editor-brand-copy">
            <strong>Website Editor</strong>
            <small>Mercier Talent Solutions</small>
          </span>
        </a>
        <div class="mts-editor-actions">
          <a class="mts-back-home" href="${ADMIN_LINKS.home}">← Editor Home</a>
          <span class="mts-draft-pill">Draft mode</span>
          <a class="mts-open-site" href="/" target="_blank" rel="noopener">View Website ↗</a>
        </div>
      </div>

      <nav class="mts-editor-nav" aria-label="Website editor menu">
        <details class="mts-editor-menu" data-admin-section="pages">
          <summary>Pages</summary>
          <div class="mts-editor-dropdown">
            <a href="${ADMIN_LINKS.currentPages}">
              <strong>Current Pages</strong>
              <span>Edit Home, About, Services, Contact and the other pages already on the site.</span>
            </a>
            <a href="${ADMIN_LINKS.newPage}">
              <strong>Create New Page</strong>
              <span>Build a new page with visual sections. No code required.</span>
            </a>
          </div>
        </details>
        <a class="mts-editor-nav-link" data-admin-section="blog" href="${ADMIN_LINKS.blog}">Blog Posts</a>
        <a class="mts-editor-nav-link" data-admin-section="whitepapers" href="${ADMIN_LINKS.whitepapers}">White Papers</a>
        <a class="mts-editor-nav-link" data-admin-section="media" href="${ADMIN_LINKS.media}">Media Assets</a>
        <a class="mts-editor-nav-link" data-admin-section="menu" href="${ADMIN_LINKS.menu}">Top Menu</a>
        <a class="mts-editor-nav-link" data-admin-section="design" href="${ADMIN_LINKS.design}">Design</a>
      </nav>

      <section class="mts-editor-dashboard" aria-label="Editor home">
        <div class="mts-dashboard-welcome">
          <span class="mts-dashboard-kicker">WELCOME</span>
          <h1>What would you like to change?</h1>
          <p>Choose a task below. Changes stay as drafts until you choose to publish them, so you can preview everything first.</p>
        </div>

        <div class="mts-dashboard-primary">
          <a href="${ADMIN_LINKS.currentPages}">
            <span class="mts-card-number">1</span>
            <div>
              <strong>Edit an existing page</strong>
              <small>Change text, replace photos, duplicate sections, or add new sections while viewing the website beside your changes.</small>
            </div>
            <span class="mts-card-arrow">→</span>
          </a>
          <a href="${ADMIN_LINKS.newPage}">
            <span class="mts-card-number">2</span>
            <div>
              <strong>Create a new page</strong>
              <small>Start with a blank page and add ready-made hero, text, image, card, and call-to-action sections.</small>
            </div>
            <span class="mts-card-arrow">→</span>
          </a>
          <a href="${ADMIN_LINKS.blog}">
            <span class="mts-card-number">3</span>
            <div>
              <strong>Add or edit a blog post</strong>
              <small>Write an article, insert images, reuse sources for citations, and preview it before publishing.</small>
            </div>
            <span class="mts-card-arrow">→</span>
          </a>
        </div>

        <div class="mts-more-tools">
          <div class="mts-more-tools-heading">
            <strong>More website tools</strong>
            <span>Use these when you need them.</span>
          </div>
          <div class="mts-secondary-grid">
            <a href="${ADMIN_LINKS.whitepapers}"><span>White Papers</span><small>Manage PDFs and library entries</small></a>
            <a href="${ADMIN_LINKS.media}"><span>Media Assets</span><small>Browse or replace website images</small></a>
            <a href="${ADMIN_LINKS.menu}"><span>Top Menu</span><small>Add or reorder website links</small></a>
            <a href="${ADMIN_LINKS.design}"><span>Design</span><small>Approved colors and font sizes</small></a>
          </div>
        </div>
      </section>
    `;

    document.body.prepend(shell);

    shell.querySelectorAll('.mts-editor-menu').forEach((menu) => {
      menu.addEventListener('toggle', () => {
        if (menu.open) closeMenus(menu);
      });
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.mts-editor-menu')) closeMenus();
    });
  };

  const relabelLogin = () => {
    document.querySelectorAll('button').forEach((button) => {
      if (!button.textContent?.includes('Login with GitHub')) return;
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeValue?.includes('Login with GitHub')) {
          node.nodeValue = node.nodeValue.replace('Login with GitHub', 'Continue to Mercier Admin');
        }
      }
    });
  };

  const relabelButtons = () => {
    document.querySelectorAll('button').forEach((button) => {
      const text = (button.textContent || '').trim();
      if (text === 'New White Papers') button.textContent = 'New White Paper';
      if (text === 'New Posts' || text === 'New Blog Posts') button.textContent = 'New Blog Post';
      if (text === 'New Custom Pages') button.textContent = 'Create New Page';
    });
  };

  const markWhitePaperRows = () => {
    const text = document.body.innerText || '';
    document.body.classList.toggle('mts-whitepaper-library', text.includes('White Papers'));
    document.querySelectorAll('a').forEach((link) => {
      const label = (link.textContent || '').trim();
      if (/^No\.\s*\d+/i.test(label) && label.includes('|')) link.classList.add('mts-whitepaper-row');
    });
  };

  const currentSection = () => {
    const hash = window.location.hash || '#/';
    if (hash.startsWith('#/media')) return 'media';
    if (hash.includes('/collections/navigation')) return 'menu';
    if (hash.includes('/collections/settings')) return 'design';
    if (hash.includes('/collections/white-papers')) return 'whitepapers';
    if (hash.includes('/collections/posts') || hash.includes('/collections/blog')) return 'blog';
    if (hash.includes('/collections/pages') || hash.includes('/collections/custom-pages')) return 'pages';
    return '';
  };

  const updateNavigation = () => {
    const active = currentSection();
    document.querySelectorAll('[data-admin-section]').forEach((item) => {
      const isActive = item.dataset.adminSection === active;
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  };

  const updateDashboard = () => {
    const dashboard = document.querySelector('.mts-editor-dashboard');
    const backHome = document.querySelector('.mts-back-home');
    if (!dashboard) return;

    const hash = window.location.hash || '#/';
    const isHome = hash === '#/' || hash === '#';
    dashboard.hidden = !isHome;
    document.body.classList.toggle('mts-editor-home', isHome);
    if (backHome) backHome.hidden = isHome;
  };

  const decoratePreview = () => {
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.classList.add('mts-preview-frame');
      const parent = frame.parentElement;
      if (parent && !parent.querySelector(':scope > .mts-preview-label')) {
        const label = document.createElement('div');
        label.className = 'mts-preview-label';
        label.innerHTML = '<strong>Website preview</strong><span>This updates while you edit. Nothing is live until you publish.</span>';
        parent.prepend(label);
      }
    });
  };

  const refresh = () => {
    ensureShell();
    relabelLogin();
    relabelButtons();
    markWhitePaperRows();
    updateNavigation();
    updateDashboard();
    decoratePreview();
  };

  const scheduleRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  };

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleRefresh);
  window.addEventListener('load', scheduleRefresh);
  refresh();
})();
