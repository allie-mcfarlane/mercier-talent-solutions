(() => {
  'use strict';

  const ENDPOINT = '/admin/api/white-paper';
  const AUTH = 'token mts-cloudflare-access';
  const BUTTON_ID = 'wp-delete-paper';
  const STYLE_ID = 'wp-delete-paper-style';

  const currentSlug = () => {
    const match = String(window.location.hash || '').match(/^#edit=(.+)$/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wp-head-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
      .ve-button.wp-danger { background:#fff; border-color:#d9b9b9; color:#8f2d2d; }
      .ve-button.wp-danger:hover { background:#fbf4f4; border-color:#c58f8f; }
      .ve-button.wp-danger:disabled { opacity:.6; cursor:wait; }
      @media (max-width:640px) { .wp-edit-head { align-items:flex-start; } .wp-head-actions { justify-content:flex-start; } }
    `;
    document.head.append(style);
  };

  const showToast = (message, isError = false) => {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const safe = String(message)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    root.innerHTML = `<div class="ve-toast${isError ? ' error' : ''}">${safe}</div>`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { root.innerHTML = ''; }, 4500);
  };

  const deletePaper = async (button, slug) => {
    const title = document.querySelector('.wp-edit-head h1')?.textContent?.trim() || slug;
    const confirmed = window.confirm(
      `Delete “${title}”?\n\nThis removes the published White Paper from the website. The PDF file will stay in Media Assets so it is not accidentally lost. This cannot be undone from the editor.`
    );
    if (!confirmed) return;

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Deleting…';

    try {
      const response = await fetch(`${ENDPOINT}?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          Authorization: AUTH,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || `Delete failed (${response.status}).`);

      window.location.hash = '';
      window.setTimeout(() => showToast('White Paper deleted. The live website will update after Cloudflare finishes the new build.'), 180);
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      showToast(error?.message || 'White Paper could not be deleted.', true);
    }
  };

  const decorate = () => {
    ensureStyle();
    const slug = currentSlug();
    const head = document.querySelector('.wp-edit-head');
    const back = document.getElementById('back-list');
    const existing = document.getElementById(BUTTON_ID);

    if (!slug || !head || !back) {
      existing?.remove();
      return;
    }
    if (existing) return;

    let actions = head.querySelector('.wp-head-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'wp-head-actions';
      head.insertBefore(actions, back);
      actions.append(back);
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 've-button wp-danger';
    button.textContent = 'Delete White Paper';
    button.addEventListener('click', () => deletePaper(button, slug));
    actions.insertBefore(button, back);
  };

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', decorate);
  window.addEventListener('load', decorate);
  decorate();
})();
