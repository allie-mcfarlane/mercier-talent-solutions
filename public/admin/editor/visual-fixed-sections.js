(() => {
  'use strict';

  const PAGE_PATHS = {
    home: 'src/content/pages/home.md',
    about: 'src/content/pages/about.md',
    services: 'src/content/pages/services.md',
  };
  const TARGETS = {
    home: {
      hero: '.hero',
      proof: '.proof',
      approach: '.approach',
      news: '.news-band',
    },
    about: {
      hero: '.about-hero',
      firm: '.firm-band',
      team: '.team-band',
    },
    services: {
      hero: '.services-hero',
      focus: '.coaching-focus',
      services: '.service-section',
      training: '.training-section',
      consulting: '.consulting-section',
    },
  };
  const STYLE_KEYS = ['paddingTop', 'paddingBottom', 'headingFontSize', 'headingColor', 'bodyFontSize', 'bodyColor'];
  const stores = new Map();
  const wrappedFetch = window.fetch.bind(window);
  let refreshQueued = false;

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
    return Object.values(PAGE_PATHS).includes(path) ? path : '';
  };

  const pageKey = () => {
    const match = (location.hash || '').match(/^#\/page\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };
  const currentPath = () => PAGE_PATHS[pageKey()] || '';

  const capture = (path, text) => {
    if (!path) return;
    const parsed = parseDocument(text);
    const source = parsed.data?.visualStyles && typeof parsed.data.visualStyles === 'object' ? parsed.data.visualStyles : {};
    stores.set(path, JSON.parse(JSON.stringify(source)));
  };

  const getStore = (path = currentPath()) => {
    if (!path) return {};
    if (!stores.has(path)) stores.set(path, {});
    return stores.get(path);
  };

  const merge = (data, store) => {
    if (!store || typeof store !== 'object') return;
    const next = data.visualStyles && typeof data.visualStyles === 'object' ? data.visualStyles : {};
    Object.entries(store).forEach(([sectionId, style]) => {
      if (!style || typeof style !== 'object') return;
      const section = next[sectionId] && typeof next[sectionId] === 'object' ? next[sectionId] : {};
      STYLE_KEYS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(style, key)) return;
        const value = style[key];
        if (value === null || value === '') delete section[key];
        else if (key.includes('Size') || key.startsWith('padding')) section[key] = Number(value);
        else section[key] = String(value);
      });
      if (Object.keys(section).length) next[sectionId] = section;
      else delete next[sectionId];
    });
    if (Object.keys(next).length) data.visualStyles = next;
    else delete data.visualStyles;
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
          merge(parsed.data, getStore(path));
          payload.content = encodeBase64(serializeDocument(parsed.data, parsed.body));
          nextInit = { ...init, body: JSON.stringify(payload) };
        }
      } catch (_) {}
    }

    const response = await wrappedFetch(input, nextInit);
    if (path && method === 'GET' && response.ok) {
      try {
        const payload = await response.clone().json();
        if (payload?.content) capture(path, decodeBase64(payload.content));
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
    document.querySelector('#ve-form [data-lines]')?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const activeSectionId = () => {
    const active = document.querySelector('.ve-section-button.active[data-section-select]');
    const id = active?.dataset.sectionSelect || '';
    return id === 'extra' || id === 'info' ? '' : id;
  };

  const targetNodes = (doc, key, sectionId) => {
    const selector = TARGETS[key]?.[sectionId];
    return selector ? [...doc.querySelectorAll(selector)] : [];
  };

  const textTargets = (node) => ({
    heading: node.querySelectorAll('h1,h2,h3'),
    body: node.querySelectorAll('p:not(.eyebrow):not(.service-number),li'),
  });

  const applyStyle = (doc, key, sectionId) => {
    const style = getStore()[sectionId] || {};
    targetNodes(doc, key, sectionId).forEach((node) => {
      if (style.paddingTop !== undefined && style.paddingTop !== null && style.paddingTop !== '') node.style.setProperty('padding-top', `${clamp(style.paddingTop, 0, 220)}px`, 'important');
      else node.style.removeProperty('padding-top');
      if (style.paddingBottom !== undefined && style.paddingBottom !== null && style.paddingBottom !== '') node.style.setProperty('padding-bottom', `${clamp(style.paddingBottom, 0, 220)}px`, 'important');
      else node.style.removeProperty('padding-bottom');
      const targets = textTargets(node);
      targets.heading.forEach((heading) => {
        if (style.headingFontSize !== undefined && style.headingFontSize !== null && style.headingFontSize !== '') heading.style.setProperty('font-size', `${clamp(style.headingFontSize, 22, 88)}px`, 'important');
        else heading.style.removeProperty('font-size');
        if (style.headingColor) heading.style.setProperty('color', style.headingColor, 'important');
        else heading.style.removeProperty('color');
      });
      targets.body.forEach((body) => {
        if (style.bodyFontSize !== undefined && style.bodyFontSize !== null && style.bodyFontSize !== '') body.style.setProperty('font-size', `${clamp(style.bodyFontSize, 12, 26)}px`, 'important');
        else body.style.removeProperty('font-size');
        if (style.bodyColor) body.style.setProperty('color', style.bodyColor, 'important');
        else body.style.removeProperty('color');
      });
    });
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

  const openStylePanel = (doc, key, sectionId) => {
    doc.querySelector('.mts-fixed-style-panel')?.remove();
    const first = targetNodes(doc, key, sectionId)[0];
    if (!first) return;
    const store = getStore();
    const style = store[sectionId] || (store[sectionId] = {});
    const targets = textTargets(first);
    const heading = targets.heading[0];
    const body = targets.body[0];
    const headingComputed = heading ? doc.defaultView.getComputedStyle(heading) : null;
    const bodyComputed = body ? doc.defaultView.getComputedStyle(body) : null;
    const headingSize = Math.round(parseFloat(headingComputed?.fontSize || '42'));
    const bodySize = Math.round(parseFloat(bodyComputed?.fontSize || '16'));
    const headingColor = rgbToHex(headingComputed?.color || '#1a2b46');
    const bodyColor = rgbToHex(bodyComputed?.color || '#34475f');

    const panel = doc.createElement('div');
    panel.className = 'mts-fixed-style-panel';
    panel.dataset.mtsFixedControl = 'true';
    panel.innerHTML = `
      <div class="mts-fixed-panel-head"><strong>Text style</strong><button type="button" data-close>×</button></div>
      <label><span>Heading size <b data-heading-label>${esc(styleValue(style, 'headingFontSize', headingSize))}px</b></span><input type="range" min="22" max="88" step="1" value="${esc(styleValue(style, 'headingFontSize', headingSize))}" data-heading-size></label>
      <label><span>Heading color</span><input type="color" value="${esc(styleValue(style, 'headingColor', headingColor))}" data-heading-color></label>
      <label><span>Body size <b data-body-label>${esc(styleValue(style, 'bodyFontSize', bodySize))}px</b></span><input type="range" min="12" max="26" step="1" value="${esc(styleValue(style, 'bodyFontSize', bodySize))}" data-body-size></label>
      <label><span>Body color</span><input type="color" value="${esc(styleValue(style, 'bodyColor', bodyColor))}" data-body-color></label>
      <button type="button" class="mts-fixed-reset" data-reset>Use site defaults</button>
    `;
    doc.body.append(panel);

    const update = (name, value) => {
      style[name] = value;
      applyStyle(doc, key, sectionId);
    };
    panel.querySelector('[data-heading-size]').addEventListener('input', (event) => {
      update('headingFontSize', Number(event.target.value));
      panel.querySelector('[data-heading-label]').textContent = `${event.target.value}px`;
    });
    panel.querySelector('[data-heading-size]').addEventListener('change', signalDirty);
    panel.querySelector('[data-body-size]').addEventListener('input', (event) => {
      update('bodyFontSize', Number(event.target.value));
      panel.querySelector('[data-body-label]').textContent = `${event.target.value}px`;
    });
    panel.querySelector('[data-body-size]').addEventListener('change', signalDirty);
    panel.querySelector('[data-heading-color]').addEventListener('input', (event) => update('headingColor', event.target.value));
    panel.querySelector('[data-heading-color]').addEventListener('change', signalDirty);
    panel.querySelector('[data-body-color]').addEventListener('input', (event) => update('bodyColor', event.target.value));
    panel.querySelector('[data-body-color]').addEventListener('change', signalDirty);
    panel.querySelector('[data-reset]').addEventListener('click', () => {
      ['headingFontSize', 'headingColor', 'bodyFontSize', 'bodyColor'].forEach((name) => { style[name] = null; });
      applyStyle(doc, key, sectionId);
      signalDirty();
      panel.remove();
    });
    panel.querySelector('[data-close]').addEventListener('click', () => panel.remove());
  };

  const beginSpaceDrag = (doc, key, sectionId, edge, event) => {
    event.preventDefault();
    event.stopPropagation();
    const first = targetNodes(doc, key, sectionId)[0];
    if (!first) return;
    const store = getStore();
    const style = store[sectionId] || (store[sectionId] = {});
    const property = edge === 'top' ? 'paddingTop' : 'paddingBottom';
    const cssProperty = edge === 'top' ? 'paddingTop' : 'paddingBottom';
    const start = parseFloat(doc.defaultView.getComputedStyle(first)[cssProperty] || '0');
    const startY = event.clientY;
    const handle = event.currentTarget;
    handle.classList.add('active');
    handle.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const direction = edge === 'top' ? -1 : 1;
      const next = clamp(start + ((moveEvent.clientY - startY) * direction), 0, 220);
      style[property] = Math.round(next);
      applyStyle(doc, key, sectionId);
      handle.querySelector('span').textContent = `${Math.round(next)}px ${edge} spacing`;
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

  const injectStyle = (doc) => {
    if (doc.getElementById('mts-fixed-editor-style')) return;
    const style = doc.createElement('style');
    style.id = 'mts-fixed-editor-style';
    style.textContent = `
      .mts-fixed-tools{position:relative;z-index:99960;height:0;max-width:min(calc(100% - 24px),1400px);margin:0 auto;pointer-events:none}.mts-fixed-tools button{position:relative;top:10px;pointer-events:auto;border:1px solid #cbd6e1;border-radius:7px;padding:6px 8px;background:#fff;color:#3f5878;box-shadow:0 4px 14px rgba(26,43,70,.10);font:700 10px Arial,sans-serif;cursor:pointer}
      .mts-fixed-space{position:relative;z-index:99955;display:flex;height:18px;align-items:center;justify-content:center;margin:-9px 0;color:#45628e;font:700 9px Arial,sans-serif;cursor:ns-resize;user-select:none;touch-action:none}.mts-fixed-space:before{position:absolute;left:8%;right:8%;height:1px;background:rgba(69,98,142,.22);content:""}.mts-fixed-space span{position:relative;border:1px solid #c9d5e1;border-radius:999px;padding:3px 8px;background:#fff;box-shadow:0 2px 7px rgba(26,43,70,.08)}.mts-fixed-space:hover,.mts-fixed-space.active{height:26px;margin:-13px 0}.mts-fixed-space:hover span,.mts-fixed-space.active span{border-color:#7890ae}
      .mts-fixed-style-panel{position:fixed;z-index:100000;top:18px;right:18px;width:260px;border:1px solid #cbd6e1;border-radius:14px;padding:13px;background:#fff;box-shadow:0 18px 48px rgba(26,43,70,.22);font-family:Arial,sans-serif;color:#1a2b46}.mts-fixed-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.mts-fixed-panel-head strong{font-size:13px}.mts-fixed-panel-head button{border:0;background:transparent;color:#60738a;font-size:18px;cursor:pointer}.mts-fixed-style-panel label{display:grid;gap:5px;border-top:1px solid #edf0f3;padding:9px 0}.mts-fixed-style-panel label span{display:flex;justify-content:space-between;color:#425a77;font-size:10px;font-weight:700}.mts-fixed-style-panel label b{font-size:10px}.mts-fixed-style-panel input[type="range"]{width:100%}.mts-fixed-style-panel input[type="color"]{width:100%;height:32px;border:1px solid #cbd6e1;border-radius:7px;padding:2px;background:#fff}.mts-fixed-reset{width:100%;border:1px solid #cbd6e1;border-radius:8px;padding:8px;background:#f6f8fb;color:#45628e;font:700 10px Arial,sans-serif;cursor:pointer}
      @media(max-width:700px){.mts-fixed-tools{padding-left:8px}.mts-fixed-style-panel{left:10px;right:10px;top:10px;width:auto}}
    `;
    doc.head.append(style);
  };

  const enhanceFrame = (doc) => {
    const key = pageKey();
    const sectionId = activeSectionId();
    if (!doc?.body || !TARGETS[key] || !sectionId || !TARGETS[key][sectionId]) return;
    injectStyle(doc);
    Object.keys(TARGETS[key]).forEach((id) => applyStyle(doc, key, id));
    doc.querySelectorAll('[data-mts-fixed-control="true"]:not(.mts-fixed-style-panel)').forEach((node) => node.remove());
    const nodes = targetNodes(doc, key, sectionId);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes.at(-1);

    const top = doc.createElement('div');
    top.className = 'mts-fixed-space';
    top.dataset.mtsFixedControl = 'true';
    top.innerHTML = '<span>↕ Top spacing</span>';
    top.addEventListener('pointerdown', (event) => beginSpaceDrag(doc, key, sectionId, 'top', event));
    first.before(top);

    const tools = doc.createElement('div');
    tools.className = 'mts-fixed-tools';
    tools.dataset.mtsFixedControl = 'true';
    const hasText = Boolean(first.querySelector('h1,h2,h3,p:not(.eyebrow)'));
    tools.innerHTML = hasText ? '<button type="button" data-mts-fixed-style>Style text</button>' : '';
    top.after(tools);
    tools.querySelector('[data-mts-fixed-style]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStylePanel(doc, key, sectionId);
    });

    const bottom = doc.createElement('div');
    bottom.className = 'mts-fixed-space';
    bottom.dataset.mtsFixedControl = 'true';
    bottom.innerHTML = '<span>↕ Bottom spacing</span>';
    bottom.addEventListener('pointerdown', (event) => beginSpaceDrag(doc, key, sectionId, 'bottom', event));
    last.after(bottom);
  };

  const enhance = () => {
    const key = pageKey();
    const sectionId = activeSectionId();
    const previewCopy = document.querySelector('.ve-preview-bar > div:first-child');
    if (previewCopy && TARGETS[key]?.[sectionId] && !previewCopy.querySelector('.mts-fixed-hint')) {
      const hint = document.createElement('div');
      hint.className = 'mts-visual-hint mts-fixed-hint';
      hint.innerHTML = '<strong>Visual editing:</strong> drag the spacing bars on the page · use Style text for font size and color';
      previewCopy.append(hint);
    }
    const frame = document.getElementById('ve-preview');
    if (frame?.contentDocument?.readyState !== 'loading') enhanceFrame(frame.contentDocument);
    if (frame && !frame.dataset.mtsFixedLoadWired) {
      frame.dataset.mtsFixedLoadWired = 'true';
      frame.addEventListener('load', () => setTimeout(() => enhanceFrame(frame.contentDocument), 130));
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
  window.addEventListener('hashchange', () => setTimeout(queueRefresh, 50));
  window.addEventListener('load', queueRefresh);
  queueRefresh();
})();
