// ==UserScript==
// @name         Plan de cours - Diagnostic collage Classroom
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      1.0.0
// @description  Observe un collage manuel réussi dans une annonce Classroom afin de reproduire exactement le comportement de l’éditeur Google.
// @author       techno-cardi
// @match        https://techno-cardi.github.io/Plan-de-cours/*
// @match        https://classroom.google.com/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const EXPECTED_KEY = 'pdc_classroom_paste_diag_expected_v1';
  const isPlan = location.hostname === 'techno-cardi.github.io';
  const isClassroom = location.hostname === 'classroom.google.com';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const now = () => new Date().toISOString();
  const trim = (s, n = 20000) => {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n) + `\n...[TRONQUÉ ${s.length - n} caractères]` : s;
  };

  function plainFromHtml(html) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    return (box.innerText || box.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  if (isPlan) initPlanDiagnostic();
  if (isClassroom) initClassroomDiagnostic();

  function initPlanDiagnostic() {
    const add = () => {
      if (document.getElementById('pdc-diag-copy-plan')) return;
      const host = document.getElementById('quick-classroom-publish') || document.querySelector('.quick-classroom-publish');
      if (!host) return;

      const wrap = document.createElement('div');
      wrap.id = 'pdc-diag-copy-plan-wrap';
      wrap.style.cssText = 'grid-column:1/-1;margin-top:5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';

      const btn = document.createElement('button');
      btn.id = 'pdc-diag-copy-plan';
      btn.type = 'button';
      btn.textContent = 'Diagnostic - copier le plan';
      btn.style.cssText = 'border:1px solid #8a6d1d;background:#fff8df;color:#5b470d;border-radius:9px;padding:9px 12px;font-weight:700;cursor:pointer';

      const status = document.createElement('span');
      status.id = 'pdc-diag-copy-status';
      status.style.cssText = 'font-size:.78rem;color:#777';
      status.textContent = 'Prépare le presse-papier sans ouvrir Classroom.';

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = 'Préparation…';
        try {
          const emojiBox = document.getElementById('avec-emojis');
          if (emojiBox) emojiBox.checked = true;

          if (typeof unsafeWindow.generer !== 'function') throw new Error('generer() introuvable');
          await unsafeWindow.generer();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

          const preview = document.getElementById('plan-preview');
          if (!preview || preview.querySelector('.empty-state')) throw new Error('aperçu non généré');
          const html = preview.innerHTML.trim();
          const text = plainFromHtml(html);
          if (!html || !text) throw new Error('plan vide');

          const expected = {
            capturedAt: now(),
            url: location.href,
            html,
            text,
            htmlLength: html.length,
            textLength: text.length
          };
          GM_setValue(EXPECTED_KEY, expected);
          GM_setClipboard(html, 'html');
          status.textContent = 'Plan riche copié. Va dans Classroom, ouvre Nouvelle annonce et fais Ctrl+V.';
          btn.textContent = 'Plan copié ✓';
          setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 2500);
          return;
        } catch (err) {
          console.error('[PDC diagnostic]', err);
          status.textContent = 'Erreur: ' + (err?.message || err);
        }
        btn.textContent = old;
        btn.disabled = false;
      });

      wrap.append(btn, status);
      host.appendChild(wrap);
    };

    add();
    new MutationObserver(add).observe(document.documentElement, { childList: true, subtree: true });
  }

  function initClassroomDiagnostic() {
    const report = {
      diagnosticVersion: '1.0.0',
      startedAt: now(),
      pageUrl: location.href,
      userAgent: navigator.userAgent,
      expectedPlan: GM_getValue(EXPECTED_KEY, null),
      events: [],
      snapshots: [],
      mutations: []
    };

    let recording = true;
    let lastEditor = null;
    let pasteAt = 0;
    let mutationCount = 0;

    const panel = document.createElement('div');
    panel.id = 'pdc-paste-diagnostic';
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:min(390px,calc(100vw - 32px));background:#fff;border:1px solid #c7c7c7;border-radius:12px;box-shadow:0 10px 35px rgba(0,0,0,.22);padding:13px;font:13px/1.35 Arial,sans-serif;color:#222';
    panel.innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:5px">Diagnostic collage Classroom</div>
      <div id="pdc-diag-state" style="margin-bottom:10px;color:#555">En attente d’un Ctrl+V manuel dans la fenêtre « Annonce ».</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button id="pdc-diag-copy" type="button" disabled style="border:0;border-radius:8px;padding:8px 10px;background:#1a73e8;color:white;font-weight:700;cursor:pointer;opacity:.5">Copier le rapport</button>
        <button id="pdc-diag-reset" type="button" style="border:1px solid #ccc;border-radius:8px;padding:8px 10px;background:white;cursor:pointer">Réinitialiser</button>
        <button id="pdc-diag-toggle" type="button" style="border:1px solid #ccc;border-radius:8px;padding:8px 10px;background:white;cursor:pointer">Pause</button>
      </div>`;
    document.body.appendChild(panel);

    const stateEl = panel.querySelector('#pdc-diag-state');
    const copyBtn = panel.querySelector('#pdc-diag-copy');
    const resetBtn = panel.querySelector('#pdc-diag-reset');
    const toggleBtn = panel.querySelector('#pdc-diag-toggle');

    function attrs(el) {
      if (!el?.attributes) return {};
      const out = {};
      for (const a of el.attributes) {
        if (['style'].includes(a.name)) continue;
        out[a.name] = trim(a.value, 1200);
      }
      return out;
    }

    function describe(el) {
      if (!el) return null;
      return {
        tag: el.tagName || null,
        id: el.id || '',
        className: typeof el.className === 'string' ? trim(el.className, 1200) : '',
        role: el.getAttribute?.('role') || '',
        contenteditable: el.getAttribute?.('contenteditable') || '',
        ariaLabel: el.getAttribute?.('aria-label') || '',
        dataPlaceholder: el.getAttribute?.('data-placeholder') || '',
        text: trim(el.innerText || el.textContent || '', 2500),
        attrs: attrs(el)
      };
    }

    function editableFrom(node) {
      if (!(node instanceof Element)) return null;
      if (node.matches('[contenteditable="true"], [role="textbox"]')) return node;
      return node.closest('[contenteditable="true"], [role="textbox"]');
    }

    function announcementRoot(editor) {
      if (!editor) return null;
      let root = editor;
      let best = editor.parentElement;
      for (let i = 0; i < 12 && root?.parentElement; i++) {
        root = root.parentElement;
        const txt = String(root.innerText || root.textContent || '').toLowerCase();
        const hasPublish = /publier|post/.test(txt);
        const hasCancel = /annuler|cancel/.test(txt);
        const hasAnnouncement = /annoncez quelque chose|announce something|\bannonce\b|\bannouncement\b/.test(txt);
        if ((hasPublish && hasCancel) || (hasAnnouncement && hasPublish)) best = root;
        if (txt.length > 25000) break;
      }
      return best;
    }

    function postState(editor) {
      const root = announcementRoot(editor) || document;
      const buttons = Array.from(root.querySelectorAll('button,[role="button"]'));
      const post = buttons.find(b => /^(publier|post)$/i.test(String(b.innerText || b.textContent || b.getAttribute('aria-label') || '').trim()));
      return post ? {
        found: true,
        disabled: !!post.disabled,
        ariaDisabled: post.getAttribute('aria-disabled'),
        text: trim(post.innerText || post.textContent || '', 300),
        outerHTML: trim(post.outerHTML, 5000)
      } : { found: false };
    }

    function selectionInfo() {
      const sel = getSelection();
      if (!sel) return null;
      return {
        rangeCount: sel.rangeCount,
        isCollapsed: sel.isCollapsed,
        anchorNode: describe(sel.anchorNode?.parentElement || null),
        anchorOffset: sel.anchorOffset,
        focusNode: describe(sel.focusNode?.parentElement || null),
        focusOffset: sel.focusOffset
      };
    }

    function parentChain(editor) {
      const chain = [];
      let el = editor;
      for (let i = 0; i < 7 && el; i++, el = el.parentElement) {
        chain.push({ level: i, ...describe(el) });
      }
      return chain;
    }

    function snapshot(label, editor = lastEditor) {
      editor = editableFrom(editor) || editor;
      const snap = {
        at: now(),
        msAfterPaste: pasteAt ? Date.now() - pasteAt : null,
        label,
        activeElement: describe(document.activeElement),
        editor: describe(editor),
        editorOuterHTML: trim(editor?.outerHTML || '', 25000),
        editorInnerHTML: trim(editor?.innerHTML || '', 25000),
        editorInnerText: trim(editor?.innerText || editor?.textContent || '', 25000),
        parentChain: parentChain(editor),
        selection: selectionInfo(),
        publishButton: postState(editor)
      };
      report.snapshots.push(snap);
      return snap;
    }

    function eventRecord(e) {
      if (!recording) return;
      const editor = editableFrom(e.target);
      const relevant = !!editor || e.type === 'focusin';
      if (!relevant) return;
      if (editor) lastEditor = editor;

      const rec = {
        at: now(),
        type: e.type,
        isTrusted: e.isTrusted,
        target: describe(e.target),
        activeElement: describe(document.activeElement)
      };

      if ('inputType' in e) rec.inputType = e.inputType;
      if ('data' in e) rec.data = e.data;
      if (e.type === 'keydown') {
        rec.key = e.key;
        rec.code = e.code;
        rec.ctrlKey = e.ctrlKey;
        rec.metaKey = e.metaKey;
        rec.shiftKey = e.shiftKey;
      }
      if (e.type === 'beforeinput' && typeof e.getTargetRanges === 'function') {
        try {
          rec.targetRanges = Array.from(e.getTargetRanges()).map(r => ({ startOffset:r.startOffset, endOffset:r.endOffset }));
        } catch (_) {}
      }
      if (e.type === 'paste') {
        pasteAt = Date.now();
        const dt = e.clipboardData;
        rec.clipboard = dt ? {
          types: Array.from(dt.types || []),
          plain: trim(dt.getData('text/plain'), 25000),
          html: trim(dt.getData('text/html'), 40000)
        } : null;
        snapshot('AVANT/pendant paste', editor);
        stateEl.textContent = 'Collage détecté. Attends 2 secondes, puis clique « Copier le rapport ».';
        copyBtn.disabled = false;
        copyBtn.style.opacity = '1';
        [30, 120, 300, 700, 1500].forEach(ms => setTimeout(() => snapshot(`APRÈS paste +${ms} ms`, editor), ms));
      }

      report.events.push(rec);
      if (report.events.length > 250) report.events.shift();
    }

    ['focusin','keydown','paste','beforeinput','input','compositionstart','compositionupdate','compositionend'].forEach(type => {
      document.addEventListener(type, eventRecord, true);
    });

    const observer = new MutationObserver(mutations => {
      if (!recording || !pasteAt || Date.now() - pasteAt > 2500 || mutationCount >= 120) return;
      const root = announcementRoot(lastEditor);
      for (const m of mutations) {
        if (mutationCount >= 120) break;
        if (root && !(root.contains(m.target) || (m.target instanceof Node && m.target.contains?.(root)))) continue;
        const item = {
          at: now(),
          msAfterPaste: Date.now() - pasteAt,
          type: m.type,
          target: describe(m.target instanceof Element ? m.target : m.target.parentElement),
          attributeName: m.attributeName || null,
          added: Array.from(m.addedNodes || []).slice(0, 8).map(n => ({
            nodeType: n.nodeType,
            text: trim(n.textContent || '', 1000),
            outerHTML: trim(n.outerHTML || '', 3000)
          })),
          removed: Array.from(m.removedNodes || []).slice(0, 8).map(n => ({
            nodeType: n.nodeType,
            text: trim(n.textContent || '', 1000),
            outerHTML: trim(n.outerHTML || '', 3000)
          }))
        };
        report.mutations.push(item);
        mutationCount++;
      }
    });
    observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-disabled','contenteditable','class'] });

    copyBtn.addEventListener('click', () => {
      snapshot('AU MOMENT DE COPIER LE RAPPORT', lastEditor);
      report.finishedAt = now();
      report.pageUrlFinal = location.href;
      const text = '=== DIAGNOSTIC COLLAGE CLASSROOM ===\n' + JSON.stringify(report, null, 2);
      GM_setClipboard(text, 'text');
      stateEl.textContent = 'Rapport copié. Colle-le directement dans ChatGPT.';
      copyBtn.textContent = 'Rapport copié ✓';
      setTimeout(() => { copyBtn.textContent = 'Copier le rapport'; }, 1800);
    });

    resetBtn.addEventListener('click', () => {
      report.events.length = 0;
      report.snapshots.length = 0;
      report.mutations.length = 0;
      report.startedAt = now();
      report.expectedPlan = GM_getValue(EXPECTED_KEY, null);
      pasteAt = 0;
      mutationCount = 0;
      lastEditor = null;
      copyBtn.disabled = true;
      copyBtn.style.opacity = '.5';
      stateEl.textContent = 'Réinitialisé. Fais maintenant un Ctrl+V manuel dans la fenêtre « Annonce ».';
    });

    toggleBtn.addEventListener('click', () => {
      recording = !recording;
      toggleBtn.textContent = recording ? 'Pause' : 'Reprendre';
      stateEl.textContent = recording ? 'Enregistrement repris.' : 'Enregistrement en pause.';
    });

    snapshot('DÉMARRAGE', null);
  }
})();
