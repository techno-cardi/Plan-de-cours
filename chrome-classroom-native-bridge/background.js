const JOB_KEY = 'pdcNativeClassroomJob';
const LAST_RESULT_KEY = 'pdcNativeClassroomLastResult';
const MAX_AGE_MS = 5 * 60 * 1000;
const RESULT = 'PDC_NATIVE_PUBLISH_RESULT';

function validGeneratorSender(sender) {
  try { return new URL(sender.tab?.url || '').origin === 'https://techno-cardi.github.io'; }
  catch (_) { return false; }
}

function validClassroomSender(sender) {
  try { return new URL(sender.tab?.url || '').origin === 'https://classroom.google.com'; }
  catch (_) { return false; }
}

async function readJob() {
  return (await chrome.storage.local.get(JOB_KEY))[JOB_KEY] || null;
}

async function writeJob(job) {
  await chrome.storage.local.set({ [JOB_KEY]: job });
}

async function finishJob(job, outcome, error = '') {
  const result = {
    type: RESULT,
    requestId: job.requestId,
    group: job.group,
    outcome,
    error,
    finishedAt: Date.now()
  };
  await chrome.storage.local.set({ [LAST_RESULT_KEY]: result });
  await chrome.tabs.sendMessage(job.sourceTabId, result).catch(() => {});
  await chrome.storage.local.remove(JOB_KEY);
  await chrome.tabs.update(job.sourceTabId, { active: true }).catch(() => {});
  if (job.classroomTabId && job.classroomTabId !== job.sourceTabId) {
    await chrome.tabs.remove(job.classroomTabId).catch(() => {});
  }
}

async function withDebugger(tabId, action) {
  const target = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(target, '1.3');
    attached = true;
    return await action(target);
  } finally {
    if (attached) await chrome.debugger.detach(target).catch(() => {});
  }
}

async function nativePaste(tabId) {
  return withDebugger(tabId, async target => {
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: 'v', code: 'KeyV', modifiers: 2,
      windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86
    });
    await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'v', code: 'KeyV', modifiers: 2,
      windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86
    });
  });
}

async function nativeClick(tabId, x, y) {
  if (![x, y].every(Number.isFinite)) throw new Error('coordonnées du bouton Publier invalides');
  return withDebugger(tabId, async target => {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1
    });
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1
    });
  });
}

async function handleMessage(message, sender) {
  if (message?.type === 'prepare') {
    if (!validGeneratorSender(sender)) throw new Error('origine du générateur refusée');
    const payload = message.payload || {};
    if (!/^\d+$/.test(String(payload.courseId || ''))) throw new Error('cours invalide');
    const target = new URL(payload.alternateLink || '');
    if (target.origin !== 'https://classroom.google.com' || !/\/c\//.test(target.pathname)) throw new Error('destination Classroom invalide');
    if (!String(payload.text || '').trim() || !String(payload.title || '').trim()) throw new Error('plan vide');
    const existing = await readJob();
    if (existing && Date.now() - Number(existing.createdAt || 0) < MAX_AGE_MS && ['opening', 'claimed', 'pasting', 'publishing'].includes(existing.status)) {
      throw new Error('une publication Classroom est déjà en cours');
    }
    const job = {
      requestId: String(payload.requestId || ''),
      createdAt: Number(payload.createdAt || Date.now()),
      courseId: String(payload.courseId),
      group: String(payload.group || ''),
      courseName: String(payload.courseName || ''),
      courseSection: String(payload.courseSection || ''),
      alternateLink: target.toString(),
      text: String(payload.text),
      title: String(payload.title),
      probes: Array.isArray(payload.probes) ? payload.probes.map(String).slice(0, 5) : [],
      sourceTabId: sender.tab.id,
      status: 'opening'
    };
    await writeJob(job);
    const classroomTab = await chrome.tabs.create({ url: job.alternateLink, active: false });
    job.classroomTabId = classroomTab.id;
    await writeJob(job);
    return { ok: true };
  }

  if (!validClassroomSender(sender)) throw new Error('origine Classroom refusée');
  const job = await readJob();
  if (!job || Date.now() - Number(job.createdAt || 0) >= MAX_AGE_MS) return { ok: false, error: 'aucune publication active' };

  if (message.type === 'claim') {
    if (job.classroomTabId && job.classroomTabId !== sender.tab.id) return { ok: false, error: 'publication déjà attribuée à un autre onglet' };
    if (job.claimedTabId && job.claimedTabId !== sender.tab.id) return { ok: false, error: 'publication déjà réclamée' };
    Object.assign(job, { claimedTabId: sender.tab.id, classroomTabId: sender.tab.id, status: 'claimed', claimedAt: Date.now() });
    await writeJob(job);
    return { ok: true, job };
  }

  if (job.claimedTabId !== sender.tab.id) throw new Error('onglet Classroom non autorisé');
  if (message.type === 'paste') {
    job.status = 'pasting';
    await writeJob(job);
    await nativePaste(sender.tab.id);
    return { ok: true };
  }
  if (message.type === 'publish') {
    job.status = 'publishing';
    await writeJob(job);
    await nativeClick(sender.tab.id, Number(message.x), Number(message.y));
    return { ok: true };
  }
  if (message.type === 'activate') {
    await chrome.tabs.update(sender.tab.id, { active: true });
    return { ok: true };
  }
  if (message.type === 'complete') {
    const outcome = message.outcome === 'duplicate' ? 'duplicate' : 'published';
    await finishJob(job, outcome);
    return { ok: true };
  }
  if (message.type === 'fail') {
    const error = String(message.error || 'erreur inconnue');
    await finishJob(job, 'failed', error);
    return { ok: true };
  }
  return { ok: false, error: 'commande inconnue' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});
