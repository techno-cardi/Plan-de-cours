// ==UserScript==
// @name         Classroom - Diagnostic collage annonce
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      1.0.0
// @description  Observe un collage manuel dans une annonce Classroom et produit un rapport de diagnostic sans publier ni modifier automatiquement le contenu.
// @author       techno-cardi
// @match        https://classroom.google.com/*
// @run-at       document-idle
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  const logs = [];
  let running = true;
  let pasteSeen = false;
  let editorAtPaste = null;
  let observer = null;
  let mutationCount = 0;
  const startedAt = performance.now();

  const now = () => `${(performance.now() - startedAt).toFixed(1)}ms`;
  const norm = s => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const short = (s, max = 12000) => {
    s = String(s ?? '');
    return s.length > max ? s.slice(0, max) + `\n...[tronqué ${s.length - max} caractères]` : s;
  };
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };
  const cssPath = el => {
    if (!(el instanceof Element)) return String(el);
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 7; depth++, cur = cur.parentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) { part += '#' + CSS.escape(cur.id); parts.unshift(part); break; }
      if (cur.getAttribute('role')) part += `[role="${cur.getAttribute('role')}"]`;
      if (cur.getAttribute('contenteditable')) part += `[contenteditable="${cur.getAttribute('contenteditable')}"]`;
      const cls = Array.from(cur.classList || []).slice(0, 2);
      if (cls.length) part += '.' + cls.map(CSS.escape).join('.');
      parts.unshift(part);
    }
    return parts.join(' > ');
  };

  function add(type, data = {}) {
    if (!running) return;
    logs.push({ t: now(), type, ...data });
    if (logs.length > 800) logs.shift();
    updatePanel();
  }

  function findAnnouncementEditor() {
    const all = Array.from(document.querySelectorAll('[contenteditable="true"],[role="textbox"],[aria-multiline="true"]')).filter(visible);
    let best = null;
    let bestScore = -Infinity;
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const txt = norm([
        el.getAttribute('aria-label'),
        el.getAttribute('data-placeholder'),
        el.getAttribute('placeholder'),
        el.parentElement?.textContent,
        el.parentElement?.parentElement?.textContent
      ].join(' ')).toLowerCase();
      let score = 0;
      if (/annoncez quelque chose à votre classe|annoncez quelque chose a votre classe|announce something to your class/.test(txt)) score += 500;
      if (/commentaire|comment/.test(txt)) score -= 300;
      if (r.width > 350) score += 60;
      if (r.height > 35) score += 30;
      if (r.top > 80 && r.top < innerHeight * .9) score += 20;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function findPublishButton(editor) {
    const roots = [];
    let cur = editor;
    for (let i = 0; cur && i < 12; i++, cur = cur.parentElement) roots.push(cur);
    roots.push(document);
    for (const root of roots) {
      const buttons = Array.from(root.querySelectorAll?.('button,[role="button"]') || []).filter(visible);
      const found = buttons.find(el => {
        const txt = norm(`${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`).toLowerCase();
        return txt === 'publier' || txt === 'post';
      });
      if (found) return found;
    }
    return null;
  }

  function selectionSnapshot() {
    const sel = getSelection();
    if (!sel) return null;
    return {
      rangeCount: sel.rangeCount,
      isCollapsed: sel.isCollapsed,
      anchorNode: sel.anchorNode ? cssPath(sel.anchorNode.parentElement || sel.anchorNode) : null,
      anchorOffset: sel.anchorOffset,
      focusNode: sel.focusNode ? cssPath(sel.focusNode.parentElement || sel.focusNode) : null,
      focusOffset: sel.focusOffset,
      text: short(sel.toString(), 1000)
    };
  }

  function snapshot(label, editor = findAnnouncementEditor()) {
    const button = findPublishButton(editor);
    add('snapshot', {
      label,
      activeElement: cssPath(document.activeElement),
      editorFound: !!editor,
      editorPath: cssPath(editor),
      editorContenteditable: editor?.getAttribute?.('contenteditable') ?? null,
      editorRole: editor?.getAttribute?.('role') ?? null,
      editorAriaLabel: editor?.getAttribute?.('aria-label') ?? null,
      editorDataPlaceholder: editor?.getAttribute?.('data-placeholder') ?? null,
      editorInnerText: short(editor?.innerText || editor?.textContent || '', 12000),
      editorInnerHTML: short(editor?.innerHTML || '', 20000),
      editorOuterHTML: short(editor?.outerHTML || '', 25000),
      publishFound: !!button,
      publishPath: cssPath(button),
      publishText: norm(button?.textContent || ''),
      publishDisabled: button?.disabled ?? null,
      publishAriaDisabled: button?.getAttribute?.('aria-disabled') ?? null,
      selection: selectionSnapshot()
    });
  }

  function isRelevantTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest('#pdc-paste-diagnostic')) return false;
    return !!target.closest('[contenteditable="true"],[role="textbox"],button,[role="button"]');
  }

  document.addEventListener('focusin', e => {
    if (isRelevantTarget(e.target)) add('focusin', { target: cssPath(e.target), text: short(e.target.innerText || e.target.textContent || '', 1500) });
  }, true);

  document.addEventListener('beforeinput', e => {
    if (!isRelevantTarget(e.target)) return;
    add('beforeinput', {
      target: cssPath(e.target),
      inputType: e.inputType,
      data: e.data,
      isTrusted: e.isTrusted,
      cancelable: e.cancelable,
      defaultPrevented: e.defaultPrevented,
      dataTransferTypes: e.dataTransfer ? Array.from(e.dataTransfer.types || []) : []
    });
  }, true);

  document.addEventListener('input', e => {
    if (!isRelevantTarget(e.target)) return;
    add('input', {
      target: cssPath(e.target),
      inputType: e.inputType,
      data: e.data,
      isTrusted: e.isTrusted,
      textAfter: short(e.target.innerText || e.target.textContent || '', 5000),
      htmlAfter: short(e.target.innerHTML || '', 10000)
    });
  }, true);

  document.addEventListener('paste', e => {
    if (!isRelevantTarget(e.target)) return;
    pasteSeen = true;
    editorAtPaste = e.target.closest('[contenteditable="true"],[role="textbox"],[aria-multiline="true"]') || findAnnouncementEditor();
    let plain = '', html = '', types = [];
    try {
      types = Array.from(e.clipboardData?.types || []);
      plain = e.clipboardData?.getData('text/plain') || '';
      html = e.clipboardData?.getData('text/html') || '';
    } catch (_) {}
    add('paste', {
      target: cssPath(e.target),
      activeElement: cssPath(document.activeElement),
      isTrusted: e.isTrusted,
      cancelable: e.cancelable,
      defaultPrevented: e.defaultPrevented,
      clipboardTypes: types,
      clipboardPlain: short(plain, 20000),
      clipboardHtml: short(html, 30000),
      selection: selectionSnapshot()
    });
    snapshot('juste avant traitement du collage', editorAtPaste);
    setTimeout(() => snapshot('après collage + 0 ms', editorAtPaste), 0);
    setTimeout(() => snapshot('après collage + 50 ms', editorAtPaste), 50);
    setTimeout(() => snapshot('après collage + 250 ms', editorAtPaste), 250);
    setTimeout(() => snapshot('après collage + 1000 ms', editorAtPaste), 1000);
    setTimeout(() => snapshot('après collage + 2500 ms', editorAtPaste), 2500);
  }, true);

  document.addEventListener('click', e => {
    if (!isRelevantTarget(e.target)) return;
    const clickable = e.target.closest('button,[role="button"]');
    if (!clickable) return;
    add('click', {
      target: cssPath(clickable),
      text: norm(`${clickable.textContent || ''} ${clickable.getAttribute('aria-label') || ''}`),
      disabled: clickable.disabled ?? null,
      ariaDisabled: clickable.getAttribute('aria-disabled'),
      isTrusted: e.isTrusted
    });
  }, true);

  observer = new MutationObserver(records => {
    if (!running || !pasteSeen) return;
    const relevant = [];
    for (const r of records) {
      if (mutationCount >= 120) break;
      const target = r.target instanceof Element ? r.target : r.target.parentElement;
      const editor = editorAtPaste || findAnnouncementEditor();
      const nearEditor = editor && (target === editor || editor.contains(target) || target?.contains(editor) || editor.parentElement?.contains(target));
      const button = findPublishButton(editor);
      const nearButton = button && (target === button || button.contains(target) || target?.contains(button) || button.parentElement?.contains(target));
      if (!nearEditor && !nearButton) continue;
      mutationCount++;
      relevant.push({
        type: r.type,
        target: cssPath(target),
        attributeName: r.attributeName || null,
        oldValue: short(r.oldValue || '', 1000),
        added: Array.from(r.addedNodes || []).slice(0, 5).map(n => short(n.outerHTML || n.textContent || n.nodeName, 3000)),
        removed: Array.from(r.removedNodes || []).slice(0, 5).map(n => short(n.outerHTML || n.textContent || n.nodeName, 3000))
      });
    }
    if (relevant.length) add('mutations', { records: relevant });
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true, characterDataOldValue: true });

  function makeReport() {
    snapshot('état au moment de copier le rapport', editorAtPaste || findAnnouncementEditor());
    return JSON.stringify({
      diagnosticVersion: '1.0.0',
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      pasteSeen,
      mutationCount,
      logs
    }, null, 2);
  }

  function createPanel() {
    const box = document.createElement('div');
    box.id = 'pdc-paste-diagnostic';
    box.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;width:min(390px,calc(100vw - 28px));background:#202124;color:#fff;border-radius:12px;padding:14px 15px;box-shadow:0 8px 30px rgba(0,0,0,.35);font:13px/1.42 Arial,sans-serif';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:6px';
    title.textContent = 'Diagnostic collage Classroom';
    const info = document.createElement('div');
    info.id = 'pdc-diag-info';
    info.style.cssText = 'color:#d2d5d9;margin-bottom:10px';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap';

    const snap = document.createElement('button');
    snap.textContent = 'Capturer état';
    const copy = document.createElement('button');
    copy.textContent = 'Copier le rapport';
    const reset = document.createElement('button');
    reset.textContent = 'Recommencer';
    const hide = document.createElement('button');
    hide.textContent = 'Masquer';
    for (const b of [snap, copy, reset, hide]) {
      b.style.cssText = 'border:0;border-radius:7px;padding:7px 9px;cursor:pointer;font:600 12px Arial,sans-serif';
    }
    snap.onclick = () => snapshot('capture manuelle');
    copy.onclick = () => {
      const report = makeReport();
      try { GM_setClipboard(report, 'text'); }
      catch (_) { navigator.clipboard?.writeText(report); }
      copy.textContent = 'Rapport copié';
      setTimeout(() => copy.textContent = 'Copier le rapport', 1800);
    };
    reset.onclick = () => {
      logs.length = 0;
      pasteSeen = false;
      editorAtPaste = null;
      mutationCount = 0;
      add('reset', {});
    };
    hide.onclick = () => box.remove();
    actions.append(snap, copy, reset, hide);
    box.append(title, info, actions);
    document.body.appendChild(box);
    updatePanel();
  }

  function updatePanel() {
    const info = document.getElementById('pdc-diag-info');
    if (!info) return;
    const editor = findAnnouncementEditor();
    const pub = findPublishButton(editor);
    info.textContent = pasteSeen
      ? `Collage détecté. ${logs.length} événements, ${mutationCount} mutations. Quand le collage manuel est terminé, clique « Copier le rapport ».`
      : `Ouvre « Nouvelle annonce », clique dans le vrai champ, puis fais Ctrl+V manuellement. Éditeur: ${editor ? 'trouvé' : 'pas encore'} | Publier: ${pub ? 'trouvé' : 'pas encore'}.`;
  }

  add('diagnostic-start', { url: location.href, userAgent: navigator.userAgent });
  setInterval(updatePanel, 500);
  createPanel();
})();
