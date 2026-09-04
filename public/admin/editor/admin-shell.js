(() => {
  'use strict';

  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');
  let scheduled = false;

  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  };

  const rewriteWhitePaperLinks = () => {
    document.querySelectorAll('a[href="/admin/#/collections/white-papers"],a[href="#/collections/white-papers"]').forEach((link) => {
      link.setAttribute('href', '/admin/editor/whitepapers.html');
    });
  };

  const clarifyLegacyTools = () => {
    const labels = new Map([
      ['/admin/#/media', 'Opens the media manager'],
      ['/admin/#/collections/navigation/entries/main', 'Opens menu settings'],
      ['/admin/#/collections/settings/entries/appearance', 'Opens design settings'],
    ]);

    labels.forEach((note, href) => {
      document.querySelectorAll(`.ve-tool-row a[href="${href}"]`).forEach((link) => {
        if (link.querySelector('.ve-tool-transition')) return;
        const helper = document.createElement('em');
        helper.className = 've-tool-transition';
        helper.textContent = note;
        link.append(helper);
      });
    });
  };

  const rewritePublishMessages = () => {
    document.querySelectorAll('.ve-toast').forEach((toast) => {
      if (/Cloudflare will update the (live )?website shortly/i.test(toast.textContent || '')) {
        toast.textContent = 'Published. Your live website is updating now.';
      }
    });
  };

  const ensureCareersSpotlight = () => {
    const tools = document.querySelector('.ve-main .ve-secondary-tools');
    if (!tools || tools.parentElement?.querySelector(':scope > .ve-careers-spotlight')) return;

    const spotlight = document.createElement('section');
    spotlight.className = 've-careers-spotlight';
    spotlight.setAttribute('aria-label', 'Careers page');
    spotlight.innerHTML = `
      <div class="ve-careers-spotlight-copy">
        <span class="ve-careers-spotlight-kicker">Careers</span>
        <h2>Manage the <em>Careers</em> page</h2>
        <p>Edit the page heading, open roles, role descriptions, and application form content from one place.</p>
      </div>
      <a href="/admin/editor/careers.html">Edit Careers →</a>
    `;
    tools.before(spotlight);
  };

  const ensureCareersPageCard = () => {
    const grid = document.querySelector('.ve-page-grid');
    if (!grid || grid.querySelector('[data-careers-page-card]')) return;

    const card = document.createElement('a');
    card.className = 've-page-card';
    card.href = '/admin/editor/careers.html';
    card.dataset.careersPageCard = 'true';
    card.innerHTML = `
      <strong>Careers</strong>
      <p>Edit the Careers page, add open roles, and manage each role description.</p>
      <span class="ve-card-action">Edit page →</span>
    `;

    const contact = [...grid.querySelectorAll('.ve-page-card')].find((item) =>
      item.querySelector('strong')?.textContent?.trim() === 'Contact'
    );
    if (contact) contact.after(card);
    else grid.append(card);
  };

  const setCurrentNavigation = () => {
    document.querySelectorAll('.ve-nav a').forEach((link) => link.removeAttribute('aria-current'));
    const path = window.location.pathname;
    const hash = window.location.hash;
    let target = null;

    if (path.endsWith('/whitepapers.html')) target = document.querySelector('.ve-nav a[href="/admin/editor/whitepapers.html"]');
    else if (path.endsWith('/careers.html')) target = [...document.querySelectorAll('.ve-nav a')].find((link) => /careers/i.test(link.textContent || ''));
    else if (hash.startsWith('#/blog')) target = document.querySelector('.ve-nav a[href="#/blog"],.ve-nav a[href="/admin/editor/#/blog"]');
    else if (hash.startsWith('#/page') || hash.startsWith('#/pages') || hash.startsWith('#/new-page')) target = document.querySelector('.ve-nav a[href="#/pages"],.ve-nav a[href="/admin/editor/#/pages"]');
    else target = document.querySelector('.ve-nav a[href="#/"],.ve-nav a[href="/admin/editor/#/"]');

    target?.setAttribute('aria-current', 'page');
  };

  const ensureContextLink = () => {
    const head = document.querySelector('.ve-editor-head');
    if (!head || head.parentElement?.querySelector(':scope > .ve-context-link')) return;
    const back = document.querySelector('.ve-sidebar-back');
    if (!back) return;

    const context = document.createElement('a');
    context.className = 've-context-link';
    context.href = back.getAttribute('href') || '#/';
    context.textContent = back.textContent?.trim() || 'Back';
    head.parentElement.insertBefore(context, head);
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
    button.textContent = 'Top ↑';
    button.addEventListener('click', scrollPreviewTop);
    tools.append(button);
    if (status) tools.append(status);
    bar.append(tools);
  };

  const ensureEditorTopButton = () => {
    const actions = document.querySelector('.ve-editor-head .ve-editor-actions');
    if (!actions || actions.querySelector('.ve-editor-top')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 've-editor-top';
    button.textContent = 'Top ↑';
    button.addEventListener('click', scrollEditorTop);
    actions.prepend(button);
  };

  const proxyAction = (action) => {
    const target = document.querySelector(`.ve-editor-head [data-action="${action}"]`);
    if (target && !target.disabled) target.click();
  };

  const ensurePublishDock = () => {
    const editor = document.querySelector('.ve-editor');
    const save = document.querySelector('.ve-editor-head [data-action="save-draft"]');
    const publish = document.querySelector('.ve-editor-head [data-action="publish"]');
    const existing = document.querySelector('.ve-publish-dock');

    if (!editor || !save || !publish) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const dock = document.createElement('div');
    dock.className = 've-publish-dock';
    dock.innerHTML = `
      <div class="ve-publish-dock-copy">
        <strong>Save first, publish when ready</strong>
        <span>Save Draft stays private. Publish updates the live website.</span>
      </div>
      <button class="ve-button" type="button" data-dock-save>Save Draft</button>
      <button class="ve-button primary" type="button" data-dock-publish>Publish</button>
    `;
    dock.querySelector('[data-dock-save]').addEventListener('click', () => proxyAction('save-draft'));
    dock.querySelector('[data-dock-publish]').addEventListener('click', () => proxyAction('publish'));
    document.body.append(dock);
  };

  const ensureSaveExplanation = () => {
    const head = document.querySelector('.ve-editor-head');
    if (!head || head.parentElement?.querySelector(':scope > .ve-save-note')) return;
    const note = document.createElement('p');
    note.className = 've-save-note';
    note.innerHTML = '<strong>Save Draft</strong> keeps changes private. <strong>Publish</strong> sends the approved changes to the live website.';
    head.after(note);
  };

  const wireSectionButtons = () => {
    document.querySelectorAll('[data-section-select]').forEach((button) => {
      if (button.dataset.veTopWired) return;
      button.dataset.veTopWired = 'true';
      button.addEventListener('click', () => setTimeout(scrollEditorTop, 30));
    });
  };

  const refresh = () => {
    rewriteWhitePaperLinks();
    clarifyLegacyTools();
    rewritePublishMessages();
    ensureCareersSpotlight();
    ensureCareersPageCard();
    setCurrentNavigation();
    ensureContextLink();
    ensurePreviewTopButton();
    ensureEditorTopButton();
    ensurePublishDock();
    ensureSaveExplanation();
    wireSectionButtons();
  };

  if (app) new MutationObserver(scheduleRefresh).observe(app, { childList: true });
  if (toastRoot) new MutationObserver(scheduleRefresh).observe(toastRoot, { childList: true });
  window.addEventListener('hashchange', scheduleRefresh);
  window.addEventListener('load', scheduleRefresh);
  refresh();
})();
