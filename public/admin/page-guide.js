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

  const PAGE_EDIT_GROUPS = {
    home: [
      { label: 'Top of page', help: 'Main heading, intro text and the two buttons.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Text', 'Primary Button', 'Secondary Button'] },
      { label: 'Intro cards', help: 'The three cards and scrolling focus areas below the hero.', fields: ['Three Intro Cards', 'Scrolling Focus Areas'] },
      { label: 'Our approach', help: 'Edit the approach heading, text and bullet points.', fields: ['Our Approach Section'] },
      { label: 'Blog heading', help: 'Edit the heading above the homepage articles.', fields: ['News Section Heading'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    about: [
      { label: 'Top of page', help: 'Main heading and introduction.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Text'] },
      { label: 'Firm introduction', help: 'Edit the firm introduction section.', fields: ['Firm Introduction'] },
      { label: 'Our team', help: 'Edit names, headshots, bios, contact details and credentials.', fields: ['Team Members — Photos, Bios & Contact Details'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'services-page': [
      { label: 'Top of page', help: 'Main heading, introduction and page image.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Words', 'Intro Text', 'Main Services Image', 'Main Image Alt Text', 'Focus Area Introduction'] },
      { label: 'Focus areas', help: 'Edit the focus-area cards near the top of the page.', fields: ['Focus Areas'] },
      { label: 'Services', help: 'Add, remove, reorder or edit individual services and their images.', fields: ['Services — use Add Service to create a new one'] },
      { label: 'Training', help: 'Edit training program groups and program descriptions.', fields: ['Training Programs'] },
      { label: 'Consulting', help: 'Edit the consulting section.', fields: ['Consulting Section'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'news-page': [
      { label: 'Page introduction', help: 'Edit the heading and introductory paragraphs.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Paragraphs'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'whitepapers-page': [
      { label: 'Page introduction', help: 'Edit the heading and introductory text.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Text'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    contact: [
      { label: 'Top of page', help: 'Edit the main page heading.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word'] },
      { label: 'Contact details', help: 'Edit names, email addresses, phone numbers and LinkedIn links.', fields: ['Direct Contacts'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    privacy: [
      { label: 'Privacy policy', help: 'Edit the title, last-updated date and policy text.', fields: ['Small Heading', 'Title', 'Blue Italic Title Word', 'Last Updated', 'Policy Content'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'privacy-choices': [
      { label: 'Page content', help: 'Edit the page heading and privacy choices copy.', fields: ['Small Heading', 'Title', 'Blue Italic Title Word', 'Page Content'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'data-requests': [
      { label: 'Page content', help: 'Edit the heading, form settings and introductory copy.', fields: ['Small Heading', 'Title', 'Blue Italic Title Word', 'Form Email Subject', 'Form Name', 'Show Name Field', 'Request Type Options', 'Page Intro Content'] },
      { label: 'Add a section', help: 'Add an optional new visual section to the bottom of the page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
  };

  const root = () => document.querySelector('#nc-root');
  const shell = () => document.querySelector('.mts-editor-shell');
  const cleanText = (node) => (node?.textContent || '').trim();

  const setRootVisible = (visible) => {
    const app = root();
    if (app) app.style.display = visible ? '' : 'none';
  };

  const removeGuide = () => {
    document.querySelectorAll('.mts-page-picker, .mts-page-edit-guide').forEach((node) => node.remove());
    document.body.classList.remove('mts-focused-page-editor');
    document.querySelectorAll('[data-mts-page-field]').forEach((node) => {
      node.style.display = node.dataset.mtsOriginalDisplay || '';
      node.removeAttribute('data-mts-page-field');
      node.removeAttribute('data-mts-original-display');
    });
  };

  const friendlyLabels = () => {
    const replacements = new Map([
      ['Add Sections to the Bottom of This Page', 'Add another section'],
      ['Page Sections — drag to reorder', 'Page sections'],
      ['Small Heading Above Title', 'Small label'],
      ['Blue Italic Title Word', 'Blue italic word'],
      ['Blue Italic Title Words', 'Blue italic words'],
      ['Image Alt Text', 'Image description'],
      ['Headshot Alt Text', 'Headshot description'],
      ['Main Services Image', 'Main page image'],
      ['Main Image Alt Text', 'Main image description'],
      ['SEO Description', 'Search description (optional)'],
      ['Focus Area Introduction', 'Focus area introduction'],
      ['Three Intro Cards', 'Intro cards'],
      ['News Section Heading', 'Blog section heading'],
      ['Team Members — Photos, Bios & Contact Details', 'Our team'],
      ['Services — use Add Service to create a new one', 'Services'],
    ]);

    document.querySelectorAll('label, h1, h2, h3, h4, p, span, button').forEach((node) => {
      if (node.children.length > 0) return;
      const text = cleanText(node);
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
        <p>Choose the page. Then choose the part of that page you want to edit.</p>
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

  const getFieldContainer = (label, topFieldNames) => {
    const app = root();
    if (!label || !app) return null;
    let current = label.parentElement;
    let best = current;

    while (current && current !== app) {
      const matchingLabels = [...current.querySelectorAll('label')]
        .filter((item) => topFieldNames.includes(cleanText(item))).length;
      if (matchingLabels > 1) break;
      best = current;
      current = current.parentElement;
    }
    return best;
  };

  const setupFocusedPageEditor = (pageKey) => {
    const groups = PAGE_EDIT_GROUPS[pageKey];
    const app = root();
    const guide = document.querySelector('.mts-page-edit-guide');
    if (!groups || !app || !guide) return;

    document.body.classList.add('mts-focused-page-editor');
    const allFieldNames = [...new Set(groups.flatMap((group) => group.fields))];
    const fieldMap = new Map();

    allFieldNames.forEach((fieldName) => {
      const label = [...app.querySelectorAll('label')].find((item) => cleanText(item) === fieldName);
      const container = getFieldContainer(label, allFieldNames);
      if (!container) return;
      if (!container.hasAttribute('data-mts-page-field')) {
        container.dataset.mtsPageField = 'true';
        container.dataset.mtsOriginalDisplay = container.style.display || '';
      }
      fieldMap.set(fieldName, container);
    });

    if (!fieldMap.size) return;

    const chooser = document.createElement('section');
    chooser.className = 'mts-section-chooser';
    chooser.innerHTML = `
      <div class="mts-section-chooser-head">
        <div>
          <span>CHOOSE WHAT TO EDIT</span>
          <strong>Work on one part of the page at a time</strong>
        </div>
        <button type="button" class="mts-show-all-fields">Show everything</button>
      </div>
      <div class="mts-section-tabs" role="tablist">
        ${groups.map((group, index) => `<button type="button" data-mts-group="${index}" role="tab"><b>${index + 1}</b><span>${group.label}</span></button>`).join('')}
      </div>
      <div class="mts-section-help" aria-live="polite"></div>
    `;
    guide.append(chooser);

    const help = chooser.querySelector('.mts-section-help');
    const tabs = [...chooser.querySelectorAll('[data-mts-group]')];
    const showAllButton = chooser.querySelector('.mts-show-all-fields');

    const restoreAll = () => {
      new Set(fieldMap.values()).forEach((container) => {
        container.style.display = container.dataset.mtsOriginalDisplay || '';
      });
      tabs.forEach((tab) => tab.classList.remove('is-active'));
      showAllButton?.classList.add('is-active');
      if (help) help.innerHTML = '<strong>All page fields are visible.</strong><span>You can switch back to a single section at any time.</span>';
    };

    const showGroup = (index) => {
      const group = groups[index];
      if (!group) return;
      new Set(fieldMap.values()).forEach((container) => {
        container.style.display = 'none';
      });
      group.fields.forEach((fieldName) => {
        const container = fieldMap.get(fieldName);
        if (container) container.style.display = container.dataset.mtsOriginalDisplay || '';
      });
      tabs.forEach((tab, tabIndex) => tab.classList.toggle('is-active', tabIndex === index));
      showAllButton?.classList.remove('is-active');
      if (help) help.innerHTML = `<strong>${group.label}</strong><span>${group.help}</span>`;
      requestAnimationFrame(() => {
        const first = group.fields.map((fieldName) => fieldMap.get(fieldName)).find(Boolean);
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    tabs.forEach((tab, index) => tab.addEventListener('click', () => showGroup(index)));
    showAllButton?.addEventListener('click', restoreAll);
    showGroup(0);
  };

  const editGuide = ({ title, path, pageKey = null, isNew = false, isBuilder = false }) => {
    removeGuide();
    setRootVisible(true);
    document.body.classList.remove('mts-guided-pages');

    const guide = document.createElement('div');
    guide.className = 'mts-page-edit-guide';
    guide.innerHTML = `
      <div class="mts-page-edit-guide-main">
        <a class="mts-simple-back" href="${isBuilder ? '#/collections/pages' : '#/collections/pages'}">← Back to Pages</a>
        <div>
          <span class="mts-page-step">${isNew ? 'NEW PAGE' : 'EDIT PAGE'}</span>
          <strong>${isNew ? 'Create a new page' : `Editing ${title}`}</strong>
          <small>${isNew ? 'Start with the page name, then add the sections you need.' : 'Choose one part of the page below. You only need to change the fields you want.'}</small>
        </div>
      </div>
      <div class="mts-page-edit-guide-actions">
        ${path ? `<a href="${path}" target="_blank" rel="noopener">View current page ↗</a>` : ''}
      </div>
      <div class="mts-edit-steps" aria-label="Editing steps">
        <span><b>1</b> Choose a section</span>
        <span><b>2</b> Make your change</span>
        <span><b>3</b> Check preview</span>
        <span><b>4</b> Save draft</span>
      </div>
    `;

    const anchor = shell();
    if (anchor) anchor.insertAdjacentElement('afterend', guide);
    else document.body.prepend(guide);

    if (pageKey) setTimeout(() => setupFocusedPageEditor(pageKey), 180);
  };

  const builderGuide = (isNew) => {
    editGuide({ title: 'Custom page', path: null, isNew, isBuilder: true });

    const guide = document.querySelector('.mts-page-edit-guide');
    if (!guide) return;
    const helper = document.createElement('div');
    helper.className = 'mts-builder-helper';
    helper.innerHTML = `
      <div><b>1</b><strong>Name the page</strong><span>Give it a clear page name and address.</span></div>
      <div><b>2</b><strong>Add a Hero / Feature</strong><span>This is the top section visitors see first.</span></div>
      <div><b>3</b><strong>Add more sections</strong><span>Use Text, Image + Text, Cards or Call to Action.</span></div>
      <div><b>4</b><strong>Preview and save</strong><span>Ignore Advanced HTML unless you specifically need custom code.</span></div>
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
      editGuide({ title: page?.label || 'Website page', path: page?.path || null, pageKey: pageMatch[1] });
      setTimeout(friendlyLabels, 360);
      return;
    }

    if (hash.startsWith('#/collections/custom-pages/new')) {
      builderGuide(true);
      setTimeout(friendlyLabels, 120);
      return;
    }

    if (hash.startsWith('#/collections/custom-pages/entries/')) {
      builderGuide(false);
      setTimeout(friendlyLabels, 120);
      return;
    }

    removeGuide();
    setRootVisible(true);
    document.body.classList.remove('mts-guided-pages');
    setTimeout(friendlyLabels, 80);
  };

  let labelTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(labelTimer);
    labelTimer = setTimeout(friendlyLabels, 60);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(render, 30));
  window.addEventListener('load', render);
  render();
})();