from pathlib import Path
import re

# ---------- index.html ----------
idx = Path('index.html')
s = idx.read_text(encoding='utf-8')

css_marker = "  .btn-generate {\n"
quick_css = r'''  .quick-classroom-publish {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
  }
  .btn-group-publish {
    min-height: 48px;
    border: none;
    border-radius: 9px;
    padding: 11px 8px;
    background: var(--red);
    color: #fff;
    font: 700 0.9rem 'DM Sans', sans-serif;
    cursor: pointer;
    transition: background .18s ease, transform .08s ease, opacity .18s ease;
  }
  .btn-group-publish:hover:not(:disabled) { background: #a50d24; }
  .btn-group-publish:active:not(:disabled) { transform: scale(.98); }
  .btn-group-publish:disabled { opacity: .38; cursor: not-allowed; }
  #quick-classroom-status {
    min-height: 18px;
    margin-top: 7px;
    color: #888;
    font-size: .76rem;
    line-height: 1.35;
  }
  @media (max-width: 520px) {
    .quick-classroom-publish { grid-template-columns: 1fr; }
  }

'''
assert css_marker in s
s = s.replace(css_marker, quick_css + css_marker, 1)

old_generate = '''    <button class="btn-generate" onclick="generer()">Générer le plan de cours</button>'''
new_generate = '''    <div class="quick-classroom-publish" id="quick-classroom-publish" aria-label="Publication rapide dans Classroom">
      <button type="button" class="btn-group-publish" id="btn-publish-group-31" data-group="31" onclick="publishPlanToGroup('31')" disabled>Groupe 31</button>
      <button type="button" class="btn-group-publish" id="btn-publish-group-32" data-group="32" onclick="publishPlanToGroup('32')" disabled>Groupe 32</button>
      <button type="button" class="btn-group-publish" id="btn-publish-group-51" data-group="51" onclick="publishPlanToGroup('51')" disabled>Groupe 51</button>
    </div>
    <div id="quick-classroom-status">Connectez-vous à Google pour activer la publication en un clic.</div>'''
assert old_generate in s
s = s.replace(old_generate, new_generate, 1)

# Bump UI version and add concise changelog.
s = s.replace('<span class="changelog-version-badge">v1.0.11</span>', '<span class="changelog-version-badge">v1.0.12</span>', 1)
changelog_anchor = '''    <div class="changelog-section">\n      <h3>Listes propres - v1.0.11</h3>'''
changelog_new = '''    <div class="changelog-section">
      <h3>Publication Classroom en un clic - v1.0.12</h3>
      <ul>
        <li><strong>Groupes 31, 32 et 51</strong> : un clic génère l'aperçu et lance directement la publication dans le bon groupe.</li>
        <li><strong>Moins de clics</strong> : le bouton Générer séparé n'est plus nécessaire pour le plan de cours.</li>
        <li><strong>Publication plus sûre</strong> : le pont Tampermonkey ne relance plus une annonce après le clic sur Publier.</li>
      </ul>
    </div>

''' + changelog_anchor
assert changelog_anchor in s
s = s.replace(changelog_anchor, changelog_new, 1)
s = s.replace('onclick="openChangelog()">v1.0.11</button>', 'onclick="openChangelog()">v1.0.12</button>', 1)
idx.write_text(s, encoding='utf-8')

# ---------- app.js ----------
app = Path('app.js')
s = app.read_text(encoding='utf-8')

load_marker = 'async function loadClassroomCourses() {'
assert load_marker in s
quick_js = r'''const QUICK_CLASSROOM_GROUPS = ['31', '32', '51'];

function classroomCourseMatchesGroup(course, group) {
  const raw = `${course?.name || ''} ${course?.section || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const g = String(group || '').trim();
  if (!g) return false;
  const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^0-9])${escaped}(?:[^0-9]|$)`).test(raw);
}

function getClassroomCourseForGroup(group) {
  return classroomCourses.find(c => classroomCourseMatchesGroup(c, group)) || null;
}

function updateQuickClassroomButtons() {
  QUICK_CLASSROOM_GROUPS.forEach(group => {
    const btn = document.getElementById(`btn-publish-group-${group}`);
    if (!btn) return;
    const course = getClassroomCourseForGroup(group);
    btn.disabled = !googleAccessToken || !course;
    btn.dataset.courseId = course?.id ? String(course.id) : '';
    btn.title = course
      ? `Publier dans ${course.name}${course.section ? ' - ' + course.section : ''}`
      : `Aucun cours Classroom actif correspondant au groupe ${group}`;
  });
  const status = document.getElementById('quick-classroom-status');
  if (!status) return;
  if (!googleAccessToken) {
    status.textContent = 'Connectez-vous à Google pour activer la publication en un clic.';
    return;
  }
  const found = QUICK_CLASSROOM_GROUPS.filter(g => getClassroomCourseForGroup(g));
  status.textContent = found.length
    ? `Groupes prêts : ${found.join(', ')}.`
    : 'Aucun des groupes 31, 32 ou 51 n’a été retrouvé dans les cours Classroom actifs.';
}

async function publishPlanToGroup(group) {
  const course = getClassroomCourseForGroup(group);
  const btn = document.getElementById(`btn-publish-group-${group}`);
  const status = document.getElementById('quick-classroom-status');

  if (!googleAccessToken) {
    showToast('Connectez-vous à Google avant de publier dans Classroom.', 'warn', 3500);
    return;
  }
  if (!course) {
    showToast(`Le groupe ${group} n’a pas été retrouvé dans vos cours Classroom actifs.`, 'err', 4000);
    updateQuickClassroomButtons();
    return;
  }
  if (document.documentElement.dataset.pdcClassroomBridge !== '1') {
    showToast('Le script Tampermonkey de publication Classroom n’est pas actif.', 'err', 4500);
    return;
  }

  const emojiBox = document.getElementById('avec-emojis');
  if (emojiBox) emojiBox.checked = true;

  const original = btn?.textContent || `Groupe ${group}`;
  if (btn) { btn.disabled = true; btn.textContent = 'Préparation…'; }
  if (status) status.textContent = `Préparation du plan pour le groupe ${group}…`;

  try {
    await generer();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const select = document.getElementById('classroom-course-select');
    if (select) select.value = String(course.id);

    document.dispatchEvent(new CustomEvent('pdc:publish-course', {
      detail: { courseId: String(course.id), group: String(group) }
    }));

    if (btn) btn.textContent = 'Ouverture…';
    if (status) status.textContent = `Ouverture de Classroom - groupe ${group}…`;
    setTimeout(() => {
      if (btn) btn.textContent = original;
      updateQuickClassroomButtons();
    }, 3500);
  } catch (err) {
    console.error('Publication rapide Classroom', err);
    if (btn) btn.textContent = original;
    updateQuickClassroomButtons();
    if (status) status.textContent = `Échec de préparation pour le groupe ${group}.`;
    showToast('Impossible de préparer le plan pour Classroom.', 'err', 4000);
  }
}

document.addEventListener('DOMContentLoaded', updateQuickClassroomButtons);

'''
s = s.replace(load_marker, quick_js + load_marker, 1)

# Refresh the fixed group buttons after Classroom courses load.
old_status = "  setStatus('classroom-status', classroomCourses.length ? `${classroomCourses.length} cours actif(s) trouvés.` : 'Aucun cours actif trouvé.', classroomCourses.length ? 'ok' : '');\n}"
new_status = "  setStatus('classroom-status', classroomCourses.length ? `${classroomCourses.length} cours actif(s) trouvés.` : 'Aucun cours actif trouvé.', classroomCourses.length ? 'ok' : '');\n  updateQuickClassroomButtons();\n}"
assert old_status in s
s = s.replace(old_status, new_status, 1)
app.write_text(s, encoding='utf-8')

# ---------- userscript ----------
us = Path('classroom-rich-publish.user.js')
s = us.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.8', '// @version      1.0.9', 1)

# Replace the plan-page bridge with one shared launch path for Copy and the new group buttons.
launch_pattern = re.compile(r"  async function launchFromPlanPage\(\) \{.*?\n  \}\n\n  function findClassLink", re.S)
launch_replacement = r'''  async function launchFromPlanPage() {
    const preview = document.getElementById('plan-preview');
    const copyBtn = document.getElementById('btn-copy');
    if (!preview || !copyBtn) return;

    document.documentElement.dataset.pdcClassroomBridge = '1';
    let handling = false;

    async function startPublish(courseId) {
      if (handling) return;
      handling = true;
      try {
        if (preview.querySelector('.empty-state') || !htmlToText(preview.innerHTML)) {
          alert('Le plan n’est pas encore prêt à être publié.');
          return;
        }
        const sourceSelect = document.getElementById('classroom-course-select');
        const option = sourceSelect ? Array.from(sourceSelect.options).find(o => String(o.value) === String(courseId)) : null;
        if (!courseId || !option) {
          alert('Le groupe Classroom choisi n’est pas disponible dans le générateur.');
          return;
        }
        sourceSelect.value = String(courseId);
        const details = await requestCourseDetails(courseId);
        const rawHtml = preview.innerHTML.trim();
        const html = cleanRichHtml(rawHtml).normalize('NFC');
        const text = htmlToText(html).normalize('NFC');
        if (!text) return;

        const pending = {
          id: crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
          courseId: String(courseId),
          courseLabel: option?.textContent?.trim() || details?.name || '',
          courseName: details?.name || option?.textContent?.trim() || '',
          courseSection: details?.section || '',
          alternateLink: details?.alternateLink || '',
          html,
          text,
          createdAt: Date.now(),
          status: 'pending'
        };

        GM_setValue(PENDING_KEY, pending);
        try { GM_setClipboard(html, 'html'); } catch (_) {}
        const target = pending.alternateLink || 'https://classroom.google.com/u/0/h/tv';
        GM_openInTab(target, { active: true, insert: true, setParent: true });
      } catch (err) {
        console.error('[Plan de cours → Classroom]', err);
        alert('Le plan a rencontré un problème avant l’ouverture de Classroom : ' + (err?.message || err));
      } finally {
        handling = false;
      }
    }

    copyBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const courseId = await chooseCourse();
      if (courseId) await startPublish(courseId);
    }, true);

    document.addEventListener('pdc:publish-course', async event => {
      const courseId = String(event.detail?.courseId || '');
      if (courseId) await startPublish(courseId);
    });

    const existing = document.querySelector('.pdc-bridge-ready-note');
    if (!existing) {
      const note = document.createElement('div');
      note.className = 'pdc-bridge-ready-note';
      note.textContent = 'Automatisation Classroom riche active';
      copyBtn.parentElement?.appendChild(note);
    }
  }

  function findClassLink'''
s, n = launch_pattern.subn(launch_replacement, s, count=1)
assert n == 1, 'launchFromPlanPage non remplacé'

# Replace the strict insertion verifier. Prefer the native browser editor path that already visibly worked.
insert_pattern = re.compile(r"  async function insertRichHtml\(editor, html, expectedText\) \{.*?\n  \}\n\n\n  const CLASSROOM_CREATE_TEMPLATE", re.S)
insert_replacement = r'''  function comparableText(value) {
    return foldText(value)
      .replace(/[\uFE0E\uFE0F\u20E3]/g, '')
      .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function contentLooksInserted(editor, expectedText) {
    const actualRaw = String(editor?.innerText || editor?.textContent || '').trim();
    if (actualRaw.length < 12) return false;
    const actual = comparableText(actualRaw);
    const expected = comparableText(expectedText);
    if (!actual || !expected) return false;
    const words = [...new Set(expected.split(' ').filter(w => w.length >= 3))].slice(0, 10);
    if (!words.length) return actual.length >= 12;
    const hits = words.filter(w => actual.includes(w)).length;
    const needed = Math.min(3, words.length);
    return hits >= needed || actual.length >= Math.min(45, Math.max(18, Math.round(expected.length * 0.45)));
  }

  async function insertRichHtml(editor, html, expectedText) {
    editor = resolveEditableElement(editor) || editor;
    if (!editor || editor.getAttribute?.('contenteditable') !== 'true') return false;

    editor.scrollIntoView?.({ block:'center' });
    editor.focus();
    clearEditorNative(editor);

    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    await sleep(260);
    if (contentLooksInserted(editor, expectedText)) return true;

    clearEditorNative(editor);
    try { insertRunsWithExecCommand(editor, html); } catch (err) {
      console.warn('[Plan de cours → Classroom] Insertion native échouée:', err);
    }
    await sleep(260);
    return contentLooksInserted(editor, expectedText);
  }

  const CLASSROOM_CREATE_TEMPLATE'''
s, n = insert_pattern.subn(insert_replacement, s, count=1)
assert n == 1, 'insertRichHtml non remplacé'

# Remove the experimental Classroom RPC section entirely. It created drafts and is no longer used.
rpc_pattern = re.compile(r"\n  const CLASSROOM_CREATE_TEMPLATE = .*?\n  function findPostButton\(editor, allowDisabled = false\) \{", re.S)
rpc_replacement = r'''
  function findPostButton(surface, allowDisabled = false) {'''
s, n = rpc_pattern.subn(rpc_replacement, s, count=1)
assert n == 1, 'bloc RPC non retiré'

# Replace findPostButton body so it cannot escape the active announcement surface.
post_pattern = re.compile(r"  function findPostButton\(surface, allowDisabled = false\) \{.*?\n  \}\n\n  function showClassroomFallback", re.S)
post_replacement = r'''  function findPostButton(surface, allowDisabled = false) {
    const root = surface?.root;
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(el => {
      if (!visible(el)) return false;
      if (allowDisabled) return true;
      return !el.disabled && el.getAttribute('aria-disabled') !== 'true';
    });
    return buttons.find(el => {
      const txt = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
      return txt === 'publier' || txt === 'post';
    }) || null;
  }

  function pageContainsPublishedPlan(expectedText) {
    if (findAnnouncementSurface()) return false;
    const body = comparableText(document.body?.innerText || '');
    const expected = comparableText(expectedText);
    const words = [...new Set(expected.split(' ').filter(w => w.length >= 4))].slice(0, 8);
    if (!words.length) return false;
    const hits = words.filter(w => body.includes(w)).length;
    return hits >= Math.min(3, words.length);
  }

  function showClassroomFallback'''
s, n = post_pattern.subn(post_replacement, s, count=1)
assert n == 1, 'findPostButton non remplacé'

# Never retry manual/clicking states.
s = s.replace("    if (GM_getValue(LAST_DONE_KEY, '') === pending.id || pending.status === 'submitted') return;",
              "    if (GM_getValue(LAST_DONE_KEY, '') === pending.id || ['submitted','clicking','manual'].includes(pending.status)) return;", 1)

# Replace the final insert/verify/publish section.
flow_pattern = re.compile(r"    const editor = surface\.editor;\n    const inserted = await insertRichHtml\(editor, pending\.html, pending\.text\);.*?    setTimeout\(\(\) => GM_deleteValue\(PENDING_KEY\), 12000\);", re.S)
flow_replacement = r'''    const editor = surface.editor;
    const inserted = await insertRichHtml(editor, pending.html, pending.text);
    if (!inserted) {
      showClassroomFallback('Le contenu n’a pas été détecté dans le vrai champ de l’annonce. Aucune autre annonce ne sera ouverte.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    let postButton = null;
    for (let i = 0; i < 25 && !postButton; i++) {
      postButton = findPostButton(surface);
      if (!postButton) await sleep(200);
    }
    if (!postButton) {
      showClassroomFallback('Le contenu est dans l’annonce, mais le bouton « Publier » de cette fenêtre n’est pas disponible.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    if (!contentLooksInserted(editor, pending.text)) {
      showClassroomFallback('Le champ contient du texte, mais pas assez d’éléments du plan pour publier sans risque.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    // Verrouiller AVANT le clic : une navigation ou une mutation Classroom ne doit jamais relancer le script.
    pending.status = 'clicking';
    GM_setValue(PENDING_KEY, pending);
    GM_setValue(LAST_DONE_KEY, pending.id);
    postButton.click();

    let confirmed = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      if (pageContainsPublishedPlan(pending.text)) {
        confirmed = true;
        break;
      }
    }

    if (confirmed) {
      pending.status = 'submitted';
      GM_setValue(PENDING_KEY, pending);
      notify(`Plan publié dans ${pending.courseLabel || pending.courseName || 'Classroom'}.`);
      setTimeout(() => GM_deleteValue(PENDING_KEY), 5000);
    } else {
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      showClassroomFallback('Classroom a reçu le clic sur « Publier », mais je n’ai pas pu confirmer l’apparition du plan dans le fil. Je ne relance rien automatiquement.');
    }'''
s, n = flow_pattern.subn(flow_replacement, s, count=1)
assert n == 1, 'flux final non remplacé'

us.write_text(s, encoding='utf-8')
