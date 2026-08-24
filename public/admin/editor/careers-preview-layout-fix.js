(() => {
  'use strict';

  const apply = (frame) => {
    try {
      const doc = frame?.contentDocument;
      if (!doc || doc.getElementById('mts-careers-role-layout-fix')) return;
      const style = doc.createElement('style');
      style.id = 'mts-careers-role-layout-fix';
      style.textContent = `
        .mts-draft-role{width:100%!important;overflow-x:hidden!important}
        .mts-draft-role .role-hero-inner,
        .mts-draft-role .role-content{
          width:100%!important;
          max-width:none!important;
          margin-inline:0!important;
          padding-inline:0!important;
        }
        .mts-draft-role .role-content-section{padding:clamp(.75rem,1.2vw,1.25rem) 0 clamp(5.5rem,9vw,9rem)!important}
        .mts-draft-role .role-rich-text h2:first-child,
        .mts-draft-role .role-rich-text h3:first-child{margin-top:0!important}
        @media(max-width:760px){
          .mts-draft-role .role-hero-inner{padding-block:3.25rem 3.75rem!important}
          .mts-draft-role .back-link{margin-bottom:2.25rem!important}
          .mts-draft-role h1{font-size:clamp(2.35rem,11vw,3.5rem)!important;line-height:1.04!important}
          .mts-draft-role .role-content-section{padding-top:.75rem!important;padding-bottom:4.5rem!important}
          .mts-draft-role .role-rich-text p,
          .mts-draft-role .role-rich-text li{font-size:1rem!important;line-height:1.7!important}
          .mts-draft-role .role-rich-text h2{font-size:clamp(1.45rem,7vw,1.9rem)!important}
          .mts-draft-role .role-rich-text h3{font-size:clamp(1.2rem,5.5vw,1.45rem)!important}
        }
      `;
      doc.head.append(style);
    } catch (_) {}
  };

  const wire = () => {
    const frame = document.getElementById('careers-preview');
    if (!frame || frame.dataset.layoutFixWired === 'true') return;
    frame.dataset.layoutFixWired = 'true';
    frame.addEventListener('load', () => setTimeout(() => apply(frame), 80));
    setTimeout(() => apply(frame), 100);
  };

  new MutationObserver(() => requestAnimationFrame(wire)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', wire);
  wire();
})();
