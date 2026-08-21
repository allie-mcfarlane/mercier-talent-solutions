(() => {
  'use strict';

  let refreshTimer = null;

  const triggerDirectCanvasRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const marker = document.createElement('span');
      marker.hidden = true;
      marker.dataset.mtsDirectRefresh = 'true';
      document.body.append(marker);
      marker.remove();
    }, 240);
  };

  const toolbarControl = (target) => {
    if (!target?.closest) return null;
    const toolbar = target.closest('.mts-selection-toolbar');
    if (!toolbar) return null;
    return target.closest('input,select,button');
  };

  const wireFrame = (doc) => {
    if (!doc?.documentElement || doc.documentElement.dataset.mtsToolbarControlsFix === 'true') return;
    doc.documentElement.dataset.mtsToolbarControlsFix = 'true';

    // The preview runs in its own browser realm. direct-canvas.js intentionally
    // blocks normal page clicks while text is selected, but its original
    // cross-frame Element check also catches toolbar clicks. Clear only the
    // browser selection before a toolbar control is used; the editor has already
    // stored the selected character offsets, so formatting still targets the
    // correct words.
    doc.addEventListener('pointerdown', (event) => {
      const control = toolbarControl(event.target);
      if (!control) return;
      doc.getSelection()?.removeAllRanges();
      delete doc.documentElement.dataset.mtsTextSelection;
    }, true);

    const scheduleRefresh = (event) => {
      const control = toolbarControl(event.target);
      if (!control) return;
      if (control.matches('[data-inline-color],[data-inline-size],[data-inline-clear]')) {
        triggerDirectCanvasRefresh();
      }
    };

    doc.addEventListener('input', scheduleRefresh, true);
    doc.addEventListener('change', scheduleRefresh, true);
    doc.addEventListener('click', scheduleRefresh, true);
  };

  const wire = () => {
    const frame = document.getElementById('ve-preview');
    if (!frame) return;
    if (frame.contentDocument?.readyState !== 'loading') wireFrame(frame.contentDocument);
    if (!frame.dataset.mtsToolbarFixLoadWired) {
      frame.dataset.mtsToolbarFixLoadWired = 'true';
      frame.addEventListener('load', () => setTimeout(() => wireFrame(frame.contentDocument), 100));
    }
  };

  new MutationObserver(wire).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(wire, 50));
  window.addEventListener('load', wire);
  wire();
})();
