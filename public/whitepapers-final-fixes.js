(() => {
  // Keep hosted PDFs readable in a new browser tab rather than forcing a download.
  document.querySelectorAll('main .paper-action[href]').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;

    const url = new URL(link.href, window.location.href);
    if (!/\.pdf$/i.test(url.pathname)) return;

    link.removeAttribute('download');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
})();
