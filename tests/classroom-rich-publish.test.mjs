import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const userscript = fs.readFileSync(new URL('../classroom-rich-publish.user.js', import.meta.url), 'utf8');
const versionedUserscript = fs.readFileSync(new URL('../classroom-rich-publish-v1.2.2.user.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../chrome-classroom-native-bridge/manifest.json', import.meta.url), 'utf8'));
const nativeBackground = fs.readFileSync(new URL('../chrome-classroom-native-bridge/background.js', import.meta.url), 'utf8');
const nativeGenerator = fs.readFileSync(new URL('../chrome-classroom-native-bridge/generator.js', import.meta.url), 'utf8');
const nativeClassroom = fs.readFileSync(new URL('../chrome-classroom-native-bridge/classroom.js', import.meta.url), 'utf8');

assert.equal(versionedUserscript.trimEnd(), userscript.trimEnd(), 'La copie v1.2.2 doit correspondre au script canonique');
assert.match(userscript, /@version\s+1\.2\.2/);
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
assert.equal(manifest.version, '1.0.10');
assert.deepEqual(manifest.permissions.sort(), ['alarms', 'debugger', 'storage', 'tabs']);
assert.match(nativeGenerator, /PDC_NATIVE_PUBLISH_REQUEST/);
assert.match(nativeGenerator, /pdcNativePublisherVersion = '1\.0\.10'/);
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
assert.match(nativeClassroom, /const retry = visibleButtons\('Publier'/);
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
assert.match(app, /baseline\.baseline\?\.contentFingerprint && baseline\.baseline\.contentFingerprint === contentFingerprint/);
assert.doesNotMatch(app, /baseline\.baseline && numbering\.similarity !== null && !numbering\.changed/);
assert.match(app, /courseNumberManuallyEdited && enteredIsValid/);
assert.match(app, /'manual-correction'/);
assert.match(app, /'loaded-correction'/);
assert.match(app, /btn\.textContent = `Groupe \$\{group\}`/);
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
assert.deepEqual(removedTabs, [202]);

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
assert.ok(removedTabs.includes(303));

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
assert.notEqual(fingerprintContext.fingerprint('Cours #2\nDevoir : Lire'), fingerprintContext.fingerprint('Cours #2\nDevoir : Écrire'));
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
assert.match(index, /v1\.0\.25/);

const numberingStart = app.indexOf('function chooseCourseNumberForGroup');
const numberingEnd = app.indexOf('function rememberPublishedCourseForGroup', numberingStart);
const numberingSource = numberingStart >= 0 && numberingEnd > numberingStart ? app.slice(numberingStart, numberingEnd).trim() : '';
assert.ok(numberingSource, 'Décision intelligente de numérotation absente');
function runNumbering({ manual, loaded, entered }) {
  const input = { value: String(entered) };
  const withoutNumber = { checked: true };
  const context = {
    courseNumberManuallyEdited: manual,
    currentLoadedCourseId: loaded ? 'saved-2' : '',
    savedCourses: loaded ? [{ id: 'saved-2', courseNumber: '2' }] : [],
    readClassroomGroupHistory: () => ({ '31': { lastPublishedNumber: 2, activities: ['Ancienne activité'] } }),
    courseActivitySimilarity: () => 0.1,
    document: { getElementById: id => id === 'num-cours' ? input : withoutNumber },
    toggleSansNumero() {}, saveNumCours() {}, sauvegarderPlanLocal() {}
  };
  vm.createContext(context);
  vm.runInContext(`${numberingSource}; this.choose = chooseCourseNumberForGroup;`, context);
  return context.choose('31', ['Activité complètement corrigée']);
}
assert.deepEqual({ ...runNumbering({ manual: false, loaded: false, entered: 2 }) }, { number: 3, changed: true, similarity: 0.1, intent: 'new-course' });
assert.deepEqual({ ...runNumbering({ manual: true, loaded: false, entered: 2 }) }, { number: 2, changed: false, similarity: 0.1, intent: 'manual-correction' });
assert.deepEqual({ ...runNumbering({ manual: false, loaded: true, entered: 2 }) }, { number: 2, changed: false, similarity: 0.1, intent: 'loaded-correction' });

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
const dateInput = { value: '' };
const dateContext = {
  MOIS_NOMS: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  document: { getElementById() { return dateInput; } }
};
vm.createContext(dateContext);
vm.runInContext(`let dpDate = new Date(); function formatDateStr(d) { return \`${'${d.getDate()} ${MOIS_NOMS[d.getMonth()]} ${d.getFullYear()}'}\`; } function setCourseDateToToday() { dpDate = new Date(); document.getElementById('date-cours').value = formatDateStr(dpDate); } ${dateRestoreSource}; this.restoreDate = setCourseDateFromState;`, dateContext);
const today = new Date();
const expectedToday = `${today.getDate()} ${dateContext.MOIS_NOMS[today.getMonth()]} ${today.getFullYear()}`;
dateContext.restoreDate({ dateISO: '2026-08-29T12:00:00.000Z', dateDisplay: '28 août 2026' });
assert.equal(dateInput.value, expectedToday);
dateContext.restoreDate({ dateDisplay: '7 septembre 2026' });
assert.equal(dateInput.value, expectedToday);
assert.match(index, /app\.js\?v=1\.0\.27/);
assert.match(index, /v1\.0\.27/);
assert.match(index, /onclick="refreshCoursePreview\(\)"/);
assert.match(app, /async function refreshCoursePreview\(\)/);
assert.match(app, /await generer\(\)/);

console.log('Tests Classroom, routage et persistance: OK');
