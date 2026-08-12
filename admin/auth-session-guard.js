/* BLOOMING_AUTH_SESSION_GUARD_V17 */
(() => {
  'use strict';
  if (window.__BL_AUTH_SESSION_GUARD_V17__) return;
  window.__BL_AUTH_SESSION_GUARD_V17__ = true;

  const TOKEN_KEY = 'bl_access';
  const nativeFetch = window.fetch.bind(window);

  function decodePayload(token) {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      return JSON.parse(atob(padded));
    } catch (_) {
      return null;
    }
  }

  function tokenIsUsable(token) {
    if (!token) return false;
    const payload = decodePayload(token);
    if (!payload || !Number.isFinite(Number(payload.exp))) return false;
    // Treat tokens expiring within 30 seconds as expired.
    return Number(payload.exp) > Math.floor(Date.now() / 1000) + 30;
  }

  function clearExpiredSession() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token && !tokenIsUsable(token)) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('bl_verifier');
      sessionStorage.removeItem('bl_id');
      document.documentElement.dataset.frontDeskAuth = 'signed-out';
      return true;
    }
    return false;
  }

  function redirectToSignedOutPage() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('bl_verifier');
    sessionStorage.removeItem('bl_id');
    const cleanUrl = location.origin + '/admin';
    if (location.href !== cleanUrl) location.replace(cleanUrl);
    else location.reload();
  }

  // Run before the dashboard's main script reads sessionStorage.
  clearExpiredSession();

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const requestUrl = String(args[0] || '');
    const isAdminApi = requestUrl.includes('/admin/appointments');

    if (isAdminApi && (response.status === 401 || response.status === 403)) {
      redirectToSignedOutPage();
      // Stop the old dashboard promise chain so it cannot show an Unauthorized alert.
      return new Promise(() => {});
    }
    return response;
  };

  window.addEventListener('pageshow', clearExpiredSession);
})();
