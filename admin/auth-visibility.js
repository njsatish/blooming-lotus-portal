/* BLOOMING_FRONT_DESK_AUTH_VISIBILITY_V8 */
(() => {
  'use strict';

  function hasSession() {
    return Boolean(sessionStorage.getItem('bl_access'));
  }

  function updateAuthenticationControls() {
    const authenticated = hasSession();
    const signOut = document.getElementById('logout');
    const refresh = document.getElementById('refresh');
    const signIn = document.getElementById('signin');

    if (signOut) {
      signOut.hidden = !authenticated;
      signOut.setAttribute('aria-hidden', String(!authenticated));
    }

    // Refresh operates on protected appointment data, so hide it before login too.
    if (refresh) {
      refresh.hidden = !authenticated;
      refresh.setAttribute('aria-hidden', String(!authenticated));
    }

    if (signIn) {
      signIn.hidden = authenticated;
      signIn.setAttribute('aria-hidden', String(authenticated));
    }

    document.documentElement.dataset.frontDeskAuth =
      authenticated ? 'authenticated' : 'signed-out';
  }

  updateAuthenticationControls();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAuthenticationControls, { once: true });
  }

  window.addEventListener('pageshow', updateAuthenticationControls);
  window.addEventListener('storage', updateAuthenticationControls);
  window.addEventListener('focus', updateAuthenticationControls);

  // The OAuth callback stores the token asynchronously after page load.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    updateAuthenticationControls();
    if (hasSession() || attempts >= 60) clearInterval(timer);
  }, 250);
})();
