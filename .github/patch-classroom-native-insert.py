from pathlib import Path
import re

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.4', '// @version      1.0.5', 1)

# Ajoute un résolveur qui privilégie toujours le vrai contenteditable.
needle = "  function findAnnouncementSurface() {\n"
helper = r'''  function resolveEditableElement(el) {
    if (!el) return null;
    if (el.matches?.('[contenteditable="true"]')) return el;
    return el.querySelector?.('[contenteditable="true"]') || null;
  }

'''
assert needle in s, 'findAnnouncementSurface introuvable'
s = s.replace(needle, helper + needle, 1)

# Remplace les retours d'éditeur pour privilégier un vrai contenteditable.
s = s.replace('          return { root, editor };', '          return { root, editor: resolveEditableElement(editor) || editor };', 1)
s = s.replace('        if (editor && hasAnnouncementActions(root)) return { root, editor };', '        if (editor && hasAnnouncementActions(root)) return { root, editor: resolveEditableElement(editor) || editor };', 1)

insert_new = r'''  function selectEditorContents(editor) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function clearEditorNative(editor) {
    try {
      editor.focus();
      selectEditorContents(editor);
      document.execCommand('delete', false, null);
      return true;
    } catch (_) {
      return false;
    }
  }

  function htmlToEditorRuns(html) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    const runs = [];
    const blockTags = new Set(['P','DIV','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE']);

    const push = (text, state) => {
      if (!text) return;
      runs.push({ text, bold: !!state.bold, italic: !!state.italic, underline: !!state.underline });
    };

    const walk = (node, state) => {
      if (node.nodeType === Node.TEXT_NODE) {
        push(node.nodeValue || '', state);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === 'BR') {
        push('\n', state);
        return;
      }
      const next = {
        bold: state.bold || tag === 'B' || tag === 'STRONG',
        italic: state.italic || tag === 'I' || tag === 'EM',
        underline: state.underline || tag === 'U'
      };
      const beforeCount = runs.length;
      Array.from(node.childNodes).forEach(child => walk(child, next));
      if (blockTags.has(tag) && runs.length > beforeCount) {
        const last = runs[runs.length - 1];
        if (!last.text.endsWith('\n')) push('\n', next);
      }
    };

    Array.from(box.childNodes).forEach(child => walk(child, { bold:false, italic:false, underline:false }));
    while (runs.length && runs[runs.length - 1].text === '\n') runs.pop();
    return runs;
  }

  function insertRunsWithExecCommand(editor, html) {
    const runs = htmlToEditorRuns(html);
    if (!runs.length) return false;
    editor.focus();
    clearEditorNative(editor);

    let state = { bold:false, italic:false, underline:false };
    const setState = (name, desired) => {
      if (state[name] === desired) return;
      try { document.execCommand(name, false, null); state[name] = desired; } catch (_) {}
    };

    for (const run of runs) {
      setState('bold', run.bold);
      setState('italic', run.italic);
      setState('underline', run.underline);
      const parts = String(run.text).split('\n');
      parts.forEach((part, index) => {
        if (part) document.execCommand('insertText', false, part);
        if (index < parts.length - 1) {
          if (!document.execCommand('insertLineBreak', false, null)) {
            document.execCommand('insertText', false, '\n');
          }
        }
      });
    }

    setState('bold', false);
    setState('italic', false);
    setState('underline', false);
    return true;
  }

  function dispatchRichPaste(editor, html, text) {
    try {
      const data = new DataTransfer();
      data.setData('text/html', html);
      data.setData('text/plain', text);
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: data
      });
      editor.focus();
      return editor.dispatchEvent(event) === false;
    } catch (_) {
      return false;
    }
  }

  async function insertRichHtml(editor, html, expectedText) {
    editor = resolveEditableElement(editor) || editor;
    if (!editor || editor.getAttribute?.('contenteditable') !== 'true') {
      console.warn('[Plan de cours → Classroom] Élément non contenteditable:', editor);
      return false;
    }

    const expected = norm(expectedText);
    const signature = expected.slice(0, Math.min(70, expected.length));
    const matches = () => {
      const actual = norm(editor.innerText || editor.textContent);
      return signature.length >= 10 && actual.includes(signature);
    };

    editor.scrollIntoView?.({ block:'center' });
    editor.focus();
    clearEditorNative(editor);

    // 1. Donner d'abord à l'éditeur Google un événement de collage riche.
    dispatchRichPaste(editor, html, expectedText);
    await sleep(180);
    if (matches()) return true;

    // 2. Essayer l'insertion HTML native du navigateur.
    clearEditorNative(editor);
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    await sleep(120);
    if (matches()) return true;

    // 3. Dernier recours : passer entièrement par les commandes natives de l'éditeur.
    // On retape le contenu et on active gras/italique/souligné au fil des segments.
    clearEditorNative(editor);
    try { insertRunsWithExecCommand(editor, html); } catch (err) {
      console.warn('[Plan de cours → Classroom] Insertion native échouée:', err);
    }
    await sleep(180);
    if (matches()) return true;

    console.warn('[Plan de cours → Classroom] Insertion refusée. Éditeur:', editor, 'contenu observé:', editor.innerText || editor.textContent);
    return false;
  }
'''

s, n = re.subn(r'  function insertRichHtml\(editor, html, expectedText\) \{.*?\n  \}\n\n  function findPostButton', insert_new + '\n  function findPostButton', s, count=1, flags=re.S)
assert n == 1, 'insertRichHtml non remplacé'

# La fonction est désormais async.
s = s.replace('    const inserted = insertRichHtml(editor, pending.html, pending.text);', '    const inserted = await insertRichHtml(editor, pending.html, pending.text);', 1)

p.write_text(s, encoding='utf-8')
