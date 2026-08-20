(() => {
  const GROUPS = [
    {
      label: 'Article details',
      help: 'Set the headline, author, date and category.',
      fields: ['Article Title', 'Subtitle', 'Author', 'Publication Date', 'Category'],
    },
    {
      label: 'Summary & image',
      help: 'Add the short card summary and optional article image.',
      fields: ['Card / SEO Summary', 'Featured Image', 'Featured Image Alt Text'],
    },
    {
      label: 'Article text',
      help: 'Write and format the main article here.',
      fields: ['Article Body'],
    },
    {
      label: 'Sources',
      help: 'Add references only when the article uses cited sources.',
      fields: ['References'],
    },
    {
      label: 'Optional settings',
      help: 'Usually leave these alone. Use them only when you need a separate updated date or search-engine wording.',
      fields: ['Updated Date', 'SEO Title', 'SEO Description'],
    },
  ];

  const LABELS = new Map([
    ['Article Title', 'Headline'],
    ['Card / SEO Summary', 'Short summary'],
    ['Featured Image', 'Article image (optional)'],
    ['Featured Image Alt Text', 'Image description'],
    ['Article Body', 'Article text'],
    ['Updated Date', 'Last updated (optional)'],
    ['SEO Title', 'Search title (optional)'],
    ['SEO Description', 'Search description (optional)'],
    ['Reference Text', 'Source name'],
    ['Source URL', 'Source link'],
  ]);

  const root = () => document.querySelector('#nc-root');
  const shell = () => document.querySelector('.mts-editor-shell');
  const clean = (node) => (node?.textContent || '').trim();
  const allFieldNames = [...new Set(GROUPS.flatMap((group) => group.fields))];

  const removeGuide = () => {
    document.querySelector('.mts-blog-edit-guide')?.remove();
    document.body.classList.remove('mts-blog-editor');
    document.querySelectorAll('[data-mts-blog-field]').forEach((node) => {
      node.style.display = node.dataset.mtsOriginalDisplay || '';
      node.removeAttribute('data-mts-blog-field');
      node.removeAttribute('data-mts-original-display');
    });
  };

  const relabel = () => {
    if (!document.body.classList.contains('mts-blog-editor')) return;
    document.querySelectorAll('label, h1, h2, h3, h4, span, p, button').forEach((node) => {
      if (node.children.length > 0) return;
      const value = clean(node);
      if (LABELS.has(value)) node.textContent = LABELS.get(value);
    });

    document.querySelectorAll('button').forEach((button) => {
      const value = clean(button);
      if (/choose (different )?image/i.test(value)) button.textContent = value.toLowerCase().includes('different') ? 'Replace image' : 'Choose image';
      if (value === 'Add References' || value === 'Add Reference') button.textContent = 'Add source';
    });
  };

  const findLabel = (fieldName) => {
    const friendly = LABELS.get(fieldName);
    return [...(root()?.querySelectorAll('label') || [])].find((label) => {
      const value = clean(label);
      return value === fieldName || value === friendly;
    });
  };

  const getFieldContainer = (label) => {
    const app = root();
    if (!label || !app) return null;
    let current = label.parentElement;
    let best = current;
    while (current && current !== app) {
      const matching = [...current.querySelectorAll('label')].filter((item) => {
        const value = clean(item);
        return allFieldNames.includes(value) || [...LABELS.values()].includes(value);
      }).length;
      if (matching > 1) break;
      best = current;
      current = current.parentElement;
    }
    return best;
  };

  const setupFields = () => {
    const app = root();
    if (!app) return null;
    const fieldMap = new Map();
    allFieldNames.forEach((fieldName) => {
      const container = getFieldContainer(findLabel(fieldName));
      if (!container) return;
      if (!container.hasAttribute('data-mts-blog-field')) {
        container.dataset.mtsBlogField = 'true';
        container.dataset.mtsOriginalDisplay = container.style.display || '';
      }
      fieldMap.set(fieldName, container);
    });
    return fieldMap.size ? fieldMap : null;
  };

  const buildGuide = (fieldMap, isNew) => {
    if (document.querySelector('.mts-blog-edit-guide')) return;
    const guide = document.createElement('section');
    guide.className = 'mts-blog-edit-guide';
    guide.innerHTML = `
      <div class="mts-blog-guide-top">
        <a href="#/collections/posts">← Back to Blog Posts</a>
        <div>
          <span>${isNew ? 'NEW BLOG POST' : 'EDIT BLOG POST'}</span>
          <strong>${isNew ? 'Create a blog post' : 'Edit blog post'}</strong>
          <small>Choose one part to work on. The other fields stay out of the way.</small>
        </div>
      </div>
      <div class="mts-blog-workflow"><span>1 Choose a part</span><span>2 Make changes</span><span>3 Check preview</span><span>4 Save draft</span></div>
      <div class="mts-blog-chooser">
        <div class="mts-blog-chooser-title"><strong>What are you editing?</strong><button type="button" class="mts-blog-show-all">Advanced: show all fields</button></div>
        <div class="mts-blog-tabs">
          ${GROUPS.map((group, index) => `<button type="button" data-blog-group="${index}"><b>${index + 1}</b><span>${group.label}</span></button>`).join('')}
        </div>
        <p class="mts-blog-help"></p>
      </div>
    `;
    (shell() || document.body).insertAdjacentElement(shell() ? 'afterend' : 'afterbegin', guide);

    const tabs = [...guide.querySelectorAll('[data-blog-group]')];
    const help = guide.querySelector('.mts-blog-help');
    const showAll = guide.querySelector('.mts-blog-show-all');

    const showGroup = (index) => {
      const group = GROUPS[index];
      if (!group) return;
      new Set(fieldMap.values()).forEach((container) => { container.style.display = 'none'; });
      group.fields.forEach((name) => {
        const container = fieldMap.get(name);
        if (container) container.style.display = container.dataset.mtsOriginalDisplay || '';
      });
      tabs.forEach((tab, tabIndex) => tab.classList.toggle('is-active', tabIndex === index));
      showAll.classList.remove('is-active');
      help.innerHTML = `<strong>${group.label}.</strong> ${group.help}`;
    };

    tabs.forEach((tab, index) => tab.addEventListener('click', () => showGroup(index)));
    showAll.addEventListener('click', () => {
      new Set(fieldMap.values()).forEach((container) => { container.style.display = container.dataset.mtsOriginalDisplay || ''; });
      tabs.forEach((tab) => tab.classList.remove('is-active'));
      showAll.classList.add('is-active');
      help.textContent = 'All fields are visible. Switch back to a section at any time.';
    });

    showGroup(0);
  };

  const render = () => {
    const hash = window.location.hash || '';
    const isEntry = /^#\/collections\/posts\/(entries\/|new)/.test(hash);
    if (!isEntry) {
      removeGuide();
      return;
    }

    document.body.classList.add('mts-blog-editor');
    relabel();
    if (document.querySelector('.mts-blog-edit-guide')) return;

    let attempts = 0;
    const waitForFields = () => {
      relabel();
      const fieldMap = setupFields();
      if (fieldMap) {
        buildGuide(fieldMap, hash.includes('/new'));
        relabel();
        return;
      }
      attempts += 1;
      if (attempts < 30) setTimeout(waitForFields, 120);
    };
    waitForFields();
  };

  let relabelTimer;
  new MutationObserver(() => {
    if (!document.body.classList.contains('mts-blog-editor')) return;
    clearTimeout(relabelTimer);
    relabelTimer = setTimeout(relabel, 70);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => setTimeout(render, 30));
  window.addEventListener('load', render);
  render();
})();
