from pathlib import Path
import re

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.3', '// @version      1.0.4', 1)

helpers = r'''
  function foldText(value) {
    return norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function findNewAnnouncementButton() {
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);
    return buttons.find(el => {
      const txt = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
      return txt === 'nouvelle annonce' || txt.includes('nouvelle annonce') ||
             txt === 'new announcement' || txt.includes('new announcement');
    }) || null;
  }

  function findAnnouncementSurface() {
    const promptMatches = value => {
      const txt = foldText(value);
      return txt.includes('annoncez quelque chose a votre classe') ||
             txt.includes('announce something to your class');
    };
    const actionText = el => foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
    const hasAnnouncementActions = root => {
      const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(visible);
      const texts = buttons.map(actionText);
      const hasCancel = texts.some(t => t === 'annuler' || t === 'cancel');
      const hasPublish = texts.some(t => t === 'publier' || t === 'post' || t.startsWith('publier '));
      return hasCancel || hasPublish;
    };

    // Première méthode : partir du vrai éditeur et vérifier qu'il appartient au panneau « Annonce ».
    const editors = Array.from(document.querySelectorAll('[contenteditable="true"],[role="textbox"]')).filter(visible);
    for (const editor of editors) {
      let root = editor;
      for (let i = 0; i < 14 && root; i++, root = root.parentElement) {
        const descriptor = `${root.textContent || ''} ${root.getAttribute?.('aria-label') || ''} ${root.getAttribute?.('data-placeholder') || ''}`;
        if (promptMatches(descriptor) && hasAnnouncementActions(root)) {
          return { root, editor };
        }
      }
    }

    // Deuxième méthode : partir du libellé « Annoncez quelque chose à votre classe » puis remonter au panneau.
    const labels = Array.from(document.querySelectorAll('div,span,p,label')).filter(visible);
    for (const label of labels) {
      const descriptor = `${label.textContent || ''} ${label.getAttribute?.('aria-label') || ''} ${label.getAttribute?.('data-placeholder') || ''}`;
      if (!promptMatches(descriptor)) continue;
      let root = label;
      for (let i = 0; i < 14 && root; i++, root = root.parentElement) {
        const editor = Array.from(root.querySelectorAll('[contenteditable="true"],[role="textbox"]')).find(visible);
        if (editor && hasAnnouncementActions(root)) return { root, editor };
      }
    }
    return null;
  }
'''

marker = '  function findAnnouncementEditor() {'
pos = s.find(marker)
assert pos != -1, 'findAnnouncementEditor introuvable'
s = s[:pos] + helpers + '\n' + s[pos:]

editor_new = r'''  function findAnnouncementEditor() {
    return findAnnouncementSurface()?.editor || null;
  }
'''
s, n = re.subn(r'  function findAnnouncementEditor\(\) \{.*?\n  \}\n\n  function insertRichHtml', editor_new + '\n  function insertRichHtml', s, count=1, flags=re.S)
assert n == 1, 'findAnnouncementEditor non remplacé'

auto_new = r'''  async function automateClassroom() {
    let pending = GM_getValue(PENDING_KEY, null);
    if (!pending || !pending.id) return;
    if (Date.now() - Number(pending.createdAt || 0) > MAX_AGE_MS) {
      GM_deleteValue(PENDING_KEY);
      return;
    }
    if (GM_getValue(LAST_DONE_KEY, '') === pending.id || pending.status === 'submitted') return;

    try { GM_setClipboard(pending.html, 'html'); } catch (_) {}

    if (pending.alternateLink) {
      try {
        const target = new URL(pending.alternateLink);
        if (target.hostname === 'classroom.google.com' && target.pathname.includes('/c/') && !location.pathname.includes('/c/')) {
          location.href = pending.alternateLink;
          return;
        }
      } catch (_) {}
    }

    if (!location.pathname.includes('/c/')) {
      for (let i = 0; i < 20; i++) {
        const link = findClassLink(pending);
        if (link) { link.click(); return; }
        await sleep(500);
      }
      showClassroomFallback(`Je n’ai pas retrouvé automatiquement le groupe « ${pending.courseLabel || pending.courseName} ».`);
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    // Ne jamais prendre un champ de commentaire du fil. Le seul éditeur admissible
    // doit appartenir au panneau « Annonce » avec le libellé Classroom et Annuler/Publier.
    let surface = findAnnouncementSurface();
    if (!surface) {
      let trigger = null;
      for (let i = 0; i < 30 && !trigger; i++) {
        trigger = findNewAnnouncementButton();
        if (!trigger) await sleep(250);
      }
      if (!trigger) {
        showClassroomFallback('Je suis dans le groupe, mais je n’ai pas retrouvé le bouton « Nouvelle annonce ».');
        pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
      }

      activateElement(trigger);

      for (let i = 0; i < 35 && !surface; i++) {
        await sleep(200);
        surface = findAnnouncementSurface();
      }
    }

    if (!surface?.editor) {
      showClassroomFallback('La fenêtre « Annonce » s’est ouverte, mais je n’ai pas retrouvé son champ de rédaction.');
      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
    }

    const editor = surface.editor;
    const inserted = insertRichHtml(editor, pending.html, pending.text);
    if (!inserted) {
      console.warn('[Plan de cours → Classroom] Mauvais éditeur évité. Panneau annonce détecté:', surface.root, 'éditeur:', editor);
      showClassroomFallback('La bonne fenêtre « Annonce » est ouverte, mais Classroom a refusé l’insertion riche automatique.');
      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
    }

    let postButton = null;
    for (let i = 0; i < 25 && !postButton; i++) {
      postButton = findPostButton(editor);
      if (!postButton) await sleep(200);
    }
    if (!postButton) {
      const disabledPost = findPostButton(editor, true);
      console.warn('[Plan de cours → Classroom] Bouton Publier:', disabledPost || 'introuvable');
      showClassroomFallback('Le plan est dans l’annonce, mais le bouton « Publier » n’est pas devenu disponible.');
      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
    }

    const actual = norm(editor.innerText || editor.textContent);
    const expected = norm(pending.text);
    const signature = expected.slice(0, Math.min(70, expected.length));
    if (!signature || !actual.includes(signature)) {
      showClassroomFallback('La vérification du contenu de l’annonce a échoué; publication automatique annulée.');
      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
    }

    pending.status = 'submitted';
    GM_setValue(PENDING_KEY, pending);
    GM_setValue(LAST_DONE_KEY, pending.id);
    activateElement(postButton);
    notify(`Plan publié dans ${pending.courseLabel || pending.courseName || 'Classroom'}.`);
    setTimeout(() => GM_deleteValue(PENDING_KEY), 12000);
  }
'''
s, n = re.subn(r'  async function automateClassroom\(\) \{.*?\n  \}\n\n  if \(isPlanPage\)', auto_new + '\n  if (isPlanPage)', s, count=1, flags=re.S)
assert n == 1, 'automateClassroom non remplacé'

p.write_text(s, encoding='utf-8')
