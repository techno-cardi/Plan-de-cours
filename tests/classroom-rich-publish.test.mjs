import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const userscript = fs.readFileSync(new URL('../classroom-rich-publish.user.js', import.meta.url), 'utf8');
const versionedUserscript = fs.readFileSync(new URL('../classroom-rich-publish-v1.1.1.user.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.equal(versionedUserscript.trimEnd(), userscript.trimEnd(), 'La copie v1.1.1 doit correspondre au script canonique');
assert.match(userscript, /@version\s+1\.1\.1/);
assert.match(userscript, /dataset\.pdcClassroomBridgeVersion = VERSION/);
assert.match(userscript, /status: 'verifying'/);
assert.match(userscript, /verified-visible/);
assert.doesNotMatch(userscript, /insertRichHtml|findPostButton|findNewAnnouncementButton|document\.execCommand|Nouvelle annonce/);
assert.doesNotMatch(userscript, /\.innerHTML\s*=/, 'Le userscript ne doit jamais écrire dans innerHTML (Trusted Types Classroom)');

const sanitizerStart = userscript.indexOf('function decodeHtmlText');
const sanitizerEnd = userscript.indexOf('function requestCourseDetails', sanitizerStart);
const sanitizerSource = sanitizerStart >= 0 && sanitizerEnd > sanitizerStart ? userscript.slice(sanitizerStart, sanitizerEnd).trim() : '';
assert.ok(sanitizerSource, 'Nettoyeur HTML sans DOM absent');
const sanitizerContext = {};
vm.createContext(sanitizerContext);
vm.runInContext(`${sanitizerSource}; this.clean = cleanRichHtml; this.toText = richHtmlToClassroomText;`, sanitizerContext);
const dirtyRich = '<div class="x"><strong onclick="bad()"><u>Cours #1</u></strong> 🌽</div><script>bad()</script><p>1️⃣&nbsp;Activité &amp; test<br><img alt="🏖️" src="bad"></p>';
const safeRich = sanitizerContext.clean(dirtyRich);
assert.equal(safeRich, '<p><b><u>Cours #1</u></b> 🌽</p><p>1️⃣&nbsp;Activité &amp; test<br>🏖️</p>');
assert.equal(sanitizerContext.toText(safeRich), 'Cours #1 🌽\n\n1️⃣ Activité & test\n🏖️');

const templateHashes = {
  CREATE: '705f0eccb53f77733e7ddf4e13161e3fc949d1846f1f538c0a8991f6ea070a17',
  SAVE: 'cc4a07b623f55aa52c9b35e84db3809dbabe0552b740ed3d20fa03a996d274a5',
  PUBLISH: '6035c68f1f017d7db39b98590112eb3ff737de4b73bb6ecdac231e1e150276b8'
};

for (const [name, expectedHash] of Object.entries(templateHashes)) {
  const match = userscript.match(new RegExp(`const CLASSROOM_${name}_TEMPLATE = (\\[.*\\]);`));
  assert.ok(match, `Modèle RPC ${name} absent`);
  assert.doesNotThrow(() => JSON.parse(match[1]), `Modèle RPC ${name} invalide`);
  assert.equal(crypto.createHash('sha256').update(match[1]).digest('hex'), expectedHash, `Modèle RPC ${name} modifié`);
}

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
