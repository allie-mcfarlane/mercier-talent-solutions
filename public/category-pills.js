(() => {
  'use strict';

  const categoryClasses = {
    Insight: 'pill-insight',
    Speaking: 'pill-speaking',
    'White Paper': 'pill-whitepaper',
    Announcement: 'pill-announcement',
    News: 'pill-news',
  };

  const managedClasses = Object.values(categoryClasses);

  const normalizePill = (pill) => {
    const label = String(pill.textContent || '').replace(/\s+/g, ' ').trim();
    const className = categoryClasses[label];
    if (!className) return;
    managedClasses.forEach((candidate) => pill.classList.remove(candidate));
    pill.classList.add(className);
  };

  const normalizeAll = () => document.querySelectorAll('.pill').forEach(normalizePill);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeAll, { once: true });
  } else {
    normalizeAll();
  }
})();
