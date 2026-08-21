(() => {
  'use strict';

  let queued = false;

  const protectHomepageHero = () => {
    const isHomeHero = /^#\/page\/home(?:$|[/?])/.test(location.hash || '')
      && document.querySelector('.ve-section-button.active[data-section-select="hero"]');
    if (!isHomeHero) return;
    const frame = document.getElementById('ve-preview');
    const doc = frame?.contentDocument;
    if (!doc?.body) return;
    const hero = doc.querySelector('.hero');
    if (hero) {
      hero.style.removeProperty('padding-top');
      hero.style.removeProperty('padding-bottom');
    }
    doc.querySelectorAll('.mts-fixed-space').forEach((node) => node.remove());
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      protectHomepageHero();
    });
  };

  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(queue, 60));
  window.addEventListener('load', queue);
  setInterval(protectHomepageHero, 500);
  queue();
})();
