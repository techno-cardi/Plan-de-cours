import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const userscript = fs.readFileSync(new URL('../classroom-rich-publish.user.js', import.meta.url), 'utf8');
const versionedUserscript = fs.readFileSync(new URL('../classroom-rich-publish-v1.3.0.user.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../chrome-classroom-native-bridge/manifest.json', import.meta.url), 'utf8'));
const nativeBackground = fs.readFileSync(new URL('../chrome-classroom-native-bridge/background.js', import.meta.url), 'utf8');
const nativeGenerator = fs.readFileSync(new URL('../chrome-classroom-native-bridge/generator.js', import.meta.url), 'utf8');
const nativeClassroom = fs.readFileSync(new URL('../chrome-classroom-native-bridge/classroom.js', import.meta.url), 'utf8');

const editSource = nativeClassroom.slice(nativeClassroom.indexOf('  async function openExistingAnnouncement'), nativeClassroom.indexOf('  function hasStyledText'));
let hydrated = false, openedEditor = false;
const editMenu = { getAttribute: () => hydrated ? "Options d'annonce pour Cours #9" : '', scrollIntoView() {}, click() {} };
const targetCard = { querySelectorAll: () => [editMenu] };
const targetEditor = { innerText: 'Cours #9' };
const editContext = vm.createContext({
  announcementEditor: () => openedEditor ? targetEditor : null,
  announcementCard: () => targetCard,
  fold: value => String(value || '').toLowerCase(),
  send: async () => ({ ok: true }),
  document: { querySelectorAll: () => [{ getClientRects: () => [1], textContent: 'Modifier', click() { openedEditor = true; } }] },
  waitFor: async read => { const first = read(); if (first) return first; hydrated = true; return read(); }
});
vm.runInContext(`${editSource}; this.open = openExistingAnnouncement;`, editContext);
assert.equal(await editContext.open({ announcementId: '9', originalText: 'Cours #9' }), targetEditor, 'Attendre le libellé du menu, pas seulement sa présence');

assert.equal(versionedUserscript.trimEnd(), userscript.trimEnd(), 'La copie versionnée doit correspondre au script canonique');
assert.match(userscript, /@version\s+1\.3\.0/);
assert.match(userscript, /dataset\.pdcClassroomBridgeVersion = VERSION/);
assert.match(userscript, /PDC_NATIVE_PUBLISH_REQUEST/);
assert.match(userscript, /dataset\.pdcClassroomBridgeMode = 'native-extension'/);
assert.match(userscript, /pdc:publish-result/);
assert.match(userscript, /pdcNativeRequestAck/);
assert.match(userscript, /pdcNativePublishResult/);
assert.doesNotMatch(userscript, /Publication native Classroom active|Publication native lancée|Pont Chrome natif non détecté —/);
assert.doesNotMatch(userscript, /n5NjMc|F7Tqub|batchexecute|GM_openInTab|document\.execCommand|Nouvelle annonce/);
assert.doesNotMatch(userscript, /\.innerHTML\s*=/, 'Le userscript ne doit jamais écrire dans innerHTML (Trusted Types Classroom)');

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.1.1');
assert.deepEqual(manifest.permissions.sort(), ['alarms', 'debugger', 'storage', 'tabs']);
assert.match(nativeGenerator, /PDC_NATIVE_PUBLISH_REQUEST/);
assert.match(nativeGenerator, /pdcNativePublisherVersion = '1\.1\.1'/);
assert.match(nativeGenerator, /PDC_NATIVE_PUBLISH_RESULT/);
assert.match(nativeGenerator, /pdcNativeClassroomLastResult/);
assert.match(nativeGenerator, /pdcNativeRequestAck/);
assert.match(nativeGenerator, /pdcNativePublishResult/);
assert.match(nativeBackground, /Input\.dispatchKeyEvent/);
assert.match(nativeBackground, /Input\.dispatchMouseEvent/);
assert.match(nativeBackground, /une publication Classroom est déjà en cours/);
assert.match(nativeBackground, /active: true/);
assert.match(nativeBackground, /windowId: sender\.tab\.windowId/);
assert.match(nativeBackground, /finishJob/);
assert.match(nativeBackground, /tabs\.update\(job\.sourceTabId, \{ active: true \}\)/);
assert.match(nativeClassroom, /type: 'activate'/);
assert.match(nativeClassroom, /publish\.click\(\)/);
assert.match(nativeClassroom, /const retry = visibleButtons\(publishLabel/);
assert.doesNotMatch(nativeClassroom, /duplicateVisible/);
assert.match(nativeClassroom, /function newAnnouncementButton/);
assert.match(nativeClassroom, /main button, main \[role="button"\]/);
assert.match(nativeClassroom, /function announcementEditor\(\)/);
assert.match(nativeClassroom, /function openAnnouncementEditor\(\)/);
assert.match(nativeClassroom, /\[role="dialog"\] \[contenteditable="true"\]\[role="textbox"\]/);
assert.match(nativeClassroom, /waitFor\(newAnnouncementButton, attempt \? 12000 : 30000/);
assert.match(nativeClassroom, /getAttribute\('aria-label'\)/);
assert.match(nativeClassroom, /\[jsname="V67aGc"\],span/);
assert.match(nativeClassroom, /\[data-is-edit-mode="true"\]/);
assert.match(nativeClassroom, /titleUnderlined/);
assert.match(nativeClassroom, /devoirBold/);
assert.match(nativeClassroom, /Aucun autre éditeur ne sera ouvert automatiquement/);
assert.doesNotMatch(nativeClassroom, /\.innerHTML\s*=/);
assert.doesNotMatch(index, /Un clic génère l’aperçu|Prêts :|Automatisation Classroom riche active/);
assert.doesNotMatch(app, /quick-classroom-status|Prêts :/);
assert.match(index, /v1\.0\.17/);
assert.match(app, /MutationObserver\(readNativeClassroomResult\)/);
assert.match(app, /data-pdc-native-publish-result/);
assert.doesNotMatch(app, /baseline\.baseline && numbering\.similarity !== null && !numbering\.changed/);
assert.match(app, /explicitNumber = !!options\.explicitNumber && enteredIsValid/);
assert.match(app, /'manual-correction'/);
const disconnectStart = app.indexOf('async function googleDisconnect');
const disconnectEnd = app.indexOf('async function afterGoogleLogin', disconnectStart);
const disconnectSource = disconnectStart >= 0 && disconnectEnd > disconnectStart ? app.slice(disconnectStart, disconnectEnd) : '';
assert.match(disconnectSource, /updateQuickClassroomButtons\(\)/, 'La déconnexion doit désactiver immédiatement les boutons Classroom');
assert.match(app, /function specialSectionLabel/);
assert.match(app, /specialSectionLabel\('Devoir'/);
assert.match(app, /specialSectionLabel\('Rappel'/);
assert.match(nativeClassroom, /hasStyledText\(editor, 'Devoir', 'bold'\)/);
assert.match(nativeClassroom, /function hasStyledText/);
assert.match(nativeClassroom, /textDecorationLine/);
assert.match(nativeClassroom, /sera publié/);

const stored = {};
const debuggerCommands = [];
const tabMessages = [];
const removedTabs = [];
const updatedTabs = [];
let createdTabOptions = null;
const backgroundContext = {
  URL,
  console,
  chrome: {
    storage: { local: {
      async get(key) { return { [key]: stored[key] }; },
      async set(values) { Object.assign(stored, values); },
      async remove(key) { delete stored[key]; }
    } },
    tabs: {
      async create(options) { createdTabOptions = options; return { id: 202, url: options.url }; },
      async get(tabId) { return { id: tabId }; },
      async sendMessage(tabId, message) {
        if (message?.type === 'PDC_NATIVE_STATUS') return null;
        tabMessages.push({ tabId, message });
      },
      async update(tabId, options) { updatedTabs.push({ tabId, options }); },
      async remove(tabId) { removedTabs.push(tabId); },
      onRemoved: { addListener() {} }
    },
    alarms: { async create() {}, async clear() {}, onAlarm: { addListener() {} } },
    debugger: {
      async attach() {}, async detach() {},
      async sendCommand(_target, method, params) { debuggerCommands.push({ method, params }); }
    },
    runtime: { onMessage: { addListener() {} }, onInstalled: { addListener() {} } }
  }
};
vm.createContext(backgroundContext);
vm.runInContext(nativeBackground, backgroundContext);
const prepared = await backgroundContext.handleMessage({ type: 'prepare', payload: {
  requestId: 'r1', createdAt: Date.now(), courseId: '875523698222', group: '31',
  courseName: 'Français SAÉ — Groupe 31', courseSection: '3e secondaire — Groupe 31',
  alternateLink: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy',
  text: 'Cours #2\n\n1️⃣ Activité test', title: 'Cours #2', probes: ['Cours #2', '1️⃣ Activité test']
} }, { tab: { id: 101, windowId: 77, url: 'https://techno-cardi.github.io/Plan-de-cours/' } });
assert.equal(prepared.ok, true);
assert.equal(createdTabOptions.active, true);
assert.equal(createdTabOptions.windowId, 77);
const claimed = await backgroundContext.handleMessage({ type: 'claim' }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.equal(claimed.job.courseId, '875523698222');
await backgroundContext.handleMessage({ type: 'paste' }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.deepEqual(debuggerCommands.map(command => command.method), ['Input.dispatchKeyEvent', 'Input.dispatchKeyEvent']);
await backgroundContext.handleMessage({ type: 'publish', x: 800, y: 650 }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.deepEqual(debuggerCommands.slice(-2).map(command => command.method), ['Input.dispatchMouseEvent', 'Input.dispatchMouseEvent']);
await backgroundContext.handleMessage({ type: 'complete', outcome: 'published' }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.equal(stored.pdcNativeClassroomJob, undefined);
assert.equal(tabMessages[0].tabId, 101);
assert.equal(tabMessages[0].message.outcome, 'published');
assert.equal(stored.pdcNativeClassroomLastResult.outcome, 'published');
assert.equal(updatedTabs[0].tabId, 101);
assert.equal(updatedTabs[0].options.active, true);
assert.deepEqual(removedTabs, [], 'L’onglet Classroom doit rester ouvert après une publication réussie');

stored.pdcNativeClassroomJob = {
  requestId: 'stuck', createdAt: Date.now() - 10000, updatedAt: Date.now() - 10000,
  courseId: '875523698222', group: '31', sourceTabId: 101, classroomTabId: 303,
  status: 'publishing'
};
const recovered = await backgroundContext.handleMessage({ type: 'prepare', payload: {
  requestId: 'r2', createdAt: Date.now(), courseId: '875523698222', group: '31',
  courseName: 'Français SAÉ — Groupe 31', courseSection: '3e secondaire — Groupe 31',
  alternateLink: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy',
  text: 'Cours #2\n\n1️⃣ Activité corrigée', title: 'Cours #2', probes: ['Cours #2', '1️⃣ Activité corrigée']
} }, { tab: { id: 101, windowId: 77, url: 'https://techno-cardi.github.io/Plan-de-cours/' } });
assert.equal(recovered.ok, true, 'Une tâche qui ne répond plus doit être remplacée automatiquement');
assert.equal(stored.pdcNativeClassroomJob.requestId, 'r2');
assert.deepEqual(removedTabs, [], 'Un onglet en erreur doit rester disponible pour récupérer le contenu');
await backgroundContext.finishJob(stored.pdcNativeClassroomJob, 'failed', 'test interrompu');
const editPrepared = await backgroundContext.handleMessage({ type: 'prepare', payload: {
  requestId: 'edit-1', courseId: '875523698222', group: '31',
  alternateLink: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy/p/ODI2MzUxMDc1MTgw',
  announcementId: '826351075180', originalText: 'Cours #1\nAncien contenu',
  text: 'Cours #1\nContenu corrigé', title: 'Cours #1'
} }, { tab: { id: 101, windowId: 77, url: 'https://techno-cardi.github.io/Plan-de-cours/' } });
assert.equal(editPrepared.ok, true);
assert.equal(stored.pdcNativeClassroomJob.announcementId, '826351075180');
assert.equal(stored.pdcNativeClassroomJob.originalText, 'Cours #1\nAncien contenu');
await backgroundContext.finishJob(stored.pdcNativeClassroomJob, 'published');
assert.deepEqual(removedTabs, [], 'Une correction réussie doit également conserver Classroom ouvert');

const sanitizerStart = userscript.indexOf('function decodeHtmlText');
const sanitizerEnd = userscript.indexOf('function installGeneratorBridge', sanitizerStart);
const sanitizerSource = sanitizerStart >= 0 && sanitizerEnd > sanitizerStart ? userscript.slice(sanitizerStart, sanitizerEnd).trim() : '';
assert.ok(sanitizerSource, 'Nettoyeur HTML sans DOM absent');
const sanitizerContext = {};
vm.createContext(sanitizerContext);
vm.runInContext(`${sanitizerSource}; this.clean = cleanRichHtml; this.toText = richHtmlToText;`, sanitizerContext);
const dirtyRich = '<div class="x"><strong onclick="bad()"><u>Cours #1</u></strong> 🌽</div><script>bad()</script><p>1️⃣&nbsp;Activité &amp; test<br><img alt="🏖️" src="bad"></p>';
const safeRich = sanitizerContext.clean(dirtyRich);
assert.equal(safeRich, '<p><b><u>Cours #1</u></b> 🌽</p><p>1️⃣&nbsp;Activité &amp; test<br>🏖️</p>');
assert.equal(sanitizerContext.toText(safeRich), 'Cours #1 🌽\n\n1️⃣ Activité & test\n🏖️');

const scoreStart = app.indexOf('function classroomCourseScoreGroup');
const scoreEnd = app.indexOf('function getClassroomCourseForGroup', scoreStart);
const scoreSource = scoreStart >= 0 && scoreEnd > scoreStart ? app.slice(scoreStart, scoreEnd).trim() : '';
assert.ok(scoreSource, 'Fonction de routage Classroom absente');
const routingContext = {};
vm.createContext(routingContext);
vm.runInContext(`${scoreSource}; this.score = classroomCourseScoreGroup;`, routingContext);

assert.equal(routingContext.score({ name: 'Français SAÉ — Groupe 31', section: '3e secondaire — Groupe 31' }, '31'), 120);
assert.equal(routingContext.score({ name: 'Français SAÉ — Groupe 32', section: '3e secondaire — Groupe 32' }, '32'), 120);
assert.equal(routingContext.score({ name: 'Français SAÉ — Groupe 51', section: '5e secondaire — Groupe 51' }, '51'), 120);
assert.equal(routingContext.score({ name: 'Français SAÉ — Groupe 31', section: '' }, '51'), 0);

const similarityStart = app.indexOf('function normalizeCourseActivityForComparison');
const similarityEnd = app.indexOf('function getCurrentCourseActivitiesForHistory', similarityStart);
const similaritySource = similarityStart >= 0 && similarityEnd > similarityStart ? app.slice(similarityStart, similarityEnd).trim() : '';
assert.ok(similaritySource, 'Comparaison des activités absente');
const similarityContext = {};
vm.createContext(similarityContext);
vm.runInContext(`${similaritySource}; this.similarity = courseActivitySimilarity;`, similarityContext);
assert.ok(similarityContext.similarity(['Lecture de la nouvelle « Le Horla » 📚', 'Questions 1 à 5'], ['Lecture de la nouvelle Le Horla', 'Questions 1 à 5']) >= 0.99);
assert.ok(similarityContext.similarity(['Lecture du Horla', 'Questions 1 à 5'], ['Laboratoire de robotique', 'Programmation des moteurs']) < 0.7);
const fingerprintStart = app.indexOf('function normalizePublishedPlanForComparison');
const fingerprintEnd = app.indexOf('function getCurrentCourseActivitiesForHistory', fingerprintStart);
const fingerprintSource = fingerprintStart >= 0 && fingerprintEnd > fingerprintStart ? app.slice(fingerprintStart, fingerprintEnd).trim() : '';
assert.ok(fingerprintSource, 'Comparaison du plan complet absente');
const fingerprintContext = {};
vm.createContext(fingerprintContext);
vm.runInContext(`${fingerprintSource}; this.fingerprint = normalizePublishedPlanForComparison;`, fingerprintContext);
assert.equal(fingerprintContext.fingerprint('Cours #2 🍂\nDevoir : Lire'), fingerprintContext.fingerprint('Cours #2 📚\nDevoir : Lire'));
assert.equal(fingerprintContext.fingerprint('Cours #2 (1 septembre 2026)'), fingerprintContext.fingerprint('Cours #2 (1er septembre 2026)'));
assert.notEqual(fingerprintContext.fingerprint('Cours #2\nDevoir : Lire'), fingerprintContext.fingerprint('Cours #2\nDevoir : Écrire'));
vm.runInContext('this.key = publicationContentKey;', fingerprintContext);
assert.equal(fingerprintContext.key('Cours #4 (13 septembre 2026) 🍎\n1️⃣ Lire\nDevoir : écrire'), fingerprintContext.key('Cours #5 (13 septembre 2026) 🍂\n1️⃣ Lire\nDevoir : écrire'), 'Changer uniquement le numéro ou les emojis ne doit pas contourner les doublons');
assert.notEqual(fingerprintContext.key('Cours #4 (13 septembre 2026)\nLire'), fingerprintContext.key('Cours #5 (14 septembre 2026)\nLire'), 'Une nouvelle séance un autre jour peut reprendre les mêmes activités');
const duplicateStart = app.indexOf('    const identical =');
const duplicateEnd = app.indexOf('    if (identical)', duplicateStart);
const duplicateDecision = app.slice(duplicateStart, duplicateEnd);
function blocksDuplicate(text, editing) {
  const context = vm.createContext({
    classroomPublishedPlans: { '31': [{ id: '123', text: 'Cours #4\nIl a terminé.' }] },
    group: '31', editTarget: editing ? { id: '123' } : null,
    latestGeneratedText: text, publicationContentKey: fingerprintContext.key
  });
  return vm.runInContext(`${duplicateDecision}; Boolean(identical)`, context);
}
assert.equal(blocksDuplicate('Cours #5\nIl a terminé.', false), true);
assert.equal(blocksDuplicate('Cours #4\nIl à terminé.', true), false, 'Une correction explicite d’accent doit être transmise');
assert.equal(blocksDuplicate('Cours #4\nIl a terminé!', true), false, 'Une correction explicite de ponctuation doit être transmise');
assert.equal(blocksDuplicate('Cours #4\nIl a terminé.', true), false, 'Une correction de mise en forme doit pouvoir garder le même texte');
assert.match(app, /CLASSROOM_GROUP_HISTORY_BACKUP_KEY/);
assert.match(app, /result\.outcome === 'published'/);
assert.match(app, /announcements\?orderBy=updateTime%20desc&pageSize=100/);
assert.match(app, /return \{ verified: true, baseline: null \}/);
assert.match(app, /La numérotation rapide est indépendante/);
assert.match(app, /if \(!baseline\.verified\)/);
assert.match(app, /function ensureDefaultBullet/);
assert.match(app, /delete editor\.dataset\.defaultBulletApplied/);
assert.match(app, /insertUnorderedList/);
assert.match(app, /ensureDefaultBullet\(event\.currentTarget\)/);
assert.match(app, /function handleSpecialListTab/);
assert.match(app, /function normalizeNestedLists/);
assert.match(app, /normalizeNestedLists\(editor\)/);
assert.match(app, /querySelectorAll\('li > li'\)/);
assert.match(app, /event\.shiftKey \? 'outdent' : 'indent'/);
assert.match(app, /primaryItems \|\| richToStructuredLines/);
assert.match(app, /durableIndent = '&nbsp;'\.repeat\(depth \* 4\)/);
assert.match(index, /app\.js\?v=1\.0\.33/);
assert.match(index, /changelog-version-badge">v1\.0\.33/);
assert.match(index, /id="btn-course-group-31"/);
assert.match(index, /id="btn-course-group-32"/);
assert.match(index, /id="btn-course-group-51"/);
assert.match(index, /id="course-group-number-status"/);
const courseOptionsStart = index.indexOf('<details class="course-options"');
const courseOptionsEnd = index.indexOf('</details>', courseOptionsStart);
const courseOptions = courseOptionsStart >= 0 && courseOptionsEnd > courseOptionsStart
  ? index.slice(courseOptionsStart, courseOptionsEnd)
  : '';
assert.ok(courseOptions, 'Le panneau repliable « Options du cours » doit être présent');
assert.doesNotMatch(courseOptions.slice(0, courseOptions.indexOf('>') + 1), /\sopen(?:\s|=|>)/, 'Les options doivent être repliées au chargement');
for (const id of ['sans-numero', 'avec-emojis', 'enable-reuse-course', 'keep-form-filled']) {
  assert.match(courseOptions, new RegExp(`id="${id}"`), `${id} doit se trouver dans les options repliables`);
}

const numberingStart = app.indexOf('function calculateCourseNumberForGroup');
const numberingEnd = app.indexOf('function setCourseGroupNumberStatus', numberingStart);
const numberingSource = numberingStart >= 0 && numberingEnd > numberingStart ? app.slice(numberingStart, numberingEnd).trim() : '';
assert.ok(numberingSource, 'Décision intelligente de numérotation absente');
function runNumbering({ manual, loaded, entered, similarity = 0.1, editTarget = null }) {
  const input = { value: String(entered) };
  const withoutNumber = { checked: true };
  const context = {
    courseNumberManuallyEdited: manual,
    classroomEditTarget: editTarget,
    currentLoadedCourseId: loaded ? 'saved-2' : '',
    savedCourses: loaded ? [{ id: 'saved-2', courseNumber: '2' }] : [],
    readClassroomGroupHistory: () => ({ '31': { lastPublishedNumber: 2, activities: ['Ancienne activité'] } }),
    courseActivitySimilarity: () => similarity,
    document: { getElementById: id => id === 'num-cours' ? input : withoutNumber },
    toggleSansNumero() {}, saveNumCours() {}, sauvegarderPlanLocal() {}
  };
  vm.createContext(context);
  vm.runInContext(`${numberingSource}; this.choose = chooseCourseNumberForGroup;`, context);
  const decision = context.choose('31', ['Activité complètement corrigée']);
  assert.equal(withoutNumber.checked, false, 'Choisir un cours numéroté, même en modification, doit désactiver le mode sans numéro');
  assert.equal(input.value, String(decision.number));
  return decision;
}
assert.deepEqual({ ...runNumbering({ manual: false, loaded: false, entered: 2 }) }, { number: 3, changed: true, similarity: 0.1, intent: 'new-course', previousNumber: 2 });
assert.deepEqual({ ...runNumbering({ manual: true, loaded: false, entered: 2 }) }, { number: 2, changed: false, similarity: 0.1, intent: 'manual-correction', previousNumber: 2 });
assert.deepEqual({ ...runNumbering({ manual: false, loaded: true, entered: 2 }) }, { number: 3, changed: true, similarity: 0.1, intent: 'new-course', previousNumber: 2 });
assert.equal(runNumbering({ manual: false, loaded: false, entered: 2, similarity: 1 }).number, 3, 'Un nouveau cours avec les mêmes activités doit avancer');
assert.equal(runNumbering({ manual: false, entered: 99, editTarget: { group: '31', number: 1 } }).number, 1, 'Une correction explicite conserve le numéro de la cible');
assert.deepEqual({ ...(() => {
  const input = { value: '2' };
  const context = {
    courseNumberManuallyEdited: false,
    classroomEditTarget: null,
    currentLoadedCourseId: '',
    savedCourses: [],
    readClassroomGroupHistory: () => ({ '31': { lastPublishedNumber: 2, activities: ['Ancienne activité'] } }),
    courseActivitySimilarity: () => 0,
    document: { getElementById: id => id === 'num-cours' ? input : { checked: true } },
    toggleSansNumero() {}, saveNumCours() {}, sauvegarderPlanLocal() {}
  };
  vm.createContext(context);
  vm.runInContext(`${numberingSource}; this.choose = chooseCourseNumberForGroup;`, context);
  return context.choose('31', []);
})() }, { number: 3, changed: true, similarity: 0, intent: 'new-course', previousNumber: 2 });

const baselineStart = app.indexOf('async function syncClassroomGroupBaseline');
const baselineEnd = app.indexOf('function renderPublishedPlanOptions', baselineStart);
const baselineSource = baselineStart >= 0 && baselineEnd > baselineStart ? app.slice(baselineStart, baselineEnd).trim() : '';
assert.ok(baselineSource, 'Synchronisation Classroom par groupe absente');
let writtenHistory = null;
const baselineContext = {
  classroomPublishedPlans: {}, renderPublishedPlanOptions() {},
  readClassroomGroupHistory: () => ({}),
  writeClassroomGroupHistory: value => { writtenHistory = value; },
  extractActivitiesFromPublishedPlan: () => ['activité'],
  normalizePublishedPlanForComparison: value => value,
  console,
  apiFetch: async url => url.includes('pageToken=page-2')
    ? { announcements: [{ state: 'PUBLISHED', text: 'Cours #3 (3 septembre 2026)', creationTime: '2026-09-03T12:00:00Z', updateTime: '2026-09-03T12:00:00Z' }, {state:'DRAFT', text:'Cours #99'}] }
    : {
        announcements: [{ state: 'PUBLISHED', text: 'Cours #1 (1er septembre 2026)', creationTime: '2026-09-04T12:00:00Z', updateTime: '2026-09-04T12:00:00Z' }],
        nextPageToken: 'page-2'
      }
};
vm.createContext(baselineContext);
vm.runInContext(`${baselineSource}; this.syncBaseline = syncClassroomGroupBaseline;`, baselineContext);
const syncedBaseline = await baselineContext.syncBaseline('31', 'course-31');
assert.equal(syncedBaseline.verified, true);
assert.equal(syncedBaseline.baseline.lastPublishedNumber, 3, 'Modifier un ancien cours ne doit pas faire reculer le numéro');
assert.equal(writtenHistory['31'].courseId, 'course-31');

let concurrentHistory = {};
const concurrentBaselineContext = {
  classroomPublishedPlans: {}, renderPublishedPlanOptions() {},
  readClassroomGroupHistory: () => JSON.parse(JSON.stringify(concurrentHistory)),
  writeClassroomGroupHistory: value => { concurrentHistory = JSON.parse(JSON.stringify(value)); },
  extractActivitiesFromPublishedPlan: () => ['activité'],
  normalizePublishedPlanForComparison: value => value,
  console,
  setTimeout,
  apiFetch: async url => {
    const group31 = url.includes('course-31');
    if (group31) await new Promise(resolve => setTimeout(resolve, 20));
    return {
      announcements: [{
        state: 'PUBLISHED',
        text: `Cours #${group31 ? 4 : 6}`,
        creationTime: '2026-09-04T12:00:00Z',
        updateTime: '2026-09-04T12:00:00Z'
      }]
    };
  }
};
vm.createContext(concurrentBaselineContext);
vm.runInContext(`${baselineSource}; this.syncBaseline = syncClassroomGroupBaseline;`, concurrentBaselineContext);
await Promise.all([
  concurrentBaselineContext.syncBaseline('31', 'course-31'),
  concurrentBaselineContext.syncBaseline('32', 'course-32')
]);
assert.deepEqual(Object.keys(concurrentHistory).sort(), ['31', '32'], 'Les synchronisations parallèles ne doivent pas écraser un autre groupe');

const extractStart = app.indexOf('function extractActivitiesFromPublishedPlan');
const extractEnd = app.indexOf('async function syncClassroomGroupBaseline', extractStart);
const extractSource = extractStart >= 0 && extractEnd > extractStart ? app.slice(extractStart, extractEnd).trim() : '';
assert.ok(extractSource, 'Lecture des activités Classroom absente');
const extractContext = { NUMERO_EMOJIS: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'] };
vm.createContext(extractContext);
vm.runInContext(`${extractSource}; this.extract = extractActivitiesFromPublishedPlan;`, extractContext);
assert.deepEqual(Array.from(extractContext.extract('Cours #7 (29 août 2026) 🍂📚\n1️⃣ Lecture du Horla\n   pages 1 à 4\n2️⃣ Questions 1 à 5\n\nDevoir(s) : Aucun devoir')), ['Lecture du Horla pages 1 à 4', 'Questions 1 à 5']);

assert.match(app, /LOCAL_PLAN_BACKUP_KEY/);
assert.match(app, /function setCourseDateFromState/);
assert.match(app, /setCourseDateFromState\(state\)/);
assert.match(app, /loadedCourseId: currentLoadedCourseId/);
assert.match(app, /loadedSupplyId: currentLoadedSupplyId/);
assert.match(app, /seenCourseIdentities/);
assert.match(app, /seenSupplyIdentities/);
assert.match(app, /seenActivities/);
assert.match(app, /'supply-links'/);

const dateRestoreStart = app.indexOf('function setCourseDateFromState');
const dateRestoreEnd = app.indexOf('function initDate', dateRestoreStart);
const dateRestoreSource = dateRestoreStart >= 0 && dateRestoreEnd > dateRestoreStart ? app.slice(dateRestoreStart, dateRestoreEnd).trim() : '';
assert.ok(dateRestoreSource, 'Restauration de date locale absente');
const dateFormatStart = app.indexOf('function formatFrenchDay');
const dateFormatEnd = app.indexOf('function setCourseDateToToday', dateFormatStart);
const dateFormatSource = dateFormatStart >= 0 && dateFormatEnd > dateFormatStart ? app.slice(dateFormatStart, dateFormatEnd).trim() : '';
assert.ok(dateFormatSource, 'Formatage français des dates absent');
const dateInput = { value: '' };
const dateContext = {
  MOIS_NOMS: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  document: { getElementById() { return dateInput; } }
};
vm.createContext(dateContext);
vm.runInContext(`${dateFormatSource}; let dpDate = new Date(); function setCourseDateToToday() { dpDate = new Date(); document.getElementById('date-cours').value = formatDateStr(dpDate); } ${dateRestoreSource}; this.restoreDate = setCourseDateFromState; this.formatDate = formatDateStr; this.normalizeFirstDay = normalizeFrenchFirstDay;`, dateContext);
const today = new Date();
const expectedToday = `${today.getDate() === 1 ? '1er' : today.getDate()} ${dateContext.MOIS_NOMS[today.getMonth()]} ${today.getFullYear()}`;
assert.equal(dateContext.formatDate(new Date(2026, 8, 1)), '1er septembre 2026');
assert.equal(dateContext.formatDate(new Date(2026, 10, 1)), '1er novembre 2026');
assert.equal(dateContext.formatDate(new Date(2026, 8, 2)), '2 septembre 2026');
assert.equal(dateContext.normalizeFirstDay('Cours #4 (1 septembre 2026)'), 'Cours #4 (1er septembre 2026)');
assert.equal(dateContext.normalizeFirstDay('Cours #4 (1er septembre 2026)'), 'Cours #4 (1er septembre 2026)');
dateContext.restoreDate({ dateISO: '2026-08-29T12:00:00.000Z', dateDisplay: '28 août 2026' });
assert.equal(dateInput.value, expectedToday);
dateContext.restoreDate({ dateDisplay: '7 septembre 2026' });
assert.equal(dateInput.value, expectedToday);
assert.match(index, /app\.js\?v=1\.0\.33/);
assert.match(index, /v1\.0\.33/);
assert.match(index, /onclick="refreshCoursePreview\(\)"/);
assert.match(app, /async function refreshCoursePreview\(\)/);
assert.match(app, /await generer\(\)/);

console.log('Tests Classroom, routage et persistance: OK');
