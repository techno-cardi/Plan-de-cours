from pathlib import Path

path = Path('.github/add-special-lists.py')
source = path.read_text(encoding='utf-8')
old = "js, n = html_classroom_pattern.subn(html_classroom_new, js, count=1)"
new = "js, n = html_classroom_pattern.subn(lambda _m: html_classroom_new, js, count=1)"
if old not in source:
    raise RuntimeError('ligne de substitution à corriger introuvable')
source = source.replace(old, new, 1)
exec(compile(source, str(path), 'exec'), {'__name__': '__main__'})
