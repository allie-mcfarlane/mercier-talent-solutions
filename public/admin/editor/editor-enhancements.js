(() => {
  'use strict';

  const rewriteWhitePaperLinks = () => {
    document.querySelectorAll('a[href="/admin/#/collections/white-papers"],a[href="#/collections/white-papers"]').forEach((link) => {
      link.setAttribute('href', '/admin/editor/whitepapers.html');
    });
  };

  const rewritePublishMessages = () => {
    document.querySelectorAll('.ve-toast').forEach((toast) => {
      if (/Cloudflare will update the (live )?website shortly/i.test(toast.textContent || '')) {
        toast.textContent = 'Published. The live website is updated.';
      }
    });
  };

  const ensureCareersStyles = () => {
    if (document.getElementById('ve-careers-spotlight-styles')) return;
    const style = document.createElement('style');
    style.id = 've-careers-spotlight-styles';
    style.textContent = `
      .ve-careers-spotlight {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        align-items: center;
        margin: 28px 0;
        padding: clamp(24px, 3vw, 34px);
        border: 1px solid rgba(69,98,142,.2);
        border-radius: 16px;
        background: linear-gradient(135deg,#f7f7f4 0%,#eef1f5 100%);
      }
      .ve-careers-spotlight::after {
        content: '';
        position: absolute;
        width: 150px;
        height: 150px;
        right: -38px;
        top: -62px;
        border: 1px solid rgba(69,98,142,.18);
        border-radius: 50%;
        box-shadow: 0 0 0 28px rgba(69,98,142,.04),0 0 0 56px rgba(69,98,142,.025);
        pointer-events: none;
      }
      .ve-careers-spotlight-copy { position: relative; z-index: 1; max-width: 680px; }
      .ve-careers-spotlight-kicker {
        display: block;
        margin-bottom: 8px;
        color: #45628e;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 2.2px;
        text-transform: uppercase;
      }
      .ve-careers-spotlight h2 { margin: 0 0 7px; color: #1a2b46; font-size: clamp(22px,2.4vw,30px); }
      .ve-careers-spotlight h2 em { color:#45628e; font-family:Georgia,serif; font-style:italic; }
      .ve-careers-spotlight p { margin: 0; color: #66707c; font-size: 13px; line-height: 1.6; }
      .ve-careers-spotlight a {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 17px;
        border-radius: 8px;
        background: #1a2b46;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        text-decoration: none;
        white-space: nowrap;
      }
      .ve-careers-spotlight a:hover,.ve-careers-spotlight a:focus-visible { background: #45628e; }
      @media (max-width: 700px) {
        .ve-careers-spotlight { grid-template-columns: 1fr; }
        .ve-careers-spotlight a { justify-self: start; }
      }
    `;
    document.head.append(style);
  };

  const ensureCareersSpotlight = () => {
    const home = document.querySelector('.ve-main .ve-secondary-tools');
    if (!home || home.parentElement?.querySelector(':scope > .ve-careers-spotlight')) return;
    const spotlight = document.createElement('section');
    spotlight.className = 've-careers-spotlight';
    spotlight.setAttribute('aria-label', 'Careers page');
    spotlight.innerHTML = `
      <div class="ve-careers-spotlight-copy">
        <span class="ve-careers-spotlight-kicker">Careers page</span>
        <h2>Join our <em>team</em></h2>
        <p>Edit the Careers heading, add open roles, and manage each role description from one place.</p>
      </div>
      <a href="/admin/editor/careers.html">Edit Careers →</a>
    `;
    home.before(spotlight);
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
      <p>Edit the hero, add open roles, and manage the description page for each role.</p>
      <span class="ve-card-action">Edit page →</span>
    `;

    const contactCard = [...grid.querySelectorAll('.ve-page-card')].find((item) =>
      item.querySelector('strong')?.textContent?.trim() === 'Contact'
    );
    if (contactCard) contactCard.after(card);
    else grid.append(card);
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
    const head = document.querySelector('.ve-editor-head');
    const actions = head?.querySelector('.ve-editor-actions');
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
    if (!editor || !save || !publish) { existing?.remove(); return; }
    if (existing) return;

    const dock = document.createElement('div');
    dock.className = 've-publish-dock';
    dock.innerHTML = `
      <div class="ve-publish-dock-copy">
        <strong>Ready when you are</strong>
        <span>Save Draft keeps it private. Publish updates the live website immediately.</span>
      </div>
      <button class="ve-button" type="button" data-dock-save>Save Draft</button>
      <button class="ve-button primary" type="button" data-dock-publish>Publish to Website</button>
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
    note.innerHTML = '<strong>Save Draft</strong> keeps changes private. <strong>Publish</strong> updates the live website immediately.';
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
    rewritePublishMessages();
    ensureCareersStyles();
    ensureCareersSpotlight();
    ensureCareersPageCard();
    ensurePreviewTopButton();
    ensureEditorTopButton();
    ensurePublishDock();
    ensureSaveExplanation();
    wireSectionButtons();
  };

  new MutationObserver(() => requestAnimationFrame(refresh)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(refresh, 40));
  window.addEventListener('load', refresh);
  refresh();
})();
