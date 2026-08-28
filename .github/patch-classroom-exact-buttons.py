from pathlib import Path
import re

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.2', '// @version      1.0.3', 1)

composer_new = r'''  function findComposerTrigger() {
    const exactLabels = ['nouvelle annonce', 'new announcement'];
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);

    // Priorité absolue au vrai bouton montré dans Classroom.
    for (const el of buttons) {
      const txt = composerText(el);
      if (exactLabels.some(label => txt === label || txt.includes(label))) return el;
    }

    // Si le texte est porté par un span enfant, remonter au bouton parent.
    const textNodes = Array.from(document.querySelectorAll('span,div')).filter(visible);
    for (const el of textNodes) {
      const txt = norm(el.textContent || '');
      if (exactLabels.some(label => txt === label || txt.includes(label))) {
        const button = el.closest('button,[role="button"]');
        if (button && visible(button)) return button;
      }
    }

    // Secours pour une éventuelle traduction ou légère variation de Google.
    const seen = new Set();
    const candidates = [];
    const add = el => {
      const clickable = clickableAncestor(el);
      if (!clickable || seen.has(clickable) || !visible(clickable)) return;
      seen.add(clickable);
      const score = Math.max(composerScore(el), composerScore(clickable));
      if (score > 0) candidates.push({ el: clickable, score });
    };
    textCandidates().forEach(add);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.score >= 90 ? candidates[0].el : null;
  }
'''
s, n = re.subn(r'  function findComposerTrigger\(\) \{.*?\n  \}\n\n  function activateElement', composer_new + '\n  function activateElement', s, count=1, flags=re.S)
assert n == 1, 'findComposerTrigger non remplacé'

editor_new = r'''  function findAnnouncementEditor() {
    const all = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"]')).filter(visible);
    if (!all.length) return null;

    // Le champ actuel de Classroom affiche « Annoncez quelque chose à votre classe ».
    const exact = all.find(el => {
      const own = composerText(el);
      const parentText = composerText(el.parentElement);
      const grandParentText = composerText(el.parentElement?.parentElement);
      const hay = `${own} ${parentText} ${grandParentText}`;
      return /annoncez quelque chose a votre classe|announce something to your class/.test(hay);
    });
    if (exact) return exact;

    // Dans la fenêtre « Annonce », privilégier le plus grand champ éditable visible.
    const scored = all.map(el => {
      const r = el.getBoundingClientRect();
      const label = composerText(el);
      let score = Math.min(r.width, 900) / 8 + Math.min(r.height, 350) / 8;
      if (/annonc|announc|classe|class/.test(label)) score += 140;
      if (r.width > 300) score += 50;
      if (r.height > 35) score += 30;
      if (r.top > 100 && r.top < innerHeight * 0.8) score += 20;
      return { el, score };
    }).sort((a,b) => b.score - a.score);
    return scored[0]?.el || null;
  }
'''
s, n = re.subn(r'  function findAnnouncementEditor\(\) \{.*?\n  \}\n\n  function insertRichHtml', editor_new + '\n  function insertRichHtml', s, count=1, flags=re.S)
assert n == 1, 'findAnnouncementEditor non remplacé'

post_new = r'''  function findPostButton(editor, allowDisabled = false) {
    const isUsable = el => visible(el) && (allowDisabled || (!el.disabled && el.getAttribute('aria-disabled') !== 'true'));

    // Le bouton montré dans la fenêtre Classroom est littéralement « Publier ».
    const allButtons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(isUsable);
    const exact = allButtons.find(el => {
      const txt = norm(el.textContent || el.getAttribute('aria-label') || '');
      return txt === 'publier' || txt === 'post';
    });
    if (exact) return exact;

    // Chercher d'abord autour de l'éditeur afin d'éviter un autre bouton « Publier » ailleurs.
    let root = editor;
    for (let i = 0; i < 10 && root?.parentElement; i++, root = root.parentElement) {
      const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(isUsable);
      const found = buttons.find(el => {
        const txt = norm(el.textContent || el.getAttribute('aria-label') || '');
        return txt.includes('publier') || txt === 'post';
      });
      if (found) return found;
    }
    return null;
  }
'''
s, n = re.subn(r'  function findPostButton\(editor\) \{.*?\n  \}\n\n  function showClassroomFallback', post_new + '\n  function showClassroomFallback', s, count=1, flags=re.S)
assert n == 1, 'findPostButton non remplacé'

old = '''    await sleep(450);\n    const postButton = findPostButton(editor);\n    if (!postButton) {\n      showClassroomFallback('Le plan est dans l’éditeur, mais je n’ai pas trouvé le bouton « Publier » de façon assez sûre.');\n      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;\n    }\n'''
new = '''    // Classroom peut mettre un court délai avant d'activer « Publier » après l'insertion.\n    let postButton = null;\n    for (let i = 0; i < 25 && !postButton; i++) {\n      postButton = findPostButton(editor);\n      if (!postButton) await sleep(200);\n    }\n    if (!postButton) {\n      const disabledPost = findPostButton(editor, true);\n      console.warn('[Plan de cours → Classroom] Bouton Publier détecté mais état:', disabledPost ? { disabled: disabledPost.disabled, ariaDisabled: disabledPost.getAttribute('aria-disabled'), text: disabledPost.textContent } : 'introuvable');\n      showClassroomFallback('Le plan est dans l’éditeur, mais le bouton « Publier » n’est pas devenu disponible.');\n      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;\n    }\n'''
assert old in s, 'bloc attente Publier introuvable'
s = s.replace(old, new, 1)

s = s.replace('    postButton.click();\n    notify(`Plan publié dans ${pending.courseLabel || pending.courseName || \'Classroom\'}.`);', '    activateElement(postButton);\n    notify(`Plan publié dans ${pending.courseLabel || pending.courseName || \'Classroom\'}.`);', 1)

p.write_text(s, encoding='utf-8')
