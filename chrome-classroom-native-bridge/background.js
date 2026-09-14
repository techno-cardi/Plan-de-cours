const JOB_KEY = 'pdcNativeClassroomJob';
const LAST_RESULT_KEY = 'pdcNativeClassroomLastResult';
const GROUP_MAP_KEY = 'pdcNativeClassroomGroupMapV1';
const MAX_IDLE_MS = 90 * 1000;
const WATCHDOG_ALARM = 'pdcNativeClassroomWatchdog';
const RESULT = 'PDC_NATIVE_PUBLISH_RESULT';

function validGeneratorSender(sender) {
  try {
    const url = new URL(sender.tab?.url || '');
    if (url.origin !== 'https://techno-cardi.github.io') return false;
    return url.pathname.startsWith('/Plan-de-cours/') || url.pathname.startsWith('/Portail-Cardinal-Roy/agendakevin/');
  } catch (_) { return false; }
}

function validClassroomSender(sender) {
  try { return new URL(sender.tab?.url || '').origin === 'https://classroom.google.com'; }
  catch (_) { return false; }
}

function normalizedGroup(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/(?:^|[^0-9])(31|32|51)(?:[^0-9]|$)/);
  return match ? match[1] : raw;
}

function normalizeClassroomTarget(raw, fallbackGroup = '') {
  const courseId = String(raw?.courseId || '').trim();
  if (!/^\d+$/.test(courseId)) throw new Error('cours invalide');
  const target = new URL(String(raw?.alternateLink || ''));
  if (target.origin !== 'https://classroom.google.com' || !/\/c\//.test(target.pathname)) {
    throw new Error('destination Classroom invalide');
  }
  return {
    group: normalizedGroup(raw?.group || fallbackGroup),
    courseId,
    courseName: String(raw?.courseName || ''),
    courseSection: String(raw?.courseSection || ''),
    alternateLink: target.toString()
  };
}

async function readGroupMap() {
  return (await chrome.storage.local.get(GROUP_MAP_KEY))[GROUP_MAP_KEY] || {};
}

async function rememberGroups(groups) {
  const map = await readGroupMap();
  let changed = false;
  for (const raw of Array.isArray(groups) ? groups.slice(0, 20) : []) {
    try {
      const target = normalizeClassroomTarget(raw);
      if (!target.group) continue;
      map[target.group] = { ...target, savedAt: Date.now() };
      changed = true;
    } catch (_) { /* entrée invalide ignorée */ }
  }
  if (changed) await chrome.storage.local.set({ [GROUP_MAP_KEY]: map });
  return map;
}

async function resolveClassroomTarget(payload) {
  const group = normalizedGroup(payload?.group || '');
  const directCourseId = String(payload?.courseId || '').trim();
  const directLink = String(payload?.alternateLink || '').trim();
  if (directCourseId && directLink) {
    const direct = normalizeClassroomTarget(payload, group);
    if (group) await rememberGroups([direct]);
    return direct;
  }

  if (!group) throw new Error('groupe Classroom manquant');
  const map = await readGroupMap();
  const remembered = map[group];
  if (!remembered) {
    throw new Error(`Groupe ${group} non lié. Ouvre le Générateur de plan de cours une fois, attends que tes cours Classroom soient chargés, puis réessaie.`);
  }
  return normalizeClassroomTarget(remembered, group);
}

async function readJob() {
  return (await chrome.storage.local.get(JOB_KEY))[JOB_KEY] || null;
}

async function writeJob(job) {
  job.updatedAt = Date.now();
  await chrome.storage.local.set({ [JOB_KEY]: job });
  await chrome.alarms.create(WATCHDOG_ALARM, { when: job.updatedAt + MAX_IDLE_MS });
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
  try {
    await chrome.storage.local.set({ [LAST_RESULT_KEY]: result });
    await chrome.tabs.sendMessage(job.sourceTabId, result).catch(() => {});
  } finally {
    await chrome.storage.local.remove(JOB_KEY).catch(() => {});
    await chrome.alarms.clear(WATCHDOG_ALARM).catch(() => {});
    await chrome.tabs.update(job.sourceTabId, { active: true }).catch(() => {});
    // Garder le flux ou l’éditeur ouvert, même si la confirmation tarde :
    // fermer cet onglet peut masquer une publication réussie ou un brouillon à récupérer.
  }
}

async function tabExists(tabId) {
  if (!Number.isInteger(Number(tabId))) return false;
  return Boolean(await chrome.tabs.get(Number(tabId)).catch(() => null));
}

async function clearAbandonedJob(existing = null) {
  const job = existing || await readJob();
  if (!job) return false;
  const updatedAt = Number(job.updatedAt || job.createdAt || 0);
  const expired = !updatedAt || Date.now() - updatedAt >= MAX_IDLE_MS;
  const sourceExists = await tabExists(job.sourceTabId);
  const classroomExists = !job.classroomTabId || await tabExists(job.classroomTabId);
  if (!expired && sourceExists && classroomExists) return false;
  await finishJob(job, 'failed', expired
    ? 'La publication précédente a expiré et a été réinitialisée.'
    : 'La publication précédente a été interrompue par la fermeture d’un onglet.');
  return true;
}

async function jobStillRunning(job) {
  if (!job?.classroomTabId) return job?.status === 'opening' && Date.now() - Number(job.updatedAt || job.createdAt || 0) < 30000;
  const status = await chrome.tabs.sendMessage(job.classroomTabId, {
    type: 'PDC_NATIVE_STATUS', requestId: job.requestId
  }).catch(() => null);
  return Boolean(status?.running && String(status.requestId || '') === String(job.requestId || ''));
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
  if (message?.type === 'rememberGroups') {
    if (!validGeneratorSender(sender)) throw new Error('origine du générateur refusée');
    const map = await rememberGroups(message.groups || []);
    return { ok: true, groups: Object.keys(map) };
  }

  if (message?.type === 'getGroups') {
    if (!validGeneratorSender(sender)) throw new Error('origine du générateur refusée');
    const map = await readGroupMap();
    return {
      ok: true,
      groups: Object.fromEntries(Object.entries(map).map(([group, value]) => [group, {
        group,
        courseId: String(value.courseId || ''),
        courseName: String(value.courseName || ''),
        courseSection: String(value.courseSection || ''),
        alternateLink: String(value.alternateLink || ''),
        savedAt: Number(value.savedAt || 0)
      }]))
    };
  }

  if (message?.type === 'prepare') {
    if (!validGeneratorSender(sender)) throw new Error('origine du générateur refusée');
    const payload = message.payload || {};
    const target = await resolveClassroomTarget(payload);
    if (!String(payload.text || '').trim() || !String(payload.title || '').trim()) throw new Error('plan vide');
    if (payload.announcementId && (!/^\d+$/.test(String(payload.announcementId)) || !String(payload.originalText || '').trim())) throw new Error('annonce à modifier invalide');
    let existing = await readJob();
    if (existing && await clearAbandonedJob(existing)) existing = null;
    if (existing && ['opening', 'claimed', 'pasting', 'publishing'].includes(existing.status)) {
      if (await jobStillRunning(existing)) throw new Error('une publication Classroom est déjà en cours');
      await finishJob(existing, 'failed', 'La publication précédente ne répondait plus et a été réinitialisée.');
      existing = null;
    }
    const job = {
      requestId: String(payload.requestId || ''),
      createdAt: Number(payload.createdAt || Date.now()),
      courseId: target.courseId,
      group: target.group || normalizedGroup(payload.group || ''),
      courseName: String(payload.courseName || target.courseName || ''),
      courseSection: String(payload.courseSection || target.courseSection || ''),
      alternateLink: target.alternateLink,
      announcementId: String(payload.announcementId || ''),
      originalText: String(payload.originalText || ''),
      text: String(payload.text),
      title: String(payload.title),
      probes: Array.isArray(payload.probes) ? payload.probes.map(String).slice(0, 5) : [],
      sourceTabId: sender.tab.id,
      status: 'opening'
    };
    await writeJob(job);
    // Classroom ne construit pas toujours son éditeur dans un onglet créé en
    // arrière-plan. L'activer ici garantit le chargement du script de contenu,
    // sans dépendre de ce même script pour demander ensuite l'activation.
    const classroomTab = await chrome.tabs.create({
      url: job.alternateLink,
      active: true,
      windowId: sender.tab.windowId
    });
    job.classroomTabId = classroomTab.id;
    await writeJob(job);
    return { ok: true };
  }

  if (!validClassroomSender(sender)) throw new Error('origine Classroom refusée');
  const job = await readJob();
  if (!job || await clearAbandonedJob(job)) return { ok: false, error: 'aucune publication active' };

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

chrome.runtime.onInstalled.addListener(() => {
  readJob().then(job => job && finishJob(job, 'failed', 'Le pont Classroom a été mis à jour et réinitialisé.')).catch(console.error);
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === WATCHDOG_ALARM) clearAbandonedJob().catch(console.error);
});

chrome.tabs.onRemoved.addListener(tabId => {
  readJob().then(job => {
    if (job && [job.sourceTabId, job.classroomTabId].includes(tabId)) {
      return finishJob(job, 'failed', 'La publication a été interrompue par la fermeture d’un onglet.');
    }
  }).catch(console.error);
});

clearAbandonedJob().catch(console.error);
