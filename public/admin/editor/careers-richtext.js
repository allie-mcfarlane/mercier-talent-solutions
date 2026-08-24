(() => {
  'use strict';

  const BRAND_COLORS = {
    navy: '#17253e',
    blue: '#45628e',
    gray: '#66707c',
  };

  let roleCache = [];
  let activePreviewIndex = null;

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeUrl = (value = '') => {
    const url = String(value || '').trim();
    if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url)) return url;
    return '';
  };

  const colorName = (value = '') => {
    const normalized = String(value || '').replace(/\s+/g, '').toLowerCase();
    if (normalized === '#45628e' || normalized === 'rgb(69,98,142)') return 'blue';
    if (normalized === '#66707c' || normalized === 'rgb(102,112,124)') return 'gray';
    if (normalized === '#17253e' || normalized === 'rgb(23,37,62)' || normalized === '#1a2b46' || normalized === 'rgb(26,43,70)') return 'navy';
    return '';
  };

  const inlineToMarkup = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node;
    const tag = element.tagName;
    const children = [...element.childNodes].map(inlineToMarkup).join('');

    if (tag === 'BR') return '\n';
    if (tag === 'STRONG' || tag === 'B') return children ? `**${children}**` : '';
    if (tag === 'A') {
      const href = safeUrl(element.getAttribute('href'));
      return href && children ? `[${children}](${href})` : children;
    }

    if (tag === 'FONT' || tag === 'SPAN') {
      const rawColor = element.getAttribute('color') || element.style.color || '';
      const name = colorName(rawColor);
      return name && children ? `[[${name}]]${children}[[/${name}]]` : children;
    }

    return children;
  };

  const editorToMarkup = (editor) => {
    const blocks = [];

    [...editor.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = inlineToMarkup(node).trim();
        if (value) blocks.push(value);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName;
      if (tag === 'UL' || tag === 'OL') {
        const ordered = tag === 'OL';
        const items = [...node.children]
          .filter((item) => item.tagName === 'LI')
          .map((item, index) => `${ordered ? `${index + 1}.` : '-'} ${inlineToMarkup(item).trim()}`)
          .filter((item) => item.replace(/^\d+\.|^-/, '').trim());
        if (items.length) blocks.push(items.join('\n'));
        return;
      }

      const content = inlineToMarkup(node).trim();
      if (!content) return;
      if (tag === 'H2') blocks.push(`## ${content}`);
      else if (tag === 'H3') blocks.push(`### ${content}`);
      else blocks.push(content);
    });

    return blocks.join('\n\n').trim();
  };

  const inlineMarkupToHtml = (value = '', allowLinks = true) => {
    let raw = String(value || '');
    const links = [];

    if (allowLinks) {
      raw = raw.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
        const safe = safeUrl(href);
        if (!safe) return label;
        const token = `@@MTSLINK${links.length}@@`;
        links.push({ label, href: safe });
        return token;
      });
    }

    let html = escapeHtml(raw);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    ['navy', 'blue', 'gray'].forEach((name) => {
      const pattern = new RegExp(`\\[\\[${name}\\]\\]([\\s\\S]*?)\\[\\[\\/${name}\\]\\]`, 'g');
      html = html.replace(pattern, `<span class="role-text-${name}">$1</span>`);
    });

    links.forEach((link, index) => {
      const label = inlineMarkupToHtml(link.label, false);
      const href = escapeHtml(link.href);
      html = html.replace(`@@MTSLINK${index}@@`, `<a href="${href}">${label}</a>`);
    });

    return html;
  };

  const markupToHtml = (markup = '') => {
    const chunks = String(markup || '').replace(/\r/g, '').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    if (!chunks.length) return '<p></p>';

    return chunks.map((chunk) => {
      const lines = chunk.split('\n').map((line) => line.trimEnd());
      if (lines.every((line) => /^-\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inlineMarkupToHtml(line.replace(/^-\s+/, ''))}</li>`).join('')}</ul>`;
      }
      if (lines.every((line) => /^\d+\.\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${inlineMarkupToHtml(line.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
      }
      if (lines.length === 1 && /^###\s+/.test(lines[0])) {
        return `<h3>${inlineMarkupToHtml(lines[0].replace(/^###\s+/, ''))}</h3>`;
      }
      if (lines.length === 1 && /^##\s+/.test(lines[0])) {
        return `<h2>${inlineMarkupToHtml(lines[0].replace(/^##\s+/, ''))}</h2>`;
      }
      return `<p>${lines.map((line) => inlineMarkupToHtml(line)).join('<br>')}</p>`;
    }).join('');
  };

  const readRoleFromForm = (index) => {
    const get = (field) => document.querySelector(`[data-bind="roles.${index}.${field}"]`)?.value || '';
    const description = document.querySelector(`[data-description="${index}"]`)?.value || '';
    const current = roleCache[index] || {};
    const role = {
      ...current,
      title: get('title') || current.title || 'New Role',
      slug: get('slug') || current.slug || '',
      location: get('location') || current.location || '',
      employmentType: get('employmentType') || current.employmentType || '',
      summary: get('summary') || current.summary || '',
      descriptionMarkup: description || current.descriptionMarkup || '',
    };
    roleCache[index] = role;
    return role;
  };

  const ensureStyles = () => {
    if (document.getElementById('mts-careers-richtext-styles')) return;
    const style = document.createElement('style');
    style.id = 'mts-careers-richtext-styles';
    style.textContent = `
      .mts-rich-wrap{border:1px solid #cfd6de;border-radius:9px;background:#fff;overflow:hidden}
      .mts-rich-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px;border-bottom:1px solid #dfe4e9;background:#f7f8fa}
      .mts-rich-toolbar button{min-height:32px;padding:0 9px;border:1px solid #d4dae1;border-radius:6px;background:#fff;color:#344251;font:700 11px/1.1 inherit;cursor:pointer}
      .mts-rich-toolbar button:hover,.mts-rich-toolbar button:focus-visible{border-color:#45628e;color:#17253e;outline:none}
      .mts-rich-toolbar .mts-color{display:inline-flex;align-items:center;gap:5px}
      .mts-rich-toolbar .mts-dot{width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.12);display:inline-block}
      .mts-rich-toolbar .mts-separator{width:1px;height:22px;background:#d8dde3;margin:0 2px}
      .mts-rich-editor{min-height:260px;padding:18px 19px;color:#17253e;font-size:14px;line-height:1.7;outline:none}
      .mts-rich-editor:focus{box-shadow:inset 0 0 0 2px rgba(69,98,142,.14)}
      .mts-rich-editor p{margin:0 0 14px}.mts-rich-editor p:last-child{margin-bottom:0}
      .mts-rich-editor h2{margin:22px 0 10px;font-size:22px;line-height:1.25;color:#17253e}
      .mts-rich-editor h3{margin:19px 0 8px;font-size:17px;line-height:1.3;color:#17253e}
      .mts-rich-editor ul,.mts-rich-editor ol{margin:8px 0 16px;padding-left:24px}
      .mts-rich-editor a{color:#45628e;text-decoration:underline;text-underline-offset:3px}
      .mts-rich-help{display:block;margin-top:7px;color:#718091;font-size:11px;line-height:1.45}
      .mts-preview-role{margin-left:auto}
      @media(max-width:760px){.mts-rich-toolbar{gap:5px}.mts-rich-toolbar button{font-size:10px;padding-inline:7px}.mts-rich-editor{min-height:220px;padding:15px}}
    `;
    document.head.append(style);
  };

  const runCommand = (editor, command, value = null, range = null) => {
    editor.focus();
    if (range) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand(command, false, value);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const enhanceDescription = (textarea) => {
    if (textarea.dataset.richReady === 'true') return;
    textarea.dataset.richReady = 'true';
    const index = Number(textarea.dataset.description);
    let savedRange = null;

    const wrap = document.createElement('div');
    wrap.className = 'mts-rich-wrap';
    wrap.innerHTML = `
      <div class="mts-rich-toolbar" role="toolbar" aria-label="Role description formatting">
        <button type="button" data-rich-command="formatBlock" data-rich-value="p">Paragraph</button>
        <button type="button" data-rich-command="formatBlock" data-rich-value="h2">Subheading</button>
        <button type="button" data-rich-command="formatBlock" data-rich-value="h3">Small Subheading</button>
        <span class="mts-separator" aria-hidden="true"></span>
        <button type="button" data-rich-command="bold"><strong>Bold</strong></button>
        <button type="button" data-rich-command="insertUnorderedList">Bullets</button>
        <button type="button" data-rich-link>Link</button>
        <span class="mts-separator" aria-hidden="true"></span>
        <button class="mts-color" type="button" data-rich-color="navy"><span class="mts-dot" style="background:${BRAND_COLORS.navy}"></span>Black</button>
        <button class="mts-color" type="button" data-rich-color="blue"><span class="mts-dot" style="background:${BRAND_COLORS.blue}"></span>Blue</button>
        <button class="mts-color" type="button" data-rich-color="gray"><span class="mts-dot" style="background:${BRAND_COLORS.gray}"></span>Gray</button>
        <button type="button" data-rich-command="removeFormat">Clear Formatting</button>
      </div>
      <div class="mts-rich-editor" contenteditable="true" role="textbox" aria-multiline="true"></div>
    `;

    const editor = wrap.querySelector('.mts-rich-editor');
    editor.innerHTML = markupToHtml(textarea.value);
    textarea.hidden = true;
    textarea.setAttribute('aria-hidden', 'true');
    textarea.after(wrap);

    const oldHelp = textarea.parentElement?.querySelector('small');
    if (oldHelp) oldHelp.textContent = 'Highlight text and use the toolbar to format it. Links and colors use the approved Mercier styles.';
    else {
      const help = document.createElement('small');
      help.className = 'mts-rich-help';
      help.textContent = 'Highlight text and use the toolbar to format it.';
      wrap.after(help);
    }

    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
    };

    const sync = () => {
      const markup = editorToMarkup(editor);
      textarea.value = markup;
      roleCache[index] = { ...(roleCache[index] || {}), descriptionMarkup: markup };
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      if (activePreviewIndex === index) renderRolePreview(index);
    };

    editor.addEventListener('keyup', rememberSelection);
    editor.addEventListener('mouseup', rememberSelection);
    editor.addEventListener('focus', rememberSelection);
    editor.addEventListener('input', sync);
    editor.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    });

    wrap.querySelectorAll('button').forEach((button) => button.addEventListener('mousedown', (event) => event.preventDefault()));

    wrap.querySelectorAll('[data-rich-command]').forEach((button) => button.addEventListener('click', () => {
      runCommand(editor, button.dataset.richCommand, button.dataset.richValue || null, savedRange);
      rememberSelection();
    }));

    wrap.querySelector('[data-rich-link]')?.addEventListener('click', () => {
      if (!savedRange || savedRange.collapsed) {
        window.alert('Highlight the words you want to turn into a link first.');
        return;
      }
      const entered = window.prompt('Paste the link address:');
      if (entered === null) return;
      const href = safeUrl(entered);
      if (!href) {
        window.alert('Please use a full https:// link, an email link, a phone link, or a website path beginning with /.');
        return;
      }
      runCommand(editor, 'createLink', href, savedRange);
      rememberSelection();
    });

    wrap.querySelectorAll('[data-rich-color]').forEach((button) => button.addEventListener('click', () => {
      const color = BRAND_COLORS[button.dataset.richColor];
      runCommand(editor, 'foreColor', color, savedRange);
      rememberSelection();
    }));

    readRoleFromForm(index);
  };

  const previewDescriptionHtml = (index) => {
    const editor = document.querySelector(`[data-description="${index}"] + .mts-rich-wrap .mts-rich-editor`);
    if (editor) return editor.innerHTML;
    const role = readRoleFromForm(index);
    return markupToHtml(role.descriptionMarkup || '');
  };

  const ensureIframeRoleStyles = (doc) => {
    if (doc.getElementById('mts-draft-role-styles')) return;
    const style = doc.createElement('style');
    style.id = 'mts-draft-role-styles';
    style.textContent = `
      .mts-draft-role .role-hero{border-bottom:1px solid rgba(221,220,215,.9);background:linear-gradient(140deg,#fafaf8 0%,#f0f0ec 100%)}
      .mts-draft-role .role-hero-inner{max-width:1380px;padding-block:clamp(4rem,7vw,6.5rem)}
      .mts-draft-role .back-link{display:inline-block;margin-bottom:clamp(2.6rem,4vw,4rem);color:#66707c;font-size:13px;font-weight:700;text-decoration:none;cursor:pointer}
      .mts-draft-role .back-link:hover{text-decoration:underline;text-underline-offset:4px;color:#45628e}
      .mts-draft-role .eyebrow{margin:0 0 1.1rem;color:#45628e;font-size:13px;font-weight:700;letter-spacing:4.5px;text-transform:uppercase}
      .mts-draft-role h1{max-width:1120px;margin:0;color:#17253e;font-family:var(--font-heading);font-size:clamp(3rem,5vw,5.5rem);font-weight:700;letter-spacing:-.05em;line-height:1.02}
      .mts-draft-role .role-meta{margin:1.5rem 0 0;color:#66707c;font-size:14px;font-weight:600}
      .mts-draft-role .role-content-section{background:#fff;padding:clamp(4rem,7vw,7rem) 0 clamp(5.5rem,9vw,9rem)}
      .mts-draft-role .role-content{max-width:960px}
      .mts-draft-role .role-summary{margin:0 0 clamp(2rem,4vw,3rem);color:#45628e;font-family:var(--font-heading);font-size:clamp(1.45rem,2.3vw,2.05rem);font-weight:600;letter-spacing:-.025em;line-height:1.45}
      .mts-draft-role .role-rich-text p{margin:0 0 1.45rem;color:#17253e;font-size:clamp(1rem,1.15vw,1.12rem);line-height:1.85}
      .mts-draft-role .role-rich-text h2{margin:2.5rem 0 1rem;color:#17253e;font-family:var(--font-heading);font-size:clamp(1.65rem,2.4vw,2.2rem);line-height:1.2}
      .mts-draft-role .role-rich-text h3{margin:2.1rem 0 .85rem;color:#17253e;font-family:var(--font-heading);font-size:clamp(1.25rem,1.8vw,1.55rem);line-height:1.3}
      .mts-draft-role .role-rich-text ul,.mts-draft-role .role-rich-text ol{margin:0 0 1.6rem;padding-left:1.4rem;color:#17253e}
      .mts-draft-role .role-rich-text li{margin:.45rem 0;font-size:clamp(1rem,1.15vw,1.12rem);line-height:1.75}
      .mts-draft-role .role-rich-text a{color:#45628e;text-decoration:underline;text-underline-offset:3px}
      .mts-draft-role .role-text-navy{color:#17253e}.mts-draft-role .role-text-blue{color:#45628e}.mts-draft-role .role-text-gray{color:#66707c}
    `;
    doc.head.append(style);
  };

  const renderRolePreview = (index, suppliedFrame = null) => {
    const frame = suppliedFrame || document.getElementById('careers-preview');
    if (!frame) return;
    const doc = frame.contentDocument;
    const main = doc?.querySelector('#main-content');
    if (!doc || !main) return;

    const role = readRoleFromForm(index);
    roleCache[index] = role;
    activePreviewIndex = index;
    ensureIframeRoleStyles(doc);

    const meta = [role.location, role.employmentType].filter(Boolean).join(' · ');
    main.innerHTML = `
      <article class="role-page mts-draft-role">
        <header class="role-hero">
          <div class="container role-hero-inner">
            <a class="back-link" href="/careers/">← Careers</a>
            <p class="eyebrow">Careers</p>
            <h1>${escapeHtml(role.title || 'New Role')}</h1>
            ${meta ? `<p class="role-meta">${escapeHtml(meta)}</p>` : ''}
          </div>
        </header>
        <section class="role-content-section">
          <div class="container role-content">
            ${role.summary ? `<p class="role-summary">${escapeHtml(role.summary)}</p>` : ''}
            <div class="role-rich-text">${previewDescriptionHtml(index)}</div>
          </div>
        </section>
      </article>`;

    main.querySelector('.back-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      activePreviewIndex = null;
      frame.src = '/careers/';
    });
  };

  const openRolePreview = (index) => {
    const hasForm = Boolean(document.querySelector(`[data-description="${index}"]`));
    if (hasForm) {
      renderRolePreview(index);
      return;
    }

    const rolesButton = document.querySelector('[data-section="roles"]');
    if (!rolesButton) return;
    rolesButton.click();
    setTimeout(() => {
      enhanceAll();
      const frame = document.getElementById('careers-preview');
      if (!frame) return;
      const show = () => setTimeout(() => renderRolePreview(index, frame), 180);
      if (frame.contentDocument?.readyState === 'complete') show();
      else frame.addEventListener('load', show, { once: true });
    }, 80);
  };

  const wirePreviewFrame = (frame) => {
    if (!frame || frame.dataset.richPreviewWired === 'true') return;
    frame.dataset.richPreviewWired = 'true';

    const wireDocument = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.documentElement.dataset.mtsRolePreviewWired === 'true') return;
        doc.documentElement.dataset.mtsRolePreviewWired = 'true';
        doc.addEventListener('click', (event) => {
          const link = event.target.closest?.('.role-link');
          if (!link) return;
          const links = [...doc.querySelectorAll('.role-link')];
          const index = links.indexOf(link);
          if (index < 0) return;
          event.preventDefault();
          event.stopPropagation();
          openRolePreview(index);
        }, true);
      } catch (_) {}
    };

    frame.addEventListener('load', () => setTimeout(wireDocument, 100));
    setTimeout(wireDocument, 120);
  };

  const addPreviewButtons = () => {
    document.querySelectorAll('.careers-role-actions').forEach((actions) => {
      if (actions.querySelector('.mts-preview-role')) return;
      const deleteButton = actions.querySelector('[data-delete-role]');
      const index = Number(deleteButton?.dataset.index);
      if (!Number.isFinite(index)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mts-preview-role';
      button.textContent = 'Preview full role';
      button.addEventListener('click', () => openRolePreview(index));
      actions.append(button);
    });
  };

  const cacheVisibleRoles = () => {
    document.querySelectorAll('[data-description]').forEach((textarea) => {
      const index = Number(textarea.dataset.description);
      if (Number.isFinite(index)) readRoleFromForm(index);
    });
  };

  const enhanceAll = () => {
    ensureStyles();
    document.querySelectorAll('[data-description]').forEach(enhanceDescription);
    addPreviewButtons();
    cacheVisibleRoles();
    wirePreviewFrame(document.getElementById('careers-preview'));
  };

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-bind^="roles."]');
    if (!input) return;
    const match = input.dataset.bind?.match(/^roles\.(\d+)\./);
    if (!match) return;
    const index = Number(match[1]);
    readRoleFromForm(index);
    if (activePreviewIndex === index) renderRolePreview(index);
  }, true);

  new MutationObserver(() => requestAnimationFrame(enhanceAll)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', enhanceAll);
  enhanceAll();
})();
