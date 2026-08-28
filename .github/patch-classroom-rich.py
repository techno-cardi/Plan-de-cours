from pathlib import Path
p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.0', '// @version      1.0.1', 1)
old = "    if (!preview || !copyBtn || preview.querySelector('.empty-state')) return;"
new = "    if (!preview || !copyBtn) return;"
if old not in s:
    raise SystemExit('garde initiale introuvable')
s = s.replace(old, new, 1)
needle = "      handling = true;\n      try {\n        const courseId = await chooseCourse();"
replacement = "      handling = true;\n      try {\n        if (preview.querySelector('.empty-state') || !htmlToText(preview.innerHTML)) {\n          alert('Générez d’abord un plan de cours avant de le publier.');\n          return;\n        }\n        const courseId = await chooseCourse();"
if needle not in s:
    raise SystemExit('point insertion introuvable')
s = s.replace(needle, replacement, 1)
p.write_text(s, encoding='utf-8')
print('Correctif appliqué')
