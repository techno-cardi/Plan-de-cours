import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../chrome-classroom-native-bridge/classroom.js', import.meta.url), 'utf8');
const start = source.indexOf('  function announcementEditor() {');
const end = source.indexOf('\n  async function openAnnouncementEditor()', start);
assert.ok(start !== -1 && end > start, 'fonction de détection de l’éditeur Classroom introuvable');
const functionSource = source.slice(start, end);
const fold = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

function element({ label = '', placeholder = '', composer = false, visible = true, hidden = false, disabled = false } = {}) {
  return {
    getClientRects: () => visible ? [{}] : [],
    getAttribute: name => ({
      'aria-label': label,
      'data-placeholder': placeholder,
      'aria-disabled': disabled ? 'true' : '',
    }[name] || ''),
    closest: selector => selector.includes('aria-hidden') ? (hidden ? {} : null) : (composer ? {} : null),
  };
}

function detect(candidates) {
  const context = { document: { querySelectorAll: selector => {
    assert.equal(selector, '[contenteditable="true"]');
    return candidates;
  } }, fold };
  vm.createContext(context);
  return vm.runInContext(functionSource + '\nannouncementEditor()', context);
}

test('trouve un champ étiqueté Annonce dans Classroom', () => {
  const editor = element({ label: 'Écrire votre annonce' });
  assert.equal(detect([element(), editor]), editor);
});

test('accepte la variante anglophone de l’éditeur', () => {
  const editor = element({ placeholder: 'Share something with your class' });
  assert.equal(detect([element(), editor]), editor);
});

test('reconnaît un éditeur unique dans le dialogue même sans libellé ARIA', () => {
  const editor = element({ composer: true });
  assert.equal(detect([element(), editor]), editor);
});

test('écarte les champs invisibles et les champs désactivés', () => {
  const editor = element({ label: 'Annonce' });
  assert.equal(detect([element({ label: 'Annonce', visible: false }), element({ label: 'Annonce', disabled: true }), editor]), editor);
});

test('ne colle jamais dans un des plusieurs champs ambigus', () => {
  assert.equal(detect([element(), element()]), null);
});

test('un seul éditeur visible demeure détectable sans libellé', () => {
  const editor = element();
  assert.equal(detect([editor]), editor);
});

test('le collage ne peut être relancé que si le champ est toujours vide', () => {
  assert.match(source, /attempt < 2 && !pasted/);
  assert.match(source, /if \(!pasted && fold\(editor\.innerText \|\| editor\.textContent \|\| ''\)\)/);
  assert.match(source, /if \(!pasted\) throw new Error/);
  const positionVerify = source.indexOf('if (!pasted) throw new Error');
  const positionPublish = source.indexOf("const publishLabel =");
  assert.ok(positionVerify > 0 && positionPublish > positionVerify, 'aucune publication ne doit précéder la vérification du collage');
});
