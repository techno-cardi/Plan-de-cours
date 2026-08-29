(() => {
  'use strict';

  const REQUEST = 'PDC_NATIVE_PUBLISH_REQUEST';
  const ACK = 'PDC_NATIVE_PUBLISH_ACK';
  const RESULT = 'PDC_NATIVE_PUBLISH_RESULT';
  document.documentElement.dataset.pdcNativePublisherVersion = '1.0.2';

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== RESULT) return;
    window.postMessage({
      type: RESULT,
      requestId: String(message.requestId || ''),
      outcome: String(message.outcome || 'failed'),
      group: String(message.group || ''),
      error: String(message.error || '')
    }, location.origin);
  });

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
