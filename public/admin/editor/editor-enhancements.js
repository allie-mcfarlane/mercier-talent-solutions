(() => {
  'use strict';

  const rewriteWhitePaperLinks = () => {
    document.querySelectorAll('a[href="/admin/#/collections/white-papers"],a[href="#/collections/white-papers"]').forEach((link) => {
      link.setAttribute('href', '/admin/editor/whitepapers.html');
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
        <span>Save Draft keeps it private. Publish updates the live website.</span>
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
    note.innerHTML = '<strong>Save Draft</strong> keeps changes private. <strong>Publish</strong> sends them to the live website; Cloudflare may take a short moment to deploy.';
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
