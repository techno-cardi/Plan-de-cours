from pathlib import Path

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.1', '// @version      1.0.2', 1)

old = r'''  function textCandidates(root = document) {
    return Array.from(root.querySelectorAll('button,[role="button"],div[role="button"],span[role="button"]')).filter(visible);
  }

  function findComposerTrigger() {
    const patterns = [
      /annoncer.*classe/i,
      /annoncez.*classe/i,
      /communiquer.*classe/i,
      /partager.*classe/i,
      /share.*class/i,
      /announce.*class/i
    ];
    const candidates = textCandidates();
    return candidates.find(el => {
      const hay = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`;
      return patterns.some(re => re.test(hay));
    }) || null;
  }
'''

new = r'''  function textCandidates(root = document) {
    return Array.from(root.querySelectorAll('button,[role="button"],[tabindex="0"],[jsaction*="click"],[aria-label],[data-tooltip]')).filter(visible);
  }

  function composerText(el) {
    if (!el) return '';
    return norm([
      el.textContent || '',
      el.getAttribute?.('aria-label') || '',
      el.getAttribute?.('data-tooltip') || '',
      el.getAttribute?.('data-placeholder') || '',
      el.getAttribute?.('placeholder') || '',
      el.getAttribute?.('title') || ''
    ].join(' '));
  }

  function composerScore(el) {
    const hay = composerText(el);
    if (!hay) return 0;
    let score = 0;
    if (/annonc/.test(hay)) score += 120;
    if (/announc/.test(hay)) score += 120;
    if (/partag|share/.test(hay)) score += 80;
    if (/communiqu/.test(hay)) score += 75;
    if (/message|publication|post/.test(hay)) score += 45;
    if (/classe|class/.test(hay)) score += 65;
    if (/quelque chose|something/.test(hay)) score += 35;
    if (/annonc.*classe|classe.*annonc|announc.*class|class.*announc/.test(hay)) score += 120;
    if (/travail|devoir|assignment|classwork/.test(hay)) score -= 70;
    if (/commentaire|comment/.test(hay)) score -= 55;
    const r = el.getBoundingClientRect();
    if (r.width > 180) score += 15;
    if (r.top > 80 && r.top < innerHeight * 0.82) score += 15;
    return score;
  }

  function clickableAncestor(el) {
    if (!el) return null;
    return el.closest('button,[role="button"],[tabindex="0"],[jsaction*="click"]') || el;
  }

  function findComposerTrigger() {
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
    Array.from(document.querySelectorAll('div,span,p')).filter(visible).forEach(el => {
      const txt = composerText(el);
      if (/annonc|announc|partag|share|communiqu/.test(txt) && /classe|class|message|publication|post|quelque chose|something/.test(txt)) add(el);
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.score >= 90 ? candidates[0].el : null;
  }

  function activateElement(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
    try { el.focus({ preventScroll: true }); } catch (_) {}
    try {
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(type => {
        const Ctor = type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
      });
      el.click();
      return true;
    } catch (_) {
      try { el.click(); return true; } catch (_) { return false; }
    }
  }
'''

if old not in s:
    raise SystemExit('Bloc findComposerTrigger introuvable')
s = s.replace(old, new, 1)

old2 = r'''    let trigger = null;
    for (let i = 0; i < 24 && !trigger; i++) {
      trigger = findComposerTrigger();
      if (!trigger) await sleep(400);
    }
    if (!trigger) {
      showClassroomFallback('Je suis dans le groupe, mais je n’ai pas retrouvé le bouton pour créer une annonce.');
      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
    }
    trigger.click();

    let editor = null;
    for (let i = 0; i < 25 && !editor; i++) {
      editor = findAnnouncementEditor();
      if (!editor) await sleep(300);
    }
'''

new2 = r'''    let editor = findAnnouncementEditor();
    if (!editor) {
      let trigger = null;
      for (let i = 0; i < 30 && !trigger; i++) {
        trigger = findComposerTrigger();
        if (!trigger) await sleep(350);
      }
      if (!trigger) {
        const diagnostics = textCandidates()
          .map(el => ({ text: composerText(el), score: composerScore(el) }))
          .filter(x => x.text && x.score > 20)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(x => x.text.slice(0, 90));
        console.warn('[Plan de cours → Classroom] Déclencheur introuvable. Candidats:', diagnostics);
        showClassroomFallback('Je suis dans le groupe, mais je n’ai pas retrouvé la zone pour créer une annonce. Recharge Classroom une fois et réessaie; si ça bloque encore, le diagnostic est dans la console.');
        pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
      }
      activateElement(trigger);
    }

    for (let i = 0; i < 30 && !editor; i++) {
      editor = findAnnouncementEditor();
      if (!editor) await sleep(300);
    }
'''

if old2 not in s:
    raise SystemExit('Bloc automateClassroom introuvable')
s = s.replace(old2, new2, 1)

p.write_text(s, encoding='utf-8')
print('Correctif appliqué')
