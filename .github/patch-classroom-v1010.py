from pathlib import Path
import re

# ---------------- app.js ----------------
app = Path('app.js')
s = app.read_text(encoding='utf-8')

# Groupe: score explicite, priorité à "Groupe 31" plutôt qu'à un simple nombre isolé.
pat = re.compile(r"function classroomCourseMatchesGroup\(course, group\) \{.*?\n\}\n\nfunction getClassroomCourseForGroup\(group\) \{.*?\n\}\n", re.S)
replacement = '''function classroomCourseScoreGroup(course, group) {
  const raw = `${course?.name || ''} ${course?.section || ''}`
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
  const g = String(group || '').trim();
  if (!g) return 0;
  const escaped = g.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  if (new RegExp(`\\bGROUPE\\s*[-–—:]?\\s*${escaped}\\b`).test(raw)) return 120;
  if (new RegExp(`\\b(?:FRA|FRANCAIS|SAE)[^\\n]{0,30}(?:-|\\s)${escaped}\\b`).test(raw)) return 90;
  if (new RegExp(`(?:^|[^0-9])${escaped}(?:[^0-9]|$)`).test(raw)) return 50;
  return 0;
}

function getClassroomCourseForGroup(group) {
  const ranked = classroomCourses
    .map(course => ({ course, score: classroomCourseScoreGroup(course, group) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    console.warn(`Plusieurs cours Classroom correspondent au groupe ${group}`, ranked.slice(0, 3));
    return null;
  }
  return ranked[0].course;
}
'''
s, n = pat.subn(lambda m: replacement, s, count=1)
assert n == 1, 'bloc de correspondance des groupes introuvable'

# Ne jamais publier un ancien aperçu si generer() quitte tôt.
needle = "  try {\n    await generer();\n    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n"
repl = "  try {\n    latestGeneratedText = '';\n    latestGeneratedHtml = '';\n    await generer();\n    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n    if (!latestGeneratedText || !latestGeneratedHtml) {\n      throw new Error('Le plan courant n’a pas pu être généré.');\n    }\n"
assert needle in s, 'début publishPlanToGroup introuvable'
s = s.replace(needle, repl, 1)

# Envoyer au pont toutes les infos déjà connues, y compris alternateLink.
old_event = """    document.dispatchEvent(new CustomEvent('pdc:publish-course', {\n      detail: { courseId: String(course.id), group: String(group) }\n    }));"""
new_event = """    document.dispatchEvent(new CustomEvent('pdc:publish-course', {\n      detail: {\n        courseId: String(course.id),\n        group: String(group),\n        courseName: course.name || '',\n        courseSection: course.section || '',\n        alternateLink: course.alternateLink || ''\n      }\n    }));"""
assert old_event in s, 'événement rapide introuvable'
s = s.replace(old_event, new_event, 1)
app.write_text(s, encoding='utf-8')

# ---------------- userscript ----------------
us = Path('classroom-rich-publish.user.js')
s = us.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.9', '// @version      1.0.10', 1)

# Pont du générateur: le chemin one-click n'injecte plus de script pour retrouver le cours.
launch_pat = re.compile(r"  async function launchFromPlanPage\(\) \{.*?\n  \}\n\n  function findClassLink", re.S)
launch_repl = '''  async function launchFromPlanPage() {
    const preview = document.getElementById('plan-preview');
    const copyBtn = document.getElementById('btn-copy');
    if (!preview || !copyBtn) return;

    document.documentElement.dataset.pdcClassroomBridge = '1';
    let handling = false;

    async function startPublish(input) {
      if (handling) return;
      handling = true;
      try {
        const courseId = String(input?.courseId || input || '');
        if (!courseId) return;
        if (preview.querySelector('.empty-state') || !htmlToText(preview.innerHTML)) {
          alert('Le plan courant n’est pas prêt à être publié.');
          return;
        }

        const sourceSelect = document.getElementById('classroom-course-select');
        const option = sourceSelect ? Array.from(sourceSelect.options).find(o => String(o.value) === courseId) : null;
        if (sourceSelect && option) sourceSelect.value = courseId;

        let details = null;
        if (input && typeof input === 'object') {
          details = {
            id: courseId,
            name: input.courseName || option?.textContent?.trim() || '',
            section: input.courseSection || '',
            alternateLink: input.alternateLink || ''
          };
        }
        if (!details?.alternateLink || !details?.name) {
          const fallback = await requestCourseDetails(courseId);
          if (fallback) details = { ...details, ...fallback };
        }
        details = details || { id: courseId, name: option?.textContent?.trim() || '', section:'', alternateLink:'' };

        const rawHtml = preview.innerHTML.trim();
        const html = cleanRichHtml(rawHtml).normalize('NFC');
        const text = htmlToText(html).normalize('NFC');
        if (!text || !html) {
          alert('Le plan courant est vide.');
          return;
        }

        const pending = {
          id: crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
          courseId,
          courseLabel: option?.textContent?.trim() || details.name || '',
          courseName: details.name || option?.textContent?.trim() || '',
          courseSection: details.section || '',
          alternateLink: details.alternateLink || '',
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
      if (courseId) await startPublish({ courseId });
    }, true);

    document.addEventListener('pdc:publish-course', async event => {
      const detail = event.detail || {};
      if (detail.courseId) await startPublish(detail);
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
s, n = launch_pat.subn(lambda m: launch_repl, s, count=1)
assert n == 1, 'launchFromPlanPage introuvable'

# Vérification du contenu: mots distinctifs + couverture des emojis attendus.
verify_pat = re.compile(r"  function comparableText\(value\) \{.*?\n  async function insertRichHtml\(editor, html, expectedText\) \{.*?\n  \}\n", re.S)
verify_repl = r'''  function comparableText(value) {
    return foldText(value)
      .replace(/[\uFE0E\uFE0F\u20E3]/g, '')
      .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function meaningfulWords(value) {
    const stop = new Set(['cours','groupe','devoir','devoirs','rappel','rappels','aucun','aucune','pour','dans','avec','sans','les','des','une','est','sont','aout','septembre','octobre','novembre','decembre','janvier','fevrier','mars','avril','mai','juin','juillet']);
    return [...new Set(comparableText(value).split(' ').filter(w => w.length >= 3 && !stop.has(w)))];
  }

  function emojiTokens(value) {
    const s = String(value || '');
    const tokens = [];
    const re = /(?:[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;
    for (const m of s.matchAll(re)) tokens.push(m[0].replace(/[\uFE0E\uFE0F]/g, ''));
    return tokens;
  }

  function emojiCoverageOkay(actualRaw, expectedText) {
    const expected = [...new Set(emojiTokens(expectedText))];
    if (!expected.length) return true;
    const actual = new Set(emojiTokens(actualRaw));
    const hits = expected.filter(x => actual.has(x)).length;
    return hits >= Math.max(1, Math.ceil(expected.length * 0.75));
  }

  function contentLooksInserted(editor, expectedText) {
    const actualRaw = String(editor?.innerText || editor?.textContent || '').trim();
    if (actualRaw.length < 8) return false;
    const actual = comparableText(actualRaw);
    const expected = comparableText(expectedText);
    if (!actual || !expected) return false;

    const words = meaningfulWords(expectedText).slice(0, 12);
    const hits = words.filter(w => actual.includes(w)).length;
    const wordOk = words.length ? hits >= Math.min(3, words.length) : actual.length >= 8;
    return wordOk && emojiCoverageOkay(actualRaw, expectedText);
  }

  async function insertRichHtml(editor, html, expectedText) {
    editor = resolveEditableElement(editor) || editor;
    if (!editor || editor.getAttribute?.('contenteditable') !== 'true') return false;

    editor.scrollIntoView?.({ block:'center' });
    editor.focus();
    clearEditorNative(editor);

    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    await sleep(450);
    if (contentLooksInserted(editor, expectedText)) return true;

    clearEditorNative(editor);
    try { insertRunsWithExecCommand(editor, html); } catch (err) {
      console.warn('[Plan de cours → Classroom] Insertion native échouée:', err);
    }
    await sleep(450);
    return contentLooksInserted(editor, expectedText);
  }
'''
s, n = verify_pat.subn(lambda m: verify_repl, s, count=1)
assert n == 1, 'vérification insertion introuvable'

# Cibler le vrai bouton principal Publier dans la surface active.
post_pat = re.compile(r"  function findPostButton\(surface, allowDisabled = false\) \{.*?\n  \}\n\n  function pageContainsPublishedPlan\(expectedText\) \{.*?\n  \}\n", re.S)
post_repl = r'''  function findPostButton(surface, allowDisabled = false) {
    const root = surface?.root;
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(el => {
      if (!visible(el)) return false;
      if (!allowDisabled && (el.disabled || el.getAttribute('aria-disabled') === 'true')) return false;
      return true;
    });
    const score = el => {
      const text = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('data-tooltip') || ''}`).trim();
      if (text === 'publier' || text === 'post') return 100;
      if (text.startsWith('publier ') && !text.includes('plus tard')) return 80;
      return 0;
    };
    return buttons.map(el => ({el, score:score(el)})).filter(x => x.score > 0).sort((a,b) => b.score-a.score)[0]?.el || null;
  }

  function pageContainsPublishedPlan(expectedText) {
    if (findAnnouncementSurface()) return false;
    const bodyRaw = String(document.body?.innerText || '');
    const body = comparableText(bodyRaw);
    const firstLine = comparableText(String(expectedText || '').split(/\r?\n/)[0]);
    if (firstLine && firstLine.length >= 8 && body.includes(firstLine)) return true;
    const words = meaningfulWords(expectedText).slice(0, 8);
    if (!words.length) return false;
    const hits = words.filter(w => body.includes(w)).length;
    return hits >= Math.min(4, words.length);
  }
'''
s, n = post_pat.subn(lambda m: post_repl, s, count=1)
assert n == 1, 'findPostButton/pageContainsPublishedPlan introuvable'

# Attendre plus longtemps l'activation du bouton: le HAR montre un autosave avant publication.
s = s.replace("for (let i = 0; i < 25 && !postButton; i++)", "for (let i = 0; i < 60 && !postButton; i++)", 1)

# Un seul clic natif, verrouillage déjà posé avant.
s = s.replace("    postButton.click();\n\n    let confirmed = false;", "    try { HTMLButtonElement.prototype.click.call(postButton); } catch (_) { postButton.click(); }\n\n    let confirmed = false;", 1)
us.write_text(s, encoding='utf-8')

# ---------------- index version ----------------
idx = Path('index.html')
s = idx.read_text(encoding='utf-8')
s = s.replace('<span class="changelog-version-badge">v1.0.12</span>', '<span class="changelog-version-badge">v1.0.13</span>', 1)
s = s.replace('onclick="openChangelog()">v1.0.12</button>', 'onclick="openChangelog()">v1.0.13</button>', 1)
anchor = '    <div class="changelog-section">\n      <h3>Publication Classroom en un clic - v1.0.12</h3>'
if anchor in s:
    extra = '''    <div class="changelog-section">
      <h3>Fiabilité Classroom - v1.0.13</h3>
      <ul>
        <li><strong>Groupe exact</strong> : les boutons privilégient explicitement « Groupe 31 », « Groupe 32 » et « Groupe 51 » et refusent une correspondance ambiguë.</li>
        <li><strong>Aucun ancien aperçu</strong> : une génération refusée ne peut plus publier le plan précédent.</li>
        <li><strong>Emojis vérifiés</strong> : la publication n'est lancée que si la majorité des emojis attendus sont réellement présents dans l'annonce.</li>
        <li><strong>Publier sécurisé</strong> : attente plus longue de l'activation du vrai bouton principal avant un seul clic natif.</li>
      </ul>
    </div>

'''
    s = s.replace(anchor, extra + anchor, 1)
idx.write_text(s, encoding='utf-8')
