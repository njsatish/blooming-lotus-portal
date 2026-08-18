/* BLOOMING_STATUS_PILLS_V13 */
(() => {
  'use strict';
  if (window.__BL_STATUS_PILLS_V13__) return;
  window.__BL_STATUS_PILLS_V13__ = true;

  const KNOWN_STATUSES = new Set([
    'REQUESTED',
    'CONTACTED',
    'CONFIRMED',
    'RESCHEDULE_NEEDED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW'
  ]);

  function normalizedStatus(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  function readableStatus(value) {
    return normalizedStatus(value).replaceAll('_', ' ');
  }

  function enhanceStatusElement(element) {
    if (!(element instanceof HTMLElement)) return;
    const status = normalizedStatus(element.textContent);
    if (!KNOWN_STATUSES.has(status)) return;

    element.textContent = readableStatus(status);
    element.dataset.statusPillV13 = status;
    element.setAttribute('aria-label', `Appointment status: ${readableStatus(status)}`);

    // Remove only non-text placeholder children from the status badge.
    element.querySelectorAll('img, svg:empty, span:empty').forEach(child => child.remove());
  }

  function enhance(root = document) {
    root.querySelectorAll?.(
      '.badge, .status, .appointment-state, [data-status], [class*="status"]'
    ).forEach(enhanceStatusElement);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhance(), { once: true });
  } else {
    enhance();
  }

  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          enhanceStatusElement(node);
          enhance(node);
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
