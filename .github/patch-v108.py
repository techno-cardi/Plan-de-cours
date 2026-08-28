from pathlib import Path
import re
p=Path('classroom-rich-publish.user.js')
s=p.read_text(encoding='utf-8')
s=s.replace('// @version      1.0.7','// @version      1.0.8',1)

# Préserver les emojis rendus comme images/éléments sans texte.
old="""      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tag = allowed.has(node.tagName) ? node.tagName.toLowerCase() : null;
"""
new="""      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const fallback = node.getAttribute?.('alt') || node.getAttribute?.('data-emoji') || node.getAttribute?.('aria-label') || '';
      if (!String(node.textContent || '').trim() && fallback) {
        if (node.tagName === 'IMG' || /[\\u2600-\\u27BF]/.test(fallback) || /[\\u{1F300}-\\u{1FAFF}]/u.test(fallback)) {
          return document.createTextNode(fallback);
        }
      }
      const tag = allowed.has(node.tagName) ? node.tagName.toLowerCase() : null;
"""
assert old in s
s=s.replace(old,new,1)

# Chercher Publier d'abord autour du vrai éditeur, jamais globalement en premier.
pat=re.compile(r"  function findPostButton\(editor, allowDisabled = false\) \{.*?\n  \}\n\n  function showClassroomFallback",re.S)
rep=r'''  function findPostButton(editor, allowDisabled = false) {
    const isUsable = el => visible(el) && (allowDisabled || (!el.disabled && el.getAttribute('aria-disabled') !== 'true'));
    let root = editor;
    for (let i = 0; i < 14 && root; i++, root = root.parentElement) {
      const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(isUsable);
      const found = buttons.find(el => {
        const txt = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
        return txt === 'publier' || txt === 'post';
      });
      if (found) return found;
    }
    return null;
  }

  function showClassroomFallback'''
s,n=pat.subn(rep,s,count=1)
assert n==1

# Si l'insertion échoue, ne plus créer de brouillon via RPC.
pat=re.compile(r"    const editor = surface\.editor;\n    const inserted = await insertRichHtml\(editor, pending\.html, pending\.text\);\n    if \(!inserted\) \{.*?\n    \}\n\n    let postButton = null;",re.S)
rep=r'''    const editor = surface.editor;
    const inserted = await insertRichHtml(editor, pending.html, pending.text);
    if (!inserted) {
      showClassroomFallback('Le contenu n’a pas pu être vérifié dans la fenêtre « Annonce ». Je n’ouvre aucune autre annonce et je ne crée aucun brouillon automatiquement.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    let postButton = null;'''
s,n=pat.subn(rep,s,count=1)
assert n==1

# Un seul clic réel sur Publier, sans pointerdown/mousedown artificiels.
s=s.replace('    activateElement(postButton);','    postButton.click();',1)

p.write_text(s,encoding='utf-8')
