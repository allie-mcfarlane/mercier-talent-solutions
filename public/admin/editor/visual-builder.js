(() => {
  'use strict';

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
  const STYLE_KEYS = ['paddingTop', 'paddingBottom', 'headingFontSize', 'headingColor', 'bodyFontSize', 'bodyColor'];
  const SECTION_TYPES = [
    ['hero', 'Hero'],
    ['text', 'Text'],
    ['imageText', 'Image + Text'],
    ['cards', 'Cards'],
    ['image', 'Image'],
    ['callout', 'Call to Action'],
  ];
  const stores = new Map();
  const wrappedFetch = window.fetch.bind(window);
  let newPageSavedPath = '';
  let lastHash = location.hash || '#/';
  let parentRefreshQueued = false;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input || ''));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  };

  const parseDocument = (text) => {
    const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: String(text || '') };
    try {
      return {
        data: window.jsyaml.load(match[1], { schema: window.jsyaml.JSON_SCHEMA }) || {},
        body: match[2] || '',
      };
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

  const currentStoreKey = () => {
    const match = (location.hash || '').match(/^#\/page\/([^/?]+)/);
    if (match) return PAGE_PATHS[decodeURIComponent(match[1])] || '';
    if ((location.hash || '') === '#/new-page') return newPageSavedPath || '__new__';
    return '';
  };

  const activeBuilder = () =>
    Boolean(document.querySelector('[data-section-select="extra"].active')) || (location.hash || '') === '#/new-page';

  const extractStyles = (section = {}) => {
    const result = {};
    STYLE_KEYS.forEach((key) => {
      if (section[key] !== undefined && section[key] !== null && section[key] !== '') result[key] = section[key];
    });
    return result;
  };

  const captureDocument = (path, text) => {
    if (!path) return;
    const parsed = parseDocument(text);
    const sections = Array.isArray(parsed.data?.sections) ? parsed.data.sections : [];
    stores.set(path, sections.map(extractStyles));
  };

  const getStore = (key = currentStoreKey(), count = null) => {
    if (!key) return [];
    if (!stores.has(key)) stores.set(key, []);
    const store = stores.get(key);
    if (Number.isInteger(count)) {
      while (store.length < count) store.push({});
      if (store.length > count) store.length = count;
    }
    return store;
  };

  const mergeStylesIntoDocument = (data, store) => {
    if (!Array.isArray(data?.sections)) return;
    data.sections.forEach((section, index) => {
      const style = store[index];
      if (!style) return;
      STYLE_KEYS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(style, key)) return;
        const value = style[key];
        if (value === null || value === '') delete section[key];
        else if (key.includes('Size') || key.startsWith('padding')) section[key] = Number(value);
        else section[key] = String(value);
      });
    });
  };

  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, location.origin);
    const method = String(init.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
    const contentPath = contentPathFromUrl(url);
    let nextInit = init;

    if (contentPath && method === 'PUT' && typeof init.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        if (payload?.content) {
          const parsed = parseDocument(decodeBase64(payload.content));
          const key = currentStoreKey() || contentPath;
          const count = Array.isArray(parsed.data?.sections) ? parsed.data.sections.length : 0;
          const store = getStore(key, count);
          mergeStylesIntoDocument(parsed.data, store);
          payload.content = encodeBase64(serializeDocument(parsed.data, parsed.body));
          nextInit = { ...init, body: JSON.stringify(payload) };
          if (key === '__new__') {
            newPageSavedPath = contentPath;
            stores.set(contentPath, store.map((item) => clone(item)));
          }
        }
      } catch (_) {}
    }

    const response = await wrappedFetch(input, nextInit);
    if (contentPath && method === 'GET' && response.ok) {
      try {
        const payload = await response.clone().json();
        if (payload?.content) captureDocument(contentPath, decodeBase64(payload.content));
      } catch (_) {}
    }
    return response;
  };

  const builderCardCount = () => document.querySelectorAll('.ve-section-card').length;

  const signalDirty = () => {
    const input = document.querySelector('#ve-form [data-bind]');
    if (input) {
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      return;
    }
    document.querySelector('#ve-form [data-lines]')?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const swapStore = (from, to) => {
    const store = getStore(currentStoreKey(), builderCardCount());
    if (from < 0 || to < 0 || from >= store.length || to >= store.length) return;
    [store[from], store[to]] = [store[to], store[from]];
  };

  const moveByButtons = (from, to) => {
    let index = Number(from);
    const target = Number(to);
    if (!Number.isInteger(index) || !Number.isInteger(target) || index === target) return;
    while (index > target) {
      const button = document.querySelector(`[data-action="move-section-up"][data-index="${index}"]`);
      if (!button) break;
      button.click();
      index -= 1;
    }
    while (index < target) {
      const button = document.querySelector(`[data-action="move-section-down"][data-index="${index}"]`);
      if (!button) break;
      button.click();
      index += 1;
    }
  };

  const openExtraPanel = (callback) => {
    if (document.querySelector('[data-action="add-section"]')) return callback();
    const extra = document.querySelector('[data-section-select="extra"]');
    if (!extra) return;
    extra.click();
    setTimeout(callback, 40);
  };

  const addAt = (type, targetIndex = null) => {
    openExtraPanel(() => {
      const safeType = String(type || '').replace(/[^a-zA-Z]/g, '');
      const button = document.querySelector(`[data-action="add-section"][data-type="${safeType}"]`);
      if (!button) return;
      button.click();
      const count = builderCardCount();
      if (!count) return;
      const from = count - 1;
      const target = targetIndex == null ? from : Math.max(0, Math.min(Number(targetIndex), from));
      if (target !== from) moveByButtons(from, target);
    });
  };

  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!button) return;
    const action = button.dataset.action;
    const count = builderCardCount();
    if (!count && action !== 'add-section') return;
    const store = getStore(currentStoreKey(), count);
    const index = Number(button.dataset.index);

    if (action === 'add-section') store.push({});
    else if (action === 'duplicate-section' && Number.isInteger(index)) store.splice(index + 1, 0, clone(store[index] || {}));
    else if (action === 'move-section-up' && index > 0) swapStore(index, index - 1);
    else if (action === 'move-section-down' && index >= 0 && index < count - 1) swapStore(index, index + 1);
    else if (action === 'delete-section' && Number.isInteger(index)) {
      const before = count;
      setTimeout(() => {
        if (builderCardCount() !== before - 1) return;
        const current = getStore(currentStoreKey());
        current.splice(index, 1);
      }, 0);
    }
  }, true);

  const parseDragPayload = (event) => {
    const [kind, value] = (event.dataTransfer?.getData('text/plain') || '').split(':');
    return { kind, value };
  };

  const dropPayloadAt = (payload, dropIndex) => {
    const count = builderCardCount();
    if (payload.kind === 'new') return addAt(payload.value, Math.max(0, Math.min(dropIndex, count)));
    if (payload.kind !== 'section') return;
    const from = Number(payload.value);
    if (!Number.isInteger(from) || from < 0 || from >= count) return;
    let target = Math.max(0, Math.min(Number(dropIndex), count));
    if (target > from) target -= 1;
    target = Math.max(0, Math.min(target, count - 1));
    moveByButtons(from, target);
  };

  const enhanceParent = () => {
    const cards = [...document.querySelectorAll('.ve-section-card')];
    const builderOpen = activeBuilder();
    document.querySelector('.ve-editor')?.classList.toggle('ve-visual-builder-mode', builderOpen);
    if (cards.length || document.querySelector('[data-action="add-section"]')) getStore(currentStoreKey(), cards.length);

    const previewCopy = document.querySelector('.ve-preview-bar > div:first-child');
    if (previewCopy && builderOpen && !previewCopy.querySelector('.mts-visual-hint')) {
      const hint = document.createElement('div');
      hint.className = 'mts-visual-hint';
      hint.innerHTML = '<strong>Visual editing:</strong> drag sections to move them · drag the spacing bars · use Style for font size and color';
      previewCopy.append(hint);
    }

    document.querySelectorAll('.ve-add-menu [data-action="add-section"]').forEach((button) => {
      button.draggable = true;
      if (button.dataset.mtsDragWired) return;
      button.dataset.mtsDragWired = 'true';
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', `new:${button.dataset.type}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
      });
    });

    cards.forEach((card, index) => {
      card.dataset.mtsDraggable = 'true';
      if (!card.querySelector('.mts-side-drag-handle')) {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'mts-side-drag-handle ve-icon-button';
        handle.draggable = true;
        handle.title = 'Drag to move section';
        handle.textContent = '⋮⋮';
        handle.addEventListener('dragstart', (event) => {
          event.stopPropagation();
          event.dataTransfer?.setData('text/plain', `section:${index}`);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        });
        card.querySelector('.ve-section-card-head .ve-mini-actions')?.prepend(handle);
      }
      if (card.dataset.mtsDropWired) return;
      card.dataset.mtsDropWired = 'true';
      card.addEventListener('dragover', (event) => {
        event.preventDefault();
        card.classList.add('mts-drop-target');
      });
      card.addEventListener('dragleave', () => card.classList.remove('mts-drop-target'));
      card.addEventListener('drop', (event) => {
        event.preventDefault();
        card.classList.remove('mts-drop-target');
        dropPayloadAt(parseDragPayload(event), index);
      });
    });

    const frame = document.getElementById('ve-preview');
    if (frame?.contentDocument?.readyState !== 'loading') enhanceFrame(frame.contentDocument);
    if (frame && !frame.dataset.mtsLoadWired) {
      frame.dataset.mtsLoadWired = 'true';
      frame.addEventListener('load', () => setTimeout(() => enhanceFrame(frame.contentDocument), 90));
    }
  };

  const rgbToHex = (color) => {
    if (/^#[0-9a-f]{6}$/i.test(String(color))) return color;
    const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#1a2b46';
    return `#${[match[1], match[2], match[3]].map((item) => Number(item).toString(16).padStart(2, '0')).join('')}`;
  };

  const styleValue = (style, key, fallback) => {
    const value = style?.[key];
    return value === undefined || value === null || value === '' ? fallback : value;
  };

  const textTargets = (section) => ({
    heading: section.querySelectorAll('.ve-b-container > h1, .ve-b-container > h2, .ve-b-split > div > h1, .ve-b-split > div > h2'),
    body: section.querySelectorAll('.ve-b-container p:not(.eyebrow), .ve-b-card p'),
  });

  const applySectionStyle = (section, style = {}) => {
    if (!section) return;
    if (style.paddingTop !== undefined && style.paddingTop !== null && style.paddingTop !== '') section.style.setProperty('padding-top', `${clamp(style.paddingTop, 0, 220)}px`, 'important');
    else section.style.removeProperty('padding-top');
    if (style.paddingBottom !== undefined && style.paddingBottom !== null && style.paddingBottom !== '') section.style.setProperty('padding-bottom', `${clamp(style.paddingBottom, 0, 220)}px`, 'important');
    else section.style.removeProperty('padding-bottom');

    const targets = textTargets(section);
    targets.heading.forEach((node) => {
      if (style.headingFontSize !== undefined && style.headingFontSize !== null && style.headingFontSize !== '') node.style.setProperty('font-size', `${clamp(style.headingFontSize, 22, 88)}px`, 'important');
      else node.style.removeProperty('font-size');
      if (style.headingColor) node.style.setProperty('color', style.headingColor, 'important');
      else node.style.removeProperty('color');
    });
    targets.body.forEach((node) => {
      if (style.bodyFontSize !== undefined && style.bodyFontSize !== null && style.bodyFontSize !== '') node.style.setProperty('font-size', `${clamp(style.bodyFontSize, 12, 26)}px`, 'important');
      else node.style.removeProperty('font-size');
      if (style.bodyColor) node.style.setProperty('color', style.bodyColor, 'important');
      else node.style.removeProperty('color');
    });
  };

  const applyFrameStyles = (doc) => {
    const sections = [...doc.querySelectorAll('.ve-preview-builder[data-ve-section]')];
    const store = getStore(currentStoreKey(), sections.length);
    sections.forEach((section, index) => applySectionStyle(section, store[index] || {}));
  };

  const openStylePanel = (doc, index) => {
    doc.querySelector('.mts-style-panel')?.remove();
    const section = doc.querySelector(`.ve-preview-builder[data-ve-section="extra-${index}"]`);
    if (!section) return;
    const store = getStore(currentStoreKey(), doc.querySelectorAll('.ve-preview-builder[data-ve-section]').length);
    const style = store[index] || (store[index] = {});
    const targets = textTargets(section);
    const heading = targets.heading[0];
    const body = targets.body[0];
    const computedHeading = heading ? doc.defaultView.getComputedStyle(heading) : null;
    const computedBody = body ? doc.defaultView.getComputedStyle(body) : null;
    const headingSize = Math.round(parseFloat(computedHeading?.fontSize || '42'));
    const bodySize = Math.round(parseFloat(computedBody?.fontSize || '16'));
    const headingColor = rgbToHex(computedHeading?.color || '#1a2b46');
    const bodyColor = rgbToHex(computedBody?.color || '#34475f');

    const panel = doc.createElement('div');
    panel.className = 'mts-style-panel';
    panel.dataset.mtsControl = 'true';
    panel.innerHTML = `
      <div class="mts-style-panel-head"><strong>Text style</strong><button type="button" data-mts-close>×</button></div>
      <label><span>Heading size <b data-mts-heading-size-label>${esc(styleValue(style, 'headingFontSize', headingSize))}px</b></span><input type="range" min="22" max="88" step="1" value="${esc(styleValue(style, 'headingFontSize', headingSize))}" data-mts-heading-size></label>
      <label><span>Heading color</span><input type="color" value="${esc(styleValue(style, 'headingColor', headingColor))}" data-mts-heading-color></label>
      <label><span>Body size <b data-mts-body-size-label>${esc(styleValue(style, 'bodyFontSize', bodySize))}px</b></span><input type="range" min="12" max="26" step="1" value="${esc(styleValue(style, 'bodyFontSize', bodySize))}" data-mts-body-size></label>
      <label><span>Body color</span><input type="color" value="${esc(styleValue(style, 'bodyColor', bodyColor))}" data-mts-body-color></label>
      <button type="button" class="mts-reset-style" data-mts-reset-style>Use site defaults</button>
    `;
    doc.body.append(panel);

    const update = (key, value) => {
      style[key] = value;
      applySectionStyle(section, style);
    };
    panel.querySelector('[data-mts-heading-size]').addEventListener('input', (event) => {
      update('headingFontSize', Number(event.target.value));
      panel.querySelector('[data-mts-heading-size-label]').textContent = `${event.target.value}px`;
    });
    panel.querySelector('[data-mts-heading-size]').addEventListener('change', signalDirty);
    panel.querySelector('[data-mts-body-size]').addEventListener('input', (event) => {
      update('bodyFontSize', Number(event.target.value));
      panel.querySelector('[data-mts-body-size-label]').textContent = `${event.target.value}px`;
    });
    panel.querySelector('[data-mts-body-size]').addEventListener('change', signalDirty);
    panel.querySelector('[data-mts-heading-color]').addEventListener('input', (event) => update('headingColor', event.target.value));
    panel.querySelector('[data-mts-heading-color]').addEventListener('change', signalDirty);
    panel.querySelector('[data-mts-body-color]').addEventListener('input', (event) => update('bodyColor', event.target.value));
    panel.querySelector('[data-mts-body-color]').addEventListener('change', signalDirty);
    panel.querySelector('[data-mts-reset-style]').addEventListener('click', () => {
      ['headingFontSize', 'headingColor', 'bodyFontSize', 'bodyColor'].forEach((key) => { style[key] = null; });
      applySectionStyle(section, style);
      signalDirty();
      panel.remove();
    });
    panel.querySelector('[data-mts-close]').addEventListener('click', () => panel.remove());
  };

  const startGapDrag = (doc, event, gapIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const sections = [...doc.querySelectorAll('.ve-preview-builder[data-ve-section]')];
    const store = getStore(currentStoreKey(), sections.length);
    if (!sections.length) return;
    const beforeIndex = gapIndex - 1;
    const afterIndex = gapIndex;
    const before = sections[beforeIndex] || null;
    const after = sections[afterIndex] || null;
    const beforeStyle = beforeIndex >= 0 ? (store[beforeIndex] || (store[beforeIndex] = {})) : null;
    const afterStyle = afterIndex < sections.length ? (store[afterIndex] || (store[afterIndex] = {})) : null;
    const beforeComputed = before ? parseFloat(doc.defaultView.getComputedStyle(before).paddingBottom || '0') : 0;
    const afterComputed = after ? parseFloat(doc.defaultView.getComputedStyle(after).paddingTop || '0') : 0;
    const startGap = before && after ? beforeComputed + afterComputed : before ? beforeComputed : afterComputed;
    const startY = event.clientY;
    const handle = event.currentTarget;
    handle.classList.add('active');
    handle.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const nextGap = clamp(startGap + (moveEvent.clientY - startY), 8, 260);
      if (before && after) {
        const half = Math.round(nextGap / 2);
        beforeStyle.paddingBottom = half;
        afterStyle.paddingTop = nextGap - half;
        applySectionStyle(before, beforeStyle);
        applySectionStyle(after, afterStyle);
      } else if (before) {
        beforeStyle.paddingBottom = Math.round(nextGap);
        applySectionStyle(before, beforeStyle);
      } else if (after) {
        afterStyle.paddingTop = Math.round(nextGap);
        applySectionStyle(after, afterStyle);
      }
      const label = handle.querySelector('span');
      if (label) label.textContent = `${Math.round(nextGap)}px spacing`;
    };

    const end = () => {
      handle.classList.remove('active');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      signalDirty();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const buildFrameControls = (doc) => {
    const main = doc.querySelector('main');
    if (!main || !activeBuilder()) return;
    const sections = [...doc.querySelectorAll('.ve-preview-builder[data-ve-section]')];
    doc.querySelectorAll('[data-mts-control="true"]:not(.mts-style-panel)').forEach((node) => node.remove());

    const palette = doc.createElement('div');
    palette.className = 'mts-builder-palette';
    palette.dataset.mtsControl = 'true';
    palette.innerHTML = `<strong>Add section</strong><span>Drag a block onto the page</span><div>${SECTION_TYPES.map(([type, label]) => `<button type="button" draggable="true" data-mts-new="${type}">${label}</button>`).join('')}</div>`;
    if (sections[0]) sections[0].before(palette); else main.append(palette);
    palette.querySelectorAll('[data-mts-new]').forEach((button) => {
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', `new:${button.dataset.mtsNew}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
        doc.documentElement.classList.add('mts-builder-dragging');
      });
      button.addEventListener('dragend', () => doc.documentElement.classList.remove('mts-builder-dragging'));
      button.addEventListener('click', () => addAt(button.dataset.mtsNew));
    });

    const currentSections = [...doc.querySelectorAll('.ve-preview-builder[data-ve-section]')];
    const insertGap = (reference, index, where = 'before') => {
      const gap = doc.createElement('div');
      gap.className = 'mts-gap-control';
      gap.dataset.mtsControl = 'true';
      gap.dataset.mtsDropIndex = String(index);
      gap.innerHTML = '<span>↕ Drag spacing</span><i>Drop section here</i>';
      gap.addEventListener('pointerdown', (event) => startGapDrag(doc, event, index));
      gap.addEventListener('dragover', (event) => {
        event.preventDefault();
        gap.classList.add('drop-active');
      });
      gap.addEventListener('dragleave', () => gap.classList.remove('drop-active'));
      gap.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        gap.classList.remove('drop-active');
        doc.documentElement.classList.remove('mts-builder-dragging');
        dropPayloadAt(parseDragPayload(event), index);
      });
      if (where === 'after') reference.after(gap); else reference.before(gap);
    };

    currentSections.forEach((section, index) => {
      insertGap(section, index, 'before');
      const tools = doc.createElement('div');
      tools.className = 'mts-section-tools';
      tools.dataset.mtsControl = 'true';
      const hasText = Boolean(section.querySelector('h1,h2,p:not(.eyebrow)'));
      tools.innerHTML = `<button type="button" draggable="true" data-mts-drag-section="${index}" title="Drag to move this section">⋮⋮ Move</button>${hasText ? `<button type="button" data-mts-style-section="${index}">Style text</button>` : ''}`;
      section.before(tools);
      const drag = tools.querySelector('[data-mts-drag-section]');
      drag.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', `section:${index}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        doc.documentElement.classList.add('mts-builder-dragging');
      });
      drag.addEventListener('dragend', () => doc.documentElement.classList.remove('mts-builder-dragging'));
      tools.querySelector('[data-mts-style-section]')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openStylePanel(doc, index);
      });
    });
    if (currentSections.length) insertGap(currentSections.at(-1), currentSections.length, 'after');
    else {
      const emptyGap = doc.createElement('div');
      emptyGap.className = 'mts-gap-control empty';
      emptyGap.dataset.mtsControl = 'true';
      emptyGap.innerHTML = '<span>Drop your first section here</span>';
      emptyGap.addEventListener('dragover', (event) => event.preventDefault());
      emptyGap.addEventListener('drop', (event) => {
        event.preventDefault();
        dropPayloadAt(parseDragPayload(event), 0);
      });
      palette.after(emptyGap);
    }
  };

  const injectFrameStyle = (doc) => {
    if (doc.getElementById('mts-visual-builder-style')) return;
    const style = doc.createElement('style');
    style.id = 'mts-visual-builder-style';
    style.textContent = `
      .mts-builder-palette{position:relative;z-index:99990;display:flex;flex-wrap:wrap;align-items:center;gap:8px;border:1px solid #cbd6e1;border-radius:12px;margin:14px auto;padding:10px 12px;width:min(calc(100% - 28px),900px);background:rgba(255,255,255,.97);box-shadow:0 10px 26px rgba(26,43,70,.10);font-family:Arial,sans-serif;color:#1a2b46}
      .mts-builder-palette strong{font-size:12px}.mts-builder-palette>span{color:#718096;font-size:10px}.mts-builder-palette>div{display:flex;flex-wrap:wrap;gap:5px;margin-left:auto}.mts-builder-palette button,.mts-section-tools button{border:1px solid #cbd6e1;border-radius:7px;padding:6px 8px;background:#fff;color:#3f5878;font:700 10px Arial,sans-serif;cursor:grab}.mts-builder-palette button:hover,.mts-section-tools button:hover{border-color:#7890ae;background:#f6f9fc}
      .mts-section-tools{position:relative;z-index:99980;height:0;max-width:min(calc(100% - 24px),1400px);margin:0 auto;pointer-events:none}.mts-section-tools>button{position:relative;top:10px;pointer-events:auto;box-shadow:0 4px 14px rgba(26,43,70,.10)}.mts-section-tools>button+button{margin-left:5px;cursor:pointer}
      .mts-gap-control{position:relative;z-index:99970;display:flex;height:18px;align-items:center;justify-content:center;gap:9px;margin:-9px 0;background:transparent;color:#45628e;font:700 9px Arial,sans-serif;cursor:ns-resize;user-select:none;touch-action:none}.mts-gap-control:before{position:absolute;left:8%;right:8%;height:1px;background:rgba(69,98,142,.22);content:""}.mts-gap-control span,.mts-gap-control i{position:relative;border:1px solid #c9d5e1;border-radius:999px;padding:3px 8px;background:#fff;font-style:normal;box-shadow:0 2px 7px rgba(26,43,70,.08)}.mts-gap-control i{display:none;color:#516982}.mts-gap-control:hover,.mts-gap-control.active{height:26px;margin:-13px 0}.mts-gap-control:hover span,.mts-gap-control.active span{border-color:#7890ae}.mts-builder-dragging .mts-gap-control{height:34px;margin:-17px 0;cursor:copy}.mts-builder-dragging .mts-gap-control i{display:inline-flex}.mts-builder-dragging .mts-gap-control span{display:none}.mts-gap-control.drop-active:before{height:3px;background:#45628e}.mts-gap-control.drop-active i{border-color:#45628e;color:#1a2b46}
      .mts-style-panel{position:fixed;z-index:100000;top:18px;right:18px;width:260px;border:1px solid #cbd6e1;border-radius:14px;padding:13px;background:#fff;box-shadow:0 18px 48px rgba(26,43,70,.22);font-family:Arial,sans-serif;color:#1a2b46}.mts-style-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.mts-style-panel-head strong{font-size:13px}.mts-style-panel-head button{border:0;background:transparent;color:#60738a;font-size:18px;cursor:pointer}.mts-style-panel label{display:grid;gap:5px;border-top:1px solid #edf0f3;padding:9px 0}.mts-style-panel label span{display:flex;justify-content:space-between;color:#425a77;font-size:10px;font-weight:700}.mts-style-panel label b{font-size:10px}.mts-style-panel input[type="range"]{width:100%}.mts-style-panel input[type="color"]{width:100%;height:32px;border:1px solid #cbd6e1;border-radius:7px;padding:2px;background:#fff}.mts-reset-style{width:100%;border:1px solid #cbd6e1;border-radius:8px;padding:8px;background:#f6f8fb;color:#45628e;font:700 10px Arial,sans-serif;cursor:pointer}
      @media(max-width:700px){.mts-builder-palette{align-items:flex-start}.mts-builder-palette>div{width:100%;margin-left:0}.mts-section-tools{padding-left:8px}.mts-gap-control span{font-size:8px}.mts-style-panel{left:10px;right:10px;top:10px;width:auto}}
    `;
    doc.head.append(style);
  };

  const enhanceFrame = (doc) => {
    if (!doc?.documentElement || doc.readyState === 'loading') return;
    injectFrameStyle(doc);
    applyFrameStyles(doc);
    if (!activeBuilder() || doc.documentElement.dataset.mtsDecorating === 'true') return;
    doc.documentElement.dataset.mtsDecorating = 'true';
    buildFrameControls(doc);
    setTimeout(() => { delete doc.documentElement.dataset.mtsDecorating; }, 0);

    if (!doc.documentElement.dataset.mtsObserverWired) {
      doc.documentElement.dataset.mtsObserverWired = 'true';
      const observer = new MutationObserver(() => {
        if (doc.documentElement.dataset.mtsDecorating === 'true') return;
        clearTimeout(doc.defaultView.__mtsVisualTimer);
        doc.defaultView.__mtsVisualTimer = setTimeout(() => enhanceFrame(doc), 30);
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }
  };

  const queueParentRefresh = () => {
    if (parentRefreshQueued) return;
    parentRefreshQueued = true;
    requestAnimationFrame(() => {
      parentRefreshQueued = false;
      enhanceParent();
    });
  };

  new MutationObserver(queueParentRefresh).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => {
    const nextHash = location.hash || '#/';
    if (nextHash === '#/new-page' && lastHash !== '#/new-page') {
      newPageSavedPath = '';
      stores.set('__new__', []);
    }
    lastHash = nextHash;
    setTimeout(queueParentRefresh, 40);
  });
  window.addEventListener('load', queueParentRefresh);
  queueParentRefresh();
})();
