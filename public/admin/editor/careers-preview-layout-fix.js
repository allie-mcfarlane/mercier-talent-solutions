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
          @media(max-width:760px){
            .mts-draft-role .role-hero-inner{padding-block:3.25rem 3.75rem!important}
            .mts-draft-role .back-link{margin-bottom:1.75rem!important}
            .mts-draft-role h1{font-size:clamp(2.35rem,11vw,3.5rem)!important;line-height:1.04!important}
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
        applicationCopy.textContent = 'Send us your details and attach your resume or professional biography. You may also include one optional PDF or Word document with additional materials.';
      }

      const formGrid = role.querySelector('.application-form .form-grid');
      if (!formGrid) return;

      const resumeLabel = [...formGrid.querySelectorAll('label')]
        .find((label) => label.textContent?.includes('RESUME'));

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
