/* BLOOMING_DETAIL_ACTION_BUTTONS_V14 */
(() => {
  'use strict';
  if (window.__BL_DETAIL_ACTIONS_V14__) return;
  window.__BL_DETAIL_ACTIONS_V14__ = true;

  const LABELS = Object.freeze({
    CONTACTED: 'Mark Contacted',
    CONFIRMED: 'Confirm Appointment',
    RESCHEDULE_NEEDED: 'Reschedule',
    CANCELLED: 'Cancel Appointment',
    COMPLETED: 'Mark Completed',
    NO_SHOW: 'Mark No Show'
  });

  const normalize = value => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  function enhanceButton(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const status = normalize(button.dataset.status || button.textContent);
    if (!LABELS[status]) return;

    button.dataset.status = status;
    button.dataset.detailActionV14 = 'true';
    button.textContent = LABELS[status];
    button.type = 'button';
    button.setAttribute('aria-label', LABELS[status]);
    button.title = button.disabled
      ? `${LABELS[status]} is not available from the current appointment status.`
      : LABELS[status];
  }

  function enhanceDetailPanel() {
    const detail = document.getElementById('detail') ||
      document.querySelector('.details-panel, [aria-label="Selected appointment details"]');
    if (!detail) return;

    const buttons = [...detail.querySelectorAll('button[data-status], .actions button')]
      .filter(button => LABELS[normalize(button.dataset.status || button.textContent)]);
    if (!buttons.length) return;

    let group = detail.querySelector('[data-detail-action-group-v14]');
    if (!group) {
      group = document.createElement('section');
      group.dataset.detailActionGroupV14 = 'true';
      group.className = 'detail-action-group-v14';
      group.setAttribute('aria-label', 'Appointment status actions');

      const heading = document.createElement('h3');
      heading.className = 'detail-action-heading-v14';
      heading.textContent = 'Appointment actions';
      group.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'detail-action-grid-v14';
      group.appendChild(grid);

      const existingContainer = buttons[0].closest('.actions');
      if (existingContainer) {
        existingContainer.insertAdjacentElement('beforebegin', group);
        existingContainer.hidden = true;
      } else {
        detail.appendChild(group);
      }
    }

    const grid = group.querySelector('.detail-action-grid-v14');
    buttons.forEach(button => {
      enhanceButton(button);
      if (button.parentElement !== grid) grid.appendChild(button);
    });

    // Current status appears selected but remains available for adding notes or
    // correcting date/time details when the underlying workflow permits it.
    buttons.forEach(button => {
      button.setAttribute('aria-disabled', String(button.disabled));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceDetailPanel, { once: true });
  } else {
    enhanceDetailPanel();
  }

  new MutationObserver(mutations => {
    if (mutations.some(mutation => [...mutation.addedNodes].some(node =>
      node instanceof Element && (node.matches?.('#detail, .actions, button[data-status]') ||
      node.querySelector?.('#detail, .actions, button[data-status]'))))) {
      requestAnimationFrame(enhanceDetailPanel);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
