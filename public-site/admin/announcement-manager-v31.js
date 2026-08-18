/* BLOOMING_ANNOUNCEMENT_MANAGER_V31 */
(() => {
  'use strict';
  if (window.__BL_ANNOUNCEMENT_MANAGER_V31__) return;
  window.__BL_ANNOUNCEMENT_MANAGER_V31__ = true;

  let apiBase = '';
  let announcements = [];
  let selectedId = '';

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[character]);

  function accessToken() {
    return sessionStorage.getItem('bl_access') || '';
  }

  async function discoverApi() {
    if (apiBase) return apiBase;
    const source = await fetch('/announcements-v29.js?v=29', { cache:'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Announcement configuration is unavailable.');
        return response.text();
      });
    const match = source.match(/const API=(["'])(.*?)\1/);
    if (!match) throw new Error('Announcement API URL could not be discovered.');
    apiBase = match[2];
    return apiBase;
  }

  async function request(path = '', options = {}) {
    const api = await discoverApi();
    const response = await fetch(api + '/admin/announcements' + path, {
      ...options,
      headers: {
        authorization: 'Bearer ' + accessToken(),
        'content-type': 'application/json',
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Your front-desk session has expired. Sign in again.');
      }
      throw new Error(data.message || `Request failed: ${response.status}`);
    }
    return data;
  }

  function formatDate(value) {
    if (!value) return 'Not set';
    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnly
      ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])
      : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle:'medium',
      ...(dateOnly ? {} : { timeStyle:'short' })
    }).format(date);
  }

  function statusClass(status) {
    return 'ann-status-v31 ann-status-' + String(status || 'DRAFT').toLowerCase();
  }

  function filteredAnnouncements() {
    const status = byId('ann-status-filter-v31')?.value || '';
    return announcements.filter(item => !status || item.status === status);
  }

  function renderList() {
    const list = byId('ann-list-v31');
    if (!list) return;
    const items = filteredAnnouncements();
    list.innerHTML = items.map(item => `
      <button type="button" class="ann-row-v31 ${item.announcementId === selectedId ? 'selected' : ''}"
        data-announcement-id="${escapeHtml(item.announcementId)}">
        <span class="ann-row-main-v31">
          <strong>${escapeHtml(item.title || 'Untitled announcement')}</strong>
          <small>${escapeHtml(item.type || 'INFO')} · ${escapeHtml(item.announcementId)}</small>
        </span>
        <span class="${statusClass(item.status)}">${escapeHtml(item.status || 'DRAFT')}</span>
      </button>`).join('') || '<div class="ann-empty-v31">No announcements match this filter.</div>';

    list.querySelectorAll('[data-announcement-id]').forEach(button => {
      button.addEventListener('click', () => selectAnnouncement(button.dataset.announcementId));
    });
  }

  function selectedAnnouncement() {
    return announcements.find(item => item.announcementId === selectedId) || null;
  }

  function renderDetails() {
    const details = byId('ann-details-v31');
    const item = selectedAnnouncement();
    if (!details) return;
    if (!item) {
      details.innerHTML = '<div class="ann-empty-v31">Select an announcement to view its details.</div>';
      return;
    }

    const closure = item.closureStartDate
      ? `${formatDate(item.closureStartDate)} through ${formatDate(item.closureEndDate)}`
      : 'No closure dates';

    details.innerHTML = `
      <div class="ann-detail-heading-v31">
        <div>
          <span class="${statusClass(item.status)}">${escapeHtml(item.status)}</span>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
      </div>
      <dl class="ann-detail-grid-v31">
        <dt>ID</dt><dd>${escapeHtml(item.announcementId)}</dd>
        <dt>Type</dt><dd>${escapeHtml(item.type || 'INFO')}</dd>
        <dt>Message</dt><dd class="ann-message-v31">${escapeHtml(item.message || '')}</dd>
        <dt>Display from</dt><dd>${escapeHtml(formatDate(item.displayFrom))}</dd>
        <dt>Display until</dt><dd>${escapeHtml(formatDate(item.displayUntil))}</dd>
        <dt>Closure</dt><dd>${escapeHtml(closure)}</dd>
        <dt>Blocks dates</dt><dd>${item.blockAppointmentDates ? 'Yes' : 'No'}</dd>
        <dt>Updated</dt><dd>${escapeHtml(formatDate(item.updatedAt))}</dd>
      </dl>
      <div class="ann-detail-actions-v31">
        ${item.status === 'PUBLISHED'
          ? '<button type="button" id="ann-archive-v31" class="ann-danger-v31">Unpublish and Archive</button>'
          : '<button type="button" id="ann-publish-v31" class="ann-primary-v31">Publish Announcement</button>'}
        ${item.status !== 'ARCHIVED'
          ? '<button type="button" id="ann-archive-only-v31" class="ann-secondary-v31">Archive</button>'
          : ''}
      </div>
      <div id="ann-action-result-v31" class="ann-action-result-v31" aria-live="polite"></div>`;

    byId('ann-archive-v31')?.addEventListener('click', () => archiveSelected(true));
    byId('ann-archive-only-v31')?.addEventListener('click', () => archiveSelected(false));
    byId('ann-publish-v31')?.addEventListener('click', publishSelected);
  }

  function selectAnnouncement(id) {
    selectedId = id;
    renderList();
    renderDetails();
  }

  async function updateStatus(item, status) {
    const body = {
      ...item,
      status
    };
    delete body.activeClosure;
    const data = await request('/' + encodeURIComponent(item.announcementId), {
      method:'PATCH',
      body:JSON.stringify(body)
    });
    const index = announcements.findIndex(value => value.announcementId === item.announcementId);
    if (index >= 0) announcements[index] = data.announcement;
    return data.announcement;
  }

  async function archiveSelected(unpublishMessage) {
    const item = selectedAnnouncement();
    if (!item) return;
    const message = unpublishMessage
      ? `Unpublish and archive “${item.title}”?\n\nThe public banner will disappear and its closure dates will stop blocking new appointments.`
      : `Archive “${item.title}”?`;
    if (!window.confirm(message)) return;

    const result = byId('ann-action-result-v31');
    try {
      if (result) result.textContent = 'Archiving announcement…';
      await updateStatus(item, 'ARCHIVED');
      if (result) result.textContent = 'Announcement archived successfully.';
      renderList();
      renderDetails();
      window.dispatchEvent(new CustomEvent('blooming-announcements-changed'));
    } catch (error) {
      if (result) result.textContent = 'Archive failed: ' + error.message;
    }
  }

  async function publishSelected() {
    const item = selectedAnnouncement();
    if (!item) return;
    if (!window.confirm(`Publish “${item.title}”?`)) return;
    const result = byId('ann-action-result-v31');
    try {
      if (result) result.textContent = 'Publishing announcement…';
      await updateStatus(item, 'PUBLISHED');
      if (result) result.textContent = 'Announcement published successfully.';
      renderList();
      renderDetails();
      window.dispatchEvent(new CustomEvent('blooming-announcements-changed'));
    } catch (error) {
      if (result) result.textContent = 'Publish failed: ' + error.message;
    }
  }

  async function loadAnnouncements() {
    const data = await request();
    announcements = data.announcements || [];
    if (selectedId && !selectedAnnouncement()) selectedId = '';
    renderList();
    renderDetails();
  }

  function closeManager() {
    byId('announcement-manager-v31')?.remove();
  }

  async function openManager() {
    if (!accessToken()) {
      alert('Sign in to manage announcements.');
      return;
    }
    byId('announcement-manager-v31')?.remove();
    const modal = document.createElement('div');
    modal.id = 'announcement-manager-v31';
    modal.className = 'ann-manager-backdrop-v31';
    modal.innerHTML = `
      <section class="ann-manager-v31" role="dialog" aria-modal="true"
        aria-labelledby="ann-manager-title-v31">
        <header class="ann-manager-header-v31">
          <div>
            <p>Business communications</p>
            <h2 id="ann-manager-title-v31">Announcement Manager</h2>
          </div>
          <button type="button" id="ann-manager-close-v31" aria-label="Close announcement manager">×</button>
        </header>
        <div class="ann-manager-tools-v31">
          <label for="ann-status-filter-v31">Show</label>
          <select id="ann-status-filter-v31">
            <option value="">All announcements</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button type="button" id="ann-manager-refresh-v31">Refresh</button>
        </div>
        <div class="ann-manager-body-v31">
          <div id="ann-list-v31" class="ann-list-v31"><div class="ann-empty-v31">Loading announcements…</div></div>
          <div id="ann-details-v31" class="ann-details-v31"><div class="ann-empty-v31">Select an announcement.</div></div>
        </div>
      </section>`;
    document.body.appendChild(modal);

    byId('ann-manager-close-v31').addEventListener('click', closeManager);
    byId('ann-manager-refresh-v31').addEventListener('click', () => loadAnnouncements().catch(showLoadError));
    byId('ann-status-filter-v31').addEventListener('change', renderList);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeManager();
    });

    selectedId = '';
    try {
      await loadAnnouncements();
    } catch (error) {
      showLoadError(error);
    }
  }

  function showLoadError(error) {
    const list = byId('ann-list-v31');
    if (list) list.innerHTML = '<div class="ann-empty-v31">Unable to load announcements: ' + escapeHtml(error.message) + '</div>';
  }

  function installManagerButton() {
    if (byId('manage-announcements-v31')) return;
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    const existingCreate = byId('announcements-v29');
    const button = document.createElement('button');
    button.id = 'manage-announcements-v31';
    button.type = 'button';
    button.className = 'ann-manager-button-v31';
    button.textContent = 'Manage Announcements';
    button.addEventListener('click', openManager);

    if (existingCreate) existingCreate.insertAdjacentElement('afterend', button);
    else toolbar.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installManagerButton, { once:true });
  } else installManagerButton();

  new MutationObserver(installManagerButton).observe(document.documentElement, {
    childList:true,
    subtree:true
  });
})();
