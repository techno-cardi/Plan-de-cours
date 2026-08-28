import base64
import pathlib
import re
import subprocess
import tempfile
import urllib.parse
from collections import Counter
from html.parser import HTMLParser

root = pathlib.Path('.')
index_path = root / 'index.html'
s = index_path.read_text(encoding='utf-8')
original_size = len(s.encode('utf-8'))
assets = root / 'assets'
assets.mkdir(exist_ok=True)


def decode_data_uri(uri: str) -> bytes:
    header, payload = uri.split(',', 1)
    if ';base64' in header:
        return base64.b64decode(payload)
    return urllib.parse.unquote_to_bytes(payload)


def save_uri(uri: str, dest: str):
    data = decode_data_uri(uri)
    path = root / dest
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if len(data) < 100:
        raise RuntimeError(f'Image extraite anormalement petite: {dest}')


# Extraire les images intégrées vers des fichiers pouvant être mis en cache.
extracted = {}

m = re.search(r'<img\s+id="school-logo"[^>]*\bsrc="(data:image/[^"]+)"', s, re.I)
if not m:
    raise RuntimeError('Logo Cardinal-Roy principal introuvable')
extracted['assets/logo-cardinal-roy.png'] = m.group(1)

m = re.search(r'<img\s+src="(data:image/[^"]+)"\s+alt="Cardinal-Roy"', s, re.I)
if not m:
    raise RuntimeError('Vignette Cardinal-Roy introuvable')
extracted['assets/cardinal-roy-badge.jpg'] = m.group(1)

school_assets = {
    'camaradiere': 'assets/logo-la-camaradiere.png',
    'neufchatel': 'assets/logo-neufchatel.svg',
    'perrault': 'assets/logo-joseph-francois-perrault.png',
    'rogercomtois': 'assets/logo-roger-comtois.png',
}
for key, dest in school_assets.items():
    mm = re.search(rf'{key}:\s*\{{\s*name:\s*"[^"]+",\s*logo:\s*"(data:image/[^"]+)"', s, re.I)
    if not mm:
        raise RuntimeError(f'Logo intégré introuvable pour {key}')
    extracted[dest] = mm.group(1)

for dest, uri in extracted.items():
    save_uri(uri, dest)
    s = s.replace(uri, dest)

if 'data:image/' in s:
    raise RuntimeError('Il reste au moins une image intégrée non extraite')

# Les bibliothèques PDF ne seront plus téléchargées au chargement initial.
pdf_imports = [
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
]
for url in pdf_imports:
    pattern = rf'\s*<script\s+src="{re.escape(url)}"></script>\s*'
    s, n = re.subn(pattern, '\n', s, count=1)
    if n != 1:
        raise RuntimeError(f'Import PDF attendu introuvable: {url}')

# Accélérer le chargement des polices utilisées dès l'affichage.
font_link = '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">'
preconnect = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
)
if preconnect.strip() not in s:
    if font_link not in s:
        raise RuntimeError('Lien Google Fonts introuvable')
    s = s.replace(font_link, preconnect + font_link, 1)

# Version, sécurité et accessibilité.
s = s.replace('v1.0.8', 'v1.0.10')
s = s.replace('<span class="changelog-date">Mars 2026</span>', '<span class="changelog-date">Août 2026</span>', 1)
s = s.replace('target="_blank" style=', 'target="_blank" rel="noopener noreferrer" style=', 1)
s = s.replace('<div id="toast-container"></div>', '<div id="toast-container" aria-live="polite" aria-atomic="false"></div>', 1)

old_section = '    <div class="changelog-section">\n      <h3>✨ Nouvelles fonctionnalités — v1.0.9</h3>'
new_section = '''    <div class="changelog-section">
      <h3>Typographie et performance - v1.0.10</h3>
      <ul>
        <li><strong>Guillemets français automatiques</strong> : la touche de guillemet produit maintenant « et » avec des espaces insécables conformes à la typographie française.</li>
        <li><strong>Sélection intelligente</strong> : un texte sélectionné peut être entouré directement de guillemets français.</li>
        <li><strong>Chargement allégé</strong> : les logos et le code principal sont maintenant des fichiers distincts pouvant être mis en cache par le navigateur.</li>
        <li><strong>PDF à la demande</strong> : html2canvas et jsPDF ne sont téléchargés que lors de la création d'un PDF; la bibliothèque html2pdf inutilisée a été retirée.</li>
        <li><strong>Lien externe sécurisé</strong> : le guide PDF ouvert dans un nouvel onglet est isolé de la page d'origine.</li>
      </ul>
    </div>

''' + old_section
if 'Typographie et performance - v1.0.10' not in s:
    if old_section not in s:
        raise RuntimeError('Point insertion changelog introuvable')
    s = s.replace(old_section, new_section, 1)

# Extraire le gros bloc JavaScript vers app.js.
script_pattern = re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', re.S | re.I)
matches = [m for m in script_pattern.finditer(s) if 'src=' not in m.group('attrs').lower()]
main_match = max(matches, key=lambda m: len(m.group('body').encode('utf-8')))
app = main_match.group('body')
if len(app.encode('utf-8')) < 100_000:
    raise RuntimeError('Bloc applicatif principal anormalement petit')

old_logo_fn = '''function getCurrentSchoolLogoDataUri() {
  return (SCHOOL_OPTIONS[getCurrentSchoolKey()] || SCHOOL_OPTIONS.cardinal).logo;
}'''
new_logo_fn = '''function getCurrentSchoolLogoDataUri() {
  const logo = (SCHOOL_OPTIONS[getCurrentSchoolKey()] || SCHOOL_OPTIONS.cardinal).logo;
  if (!logo || logo.startsWith('data:')) return logo || '';
  try { return new URL(logo, document.baseURI).href; }
  catch (e) { return logo; }
}'''
if old_logo_fn not in app:
    raise RuntimeError('Fonction de logo attendue introuvable')
app = app.replace(old_logo_fn, new_logo_fn, 1)

# Charger html2canvas et jsPDF uniquement lors d'un téléchargement PDF.
pdf_loader = r'''
const PDF_LIBRARY_URLS = {
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
};
let pdfLibrariesPromise = null;

function loadExternalScriptOnce(src, ready) {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const absoluteSrc = new URL(src, document.baseURI).href;
    const existing = Array.from(document.scripts).find(script => script.src === absoluteSrc);
    const finish = () => ready() ? resolve() : reject(new Error(`Bibliothèque chargée mais indisponible: ${src}`));
    if (existing) {
      if (ready()) {
        resolve();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Impossible de charger ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.head.appendChild(script);
  });
}

function ensurePdfLibraries() {
  const hasHtml2Canvas = () => typeof window.html2canvas === 'function';
  const hasJsPdf = () => Boolean((window.jspdf && window.jspdf.jsPDF) || window.jsPDF);
  if (hasHtml2Canvas() && hasJsPdf()) return Promise.resolve();
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = Promise.all([
      loadExternalScriptOnce(PDF_LIBRARY_URLS.html2canvas, hasHtml2Canvas),
      loadExternalScriptOnce(PDF_LIBRARY_URLS.jspdf, hasJsPdf)
    ]).then(() => undefined).catch(error => {
      pdfLibrariesPromise = null;
      throw error;
    });
  }
  return pdfLibrariesPromise;
}
'''
download_fn = 'async function downloadSupplyPDF() {'
if download_fn not in app:
    raise RuntimeError('Fonction PDF introuvable')
if 'const PDF_LIBRARY_URLS' not in app:
    app = app.replace(download_fn, pdf_loader + '\n' + download_fn, 1)

pdf_try = '''  let iframe = null;
  try {
    syncSupplyFromCourse(false);'''
pdf_try_new = '''  let iframe = null;
  try {
    await ensurePdfLibraries();
    syncSupplyFromCourse(false);'''
if pdf_try not in app:
    raise RuntimeError('Bloc de démarrage PDF introuvable')
app = app.replace(pdf_try, pdf_try_new, 1)

(root / 'app.js').write_text(app.strip() + '\n', encoding='utf-8')
s = s[:main_match.start()] + '<script src="app.js"></script>' + s[main_match.end():]

# Guillemets français avec espaces insécables et sélection intelligente.
smart_script = r'''<!-- French smart quotes -->
<script>
(() => {
  const NBSP = '\u00A0';

  const nextFrenchQuote = (textBefore) => {
    let depth = 0;
    for (const ch of textBefore) {
      if (ch === '«') depth += 1;
      else if (ch === '»' && depth > 0) depth -= 1;
    }
    return depth > 0 ? '»' : '«';
  };

  const normalizeSelectedText = (text) => text.replace(/^[ \u00A0]+|[ \u00A0]+$/g, '');

  const emitInput = (element, text) => {
    let inputEvent;
    try {
      inputEvent = new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      });
    } catch (error) {
      inputEvent = new Event('input', { bubbles: true });
    }
    element.dispatchEvent(inputEvent);
  };

  const textBeforeRange = (editor, range) => {
    const before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString();
  };

  document.addEventListener('beforeinput', (event) => {
    if (event.inputType !== 'insertText') return;

    const target = event.target;
    const isTextInput = target instanceof HTMLInputElement &&
      ['text', 'search'].includes((target.type || 'text').toLowerCase());

    if (target instanceof HTMLTextAreaElement || isTextInput) {
      if (target.disabled || target.readOnly ||
          target.selectionStart === null || target.selectionEnd === null) return;

      const start = target.selectionStart;
      const end = target.selectionEnd;

      if (event.data === ' ' && start === end && target.value.slice(Math.max(0, start - 2), start) === `«${NBSP}`) {
        event.preventDefault();
        return;
      }
      if (event.data !== '"') return;

      event.preventDefault();
      if (start !== end) {
        const selected = normalizeSelectedText(target.value.slice(start, end));
        const wrapped = `«${NBSP}${selected}${NBSP}»`;
        target.setRangeText(wrapped, start, end, 'end');
        emitInput(target, wrapped);
        return;
      }

      const quote = nextFrenchQuote(target.value.slice(0, start));
      if (quote === '«') {
        const inserted = `«${NBSP}`;
        target.setRangeText(inserted, start, start, 'end');
        emitInput(target, inserted);
      } else {
        const replaceStart = start > 0 && /[ \u00A0]/.test(target.value[start - 1]) ? start - 1 : start;
        const inserted = `${NBSP}»`;
        target.setRangeText(inserted, replaceStart, start, 'end');
        emitInput(target, inserted);
      }
      return;
    }

    const editor = target instanceof Element
      ? target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')
      : null;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0);

    let beforeText;
    try { beforeText = textBeforeRange(editor, range); }
    catch (error) { return; }

    if (event.data === ' ' && range.collapsed && beforeText.endsWith(`«${NBSP}`)) {
      event.preventDefault();
      return;
    }
    if (event.data !== '"') return;

    event.preventDefault();
    if (!range.collapsed) {
      const fragment = range.extractContents();
      const holder = document.createDocumentFragment();
      const openNode = document.createTextNode(`«${NBSP}`);
      const closeNode = document.createTextNode(`${NBSP}»`);
      holder.appendChild(openNode);
      holder.appendChild(fragment);
      holder.appendChild(closeNode);
      range.insertNode(holder);
      range.setStartAfter(closeNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      emitInput(editor, `«${NBSP}…${NBSP}»`);
      return;
    }

    const quote = nextFrenchQuote(beforeText);
    let inserted = `«${NBSP}`;
    if (quote === '»') {
      inserted = `${NBSP}»`;
      if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
        const textNode = range.startContainer;
        const previous = textNode.data[range.startOffset - 1];
        if (previous === ' ' || previous === NBSP) {
          textNode.deleteData(range.startOffset - 1, 1);
          range.setStart(textNode, range.startOffset - 1);
          range.collapse(true);
        }
      }
    }

    const node = document.createTextNode(inserted);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    emitInput(editor, inserted);
  }, true);
})();
</script>
'''
smart_pattern = re.compile(r'<!-- French smart quotes -->\s*<script>.*?</script>\s*(?=</body>)', re.S | re.I)
s, n = smart_pattern.subn(lambda _: smart_script, s, count=1)
if n != 1:
    raise RuntimeError('Bloc de guillemets français introuvable')

index_path.write_text(s, encoding='utf-8')

# Validation statique avant le commit.
subprocess.run(['node', '--check', 'app.js'], check=True)
final_html = index_path.read_text(encoding='utf-8')
final_app = (root / 'app.js').read_text(encoding='utf-8')

assert 'data:image/' not in final_html
assert 'html2pdf.bundle.min.js' not in final_html
assert '<script src="app.js"></script>' in final_html
assert 'v1.0.10' in final_html
assert 'rel="noopener noreferrer"' in final_html
assert 'aria-live="polite"' in final_html
assert 'Typographie et performance - v1.0.10' in final_html
assert 'PDF_LIBRARY_URLS' in final_app
assert 'new URL(logo, document.baseURI).href' in final_app

expected = [
    'assets/logo-cardinal-roy.png',
    'assets/cardinal-roy-badge.jpg',
    'assets/logo-la-camaradiere.png',
    'assets/logo-neufchatel.svg',
    'assets/logo-joseph-francois-perrault.png',
    'assets/logo-roger-comtois.png',
]
for path in expected:
    p = pathlib.Path(path)
    assert p.exists() and p.stat().st_size > 100, path
    assert path in final_html or path in final_app, path


class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])


parser = AuditParser()
parser.feed(final_html)
duplicates = [x for x in Counter(parser.ids).items() if x[1] > 1]
assert not duplicates, duplicates

inline_scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', final_html, re.S | re.I)
for i, body in enumerate(inline_scripts):
    if not body.strip():
        continue
    tmp = pathlib.Path(tempfile.gettempdir()) / f'plan-inline-{i}.js'
    tmp.write_text(body, encoding='utf-8')
    subprocess.run(['node', '--check', str(tmp)], check=True)

assert len(final_html.encode('utf-8')) < 250_000, len(final_html.encode('utf-8'))

print(f'index.html: {original_size} -> {len(final_html.encode("utf-8"))} octets')
print(f'app.js: {pathlib.Path("app.js").stat().st_size} octets')
for path in sorted(extracted):
    print(f'{path}: {(root / path).stat().st_size} octets')
print('Validation réussie')
