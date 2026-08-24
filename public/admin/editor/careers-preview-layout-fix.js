(() => {
  'use strict';

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const openRolePreviewFallback = (index, frame) => {
    let attempts = 0;

    const tryOpen = () => {
      try {
        const currentDoc = frame?.contentDocument;
        if (currentDoc?.querySelector('.mts-draft-role')) {
          patchPreview(frame);
          return;
        }
      } catch (_) {}

      const buttons = [...document.querySelectorAll('.mts-preview-role')];
      if (buttons[index]) {
        buttons[index].click();
        return;
      }

      const rolesButton = document.querySelector('[data-section="roles"]');
      if (rolesButton && !rolesButton.classList.contains('active')) {
        rolesButton.click();
      }

      attempts += 1;
      if (attempts < 24) setTimeout(tryOpen, 100);
    };

    setTimeout(tryOpen, 250);
  };

  const wireRoleLinks = (frame, doc) => {
    doc.querySelectorAll('.role-link').forEach((link, index) => {
      if (link.dataset.editorRolePreviewWired === 'true') return;
      link.dataset.editorRolePreviewWired = 'true';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRolePreviewFallback(index, frame);
      });
    });
  };

  const previewControl = (field) => {
    if (field.type === 'textarea') return '<textarea disabled></textarea>';
    if (field.type === 'file') return '<input type="file" disabled>';
    return `<input type="${field.type === 'email' ? 'email' : 'text'}" disabled>`;
  };

  const patchConfigurableForm = (role, doc) => {
    const config = window.__MTS_CAREERS_APPLICATION_FORM__;
    if (!config || !Array.isArray(config.fields)) return;

    const heading = role.querySelector('.application-heading');
    if (heading) {
      const eyebrow = heading.querySelector('.eyebrow');
      const title = heading.querySelector('h2');
      const copy = heading.querySelector('p:last-child');
      if (eyebrow) eyebrow.textContent = config.eyebrow || '';
      if (title) title.textContent = config.title || 'Submit your application';
      if (copy) {
        copy.textContent = config.intro || '';
        copy.style.display = config.intro ? '' : 'none';
      }
    }

    const form = role.querySelector('.application-form');
    const formGrid = form?.querySelector('.form-grid');
    if (!formGrid) return;

    const signature = JSON.stringify(config);
    if (formGrid.dataset.applicationFormSignature === signature) return;
    formGrid.dataset.applicationFormSignature = signature;
    form?.setAttribute('data-configurable-careers-form', 'true');

    const fieldsHtml = config.fields.map((field) => {
      const label = escapeHtml(field.label || 'Field');
      const required = field.required ? '*' : '';
      const help = field.help
        ? `<span class="field-note">${escapeHtml(field.help)}</span>`
        : '';
      return `<label class="full form-field${field.type === 'file' ? ' file-field' : ''}"><span class="field-label">${label}${required}</span>${previewControl(field)}${help}</label>`;
    }).join('');

    formGrid.innerHTML = `${fieldsHtml}
      <span class="preview-form-note">Security check appears here on the live page.</span>
      <button class="preview-submit" type="button" disabled>${escapeHtml(config.submitLabel || 'Submit application')}</button>
      <span class="preview-form-note">Preview only — applications are not sent from the editor.</span>`;
  };

  const patchPreview = (frame) => {
    try {
      const doc = frame?.contentDocument;
      if (!doc) return;

      wireRoleLinks(frame, doc);

      if (!doc.getElementById('mts-careers-role-layout-fix')) {
        const style = doc.createElement('style');
        style.id = 'mts-careers-role-layout-fix';
        style.textContent = `
          .mts-draft-role{width:100%!important;overflow-x:hidden!important}
          .mts-draft-role .role-hero-inner{max-width:1380px!important}
          .mts-draft-role h1{font-size:clamp(2.25rem,3.6vw,3.9rem)!important;line-height:1.06!important}
          .mts-draft-role .role-content{max-width:1120px!important}
          .mts-draft-role .role-summary,
          .mts-draft-role .role-rich-text{max-width:860px!important}
          .mts-draft-role .role-content-section{padding:clamp(3.6rem,6vw,5.5rem) 0 clamp(5.5rem,9vw,9rem)!important}
          .mts-draft-role .role-rich-text{font-size:16.5px!important;line-height:1.45!important}
          .mts-draft-role .role-rich-text p{margin:0 0 1rem!important;line-height:1.45!important}
          .mts-draft-role .role-rich-text ul,
          .mts-draft-role .role-rich-text ol{gap:.35rem!important;margin-bottom:1rem!important}
          .mts-draft-role .role-rich-text li{line-height:1.45!important}
          .mts-draft-role .role-rich-text h2{margin:2.2rem 0 .8rem!important}
          .mts-draft-role .role-rich-text h3{margin:1.75rem 0 .65rem!important}
          .mts-draft-role .role-rich-text h2:first-child,
          .mts-draft-role .role-rich-text h3:first-child{margin-top:0!important}
          .mts-draft-role .field-note{color:#66707c;font-size:13px;font-weight:400;letter-spacing:0;line-height:1.5;text-transform:none}
          .mts-draft-role .field-label{display:block}
          .mts-draft-role .form-field textarea{min-height:96px!important}
          @media(max-width:760px){
            .mts-draft-role .role-hero-inner{padding-block:3.25rem 3.75rem!important}
            .mts-draft-role .back-link{margin-bottom:1.75rem!important}
            .mts-draft-role h1{font-size:clamp(2rem,8vw,2.75rem)!important;line-height:1.06!important}
            .mts-draft-role .role-content-section{padding-top:3rem!important;padding-bottom:4.5rem!important}
            .mts-draft-role .role-rich-text{font-size:16px!important;line-height:1.45!important}
            .mts-draft-role .role-rich-text h2{font-size:clamp(1.45rem,7vw,1.9rem)!important}
            .mts-draft-role .role-rich-text h3{font-size:clamp(1.2rem,5.5vw,1.45rem)!important}
          }
        `;
        doc.head.append(style);
      }

      const role = doc.querySelector('.mts-draft-role');
      if (!role) return;
      patchConfigurableForm(role, doc);
    } catch (_) {}
  };

  const watchFrameDocument = (frame) => {
    try {
      const doc = frame?.contentDocument;
      if (!doc?.documentElement) return;
      patchPreview(frame);

      if (doc.documentElement.dataset.careersLayoutWatch === 'true') return;
      doc.documentElement.dataset.careersLayoutWatch = 'true';

      new MutationObserver(() => patchPreview(frame)).observe(doc.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (_) {}
  };

  const wire = () => {
    const frame = document.getElementById('careers-preview');
    if (!frame || frame.dataset.layoutFixWired === 'true') return;
    frame.dataset.layoutFixWired = 'true';
    frame.addEventListener('load', () => setTimeout(() => watchFrameDocument(frame), 80));
    setTimeout(() => watchFrameDocument(frame), 100);
  };

  document.addEventListener('mts:preview-career-role', (event) => {
    const frame = document.getElementById('careers-preview');
    if (!frame) return;
    const index = Number(event.detail?.index ?? 0);
    try {
      if (frame.contentDocument?.querySelector('.mts-draft-role')) {
        patchPreview(frame);
        return;
      }
    } catch (_) {}
    openRolePreviewFallback(Number.isFinite(index) ? index : 0, frame);
  });

  new MutationObserver(() => requestAnimationFrame(wire)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', wire);
  wire();
})();