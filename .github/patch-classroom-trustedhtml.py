from pathlib import Path
import re

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.6', '// @version      1.0.7', 1)

pattern = re.compile(r"  function classroomHtmlForRpc\(html\) \{.*?\n  \}\n", re.S)
replacement = '''  function classroomHtmlForRpc(html) {\n    // Ne jamais réinjecter le HTML dans le DOM de Classroom :\n    // Google impose Trusted Types/TrustedHTML sur cette page.\n    // Le HTML a déjà été nettoyé sur le générateur avant d'être stocké dans pending.html.\n    return String(html || '').trim();\n  }\n'''
s, n = pattern.subn(replacement, s, count=1)
assert n == 1, 'classroomHtmlForRpc introuvable'

p.write_text(s, encoding='utf-8')
