from pathlib import Path
import re, subprocess

idx = Path('index.html')
app = Path('app.js')
html = idx.read_text(encoding='utf-8')
js = app.read_text(encoding='utf-8')

# --- CSS: list controls + hyphen rendering in editors ---
css_marker = "\n</style>"
css = r'''

  /* Listes dans les éditeurs de devoirs et rappels */
  .list-format-tools {
    display:flex;
    gap:6px;
    align-items:center;
    margin-top:7px;
    margin-bottom:2px;
    flex-wrap:wrap;
  }
  .list-format-btn {
    border:1px solid #ddd6cf;
    background:#faf8f5;
    color:#5f554d;
    border-radius:7px;
    padding:5px 9px;
    font:600 0.76rem 'DM Sans',sans-serif;
    cursor:pointer;
    line-height:1.2;
  }
  .list-format-btn:hover { border-color:#c8102e; color:#c8102e; background:#fff; }
  .list-format-btn:focus-visible { outline:2px solid #c8102e; outline-offset:2px; }
  .rich-editor ul { list-style:none; padding-left:1.25em; margin:0.3em 0; }
  .rich-editor ul > li::before { content:'- '; margin-left:-1.05em; }
  .rich-editor ol { padding-left:1.65em; margin:0.3em 0; }
  .rich-editor li { margin:0.12em 0; }
'''
if '.list-format-tools {' not in html:
    html = html.replace(css_marker, css + css_marker, 1)

# --- Controls under Devoir and Rappel editors ---
def add_tools(editor_id, source):
    pattern = rf'(<div class="rich-editor" id="{editor_id}"[^>]*></div>)'
    tools = rf'''\1
      <div class="list-format-tools" aria-label="Mise en forme des listes">
        <button type="button" class="list-format-btn" onmousedown="event.preventDefault(); formatEditorList('{editor_id}','unordered')" title="Créer ou retirer une liste à tirets">- Liste à tirets</button>
        <button type="button" class="list-format-btn" onmousedown="event.preventDefault(); formatEditorList('{editor_id}','ordered')" title="Créer ou retirer une liste numérotée">1. Liste numérotée</button>
      </div>'''
    if f"formatEditorList('{editor_id}'" not in source:
        source, n = re.subn(pattern, tools, source, count=1)
        if n != 1:
            raise RuntimeError(f'éditeur {editor_id} introuvable')
    return source

html = add_tools('devoir', html)
html = add_tools('rappel', html)

# --- Changelog v1.0.11 ---
html = html.replace('<span class="changelog-version-badge">v1.0.10</span>', '<span class="changelog-version-badge">v1.0.11</span>', 1)
html = html.replace('onclick="openChangelog()">v1.0.10</button>', 'onclick="openChangelog()">v1.0.11</button>', 1)
if 'Listes propres - v1.0.11' not in html:
    old = '''    <div class="changelog-section">\n      <h3>Typographie et performance - v1.0.10</h3>'''
    new = '''    <div class="changelog-section">\n      <h3>Listes propres - v1.0.11</h3>\n      <ul>\n        <li><strong>Listes à tirets</strong> : les devoirs et rappels peuvent être organisés avec des tirets simples qui restent propres après la génération et le copier-coller.</li>\n        <li><strong>Listes numérotées</strong> : une sélection de plusieurs lignes peut être convertie en liste 1, 2, 3 en un clic.</li>\n        <li><strong>Copie compatible</strong> : le presse-papiers contient maintenant une version HTML et une version texte pour préserver la structure dans davantage de destinations, dont Classroom.</li>\n      </ul>\n    </div>\n\n''' + old
    if old not in html:
        raise RuntimeError('section changelog v1.0.10 introuvable')
    html = html.replace(old, new, 1)

# --- JS helpers: parse lists into clean generated lines ---
insert_after = """function richToLines(html) {\n  // Normalize: <div> blocks → <br>\n  let normalized = html\n    .replace(/<div><br\\s*\\/?><\\/div>/gi, '<br>')\n    .replace(/<div>(.*?)<\\/div>/gi, '<br>$1')\n    .replace(/<br\\s*\\/?>/gi, '\\n');\n  // Split, trim, and drop empty lines\n  const lines = normalized.split('\\n').map(l => l.trim()).filter(l => l.replace(/<[^>]*>/g,'').trim().length > 0);\n  return lines.length > 0 ? lines : [''];\n}\n"""
helper = r'''function richToStructuredLines(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  const lines = [];

  function hasVisibleText(fragment) {
    const probe = document.createElement('div');
    probe.innerHTML = fragment || '';
    return (probe.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
  }
  function push(kind, fragment, number = null) {
    const clean = sanitizeInlineFragment(fragment || '');
    if (hasVisibleText(clean)) lines.push({ kind, html: clean, number });
  }
  function processList(list, ordered) {
    let n = parseInt(list.getAttribute('start') || '1', 10);
    if (!Number.isFinite(n)) n = 1;
    Array.from(list.children).forEach(child => {
      if (child.tagName?.toLowerCase() !== 'li') return;
      const clone = child.cloneNode(true);
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach(nested => nested.remove());
      push(ordered ? 'number' : 'bullet', clone.innerHTML, ordered ? n++ : null);
      Array.from(child.children).forEach(nested => {
        const tag = nested.tagName?.toLowerCase();
        if (tag === 'ul') processList(nested, false);
        if (tag === 'ol') processList(nested, true);
      });
    });
  }
  function process(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.nodeValue || '').trim()) push('text', esc(node.nodeValue || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul') { processList(node, false); return; }
    if (tag === 'ol') { processList(node, true); return; }
    if (tag === 'div' || tag === 'p') {
      const directLists = Array.from(node.children).filter(c => ['ul','ol'].includes(c.tagName.toLowerCase()));
      if (!directLists.length) { push('text', node.innerHTML); return; }
      Array.from(node.childNodes).forEach(process);
      return;
    }
    if (tag === 'br') return;
    push('text', node.outerHTML);
  }
  Array.from(wrapper.childNodes).forEach(process);
  return lines;
}

function buildSpecialPreview(label, html) {
  const lines = richToStructuredLines(html);
  if (!lines.length) return '';
  if (lines.length === 1 && lines[0].kind === 'text') {
    return `<p class="special"><b>${label} :</b> ${lines[0].html}</p>`;
  }
  let out = `<p class="special"><b>${label} :</b></p>`;
  lines.forEach(line => {
    const prefix = line.kind === 'bullet' ? '- ' : (line.kind === 'number' ? `${line.number}. ` : '');
    out += `<p style="margin-left:1.8em">${prefix}${line.html}</p>`;
  });
  return out;
}
'''
if 'function richToStructuredLines(html)' not in js:
    if insert_after not in js:
        raise RuntimeError('richToLines introuvable')
    js = js.replace(insert_after, insert_after + helper, 1)

# --- Replace special preview generation ---
pattern = re.compile(r"  if \(pasDevoir\) \{\n    previewHTML \+= `<p class=\"special\"><b>Devoir\(s\) :</b> <b>Aucun devoir</b></p>`;\n  \} else if \(devoirText\) \{.*?\n  \}\n\n  if \(!pasRappel && rappelText\) \{.*?\n  \}\n", re.S)
replacement = '''  if (pasDevoir) {\n    previewHTML += `<p class="special"><b>Devoir(s) :</b> <b>Aucun devoir</b></p>`;\n  } else if (devoirText) {\n    previewHTML += buildSpecialPreview('Devoir(s)', devoirHTML);\n  }\n\n  if (!pasRappel && rappelText) {\n    previewHTML += buildSpecialPreview('Rappel(s)', rappelHTML);\n  }\n'''
js, n = pattern.subn(replacement, js, count=1)
if n != 1 and "buildSpecialPreview('Devoir(s)'" not in js:
    raise RuntimeError('bloc devoir/rappel de generer introuvable')

# --- Dedicated list command for Devoir/Rappel ---
fmt_block = """function fmt(cmd) {\n  if (_lastRange) {\n    const sel = window.getSelection();\n    sel.removeAllRanges();\n    sel.addRange(_lastRange);\n  }\n  document.execCommand(cmd, false, null);\n  hideToolbar();\n}\n"""
list_cmd = r'''
function formatEditorList(editorId, type) {
  const editor = document.getElementById(editorId);
  if (!editor || editor.contentEditable === 'false') return;
  const sel = window.getSelection();
  const currentRange = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const anchor = currentRange ? (currentRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? currentRange.commonAncestorContainer : currentRange.commonAncestorContainer.parentElement) : null;
  const selectionIsInside = !!(anchor && editor.contains(anchor));
  if (!selectionIsInside) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.execCommand(type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
  editor.focus();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  sauvegarderPlanLocal();
}
'''
if 'function formatEditorList(editorId, type)' not in js:
    if fmt_block not in js:
        raise RuntimeError('fonction fmt introuvable')
    js = js.replace(fmt_block, fmt_block + list_cmd, 1)

# --- Classroom text conversion: semantic lists -> literal '-' or '1.' ---
html_classroom_pattern = re.compile(r"function htmlVersTexteClassroom\(html\) \{.*?\n\}\nfunction buildCurrentPlanTextForClassroom", re.S)
html_classroom_new = r'''function htmlVersTexteClassroom(html) {
  const wrapper = document.createElement('div'); wrapper.innerHTML = html || '';
  function underlineUnicode(s) { return Array.from(s).map(ch => (ch === ' ' || ch === '\n' || ch === '\t') ? ch : ch + '\u0332').join(''); }
  function walkChildren(node) {
    let out = '';
    node.childNodes.forEach(child => { out += walk(child); });
    return out;
  }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'ul' || tag === 'ol') {
      let number = parseInt(node.getAttribute('start') || '1', 10);
      if (!Number.isFinite(number)) number = 1;
      let listText = '';
      Array.from(node.children).forEach(li => {
        if (li.tagName?.toLowerCase() !== 'li') return;
        let itemText = '';
        li.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE && ['ul','ol'].includes(child.tagName.toLowerCase())) return;
          itemText += walk(child);
        });
        itemText = itemText.replace(/\n+/g, ' ').trim();
        if (itemText) listText += (tag === 'ul' ? '- ' : `${number++}. `) + itemText + '\n';
        Array.from(li.children).forEach(child => {
          const childTag = child.tagName?.toLowerCase();
          if (childTag === 'ul' || childTag === 'ol') listText += walk(child);
        });
      });
      return listText;
    }
    let out = walkChildren(node);
    if (tag === 'u') out = underlineUnicode(out);
    if (tag === 'div' || tag === 'p') return out + '\n';
    return out;
  }
  let result = ''; wrapper.childNodes.forEach(child => result += walk(child));
  return result.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function buildCurrentPlanTextForClassroom'''
js, n = html_classroom_pattern.subn(html_classroom_new, js, count=1)
if n != 1:
    raise RuntimeError('htmlVersTexteClassroom introuvable')

# --- Clipboard: provide both HTML and clean text/plain ---
old_clip = """    const blob = new Blob([clipboardHTML], { type: 'text/html' });\n    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);"""
new_clip = """    const blob = new Blob([clipboardHTML], { type: 'text/html' });\n    const plainText = htmlVersTexteClassroom(clipboardHTML);\n    const plainBlob = new Blob([plainText], { type: 'text/plain' });\n    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': plainBlob })]);"""
if old_clip in js:
    js = js.replace(old_clip, new_clip, 1)
elif "'text/plain': plainBlob" not in js:
    raise RuntimeError('bloc clipboard introuvable')

idx.write_text(html, encoding='utf-8')
app.write_text(js, encoding='utf-8')

# Sanity checks
for required in ["- Liste à tirets", "1. Liste numérotée", "v1.0.11"]:
    if required not in html: raise RuntimeError(f'marqueur HTML manquant: {required}')
for required in ['function formatEditorList', 'function richToStructuredLines', "'text/plain': plainBlob", "tag === 'ul' || tag === 'ol'"]:
    if required not in js: raise RuntimeError(f'marqueur JS manquant: {required}')
subprocess.run(['node', '--check', 'app.js'], check=True)
print('Validation réussie')
