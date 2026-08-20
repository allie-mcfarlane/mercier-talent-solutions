(() => {
  const ensureHelp = () => {
    if (document.querySelector('.mts-admin-help')) return;
    const bar = document.createElement('div');
    bar.className = 'mts-admin-help';
    bar.innerHTML = '<strong>Mercier Website Editor</strong><span>Changes save as drafts until you publish them.</span><span>Use image fields to replace photos and the preview pane to check your work.</span><a href="/" target="_blank" rel="noopener">Open website</a>';
    document.body.prepend(bar);
  };

  const relabelButtons = () => {
    document.querySelectorAll('button').forEach((button) => {
      const text = (button.textContent || '').trim();
      if (text === 'New White Papers') button.textContent = 'New White Paper';
      if (text === 'New Posts') button.textContent = 'New Article';
    });
  };

  const markWhitePaperRows = () => {
    const text = document.body.innerText || '';
    document.body.classList.toggle('mts-whitepaper-library', text.includes('White Papers — Library'));
    document.querySelectorAll('a').forEach((link) => {
      const label = (link.textContent || '').trim();
      if (/^No\.\s*\d+/i.test(label) && label.includes('|')) {
        link.classList.add('mts-whitepaper-row');
      }
    });
  };

  const refresh = () => {
    ensureHelp();
    relabelButtons();
    markWhitePaperRows();
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', refresh);
  refresh();
})();
