/* BLOOMING_STATUS_ICON_FIX_V12 */
(() => {
  'use strict';
  if (window.__BL_STATUS_ICON_FIX_V12__) return;
  window.__BL_STATUS_ICON_FIX_V12__ = true;

  const STATUS_CONTAINER_SELECTORS = [
    '.card',
    '.appointment',
    '.appointment-state',
    '.status',
    '.badge',
    '[class*="status"]',
    '[data-status]'
  ];

  function isInsideStatusContext(image) {
    return STATUS_CONTAINER_SELECTORS.some(selector => image.closest(selector));
  }

  function hasUsableSource(image) {
    const raw = (image.getAttribute('src') || '').trim();
    return Boolean(raw && raw !== '#' && raw !== 'about:blank');
  }

  function removeIfBroken(image) {
    if (!(image instanceof HTMLImageElement) || !isInsideStatusContext(image)) return;

    // Remove empty placeholders immediately. For loaded images, remove only if
    // the browser confirms the resource has no intrinsic dimensions.
    const broken = !hasUsableSource(image) || (image.complete && image.naturalWidth === 0);
    if (broken) image.remove();
  }

  function cleanStatusArea(root = document) {
    root.querySelectorAll?.('img').forEach(removeIfBroken);
  }

  // Catch network failures without affecting valid icons or assets.
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement) removeIfBroken(event.target);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cleanStatusArea(), { once: true });
  } else {
    cleanStatusArea();
  }

  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) removeIfBroken(node);
        else if (node instanceof Element) cleanStatusArea(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
