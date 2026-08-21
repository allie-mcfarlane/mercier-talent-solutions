(() => {
  'use strict';

  const REPO = 'repos/allie-mcfarlane/mercier-talent-solutions';
  const PAGE_PATHS = {
    home: 'src/content/pages/home.md',
    about: 'src/content/pages/about.md',
    services: 'src/content/pages/services.md',
    news: 'src/content/pages/news.md',
    whitepapers: 'src/content/pages/whitepapers.md',
    contact: 'src/content/pages/contact.md',
    privacy: 'src/content/pages/privacy.md',
    'privacy-choices': 'src/content/pages/privacy-choices.md',
    'data-requests': 'src/content/pages/data-requests.md',
  };
  const SECTION_TYPES = [
    ['hero', 'Hero'],
    ['text', 'Text'],
    ['imageText', 'Image + Text'],
    ['cards', 'Cards'],
    ['image', 'Image'],
    ['callout', 'Call to Action'],
  ];
  const GENERIC_CLASSES = new Set(['section', 'shaded', 'container', 'is-visible', 'motion-image']);
  const TEXT_SELECTOR = 'h1,h2,h3,h4,p,li,a.button,a.eyebrow-link';
  const wrappedFetch = window.fetch.bind(window);
  const stores = new Map();
  let newPageSavedPath = '';
  let refreshQueued = false;
  let lastHash = location.hash || '#/';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const newId = () => {
    if (globalThis.crypto?.randomUUID) return `s-${crypto.randomUUID().slice(0, 12)}`;
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input || ''));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  const parseDocument = (text) => {
    const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: String(text || '') };
    try {
      return { data: window.jsyaml.load(match[1], { schema: window.jsyaml.JSON_SCHEMA }) || {}, body: match[2] || '' };
    } catch {
      return { data: {}, body: match[2] || '' };
    }
  };

  const serializeDocument = (data, body = '') => {
    const yaml = window.jsyaml.dump(data || {}, {
      schema: window.jsyaml.JSON_SCHEMA,
      noRefs: true,
      lineWidth: -1,
      sortKeys: false,
      quotingType: '"',
      forceQuotes: false,
    });
    return `---\n${yaml}---\n${body || ''}`;
  };

  const contentPathFromUrl = (url) => {
    const decoded = decodeURIComponent(url.pathname || '');
    const marker = '/contents/';
    const index = decoded.indexOf(marker);
    if (index < 0) return '';
    const path = decoded.slice(index + marker.length).replace(/^\/+/, '');
    return /^src\/content\/pages\/[^/]+\.md$/i.test(path) ? path : '';
  };

  const currentKey = () => {
    const match = (location.hash || '').match(/^#\/page\/([^/?]+)/);
    if (match) return PAGE_PATHS[decodeURIComponent(match[1])] || '';
    if ((location.hash || '') === '#/new-page') return newPageSavedPath || '__new__';
    return '';
  };

  const emptyStore = () => ({ fixedInline: {}, builderInline: {}, builderIds: [], order: [] });
  const getStore = (key = currentKey()) => {
    if (!key) return null;
    if (!stores.has(key)) stores.set(key, emptyStore());
    return stores.get(key);
  };

  const captureDocument = (path, text) => {
    if (!path) return;
    const parsed = parseDocument(text);
    const sections = Array.isArray(parsed.data?.sections) ? parsed.data.sections : [];
    const visualStyles = parsed.data?.visualStyles && typeof parsed.data.visualStyles === 'object' ? parsed.data.visualStyles : {};
    const existing = stores.get(path);
    const builderIds = sections.map((section, index) => String(section?.editorId || existing?.builderIds?.[index] || newId()));
    const builderInline = {};
    sections.forEach((section, index) => {
      const id = builderIds[index];
      builderInline[id] = section?.inlineStyles && typeof section.inlineStyles === 'object' ? clone(section.inlineStyles) : {};
    });
    stores.set(path, {
      fixedInline: visualStyles?.__inline?.scopes && typeof visualStyles.__inline.scopes === 'object' ? clone(visualStyles.__inline.scopes) : {},
      order: Array.isArray(visualStyles?.__order?.items) ? [...visualStyles.__order.items].map(String) : [],
      builderIds,
      builderInline,
    });
  };

  const mergeDocument = (data, store) => {
    if (!store) return;
    const visualStyles = data.visualStyles && typeof data.visualStyles === 'object' ? clone(data.visualStyles) : {};
    if (Object.keys(store.fixedInline || {}).length) visualStyles.__inline = { scopes: clone(store.fixedInline) };
    else delete visualStyles.__inline;
    if (Array.isArray(store.order) && store.order.length) visualStyles.__order = { items: [...store.order] };
    else delete visualStyles.__order;
    if (Object.keys(visualStyles).length) data.visualStyles = visualStyles;
    else delete data.visualStyles;

    if (Array.isArray(data.sections)) {
      while (store.builderIds.length < data.sections.length) store.builderIds.push(newId());
      if (store.builderIds.length > data.sections.length) store.builderIds.length = data.sections.length;
      data.sections.forEach((section, index) => {
        const id = store.builderIds[index] || (store.builderIds[index] = newId());
        section.editorId = id;
        const inlineStyles = store.builderInline[id];
        if (inlineStyles && Object.keys(inlineStyles).length) section.inlineStyles = clone(inlineStyles);
        else delete section.inlineStyles;
      });
    }
  };

  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, location.origin);
    const method = String(init.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
    const path = contentPathFromUrl(url);
    let nextInit = init;

    if (path && method === 'PUT' && typeof init.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        if (payload?.content) {
          const parsed = parseDocument(decodeBase64(payload.content));
          const key = currentKey() || path;
          const store = getStore(key);
          mergeDocument(parsed.data, store);
          payload.content = encodeBase64(serializeDocument(parsed.data, parsed.body));
          nextInit = { ...init, body: JSON.stringify(payload) };
          if (key === '__new__') {
            newPageSavedPath = path;
            stores.set(path, clone(store));
          }
        }
      } catch (_) {}
    }

    const response = await wrappedFetch(input, nextInit);
    if (path && method === 'GET' && response.ok) {
      try {
        const payload = await response.clone().json();
        if (payload?.content) captureDocument(path, decodeBase64(payload.content));
      } catch (_) {}
    }
    return response;
  };

  const signalDirty = () => {
    const input = document.querySelector('#ve-form [data-bind]');
    if (input) {
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      return;
    }
    const lines = document.querySelector('#ve-form [data-lines]');
    if (lines) lines.dispatchEvent(new Event('input', { bubbles: true }));
    const status = document.getElementById('ve-status');
    if (status) { status.className = 've-status changed'; status.textContent = 'Unsaved changes'; }
  };

  const builderCount = () => document.querySelectorAll('.ve-section-card').length;
  const ensureBuilderArrays = (store, count = builderCount()) => {
    if (!store) return;
    while (store.builderIds.length < count) {
      const id = newId();
      store.builderIds.push(id);
      store.builderInline[id] = {};
    }
    if (store.builderIds.length > count) store.builderIds.length = count;
  };

  const swapOrderTokens = (order, a, b) => {
    const ai = order.indexOf(`builder:${a}`);
    const bi = order.indexOf(`builder:${b}`);
    if (ai >= 0 && bi >= 0) [order[ai], order[bi]] = [order[bi], order[ai]];
  };

  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!button) return;
    const store = getStore();
    if (!store) return;
    ensureBuilderArrays(store);
    const action = button.dataset.action;
    const index = Number(button.dataset.index);

    if (action === 'add-section') {
      const id = newId();
      store.builderIds.push(id);
      store.builderInline[id] = {};
      if (store.order.length) store.order.push(`builder:${id}`);
    } else if (action === 'duplicate-section' && Number.isInteger(index) && store.builderIds[index]) {
      const sourceId = store.builderIds[index];
      const id = newId();
      store.builderIds.splice(index + 1, 0, id);
      store.builderInline[id] = clone(store.builderInline[sourceId] || {});
      const orderIndex = store.order.indexOf(`builder:${sourceId}`);
      if (orderIndex >= 0) store.order.splice(orderIndex + 1, 0, `builder:${id}`);
    } else if (action === 'move-section-up' && index > 0 && store.builderIds[index]) {
      const a = store.builderIds[index];
      const b = store.builderIds[index - 1];
      [store.builderIds[index], store.builderIds[index - 1]] = [b, a];
      swapOrderTokens(store.order, a, b);
    } else if (action === 'move-section-down' && index >= 0 && index < store.builderIds.length - 1) {
      const a = store.builderIds[index];
      const b = store.builderIds[index + 1];
      [store.builderIds[index], store.builderIds[index + 1]] = [b, a];
      swapOrderTokens(store.order, a, b);
    } else if (action === 'delete-section' && Number.isInteger(index) && store.builderIds[index]) {
      const id = store.builderIds[index];
      const before = builderCount();
      setTimeout(() => {
        if (builderCount() !== before - 1) return;
        const current = getStore();
        const actual = current?.builderIds.indexOf(id) ?? -1;
        if (actual >= 0) current.builderIds.splice(actual, 1);
        if (current) {
          delete current.builderInline[id];
          current.order = current.order.filter((token) => token !== `builder:${id}`);
        }
      }, 0);
    }
  }, true);

  const topBlocks = (doc) => {
    const main = doc.querySelector('main');
    if (!main) return [];
    return [...main.children].filter((node) => {
      if (!(node instanceof doc.defaultView.Element)) return false;
      if (node.dataset.mtsDirectControl === 'true' || node.dataset.mtsControl === 'true' || node.dataset.mtsFixedControl === 'true') return false;
      if (node.classList.contains('mts-builder-palette') || node.classList.contains('mts-gap-control') || node.classList.contains('mts-section-tools') || node.classList.contains('mts-fixed-tools') || node.classList.contains('mts-fixed-space')) return false;
      return node.matches('section,nav,article');
    });
  };

  const preferredClass = (node, siblings) => {
    const candidates = [...node.classList].filter((name) => !GENERIC_CLASSES.has(name) && !name.startsWith('mts-') && !name.startsWith('ve-'));
    const unique = candidates.find((name) => siblings.filter((item) => item.classList.contains(name)).length === 1);
    return unique || candidates[0] || '';
  };

  const staticToken = (node, siblings) => {
    if (node.id) return `fixed:id:${node.id}`;
    const className = preferredClass(node, siblings);
    if (className) {
      const matches = siblings.filter((item) => item.classList.contains(className));
      return `fixed:class:${className}:${matches.indexOf(node)}`;
    }
    const matches = siblings.filter((item) => item.tagName === node.tagName);
    return `fixed:tag:${node.tagName.toLowerCase()}:${matches.indexOf(node)}`;
  };

  const assignTokens = (doc) => {
    const store = getStore();
    const blocks = topBlocks(doc);
    if (!store) return [];
    ensureBuilderArrays(store, doc.querySelectorAll('.ve-preview-builder[data-ve-section]').length || store.builderIds.length);
    blocks.forEach((block) => {
      const generated = block.matches('.ve-preview-builder[data-ve-section]') ? block : null;
      if (generated) {
        const index = Number(generated.dataset.veSection?.replace('extra-', ''));
        const id = store.builderIds[index] || (store.builderIds[index] = newId());
        if (!store.builderInline[id]) store.builderInline[id] = {};
        block.dataset.mtsPageToken = `builder:${id}`;
      } else {
        block.dataset.mtsPageToken = staticToken(block, blocks);
      }
    });
    return blocks;
  };

  const normalizeOrder = (store, blocks) => {
    const tokens = blocks.map((block) => block.dataset.mtsPageToken).filter(Boolean);
    if (!store.order.length) store.order = [...tokens];
    else {
      store.order = store.order.filter((token) => tokens.includes(token));
      tokens.forEach((token) => { if (!store.order.includes(token)) store.order.push(token); });
    }
    return store.order;
  };

  const applyOrder = (doc) => {
    const store = getStore();
    if (!store) return [];
    const main = doc.querySelector('main');
    const blocks = assignTokens(doc);
    const order = normalizeOrder(store, blocks);
    const byToken = new Map(blocks.map((block) => [block.dataset.mtsPageToken, block]));
    order.forEach((token) => {
      const block = byToken.get(token);
      if (block) main.append(block);
    });
    return topBlocks(doc);
  };

  const unwrapFormats = (element) => {
    element.querySelectorAll('span[data-mts-inline-format="true"]').forEach((span) => span.replaceWith(...span.childNodes));
    element.normalize();
  };

  const textNodes = (element) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('[data-mts-direct-control="true"]')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  };

  const styleAt = (formats, start, end) => {
    const style = { colorSet: false, color: null, sizeSet: false, fontSize: null };
    formats.forEach((format) => {
      if (Number(format.start) > start || Number(format.end) < end) return;
      if (Object.prototype.hasOwnProperty.call(format, 'color')) { style.colorSet = true; style.color = format.color; }
      if (Object.prototype.hasOwnProperty.call(format, 'fontSize')) { style.sizeSet = true; style.fontSize = format.fontSize; }
    });
    return style;
  };

  const applyRecord = (element, record) => {
    if (!element || !record || !Array.isArray(record.formats)) return;
    unwrapFormats(element);
    const source = element.textContent || '';
    if (record.source !== source) return;
    let cursor = 0;
    textNodes(element).forEach((node) => {
      const text = node.nodeValue || '';
      const nodeStart = cursor;
      const nodeEnd = cursor + text.length;
      cursor = nodeEnd;
      const boundaries = new Set([nodeStart, nodeEnd]);
      record.formats.forEach((format) => {
        const start = Math.max(nodeStart, Number(format.start));
        const end = Math.min(nodeEnd, Number(format.end));
        if (start < end) { boundaries.add(start); boundaries.add(end); }
      });
      const sorted = [...boundaries].sort((a, b) => a - b);
      if (sorted.length <= 2 && !record.formats.some((format) => Number(format.start) < nodeEnd && Number(format.end) > nodeStart)) return;
      const fragment = element.ownerDocument.createDocumentFragment();
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const start = sorted[i];
        const end = sorted[i + 1];
        const piece = text.slice(start - nodeStart, end - nodeStart);
        const style = styleAt(record.formats, start, end);
        const hasColor = style.colorSet && style.color;
        const hasSize = style.sizeSet && Number(style.fontSize) > 0;
        if (!hasColor && !hasSize) {
          fragment.append(element.ownerDocument.createTextNode(piece));
          continue;
        }
        const span = element.ownerDocument.createElement('span');
        span.dataset.mtsInlineFormat = 'true';
        if (hasColor) span.style.setProperty('--mts-inline-color', style.color);
        if (hasSize) span.style.setProperty('--mts-inline-size', `${Math.max(10, Math.min(96, Number(style.fontSize)))}px`);
        span.textContent = piece;
        fragment.append(span);
      }
      node.replaceWith(fragment);
    });
  };

  const targetElements = (block) => [...block.querySelectorAll(TEXT_SELECTOR)].filter((element) => !element.closest('[data-mts-direct-control="true"]'));

  const assignInlineTargets = (doc) => {
    const store = getStore();
    if (!store) return;
    assignTokens(doc).forEach((block) => {
      const token = block.dataset.mtsPageToken;
      const builderId = token?.startsWith('builder:') ? token.slice('builder:'.length) : '';
      const scope = builderId ? (store.builderInline[builderId] || (store.builderInline[builderId] = {})) : (store.fixedInline[token] || (store.fixedInline[token] = {}));
      targetElements(block).forEach((element, index) => {
        element.dataset.mtsInlineTarget = 'true';
        element.dataset.mtsInlineToken = token;
        element.dataset.mtsInlineIndex = String(index);
        const record = scope[String(index)];
        if (record) applyRecord(element, record);
      });
    });
  };

  const recordFor = (element, create = false) => {
    const store = getStore();
    if (!store || !element) return null;
    const token = element.dataset.mtsInlineToken || '';
    const index = element.dataset.mtsInlineIndex || '';
    let scope = null;
    if (token.startsWith('builder:')) {
      const id = token.slice('builder:'.length);
      scope = store.builderInline[id] || (create ? (store.builderInline[id] = {}) : null);
    } else {
      scope = store.fixedInline[token] || (create ? (store.fixedInline[token] = {}) : null);
    }
    if (!scope) return null;
    if (!scope[index] && create) scope[index] = { source: element.textContent || '', formats: [] };
    return scope[index] || null;
  };

  const selectionOffsets = (element, range) => {
    const beforeStart = element.ownerDocument.createRange();
    beforeStart.selectNodeContents(element);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = element.ownerDocument.createRange();
    beforeEnd.selectNodeContents(element);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
  };

  const rgbToHex = (color) => {
    if (/^#[0-9a-f]{6}$/i.test(String(color))) return String(color);
    const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#1a2b46';
    return `#${[match[1], match[2], match[3]].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
  };

  const upsertFormat = (record, start, end, patch) => {
    let format = [...record.formats].reverse().find((item) => Number(item.start) === start && Number(item.end) === end);
    if (!format) {
      format = { start, end };
      record.formats.push(format);
    }
    Object.entries(patch).forEach(([key, value]) => { format[key] = value; });
  };

  const showSelectionToolbar = (doc) => {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const startElement = (range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement)?.closest?.('[data-mts-inline-target="true"]');
    const endElement = (range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement)?.closest?.('[data-mts-inline-target="true"]');
    if (!startElement || startElement !== endElement) return;
    const offsets = selectionOffsets(startElement, range);
    if (offsets.end <= offsets.start) return;
    const record = recordFor(startElement, true);
    if (!record) return;
    unwrapFormats(startElement);
    record.source = startElement.textContent || '';
    record.formats ||= [];

    doc.querySelector('.mts-selection-toolbar')?.remove();
    const computed = doc.defaultView.getComputedStyle(startElement);
    const rect = range.getBoundingClientRect();
    const toolbar = doc.createElement('div');
    toolbar.className = 'mts-selection-toolbar';
    toolbar.dataset.mtsDirectControl = 'true';
    toolbar.innerHTML = `
      <span>Selected text</span>
      <label title="Text color"><input type="color" value="${esc(rgbToHex(computed.color))}" data-inline-color></label>
      <label><select data-inline-size title="Font size"><option value="">Size</option>${[12,14,16,18,20,22,24,28,32,36,42,48,56,64,72].map((size) => `<option value="${size}">${size}px</option>`).join('')}</select></label>
      <button type="button" data-inline-clear title="Remove formatting from this selection">Reset</button>
      <button type="button" data-inline-close aria-label="Close">×</button>
    `;
    toolbar.style.left = `${Math.max(8, Math.min(doc.defaultView.innerWidth - 310, rect.left))}px`;
    toolbar.style.top = `${Math.max(8, Math.min(doc.defaultView.innerHeight - 54, rect.bottom + 8))}px`;
    doc.body.append(toolbar);

    const apply = (patch) => {
      upsertFormat(record, offsets.start, offsets.end, patch);
      applyRecord(startElement, record);
      signalDirty();
    };
    toolbar.addEventListener('pointerdown', (event) => event.stopPropagation());
    toolbar.addEventListener('click', (event) => event.stopPropagation());
    toolbar.querySelector('[data-inline-color]').addEventListener('input', (event) => apply({ color: event.target.value }));
    toolbar.querySelector('[data-inline-size]').addEventListener('change', (event) => {
      if (!event.target.value) return;
      apply({ fontSize: Number(event.target.value) });
    });
    toolbar.querySelector('[data-inline-clear]').addEventListener('click', () => apply({ color: null, fontSize: null }));
    toolbar.querySelector('[data-inline-close]').addEventListener('click', () => toolbar.remove());
    doc.documentElement.dataset.mtsTextSelection = 'true';
    setTimeout(() => { delete doc.documentElement.dataset.mtsTextSelection; }, 350);
  };

  const wireSelection = (doc) => {
    if (doc.documentElement.dataset.mtsDirectSelectionWired) return;
    doc.documentElement.dataset.mtsDirectSelectionWired = 'true';
    doc.addEventListener('mouseup', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-mts-direct-control="true"]')) return;
      setTimeout(() => showSelectionToolbar(doc), 0);
    });
    doc.defaultView.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-mts-direct-control="true"]')) return;
      const selection = doc.getSelection();
      if (doc.documentElement.dataset.mtsTextSelection === 'true' || (selection && !selection.isCollapsed && selection.toString().trim())) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  };

  const moveToken = (token, dropIndex) => {
    const store = getStore();
    if (!store) return;
    const current = store.order.indexOf(token);
    if (current < 0) return;
    store.order.splice(current, 1);
    let target = Math.max(0, Math.min(Number(dropIndex), store.order.length));
    if (target > current) target -= 1;
    store.order.splice(Math.max(0, target), 0, token);
    signalDirty();
    const frame = document.getElementById('ve-preview');
    if (frame?.contentDocument) enhanceFrame(frame.contentDocument);
  };

  const addSectionAt = (type, dropIndex) => {
    const previous = document.querySelector('.ve-section-button.active[data-section-select]')?.dataset.sectionSelect || '';
    const openAndAdd = () => {
      const add = document.querySelector(`[data-action="add-section"][data-type="${String(type).replace(/[^a-zA-Z]/g, '')}"]`);
      if (!add) return;
      add.click();
      setTimeout(() => {
        const store = getStore();
        const id = store?.builderIds.at(-1);
        if (store && id) {
          const token = `builder:${id}`;
          store.order = store.order.filter((item) => item !== token);
          store.order.splice(Math.max(0, Math.min(Number(dropIndex), store.order.length)), 0, token);
          signalDirty();
        }
        if (previous && previous !== 'extra') {
          document.querySelector(`[data-section-select="${previous}"]`)?.click();
        }
      }, 80);
    };
    if (document.querySelector('[data-action="add-section"]')) openAndAdd();
    else {
      document.querySelector('[data-section-select="extra"]')?.click();
      setTimeout(openAndAdd, 60);
    }
  };

  const injectStyle = (doc) => {
    if (doc.getElementById('mts-direct-canvas-style')) return;
    const style = doc.createElement('style');
    style.id = 'mts-direct-canvas-style';
    style.textContent = `
      .mts-section-tools,.mts-fixed-tools{display:none!important}
      [data-mts-inline-target="true"]{cursor:text!important}
      [data-mts-inline-target="true"]::selection{background:rgba(69,98,142,.22)}
      span[data-mts-inline-format="true"]{color:var(--mts-inline-color,inherit);font-size:var(--mts-inline-size,inherit)}
      .mts-direct-handle{position:relative;z-index:100020;height:0;max-width:min(calc(100% - 22px),1440px);margin:0 auto;pointer-events:none}.mts-direct-handle button{position:relative;top:8px;display:inline-flex;align-items:center;gap:5px;border:1px solid #bfcddd;border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.97);box-shadow:0 5px 18px rgba(26,43,70,.14);color:#355273;font:800 9px Arial,sans-serif;cursor:grab;pointer-events:auto}.mts-direct-handle button:active{cursor:grabbing}
      .mts-direct-drop{position:relative;z-index:100010;display:flex;height:10px;align-items:center;justify-content:center;margin:-5px 0;transition:.12s ease}.mts-direct-drop:before{position:absolute;left:6%;right:6%;height:1px;background:transparent;content:""}.mts-direct-drop span{display:none;border:1px solid #45628e;border-radius:999px;padding:4px 8px;background:#fff;color:#355273;font:800 9px Arial,sans-serif}.mts-direct-dragging .mts-direct-drop{height:34px;margin:-17px 0}.mts-direct-dragging .mts-direct-drop:before{background:rgba(69,98,142,.35)}.mts-direct-drop.active:before{height:3px;background:#45628e}.mts-direct-drop.active span{display:inline-flex}
      .mts-direct-addbar{position:fixed;z-index:100030;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;max-width:calc(100vw - 24px);overflow:auto;border:1px solid #c8d4e0;border-radius:12px;padding:7px 8px;background:rgba(255,255,255,.97);box-shadow:0 14px 38px rgba(26,43,70,.19);font-family:Arial,sans-serif}.mts-direct-addbar>strong{padding:0 4px;color:#1a2b46;font-size:10px;white-space:nowrap}.mts-direct-addbar button{border:1px solid #d1dae4;border-radius:7px;padding:6px 8px;background:#fff;color:#45628e;font:800 9px Arial,sans-serif;white-space:nowrap;cursor:grab}.mts-direct-addbar button:hover{border-color:#7890ae;background:#f6f9fc}
      .mts-selection-toolbar{position:fixed;z-index:100080;display:flex;align-items:center;gap:6px;border:1px solid #bfcddd;border-radius:10px;padding:6px 7px;background:#fff;box-shadow:0 16px 38px rgba(26,43,70,.22);font-family:Arial,sans-serif;color:#1a2b46}.mts-selection-toolbar>span{font-size:9px;font-weight:800}.mts-selection-toolbar input[type="color"]{width:30px;height:28px;border:1px solid #cad5df;border-radius:6px;padding:2px;background:#fff;cursor:pointer}.mts-selection-toolbar select,.mts-selection-toolbar button{height:28px;border:1px solid #cad5df;border-radius:6px;padding:0 7px;background:#fff;color:#45628e;font:800 9px Arial,sans-serif;cursor:pointer}.mts-selection-toolbar button[data-inline-close]{border:0;padding:0 4px;font-size:16px}
      @media(max-width:820px){span[data-mts-inline-format="true"]{font-size:min(var(--mts-inline-size,1em),1.15em)}.mts-direct-addbar{left:8px;right:8px;transform:none}.mts-direct-handle{padding-left:6px}.mts-selection-toolbar{left:8px!important;right:8px;width:auto;overflow:auto}}
    `;
    doc.head.append(style);
  };

  const decorateDragging = (doc, active) => doc.documentElement.classList.toggle('mts-direct-dragging', active);

  const buildCanvasControls = (doc) => {
    if (!/^#\/(page\/|new-page)/.test(location.hash || '')) return;
    doc.querySelectorAll('[data-mts-direct-control="true"]:not(.mts-selection-toolbar)').forEach((node) => node.remove());
    const blocks = applyOrder(doc);
    const store = getStore();
    if (!store) return;
    normalizeOrder(store, blocks);

    const addbar = doc.createElement('div');
    addbar.className = 'mts-direct-addbar';
    addbar.dataset.mtsDirectControl = 'true';
    addbar.innerHTML = `<strong>Add section</strong>${SECTION_TYPES.map(([type, label]) => `<button type="button" draggable="true" data-direct-new="${type}">${label}</button>`).join('')}`;
    doc.body.append(addbar);
    addbar.querySelectorAll('[data-direct-new]').forEach((button) => {
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', `new:${button.dataset.directNew}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
        decorateDragging(doc, true);
      });
      button.addEventListener('dragend', () => decorateDragging(doc, false));
      button.addEventListener('click', () => addSectionAt(button.dataset.directNew, store.order.length));
    });

    const insertDrop = (reference, index, after = false) => {
      const drop = doc.createElement('div');
      drop.className = 'mts-direct-drop';
      drop.dataset.mtsDirectControl = 'true';
      drop.innerHTML = '<span>Drop here</span>';
      drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('active'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('active'));
      drop.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.remove('active');
        decorateDragging(doc, false);
        const raw = event.dataTransfer?.getData('text/plain') || '';
        const split = raw.indexOf(':');
        const kind = split >= 0 ? raw.slice(0, split) : raw;
        const value = split >= 0 ? raw.slice(split + 1) : '';
        if (kind === 'canvas') moveToken(value, index);
        if (kind === 'new') addSectionAt(value, index);
      });
      if (after) reference.after(drop); else reference.before(drop);
    };

    blocks.forEach((block, index) => {
      insertDrop(block, index, false);
      const token = block.dataset.mtsPageToken;
      const handle = doc.createElement('div');
      handle.className = 'mts-direct-handle';
      handle.dataset.mtsDirectControl = 'true';
      handle.innerHTML = `<button type="button" draggable="true" title="Drag this section to move it">⋮⋮ Move section</button>`;
      block.before(handle);
      const button = handle.querySelector('button');
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', `canvas:${token}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        decorateDragging(doc, true);
      });
      button.addEventListener('dragend', () => decorateDragging(doc, false));
    });
    if (blocks.length) insertDrop(blocks.at(-1), blocks.length, true);
  };

  const enhanceFrame = (doc) => {
    if (!doc?.body || doc.readyState === 'loading') return;
    if (doc.documentElement.dataset.mtsDirectDecorating === 'true') return;
    doc.documentElement.dataset.mtsDirectDecorating = 'true';
    injectStyle(doc);
    applyOrder(doc);
    assignInlineTargets(doc);
    wireSelection(doc);
    buildCanvasControls(doc);
    setTimeout(() => { delete doc.documentElement.dataset.mtsDirectDecorating; }, 0);
  };

  const enhance = () => {
    const frame = document.getElementById('ve-preview');
    if (!frame) return;
    const previewCopy = document.querySelector('.ve-preview-bar > div:first-child');
    if (previewCopy && /^#\/(page\/|new-page)/.test(location.hash || '') && !previewCopy.querySelector('.mts-direct-hint')) {
      const hint = document.createElement('div');
      hint.className = 'mts-visual-hint mts-direct-hint';
      hint.innerHTML = '<strong>Edit on the page:</strong> highlight words to format them · drag Move section handles to reorder · drag Add section blocks onto the page';
      previewCopy.append(hint);
    }
    if (frame.contentDocument?.readyState !== 'loading') enhanceFrame(frame.contentDocument);
    if (!frame.dataset.mtsDirectLoadWired) {
      frame.dataset.mtsDirectLoadWired = 'true';
      frame.addEventListener('load', () => setTimeout(() => enhanceFrame(frame.contentDocument), 150));
    }
  };

  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      enhance();
    });
  };

  new MutationObserver(queueRefresh).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => {
    const nextHash = location.hash || '#/';
    if (nextHash === '#/new-page' && lastHash !== '#/new-page') {
      newPageSavedPath = '';
      stores.set('__new__', emptyStore());
    }
    lastHash = nextHash;
    setTimeout(queueRefresh, 60);
  });
  window.addEventListener('load', queueRefresh);
  queueRefresh();
})();
