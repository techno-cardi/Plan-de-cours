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
assert.equal(manifest.version, '1.0.4');
assert.deepEqual(manifest.permissions.sort(), ['debugger', 'storage', 'tabs']);
assert.match(nativeGenerator, /PDC_NATIVE_PUBLISH_REQUEST/);
assert.match(nativeGenerator, /pdcNativePublisherVersion = '1\.0\.4'/);
assert.match(nativeGenerator, /PDC_NATIVE_PUBLISH_RESULT/);
assert.match(nativeGenerator, /pdcNativeClassroomLastResult/);
assert.match(nativeGenerator, /pdcNativeRequestAck/);
assert.match(nativeGenerator, /pdcNativePublishResult/);
assert.match(nativeBackground, /Input\.dispatchKeyEvent/);
assert.match(nativeBackground, /Input\.dispatchMouseEvent/);
assert.match(nativeBackground, /une publication Classroom est déjà en cours/);
assert.match(nativeBackground, /active: false/);
assert.match(nativeBackground, /finishJob/);
assert.match(nativeBackground, /tabs\.update\(job\.sourceTabId, \{ active: true \}\)/);
assert.match(nativeClassroom, /type: 'activate'/);
assert.match(nativeClassroom, /duplicateVisible/);
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
      async sendMessage(tabId, message) { tabMessages.push({ tabId, message }); },
      async update(tabId, options) { updatedTabs.push({ tabId, options }); },
      async remove(tabId) { removedTabs.push(tabId); }
    },
    debugger: {
      async attach() {}, async detach() {},
      async sendCommand(_target, method, params) { debuggerCommands.push({ method, params }); }
    },
    runtime: { onMessage: { addListener() {} } }
  }
};
vm.createContext(backgroundContext);
vm.runInContext(nativeBackground, backgroundContext);
const prepared = await backgroundContext.handleMessage({ type: 'prepare', payload: {
  requestId: 'r1', createdAt: Date.now(), courseId: '875523698222', group: '31',
  courseName: 'Français SAÉ — Groupe 31', courseSection: '3e secondaire — Groupe 31',
  alternateLink: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy',
  text: 'Cours #2\n\n1️⃣ Activité test', title: 'Cours #2', probes: ['Cours #2', '1️⃣ Activité test']
} }, { tab: { id: 101, url: 'https://techno-cardi.github.io/Plan-de-cours/' } });
assert.equal(prepared.ok, true);
assert.equal(createdTabOptions.active, false);
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
assert.match(app, /CLASSROOM_GROUP_HISTORY_BACKUP_KEY/);
assert.match(app, /result\.outcome === 'published'/);
assert.match(app, /announcements\?orderBy=updateTime%20desc&pageSize=100/);

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
vm.runInContext(`let dpDate = new Date(); function formatDateStr(d) { return \`${'${d.getDate()} ${MOIS_NOMS[d.getMonth()]} ${d.getFullYear()}'}\`; } ${dateRestoreSource}; this.restoreDate = setCourseDateFromState;`, dateContext);
dateContext.restoreDate({ dateISO: '2026-08-29T12:00:00.000Z', dateDisplay: '28 août 2026' });
assert.equal(dateInput.value, '28 août 2026');
dateContext.restoreDate({ dateDisplay: '7 septembre 2026' });
assert.equal(dateInput.value, '7 septembre 2026');

console.log('Tests Classroom, routage et persistance: OK');
