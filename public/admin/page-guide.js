(() => {
  const PAGE_ROUTES = [
    { key: 'home', label: 'Home', path: '/', note: 'Main headline, intro, buttons, cards and homepage sections.' },
    { key: 'about', label: 'About', path: '/about/', note: 'Firm introduction, team headshots, bios and contact details.' },
    { key: 'services-page', label: 'Services', path: '/services/', note: 'Page image, focus areas, services, training and consulting.' },
    { key: 'news-page', label: 'News & Insights', path: '/news/', note: 'Landing-page heading and introduction.' },
    { key: 'whitepapers-page', label: 'White Papers', path: '/whitepapers/', note: 'White Paper library heading and introduction.' },
    { key: 'contact', label: 'Contact', path: '/contactus/', note: 'Contact-page heading and contact details.' },
    { key: 'privacy', label: 'Privacy Policy', path: '/privacy/', note: 'Privacy policy text and date.' },
    { key: 'privacy-choices', label: 'Privacy Choices', path: '/privacy-choices/', note: 'Privacy choices page copy.' },
    { key: 'data-requests', label: 'Data Requests', path: '/data-requests/', note: 'Data request page copy and form options.' },
  ];

  const GROUPS = {
    home: [
      { label: 'Top of page', help: 'Edit the main heading, intro and buttons.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Text', 'Primary Button', 'Secondary Button'] },
      { label: 'Intro cards', help: 'Edit the three cards and scrolling focus areas.', fields: ['Three Intro Cards', 'Scrolling Focus Areas'] },
      { label: 'Our approach', help: 'Edit the approach heading, copy and bullet points.', fields: ['Our Approach Section'] },
      { label: 'Blog heading', help: 'Edit the heading above the homepage blog posts.', fields: ['News Section Heading'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    about: [
      { label: 'Top of page', help: 'Edit the main heading and introduction.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Text'] },
      { label: 'Firm introduction', help: 'Edit the firm introduction.', fields: ['Firm Introduction'] },
      { label: 'Team & photos', help: 'Edit team bios and headshots. To change a photo, use Replace photo and choose from Media Assets.', fields: ['Team Members — Photos, Bios & Contact Details'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'services-page': [
      { label: 'Page header & photo', help: 'Edit the main heading, intro and large page photo. Use Replace photo to choose another image.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Words', 'Intro Text', 'Main Services Image', 'Main Image Alt Text', 'Focus Area Introduction'] },
      { label: 'Focus areas', help: 'Edit the focus-area cards near the top of the page.', fields: ['Focus Areas'] },
      { label: 'Services & photos', help: 'Edit, add or reorder services and their images. Use Replace photo inside a service to swap its image.', fields: ['Services — use Add Service to create a new one'] },
      { label: 'Training', help: 'Edit training groups and program descriptions.', fields: ['Training Programs'] },
      { label: 'Consulting', help: 'Edit the consulting section.', fields: ['Consulting Section'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'news-page': [
      { label: 'Page introduction', help: 'Edit the page heading and introduction.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Paragraphs'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'whitepapers-page': [
      { label: 'Page introduction', help: 'Edit the page heading and introduction.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word', 'Intro Text'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    contact: [
      { label: 'Top of page', help: 'Edit the main page heading.', fields: ['Small Heading Above Title', 'Main Title', 'Blue Italic Title Word'] },
      { label: 'Contact details', help: 'Edit names, email addresses, phone numbers and LinkedIn links.', fields: ['Direct Contacts'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    privacy: [
      { label: 'Privacy policy', help: 'Edit the title, date and policy text.', fields: ['Small Heading', 'Title', 'Blue Italic Title Word', 'Last Updated', 'Policy Content'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'privacy-choices': [
      { label: 'Page content', help: 'Edit the heading and privacy choices copy.', fields: ['Small Heading', 'Title', 'Blue Italic Title Word', 'Page Content'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
    'data-requests': [
      { label: 'Page content', help: 'Edit the heading, copy and request options.', fields: ['Small Heading', 'Title', 'Blue Italic Title Word', 'Form Email Subject', 'Form Name', 'Show Name Field', 'Request Type Options', 'Page Intro Content'] },
      { label: 'Add a section', help: 'Add an optional new section below the existing page.', fields: ['Add Sections to the Bottom of This Page'] },
    ],
  };

  const LABELS = new Map([
    ['Add Sections to the Bottom of This Page', 'Add another section'],
    ['Page Sections — drag to reorder', 'Page sections'],
    ['Small Heading Above Title', 'Small label'],
    ['Blue Italic Title Word', 'Blue italic word'],
    ['Blue Italic Title Words', 'Blue italic words'],
    ['Image Alt Text', 'Image description'],
    ['Headshot Alt Text', 'Headshot description'],
    ['Main Services Image', 'Main page photo'],
    ['Main Image Alt Text', 'Main photo description'],
    ['SEO Description', 'Search description (optional)'],
    ['Focus Area Introduction', 'Focus area introduction'],
    ['Three Intro Cards', 'Intro cards'],
    ['News Section Heading', 'Blog section heading'],
    ['Team Members — Photos, Bios & Contact Details', 'Team & photos'],
    ['Services — use Add Service to create a new one', 'Services & photos'],
  ]);

  const root = () => document.querySelector('#nc-root');
  const shell = () => document.querySelector('.mts-editor-shell');
  const clean = (node) => (node?.textContent || '').trim();
  const aliases = (name) => [name, LABELS.get(name)].filter(Boolean);
  const matches = (node, name) => aliases(name).includes(clean(node));

  const setRootVisible = (visible) => {
    const app = root();
    if (app) app.style.display = visible ? '' : 'none';
  };

  const resetFieldVisibility = () => {
    document.querySelectorAll('[data-mts-page-field]').forEach((node) => {
      node.style.display = node.dataset.mtsOriginalDisplay || '';
      node.removeAttribute('data-mts-page-field');
      node.removeAttribute('data-mts-original-display');
    });
  };

  const removeGuide = () => {
    document.querySelectorAll('.mts-page-picker,.mts-page-edit-guide').forEach((node) => node.remove());
    document.body.classList.remove('mts-focused-page-editor','mts-guided-pages');
    resetFieldVisibility();
  };

  const friendlyLabels = () => {
    document.querySelectorAll('label,h1,h2,h3,h4,p,span').forEach((node) => {
      if (node.children.length) return;
      const replacement = LABELS.get(clean(node));
      if (replacement) node.textContent = replacement;
    });
    document.querySelectorAll('button').forEach((button) => {
      const label = clean(button);
      if (label === 'Choose an image' || label === 'Choose image') button.textContent = 'Choose photo';
      if (label === 'Choose different image' || label === 'Choose a different image') button.textContent = 'Replace photo';
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
        <h1>Which page do you want to edit?</h1>
        <p>Choose a page, then choose the part of that page you want to change.</p>
      </div>
      <div class="mts-page-picker-grid">
        ${PAGE_ROUTES.map((page) => `<a class="mts-page-card" href="#/collections/pages/entries/${page.key}"><span class="mts-page-card-title">${page.label}</span><span class="mts-page-card-note">${page.note}</span><span class="mts-page-card-action">Edit page →</span></a>`).join('')}
      </div>
      <div class="mts-create-page-callout"><div><strong>Need a new page?</strong><span>Build one from ready-made sections. No code required.</span></div><a href="#/collections/custom-pages/new">Create a new page</a></div>`;
    const anchor = shell();
    if (anchor) anchor.insertAdjacentElement('afterend', wrap);
    else document.body.prepend(wrap);
  };

  const findFieldContainer = (label, allNames) => {
    const app = root();
    if (!label || !app) return null;
    let current = label.parentElement;
    let best = current;
    while (current && current !== app) {
      const count = [...current.querySelectorAll('label')].filter((candidate) => allNames.some((name) => matches(candidate, name))).length;
      if (count > 1) break;
      best = current;
      current = current.parentElement;
    }
    return best;
  };

  const setupFocusedPageEditor = (pageKey, attempt = 0) => {
    const groups = GROUPS[pageKey];
    const app = root();
    const guide = document.querySelector('.mts-page-edit-guide');
    if (!groups || !app || !guide || guide.querySelector('.mts-section-chooser')) return;

    const allNames = [...new Set(groups.flatMap((group) => group.fields))];
    const labels = [...app.querySelectorAll('label')];
    const fieldMap = new Map();
    allNames.forEach((name) => {
      const label = labels.find((candidate) => matches(candidate, name));
      const container = findFieldContainer(label, allNames);
      if (!container) return;
      if (!container.hasAttribute('data-mts-page-field')) {
        container.dataset.mtsPageField = 'true';
        container.dataset.mtsOriginalDisplay = container.style.display || '';
      }
      fieldMap.set(name, container);
    });

    if (!fieldMap.size) {
      if (attempt < 16) setTimeout(() => setupFocusedPageEditor(pageKey, attempt + 1), 150);
      return;
    }

    document.body.classList.add('mts-focused-page-editor');
    const chooser = document.createElement('section');
    chooser.className = 'mts-section-chooser';
    chooser.innerHTML = `
      <div class="mts-section-chooser-head"><div><span>WHAT ARE YOU EDITING?</span><strong>Choose one part of the page</strong></div><button type="button" class="mts-show-all-fields">Advanced: show all fields</button></div>
      <div class="mts-section-tabs" role="tablist">${groups.map((group,index) => `<button type="button" data-mts-group="${index}" role="tab"><b>${index + 1}</b><span>${group.label}</span></button>`).join('')}</div>
      <div class="mts-section-help" aria-live="polite"></div>`;
    guide.append(chooser);

    const help = chooser.querySelector('.mts-section-help');
    const tabs = [...chooser.querySelectorAll('[data-mts-group]')];
    const showAll = chooser.querySelector('.mts-show-all-fields');
    const containers = new Set(fieldMap.values());

    const showGroup = (index) => {
      const group = groups[index];
      containers.forEach((container) => { container.style.display = 'none'; });
      group.fields.forEach((name) => {
        const container = fieldMap.get(name);
        if (container) container.style.display = container.dataset.mtsOriginalDisplay || '';
      });
      tabs.forEach((tab, i) => tab.classList.toggle('is-active', i === index));
      showAll.classList.remove('is-active');
      help.innerHTML = `<strong>Editing: ${group.label}</strong><span>${group.help}</span>`;
    };

    tabs.forEach((tab,index) => tab.addEventListener('click', () => showGroup(index)));
    showAll.addEventListener('click', () => {
      containers.forEach((container) => { container.style.display = container.dataset.mtsOriginalDisplay || ''; });
      tabs.forEach((tab) => tab.classList.remove('is-active'));
      showAll.classList.add('is-active');
      help.innerHTML = '<strong>All fields are visible</strong><span>Use the section buttons above to return to the simpler view.</span>';
    });
    showGroup(0);
    friendlyLabels();
  };

  const editGuide = ({ title, path, pageKey = null, isNew = false }) => {
    removeGuide();
    setRootVisible(true);
    const guide = document.createElement('div');
    guide.className = 'mts-page-edit-guide';
    guide.innerHTML = `
      <div class="mts-page-edit-guide-main"><a class="mts-simple-back" href="#/collections/pages">← Back to Pages</a><div><span class="mts-page-step">${isNew ? 'NEW PAGE' : 'EDIT PAGE'}</span><strong>${isNew ? 'Create a new page' : `Editing ${title}`}</strong><small>${isNew ? 'Add the page name first, then build the page section by section.' : 'Choose the part of the page you want to change. Everything else stays out of the way.'}</small></div></div>
      <div class="mts-page-edit-guide-actions">${path ? `<a href="${path}" target="_blank" rel="noopener">View current page ↗</a>` : ''}</div>
      <div class="mts-edit-steps"><span><b>1</b> Choose what to edit</span><span><b>2</b> Make the change</span><span><b>3</b> Check the website preview</span><span><b>4</b> Save draft</span></div>`;
    const anchor = shell();
    if (anchor) anchor.insertAdjacentElement('afterend', guide);
    else document.body.prepend(guide);
    if (pageKey) setTimeout(() => setupFocusedPageEditor(pageKey), 120);
  };

  const builderGuide = () => {
    editGuide({ title: 'New page', path: null, isNew: true });
    const guide = document.querySelector('.mts-page-edit-guide');
    if (!guide) return;
    const helper = document.createElement('div');
    helper.className = 'mts-builder-helper';
    helper.innerHTML = '<div><b>1</b><strong>Name the page</strong><span>Choose the page name and address.</span></div><div><b>2</b><strong>Add the top section</strong><span>Start with Hero / Feature.</span></div><div><b>3</b><strong>Add more sections</strong><span>Choose Text, Image + Text, Cards or Call to Action.</span></div><div><b>4</b><strong>Preview and save</strong><span>Advanced HTML is optional.</span></div>';
    guide.append(helper);
  };

  const render = () => {
    const hash = window.location.hash || '#/';
    if (hash === '#/collections/pages' || hash === '#/collections/pages/') return pagePicker();
    const pageMatch = hash.match(/^#\/collections\/pages\/entries\/([^/?]+)/);
    if (pageMatch) {
      const page = PAGE_ROUTES.find((item) => item.key === pageMatch[1]);
      editGuide({ title: page?.label || 'Website page', path: page?.path || null, pageKey: pageMatch[1] });
      return;
    }
    if (hash.startsWith('#/collections/custom-pages/new') || hash.startsWith('#/collections/custom-pages/entries/')) {
      builderGuide();
      return;
    }
    removeGuide();
    setRootVisible(true);
    setTimeout(friendlyLabels, 80);
  };

  let labelTimer;
  new MutationObserver(() => {
    clearTimeout(labelTimer);
    labelTimer = setTimeout(friendlyLabels, 80);
  }).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange', () => setTimeout(render, 30));
  window.addEventListener('load', render);
  render();
})();