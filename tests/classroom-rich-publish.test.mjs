import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const userscript = fs.readFileSync(new URL('../classroom-rich-publish.user.js', import.meta.url), 'utf8');
const versionedUserscript = fs.readFileSync(new URL('../classroom-rich-publish-v1.2.0.user.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../chrome-classroom-native-bridge/manifest.json', import.meta.url), 'utf8'));
const nativeBackground = fs.readFileSync(new URL('../chrome-classroom-native-bridge/background.js', import.meta.url), 'utf8');
const nativeGenerator = fs.readFileSync(new URL('../chrome-classroom-native-bridge/generator.js', import.meta.url), 'utf8');
const nativeClassroom = fs.readFileSync(new URL('../chrome-classroom-native-bridge/classroom.js', import.meta.url), 'utf8');

assert.equal(versionedUserscript.trimEnd(), userscript.trimEnd(), 'La copie v1.2.0 doit correspondre au script canonique');
assert.match(userscript, /@version\s+1\.2\.0/);
assert.match(userscript, /dataset\.pdcClassroomBridgeVersion = VERSION/);
assert.match(userscript, /PDC_NATIVE_PUBLISH_REQUEST/);
assert.match(userscript, /dataset\.pdcClassroomBridgeMode = 'native-extension'/);
assert.doesNotMatch(userscript, /n5NjMc|F7Tqub|batchexecute|GM_openInTab|document\.execCommand|Nouvelle annonce/);
assert.doesNotMatch(userscript, /\.innerHTML\s*=/, 'Le userscript ne doit jamais écrire dans innerHTML (Trusted Types Classroom)');

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.0.0');
assert.deepEqual(manifest.permissions.sort(), ['debugger', 'storage', 'tabs']);
assert.match(nativeGenerator, /PDC_NATIVE_PUBLISH_REQUEST/);
assert.match(nativeBackground, /Input\.dispatchKeyEvent/);
assert.match(nativeBackground, /Input\.dispatchMouseEvent/);
assert.match(nativeBackground, /une publication Classroom est déjà en cours/);
assert.match(nativeClassroom, /duplicateVisible/);
assert.match(nativeClassroom, /titleUnderlined/);
assert.match(nativeClassroom, /devoirBold/);
assert.match(nativeClassroom, /Aucun autre éditeur ne sera ouvert automatiquement/);
assert.doesNotMatch(nativeClassroom, /\.innerHTML\s*=/);

const stored = {};
const debuggerCommands = [];
const backgroundContext = {
  URL,
  console,
  chrome: {
    storage: { local: {
      async get(key) { return { [key]: stored[key] }; },
      async set(values) { Object.assign(stored, values); },
      async remove(key) { delete stored[key]; }
    } },
    tabs: { async create({ url }) { return { id: 202, url }; } },
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
const claimed = await backgroundContext.handleMessage({ type: 'claim' }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.equal(claimed.job.courseId, '875523698222');
await backgroundContext.handleMessage({ type: 'paste' }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.deepEqual(debuggerCommands.map(command => command.method), ['Input.dispatchKeyEvent', 'Input.dispatchKeyEvent']);
await backgroundContext.handleMessage({ type: 'publish', x: 800, y: 650 }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.deepEqual(debuggerCommands.slice(-2).map(command => command.method), ['Input.dispatchMouseEvent', 'Input.dispatchMouseEvent']);
await backgroundContext.handleMessage({ type: 'complete' }, { tab: { id: 202, url: 'https://classroom.google.com/c/ODc1NTIzNjk4MjIy' } });
assert.equal(stored.pdcNativeClassroomJob, undefined);

const sanitizerStart = userscript.indexOf('function decodeHtmlText');
const sanitizerEnd = userscript.indexOf('function note', sanitizerStart);
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

assert.match(app, /LOCAL_PLAN_BACKUP_KEY/);
assert.match(app, /loadedCourseId: currentLoadedCourseId/);
assert.match(app, /loadedSupplyId: currentLoadedSupplyId/);
assert.match(app, /seenCourseIdentities/);
assert.match(app, /seenSupplyIdentities/);
assert.match(app, /seenActivities/);
assert.match(app, /'supply-links'/);

console.log('Tests Classroom, routage et persistance: OK');
