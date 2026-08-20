(() => {
  const PAGE_ROUTES = [
    { key: 'home', label: 'Home', path: '/', note: 'Main headline, intro, buttons, cards and homepage sections.' },
    { key: 'about', label: 'About', path: '/about/', note: 'Firm introduction, Julia and Allie headshots, bios and team details.' },
    { key: 'services-page', label: 'Services', path: '/services/', note: 'Services, service images, focus areas, training and consulting.' },
    { key: 'news-page', label: 'News & Insights', path: '/news/', note: 'The landing page introduction for articles and insights.' },
    { key: 'whitepapers-page', label: 'White Papers', path: '/whitepapers/', note: 'The landing page introduction for the white paper library.' },
    { key: 'contact', label: 'Contact', path: '/contactus/', note: 'Contact page headings and direct contact details.' },
    { key: 'privacy', label: 'Privacy Policy', path: '/privacy/', note: 'Privacy policy text and last-updated date.' },
    { key: 'privacy-choices', label: 'Privacy Choices', path: '/privacy-choices/', note: 'Privacy choices page copy.' },
    { key: 'data-requests', label: 'Data Requests', path: '/data-requests/', note: 'Data request and appeal page copy and options.' },
  ];

  const root = () => document.querySelector('#nc-root');
  const shell = () => document.querySelector('.mts-editor-shell');

  const setRootVisible = (visible) => {
    const app = root();
    if (app) app.style.display = visible ? '' : 'none';
  };

  const removeGuide = () => {
    document.querySelectorAll('.mts-page-picker, .mts-page-edit-guide').forEach((node) => node.remove());
  };

  const friendlyLabels = () => {
    const replacements = new Map([
      ['Add Sections to the Bottom of This Page', 'Add another section (optional)'],
      ['Page Sections — drag to reorder', 'Page sections'],
      ['Small Heading Above Title', 'Small label'],
      ['Blue Italic Title Word', 'Blue italic word'],
      ['Blue Italic Title Words', 'Blue italic words'],
      ['Image Alt Text', 'Image description'],
      ['Headshot Alt Text', 'Headshot description'],
      ['Main Services Image', 'Main page image'],
      ['Main Image Alt Text', 'Main image description'],
      ['SEO Description', 'Search description (optional)'],
    ]);

    document.querySelectorAll('label, h1, h2, h3, h4, p, span, button').forEach((node) => {
      if (node.children.length > 0) return;
      const text = (node.textContent || '').trim();
      if (replacements.has(text)) node.textContent = replacements.get(text);
    });
  };

  const pagePicker = () => {
    removeGuide();
    setRootVisible(false);
    document.body.classList.add('mts-guided-pages');

    const wrap = document.createElement('main');
    wrap.className = 'mts-page-picker';
    wrap.innerHTML = `
      <div class="mts-page-picker-head">
        <a class="mts-simple-back" href="#/">← Editor Home</a>
        <span class="mts-page-step">PAGES</span>
        <h1>Which page do you want to change?</h1>
        <p>Pick the page first. On the next screen, change only what you need and use the preview to check it before saving.</p>
      </div>
      <div class="mts-page-picker-grid">
        ${PAGE_ROUTES.map((page) => `
          <a class="mts-page-card" href="#/collections/pages/entries/${page.key}">
            <span class="mts-page-card-title">${page.label}</span>
            <span class="mts-page-card-note">${page.note}</span>
            <span class="mts-page-card-action">Edit page →</span>
          </a>
        `).join('')}
      </div>
      <div class="mts-create-page-callout">
        <div>
          <strong>Need a page that does not exist yet?</strong>
          <span>Create one from ready-made sections. You can add it to the top menu later.</span>
        </div>
        <a href="#/collections/custom-pages/new">Create a new page</a>
      </div>
    `;

    const anchor = shell();
    if (anchor) anchor.insertAdjacentElement('afterend', wrap);
    else document.body.prepend(wrap);
  };

  const findTextElement = (needle) => {
    return [...document.querySelectorAll('label, h1, h2, h3, h4, p, span, button')]
      .find((node) => (node.textContent || '').trim().includes(needle));
  };

  const scrollToOptionalSections = () => {
    const target = findTextElement('Add another section') || findTextElement('Add Sections to the Bottom');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const editGuide = ({ title, path, isNew = false, isBuilder = false }) => {
    removeGuide();
    setRootVisible(true);
    document.body.classList.remove('mts-guided-pages');

    const guide = document.createElement('div');
    guide.className = 'mts-page-edit-guide';
    guide.innerHTML = `
      <div class="mts-page-edit-guide-main">
        <a class="mts-simple-back" href="#/collections/pages">← Back to Pages</a>
        <div>
          <span class="mts-page-step">${isNew ? 'NEW PAGE' : 'EDIT PAGE'}</span>
          <strong>${title}</strong>
          <small>${isNew ? 'Start with the page name and URL, then add sections.' : 'Change only the fields you need. Leave everything else as it is.'}</small>
        </div>
      </div>
      <div class="mts-page-edit-guide-actions">
        ${!isNew && !isBuilder ? '<button type="button" class="mts-jump-sections">+ Add a section</button>' : ''}
        ${path ? `<a href="${path}" target="_blank" rel="noopener">View current page ↗</a>` : ''}
      </div>
      <div class="mts-edit-steps" aria-label="Editing steps">
        <span><b>1</b> Edit</span>
        <span><b>2</b> Check preview</span>
        <span><b>3</b> Save draft</span>
      </div>
    `;

    const anchor = shell();
    if (anchor) anchor.insertAdjacentElement('afterend', guide);
    else document.body.prepend(guide);

    guide.querySelector('.mts-jump-sections')?.addEventListener('click', scrollToOptionalSections);
  };

  const builderGuide = (isNew) => {
    editGuide({
      title: isNew ? 'Create a new page' : 'Edit custom page',
      path: null,
      isNew,
      isBuilder: true,
    });

    const guide = document.querySelector('.mts-page-edit-guide');
    if (!guide) return;
    const helper = document.createElement('div');
    helper.className = 'mts-builder-helper';
    helper.innerHTML = `
      <strong>Keep it simple:</strong>
      <span>1. Give the page a name and URL.</span>
      <span>2. Add a <b>Hero / Feature</b> section first.</span>
      <span>3. Add Text, Image + Text, Cards, or Call to Action sections as needed.</span>
      <span>4. Ignore Advanced HTML unless you specifically need custom code.</span>
    `;
    guide.append(helper);
  };

  const render = () => {
    const hash = window.location.hash || '#/';

    if (hash === '#/collections/pages' || hash === '#/collections/pages/') {
      pagePicker();
      return;
    }

    const pageMatch = hash.match(/^#\/collections\/pages\/entries\/([^/?]+)/);
    if (pageMatch) {
      const page = PAGE_ROUTES.find((item) => item.key === pageMatch[1]);
      editGuide({ title: page?.label || 'Website page', path: page?.path || null });
      setTimeout(friendlyLabels, 80);
      return;
    }

    if (hash.startsWith('#/collections/custom-pages/new')) {
      builderGuide(true);
      setTimeout(friendlyLabels, 80);
      return;
    }

    if (hash.startsWith('#/collections/custom-pages/entries/')) {
      builderGuide(false);
      setTimeout(friendlyLabels, 80);
      return;
    }

    removeGuide();
    setRootVisible(true);
    document.body.classList.remove('mts-guided-pages');
    setTimeout(friendlyLabels, 80);
  };

  const observer = new MutationObserver(() => {
    friendlyLabels();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(render, 20));
  window.addEventListener('load', render);
  render();
})();