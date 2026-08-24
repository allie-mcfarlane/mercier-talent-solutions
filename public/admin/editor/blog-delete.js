(() => {
  'use strict';

  const ENDPOINT = '/admin/api/blog-post';
  const AUTH = 'token mts-cloudflare-access';
  const STYLE_ID = 've-blog-delete-style';
  const BUTTON_ID = 've-delete-blog-post';

  const currentSlug = () => {
    const match = String(window.location.hash || '').match(/^#\/blog\/([^/?#]+)$/);
    if (!match || match[1] === 'new') return '';
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ve-button.ve-danger {
        background: #fff;
        border-color: #d9b9b9;
        color: #8f2d2d;
      }
      .ve-button.ve-danger:hover {
        background: #fbf4f4;
        border-color: #c58f8f;
      }
      .ve-button.ve-danger:disabled {
        opacity: .6;
        cursor: wait;
      }
    `;
    document.head.append(style);
  };

  const showToast = (message, isError = false) => {
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.innerHTML = `<div class="ve-toast${isError ? ' error' : ''}">${String(message).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { root.innerHTML = ''; }, 4500);
  };

  const deletePost = async (button, slug) => {
    const articleTitle = document.querySelector('.ve-sidebar h2')?.textContent?.trim() || slug;
    const confirmed = window.confirm(
      `Delete “${articleTitle}”?\n\nThis removes the blog post from the website. Images used by the post will stay in Media Assets. This cannot be undone from the editor.`
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

      window.location.hash = '#/blog';
      window.setTimeout(() => showToast('Blog post deleted. The live website will update after Cloudflare finishes the new build.'), 180);
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      showToast(error?.message || 'Blog post could not be deleted.', true);
    }
  };

  const decorate = () => {
    ensureStyle();
    const slug = currentSlug();
    const actions = document.querySelector('.ve-editor-actions');

    const existing = document.getElementById(BUTTON_ID);
    if (!slug || !actions) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 've-button ve-danger';
    button.textContent = 'Delete post';
    button.addEventListener('click', () => deletePost(button, slug));
    actions.append(button);
  };

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', decorate);
  window.addEventListener('load', decorate);
  decorate();
})();
