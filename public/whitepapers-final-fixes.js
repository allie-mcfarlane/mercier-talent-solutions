(() => {
  document.querySelectorAll('main .paper-action[href$=".pdf"]').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;

    const url = new URL(link.href, window.location.href);
    const filename = url.pathname.split('/').filter(Boolean).pop() || 'white-paper.pdf';

    link.removeAttribute('target');
    link.setAttribute('download', filename);
  });
})();
