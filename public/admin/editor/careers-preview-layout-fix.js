(() => {
  'use strict';

  const patchPreview = (frame) => {
    try {
      const doc = frame?.contentDocument;
      if (!doc) return;

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
          .mts-draft-role [data-preview-guided-field] textarea{min-height:96px!important}
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

      const applicationCopy = role.querySelector('.application-heading > p:last-child');
      if (applicationCopy) {
        applicationCopy.textContent = 'Tell us a little about your background, experience and availability, then attach your resume or professional biography. Additional materials are optional.';
      }

      const formGrid = role.querySelector('.application-form .form-grid');
      if (!formGrid) return;

      const labels = [...formGrid.querySelectorAll('label')];
      const resumeLabel = labels.find((label) => label.textContent?.includes('RESUME'));
      const messageLabel = labels.find((label) => label.textContent?.trim().startsWith('MESSAGE'));

      if (messageLabel && messageLabel.dataset.previewAdditionalNotes !== 'true') {
        const textNode = [...messageLabel.childNodes]
          .find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim());
        if (textNode) textNode.nodeValue = "ANYTHING ELSE YOU'D LIKE US TO KNOW (OPTIONAL)";
        messageLabel.dataset.previewAdditionalNotes = 'true';
      }

      if (messageLabel && !formGrid.querySelector('[data-preview-guided-fields]')) {
        const createField = (labelText, kind = 'textarea', note = '', marker = '') => {
          const label = doc.createElement('label');
          label.dataset.previewGuidedField = 'true';
          if (marker) label.dataset.previewGuidedFields = marker;

          const control = doc.createElement(kind === 'input' ? 'input' : 'textarea');
          control.disabled = true;
          if (kind === 'input') control.type = 'text';

          label.append(doc.createTextNode(labelText));
          label.append(control);

          if (note) {
            const help = doc.createElement('span');
            help.className = 'field-note';
            help.textContent = note;
            label.append(help);
          }

          return label;
        };

        const guidedFields = [
          createField('LOCATION (OPTIONAL)', 'input', '', 'true'),
          createField(
            'RELEVANT LEGAL & COACHING EXPERIENCE*',
            'textarea',
            'Briefly summarize your legal practice background and experience coaching partners or senior leaders.',
          ),
          createField(
            'PROGRAMS & LEADERSHIP DEVELOPMENT EXPERIENCE (OPTIONAL)',
            'textarea',
            'You may include training programs, workshops, retreats or other leadership-development work you have designed or led.',
          ),
          createField(
            'COACHING CREDENTIALS & EDUCATION*',
            'textarea',
            'Include relevant coach training, credentials, education and assessment certifications.',
          ),
          createField(
            'WHY MERCIER TALENT SOLUTIONS? (OPTIONAL)',
            'textarea',
            'Tell us briefly what interests you about becoming involved with the firm.',
          ),
          createField(
            'AVAILABILITY & PREFERRED PROFESSIONAL ARRANGEMENT (OPTIONAL)',
            'textarea',
            'Share your general availability and the types of professional arrangements you would be open to considering.',
          ),
        ];

        guidedFields.forEach((field) => messageLabel.before(field));
      }

      if (resumeLabel && resumeLabel.dataset.previewResumeUpdated !== 'true') {
        const textNode = [...resumeLabel.childNodes]
          .find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim());
        if (textNode) textNode.nodeValue = 'RESUME OR PROFESSIONAL BIOGRAPHY*';
        resumeLabel.dataset.previewResumeUpdated = 'true';
      }

      if (resumeLabel && !formGrid.querySelector('[data-preview-additional-materials]')) {
        const label = doc.createElement('label');
        label.dataset.previewAdditionalMaterials = 'true';
        label.innerHTML = 'ADDITIONAL MATERIALS (OPTIONAL)<input type="file" disabled><span class="file-note">Optional: attach one PDF or Word document with any additional information you would like us to consider.</span>';
        resumeLabel.after(label);
      }
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

  new MutationObserver(() => requestAnimationFrame(wire)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', wire);
  wire();
})();
