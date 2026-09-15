(() => {
  'use strict';

  const SUCCESS_PREFIX = 'Plan riche publié et vérifié';
  const SUCCESS_DELAY_MS = 2000;
  let successTimer = 0;

  function scheduleIfSuccess() {
    const banner = document.getElementById('pdc-native-classroom-status');
    if (!banner) return;

    clearTimeout(successTimer);
    if (!String(banner.textContent || '').includes(SUCCESS_PREFIX)) return;

    successTimer = window.setTimeout(() => {
      const current = document.getElementById('pdc-native-classroom-status');
      if (current === banner && String(current.textContent || '').includes(SUCCESS_PREFIX)) {
        current.remove();
      }
    }, SUCCESS_DELAY_MS);
  }

  const observer = new MutationObserver(scheduleIfSuccess);

  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    scheduleIfSuccess();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
