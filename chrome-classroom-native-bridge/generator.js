(() => {
  'use strict';

  const REQUEST = 'PDC_NATIVE_PUBLISH_REQUEST';
  const ACK = 'PDC_NATIVE_PUBLISH_ACK';
  document.documentElement.dataset.pdcNativePublisherVersion = '1.0.1';

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== REQUEST) return;
    const requestId = String(event.data.requestId || '');
    const payload = event.data.payload || {};
    chrome.runtime.sendMessage({ type: 'prepare', payload }).then(result => {
      window.postMessage({ type: ACK, requestId, ok: Boolean(result?.ok), error: result?.error || '' }, location.origin);
    }).catch(error => {
      window.postMessage({ type: ACK, requestId, ok: false, error: String(error?.message || error) }, location.origin);
    });
  });
})();
