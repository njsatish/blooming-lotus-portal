/* BLOOMING_PRINT_DAY_SHEET_NO_POPUP_V16 */
(() => {
  'use strict';
  if (window.__BL_PRINT_V16__) return;
  window.__BL_PRINT_V16__ = true;

  let appointments = [];
  const nativeFetch = window.fetch.bind(window);
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[character]);
  const readable = value => String(value || 'REQUESTED').trim().toUpperCase().replaceAll('_', ' ');

  function phone(value) {
    let number = String(value || '').replace(/\D/g, '');
    if (number.length === 11 && number.startsWith('1')) number = number.slice(1);
    return number.length === 10
      ? `${number.slice(0,3)}-${number.slice(3,6)}-${number.slice(6)}`
      : String(value || '—');
  }
  const dateOf = item => item.confirmedDate || item.proposedDate || item.preferredDate || item.date || '';
  const timeOf = item => item.confirmedTime || item.proposedTime || item.preferredTime || item.time || '';

  function selectedText(selector, fallback) {
    const element = document.querySelector(selector);
    if (!element) return fallback;
    if (element.tagName === 'SELECT') return element.options[element.selectedIndex]?.text || fallback;
    return element.value || fallback;
  }

  function visibleIds() {
    return new Set([...document.querySelectorAll('.card[data-id]')]
      .filter(card => {
        const style = getComputedStyle(card);
        return !card.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map(card => String(card.dataset.id)));
  }

  function buildPrintSheet() {
    const ids = visibleIds();
    const visible = appointments
      .filter(item => ids.has(String(item.appointmentId)))
      .sort((a,b) => `${dateOf(a)}T${timeOf(a)}`.localeCompare(`${dateOf(b)}T${timeOf(b)}`));

    if (!visible.length) {
      alert('No visible appointments are available to print. Change the filters or select All dates.');
      return false;
    }

    let sheet = byId('print-sheet-v16');
    if (!sheet) {
      sheet = document.createElement('section');
      sheet.id = 'print-sheet-v16';
      sheet.setAttribute('aria-label', 'Printable front-desk schedule');
      document.body.appendChild(sheet);
    }

    const generated = new Intl.DateTimeFormat('en-US', {
      dateStyle:'medium', timeStyle:'short'
    }).format(new Date());
    const filters = [
      `Status: ${selectedText('#filter, #status-filter','All statuses')}`,
      `Source: ${selectedText('#source-filter-v6','All sources')}`,
      `Date range: ${selectedText('#date-range-v10, #date-range-v9','Current view')}`,
      `Search: ${selectedText('#search','None') || 'None'}`
    ].join(' | ');

    const rows = visible.map(item => `<tr>
      <td><strong>${escapeHtml(dateOf(item) || 'Date not set')}</strong><br>${escapeHtml(timeOf(item) || 'Time not set')}</td>
      <td><strong>${escapeHtml(item.customerName || item.name || 'Customer')}</strong><br>${escapeHtml(phone(item.phone))}</td>
      <td>${escapeHtml(item.service || '—')}<br><small>Therapist: ${escapeHtml(item.therapist || 'No preference')}</small><br><small>Length: ${escapeHtml(item.sessionLength || item.length || '—')}</small></td>
      <td>${escapeHtml(item.bookingSource || 'WEB')}</td>
      <td>${escapeHtml(readable(item.status))}</td>
      <td>${escapeHtml(item.notes || '—')}</td>
    </tr>`).join('');

    sheet.innerHTML = `<header><div><h1>Blooming Lotus</h1><h2>Internal Front-Desk Schedule</h2></div><div class="print-meta-v16">Generated: ${escapeHtml(generated)}<br>Appointments: ${visible.length}</div></header>
      <div class="print-filters-v16">${escapeHtml(filters)}</div>
      <table><thead><tr><th>Date / Time</th><th>Customer</th><th>Service</th><th>Source</th><th>Status</th><th>Special Request</th></tr></thead><tbody>${rows}</tbody></table>
      <footer><span>Internal scheduling document</span><span>Private front-desk notes intentionally excluded</span></footer>`;
    return true;
  }

  function printDaySheet(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    if (!buildPrintSheet()) return;
    document.documentElement.classList.add('printing-day-sheet-v16');
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  function connect() {
    const button = [...document.querySelectorAll('button')]
      .find(item => /^print(?: day sheet)?$/i.test(item.textContent.trim()) || item.id === 'export-button');
    if (!button || button.dataset.printV16 === '1') return;
    button.dataset.printV16 = '1';
    button.textContent = 'Print Day Sheet';
    button.type = 'button';
    button.addEventListener('click', printDaySheet, true);
  }

  window.addEventListener('afterprint', () => {
    document.documentElement.classList.remove('printing-day-sheet-v16');
  });

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const url = String(args[0] || '');
      const options = args[1] || {};
      if (url.endsWith('/admin/appointments') && (!options.method || options.method === 'GET')) {
        const data = await response.clone().json();
        appointments = data.appointments || [];
      }
    } catch (error) {
      console.warn('Print V16 could not inspect appointment data.', error);
    }
    return response;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect, {once:true});
  } else connect();
  new MutationObserver(connect).observe(document.documentElement,{childList:true,subtree:true});
})();
