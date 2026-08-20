(() => {
  const ADMIN_LINKS = {
    currentPages: '#/collections/pages',
    newPage: '#/collections/custom-pages/new',
    blog: '#/collections/posts',
    whitepapers: '#/collections/white-papers',
    menu: '#/collections/navigation/entries/main',
    media: '#/media',
    design: '#/collections/settings/entries/appearance',
  };

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
        <div>
          <strong>Mercier Website Editor</strong>
          <span>Draft safely, preview your changes, then publish when ready.</span>
        </div>
        <a class="mts-open-site" href="/" target="_blank" rel="noopener">Open Live Website ↗</a>
      </div>
      <nav class="mts-editor-nav" aria-label="Website editor menu">
        <details class="mts-editor-menu">
          <summary>Pages</summary>
          <div class="mts-editor-dropdown">
            <a href="${ADMIN_LINKS.currentPages}"><strong>Current Pages</strong><span>Edit Home, About, Services, Contact and privacy pages.</span></a>
            <a href="${ADMIN_LINKS.newPage}"><strong>Create New Page</strong><span>Build a new page with ready-made visual sections.</span></a>
          </div>
        </details>
        <details class="mts-editor-menu">
          <summary>Content</summary>
          <div class="mts-editor-dropdown">
            <a href="${ADMIN_LINKS.blog}"><strong>Blog Posts</strong><span>Create and edit articles and insights.</span></a>
            <a href="${ADMIN_LINKS.whitepapers}"><strong>White Papers</strong><span>Manage PDFs, titles, dates, images and descriptions.</span></a>
          </div>
        </details>
        <details class="mts-editor-menu">
          <summary>Website</summary>
          <div class="mts-editor-dropdown">
            <a href="${ADMIN_LINKS.menu}"><strong>Top Menu</strong><span>Choose which pages appear in the website navigation.</span></a>
            <a href="${ADMIN_LINKS.media}"><strong>Media Assets</strong><span>Browse website photos, headshots, graphics and uploads.</span></a>
          </div>
        </details>
        <a class="mts-editor-nav-link" href="${ADMIN_LINKS.design}">Design Settings</a>
      </nav>
      <section class="mts-editor-dashboard" aria-label="Editor quick start">
        <div class="mts-dashboard-copy">
          <span class="mts-dashboard-kicker">QUICK START</span>
          <h1>What would you like to edit?</h1>
          <p>Choose a task below. You do not need to know anything about code.</p>
        </div>
        <div class="mts-dashboard-grid">
          <a href="${ADMIN_LINKS.currentPages}"><span class="mts-card-icon">▣</span><strong>Edit a Page</strong><small>Update text, photos or add sections.</small></a>
          <a href="${ADMIN_LINKS.newPage}"><span class="mts-card-icon">＋</span><strong>Create a Page</strong><small>Build a new page from visual blocks.</small></a>
          <a href="${ADMIN_LINKS.blog}"><span class="mts-card-icon">✎</span><strong>Blog Posts</strong><small>Write or update website articles.</small></a>
          <a href="${ADMIN_LINKS.whitepapers}"><span class="mts-card-icon">▤</span><strong>White Papers</strong><small>Manage the white paper library.</small></a>
          <a href="${ADMIN_LINKS.media}"><span class="mts-card-icon">▧</span><strong>Media Assets</strong><small>See and replace website images.</small></a>
          <a href="${ADMIN_LINKS.menu}"><span class="mts-card-icon">☰</span><strong>Top Menu</strong><small>Add or reorder navigation links.</small></a>
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
      if (/^No\.\s*\d+/i.test(label) && label.includes('|')) {
        link.classList.add('mts-whitepaper-row');
      }
    });
  };

  const updateDashboard = () => {
    const dashboard = document.querySelector('.mts-editor-dashboard');
    if (!dashboard) return;
    const hash = window.location.hash || '#/';
    dashboard.hidden = !(hash === '#/' || hash === '#');
  };

  const decoratePreview = () => {
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.classList.add('mts-preview-frame');
      const parent = frame.parentElement;
      if (parent && !parent.querySelector(':scope > .mts-preview-label')) {
        const label = document.createElement('div');
        label.className = 'mts-preview-label';
        label.textContent = 'Website Preview';
        parent.prepend(label);
      }
    });
  };

  const refresh = () => {
    ensureShell();
    relabelButtons();
    markWhitePaperRows();
    updateDashboard();
    decoratePreview();
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', refresh);
  window.addEventListener('load', refresh);
  refresh();
})();
