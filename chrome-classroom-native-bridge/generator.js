(() => {
  'use strict';

  const REQUEST = 'PDC_NATIVE_PUBLISH_REQUEST';
  const ACK = 'PDC_NATIVE_PUBLISH_ACK';
  const RESULT = 'PDC_NATIVE_PUBLISH_RESULT';
  const LAST_RESULT_KEY = 'pdcNativeClassroomLastResult';
  document.documentElement.dataset.pdcNativePublisherVersion = '1.0.11';
  let lastDeliveredResult = '';

  function deliverResult(message) {
    const requestId = String(message?.requestId || '');
    if (!requestId || requestId === lastDeliveredResult) return;
    lastDeliveredResult = requestId;
    document.documentElement.dataset.pdcNativePublishResult = JSON.stringify({
      requestId,
      outcome: String(message.outcome || 'failed'),
      group: String(message.group || ''),
      error: String(message.error || '')
    });
    window.postMessage({
      type: RESULT,
      requestId,
      outcome: String(message.outcome || 'failed'),
      group: String(message.group || ''),
      error: String(message.error || '')
    }, location.origin);
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== RESULT) return;
    deliverResult(message);
  });

  setInterval(async () => {
    try {
      const result = (await chrome.storage.local.get(LAST_RESULT_KEY))[LAST_RESULT_KEY];
      if (result && Date.now() - Number(result.finishedAt || 0) < 10 * 60 * 1000) deliverResult(result);
    } catch (_) { /* le message direct reste le chemin principal */ }
  }, 1000);

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== REQUEST) return;
    const requestId = String(event.data.requestId || '');
    const payload = event.data.payload || {};
    document.documentElement.dataset.pdcNativeRequestAck = requestId;
    window.postMessage({ type: ACK, requestId, ok: true, error: '' }, location.origin);
    chrome.runtime.sendMessage({ type: 'prepare', payload }).then(result => {
      if (!result?.ok) deliverResult({ requestId, outcome: 'failed', group: payload.group, error: result?.error || 'pont Chrome indisponible' });
    }).catch(error => {
      deliverResult({ requestId, outcome: 'failed', group: payload.group, error: String(error?.message || error) });
    });
  });
})();
