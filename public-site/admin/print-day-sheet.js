/* BLOOMING_PRINT_DAY_SHEET_V15 */
(() => {
  'use strict';
  if (window.__BL_PRINT_DAY_SHEET_V15__) return;
  window.__BL_PRINT_DAY_SHEET_V15__ = true;

  let appointments = [];
  const nativeFetch = window.fetch.bind(window);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const readableStatus = value => String(value || 'REQUESTED')
    .trim().toUpperCase().replaceAll('_', ' ');

  function formatPhone(value) {
    let number = String(value || '').replace(/\D/g, '');
    if (number.length === 11 && number.startsWith('1')) number = number.slice(1);
    return number.length === 10
      ? `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
      : String(value || '—');
  }

  function operationalDate(item) {
    return item.confirmedDate || item.proposedDate || item.preferredDate || item.date || '';
  }

  function operationalTime(item) {
    return item.confirmedTime || item.proposedTime || item.preferredTime || item.time || '';
  }

  function selectedText(selector, fallback) {
    const element = document.querySelector(selector);
    if (!element) return fallback;
    if (element.tagName === 'SELECT') return element.options[element.selectedIndex]?.text || fallback;
    return element.value || fallback;
  }

  function visibleAppointmentIds() {
    return [...document.querySelectorAll('.card[data-id]')]
      .filter(card => {
        const style = getComputedStyle(card);
        return !card.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map(card => String(card.dataset.id));
  }

  function filterDescription() {
    return [
      `Status: ${selectedText('#filter, #status-filter', 'All statuses')}`,
      `Source: ${selectedText('#source-filter-v6', 'All sources')}`,
      `Date range: ${selectedText('#date-range-v10, #date-range-v9', 'Current view')}`,
      `Search: ${selectedText('#search', 'None') || 'None'}`
    ].join(' | ');
  }

  function row(item) {
    return `<tr>
      <td class="datetime"><strong>${escapeHtml(operationalDate(item) || 'Date not set')}</strong><br>${escapeHtml(operationalTime(item) || 'Time not set')}</td>
      <td><strong>${escapeHtml(item.customerName || item.name || 'Customer')}</strong><br><span>${escapeHtml(formatPhone(item.phone))}</span></td>
      <td>${escapeHtml(item.service || '—')}<br><span>Therapist: ${escapeHtml(item.therapist || 'No preference')}</span><br><span>Length: ${escapeHtml(item.sessionLength || item.length || '—')}</span></td>
      <td><span class="source">${escapeHtml(item.bookingSource || 'WEB')}</span></td>
      <td><span class="status">${escapeHtml(readableStatus(item.status))}</span></td>
      <td class="notes">${escapeHtml(item.notes || '—')}</td>
    </tr>`;
  }

  function printDaySheet() {
    const ids = new Set(visibleAppointmentIds());
    const visible = appointments
      .filter(item => ids.has(String(item.appointmentId)))
      .sort((left, right) => `${operationalDate(left)}T${operationalTime(left)}`.localeCompare(`${operationalDate(right)}T${operationalTime(right)}`));

    if (!visible.length) {
      alert('No visible appointments are available to print. Change the filters or select All dates.');
      return;
    }

    // Open synchronously from the click event so mobile browsers do not block it.
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      alert('The print window was blocked. Allow pop-ups for this site and try again.');
      return;
    }

    const generated = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date());

    const documentHtml = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blooming Lotus Front-Desk Schedule</title>
<style>
  @page { size: Letter portrait; margin: 0.45in; }
  * { box-sizing: border-box; }
  body { margin:0; color:#2f241f; font:10.5pt Arial, sans-serif; }
  header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; padding-bottom:12px; border-bottom:3px solid #5b163f; }
  h1 { margin:0; color:#5b163f; font:700 24pt Georgia, serif; }
  h2 { margin:4px 0 0; font-size:12pt; }
  .meta { text-align:right; color:#665247; font-size:9pt; }
  .filters { margin:10px 0 12px; padding:8px 10px; border:1px solid #ddd0c5; background:#faf7f2; font-size:8.5pt; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th { padding:7px 6px; background:#5b163f; color:#fff; text-align:left; font-size:8.5pt; }
  td { padding:8px 6px; border:1px solid #ddd0c5; vertical-align:top; overflow-wrap:anywhere; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  tbody tr:nth-child(even) { background:#fcfaf7; }
  td span { color:#665247; font-size:8.5pt; }
  .datetime { width:14%; } th:nth-child(1){width:14%} th:nth-child(2){width:18%} th:nth-child(3){width:25%} th:nth-child(4){width:9%} th:nth-child(5){width:14%} th:nth-child(6){width:20%}
  .status,.source { display:inline-block; padding:3px 6px; border-radius:999px; background:#fff1c9; color:#704d00; font-weight:700; }
  .notes { white-space:pre-wrap; }
  footer { margin-top:12px; display:flex; justify-content:space-between; color:#76675f; font-size:8pt; }
  .screen-actions { margin:15px 0; text-align:right; }
  .screen-actions button { padding:10px 16px; border:0; border-radius:8px; background:#c42e72; color:#fff; font-weight:700; cursor:pointer; }
  @media print { .screen-actions { display:none; } }
</style></head><body>
<header><div><h1>Blooming Lotus</h1><h2>Internal Front-Desk Schedule</h2></div><div class="meta">Generated: ${escapeHtml(generated)}<br>Appointments: ${visible.length}</div></header>
<div class="filters">${escapeHtml(filterDescription())}</div>
<div class="screen-actions"><button onclick="window.print()">Print Schedule</button></div>
<table aria-label="Filtered appointment schedule"><thead><tr><th>Date / Time</th><th>Customer</th><th>Service</th><th>Source</th><th>Status</th><th>Special Request</th></tr></thead><tbody>${visible.map(row).join('')}</tbody></table>
<footer><span>Internal scheduling document</span><span>Private front-desk notes intentionally excluded</span></footer>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script>
</body></html>`;

    printWindow.document.open();
    printWindow.document.write(documentHtml);
    printWindow.document.close();
  }

  function connectPrintButton() {
    const button = [...document.querySelectorAll('button')]
      .find(item => /^print$/i.test(item.textContent.trim()) || item.id === 'export-button');
    if (!button || button.dataset.printDaySheetV15 === '1') return;
    button.dataset.printDaySheetV15 = '1';
    button.textContent = 'Print Day Sheet';
    button.type = 'button';
    // Capture phase prevents older click handlers from also invoking window.print().
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      printDaySheet();
    }, true);
  }

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
      console.warn('Print day sheet could not inspect the appointment response.', error);
    }
    return response;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectPrintButton, { once: true });
  } else {
    connectPrintButton();
  }
  new MutationObserver(connectPrintButton).observe(document.documentElement, { childList:true, subtree:true });
})();
