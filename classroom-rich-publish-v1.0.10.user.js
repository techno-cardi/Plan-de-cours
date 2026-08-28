// ==UserScript==
// @name         Plan de cours - Publication riche Classroom
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      1.0.10
// @description  Copie le plan avec sa mise en forme, ouvre le bon groupe Classroom et publie automatiquement l'annonce.
// @author       techno-cardi
// @match        https://techno-cardi.github.io/Plan-de-cours/*
// @match        https://classroom.google.com/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/classroom-rich-publish.user.js
// @downloadURL  https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/classroom-rich-publish.user.js
// ==/UserScript==

(function () {
  'use strict';

  const PENDING_KEY = 'plan_de_cours_classroom_rich_pending_v1';
  const LAST_DONE_KEY = 'plan_de_cours_classroom_rich_last_done_v1';
  const MAX_AGE_MS = 3 * 60 * 1000;
  const isPlanPage = location.hostname === 'techno-cardi.github.io';
  const isClassroom = location.hostname === 'classroom.google.com';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = s => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  };

  function cleanRichHtml(html) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    const allowed = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U']);

    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const fallback = node.getAttribute?.('alt') || node.getAttribute?.('data-emoji') || node.getAttribute?.('aria-label') || '';
      if (!String(node.textContent || '').trim() && fallback) {
        if (node.tagName === 'IMG' || /[\u2600-\u27BF]/.test(fallback) || /[\u{1F300}-\u{1FAFF}]/u.test(fallback)) {
          return document.createTextNode(fallback);
        }
      }
      const tag = allowed.has(node.tagName) ? node.tagName.toLowerCase() : null;
      const out = tag ? document.createElement(tag) : document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => out.appendChild(clean(child)));
      return out;
    }

    const result = document.createElement('div');
    Array.from(box.childNodes).forEach(child => result.appendChild(clean(child)));
    return result.innerHTML
      .replace(/<div>/gi, '<p>')
      .replace(/<\/div>/gi, '</p>')
      .replace(/(?:<p>\s*<\/p>){2,}/gi, '<p><br></p>')
      .trim();
  }

  function htmlToText(html) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    return (box.innerText || box.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function notify(text) {
    try { GM_notification({ title: 'Plan de cours → Classroom', text, timeout: 5000 }); }
    catch (_) { /* notification facultative */ }
  }

  function injectPlanStyles() {
    if (document.getElementById('pdc-classroom-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'pdc-classroom-bridge-style';
    style.textContent = `
      #pdc-classroom-modal{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.46);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'DM Sans',Arial,sans-serif}
      #pdc-classroom-modal .pdc-box{width:min(520px,100%);background:#fff;border-radius:14px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      #pdc-classroom-modal h3{margin:0 0 8px;font-size:1.2rem;color:#222}
      #pdc-classroom-modal p{margin:0 0 16px;color:#666;font-size:.9rem;line-height:1.45}
      #pdc-classroom-modal select{width:100%;padding:11px 12px;border:1.5px solid #ddd;border-radius:9px;font:inherit;background:#fff;color:#222}
      #pdc-classroom-modal .pdc-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
      #pdc-classroom-modal button{border:0;border-radius:9px;padding:10px 14px;font:600 .9rem 'DM Sans',Arial,sans-serif;cursor:pointer}
      #pdc-classroom-modal .pdc-cancel{background:#eee;color:#444}
      #pdc-classroom-modal .pdc-go{background:#c8102e;color:#fff}
      #pdc-classroom-modal .pdc-go:disabled{opacity:.5;cursor:not-allowed}
      .pdc-bridge-ready-note{font-size:.75rem;color:#777;margin-top:5px}
    `;
    document.head.appendChild(style);
  }

  function requestCourseDetails(courseId) {
    return new Promise(resolve => {
      const token = 'pdc-' + Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, 800);

      function onMessage(event) {
        if (event.source !== window || event.data?.type !== 'PDC_COURSE_DETAILS' || event.data?.token !== token) return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(event.data.course || null);
      }
      window.addEventListener('message', onMessage);

      const s = document.createElement('script');
      s.textContent = `(() => { try { const id=${JSON.stringify(String(courseId))}; const c=(typeof classroomCourses!=='undefined'&&Array.isArray(classroomCourses))?classroomCourses.find(x=>String(x.id)===id):null; window.postMessage({type:'PDC_COURSE_DETAILS',token:${JSON.stringify(token)},course:c?{id:String(c.id||''),name:c.name||'',section:c.section||'',alternateLink:c.alternateLink||''}:null},location.origin); } catch(e) { window.postMessage({type:'PDC_COURSE_DETAILS',token:${JSON.stringify(token)},course:null},location.origin); } })();`;
      (document.documentElement || document.head).appendChild(s);
      s.remove();
    });
  }

  function chooseCourse() {
    const source = document.getElementById('classroom-course-select');
    const options = source ? Array.from(source.options).filter(o => o.value) : [];
    if (!options.length) {
      alert('Connectez-vous d’abord avec Google dans le générateur pour charger vos groupes Classroom.');
      return Promise.resolve(null);
    }
    if (source.value) return Promise.resolve(source.value);

    injectPlanStyles();
    return new Promise(resolve => {
      document.getElementById('pdc-classroom-modal')?.remove();
      const modal = document.createElement('div');
      modal.id = 'pdc-classroom-modal';
      modal.innerHTML = `
        <div class="pdc-box" role="dialog" aria-modal="true" aria-labelledby="pdc-classroom-title">
          <h3 id="pdc-classroom-title">Publier dans quel groupe?</h3>
          <p>Le plan sera copié avec sa mise en forme, puis Classroom s’ouvrira et tentera de publier automatiquement l’annonce.</p>
          <select aria-label="Groupe Classroom">
            <option value="">Choisir un groupe</option>
            ${options.map(o => `<option value="${String(o.value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${String(o.textContent || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('')}
          </select>
          <div class="pdc-actions">
            <button type="button" class="pdc-cancel">Annuler</button>
            <button type="button" class="pdc-go" disabled>Copier et publier</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const select = modal.querySelector('select');
      const go = modal.querySelector('.pdc-go');
      const finish = value => { modal.remove(); resolve(value || null); };
      select.addEventListener('change', () => { go.disabled = !select.value; });
      go.addEventListener('click', () => finish(select.value));
      modal.querySelector('.pdc-cancel').addEventListener('click', () => finish(null));
      modal.addEventListener('click', e => { if (e.target === modal) finish(null); });
      select.focus();
    });
  }

  async function launchFromPlanPage() {
    const preview = document.getElementById('plan-preview');
    const copyBtn = document.getElementById('btn-copy');
    if (!preview || !copyBtn) return;

    document.documentElement.dataset.pdcClassroomBridge = '1';
    let handling = false;

    async function startPublish(input) {
      if (handling) return;
      handling = true;
      try {
        const courseId = String(input?.courseId || input || '');
        if (!courseId) return;
        if (preview.querySelector('.empty-state') || !htmlToText(preview.innerHTML)) {
          alert('Le plan courant n’est pas prêt à être publié.');
          return;
        }

        const sourceSelect = document.getElementById('classroom-course-select');
        const option = sourceSelect ? Array.from(sourceSelect.options).find(o => String(o.value) === courseId) : null;
        if (sourceSelect && option) sourceSelect.value = courseId;

        let details = null;
        if (input && typeof input === 'object') {
          details = {
            id: courseId,
            name: input.courseName || option?.textContent?.trim() || '',
            section: input.courseSection || '',
            alternateLink: input.alternateLink || ''
          };
        }
        if (!details?.alternateLink || !details?.name) {
          const fallback = await requestCourseDetails(courseId);
          if (fallback) details = { ...details, ...fallback };
        }
        details = details || { id: courseId, name: option?.textContent?.trim() || '', section:'', alternateLink:'' };

        const rawHtml = preview.innerHTML.trim();
        const html = cleanRichHtml(rawHtml).normalize('NFC');
        const text = htmlToText(html).normalize('NFC');
        if (!text || !html) {
          alert('Le plan courant est vide.');
          return;
        }

        const pending = {
          id: crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
          courseId,
          courseLabel: option?.textContent?.trim() || details.name || '',
          courseName: details.name || option?.textContent?.trim() || '',
          courseSection: details.section || '',
          alternateLink: details.alternateLink || '',
          html,
          text,
          createdAt: Date.now(),
          status: 'pending'
        };

        GM_setValue(PENDING_KEY, pending);
        try { GM_setClipboard(html, 'html'); } catch (_) {}
        const target = pending.alternateLink || 'https://classroom.google.com/u/0/h/tv';
        GM_openInTab(target, { active: true, insert: true, setParent: true });
      } catch (err) {
        console.error('[Plan de cours → Classroom]', err);
        alert('Le plan a rencontré un problème avant l’ouverture de Classroom : ' + (err?.message || err));
      } finally {
        handling = false;
      }
    }

    copyBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const courseId = await chooseCourse();
      if (courseId) await startPublish({ courseId });
    }, true);

    document.addEventListener('pdc:publish-course', async event => {
      const detail = event.detail || {};
      if (detail.courseId) await startPublish(detail);
    });

    const existing = document.querySelector('.pdc-bridge-ready-note');
    if (!existing) {
      const note = document.createElement('div');
      note.className = 'pdc-bridge-ready-note';
      note.textContent = 'Automatisation Classroom riche active';
      copyBtn.parentElement?.appendChild(note);
    }
  }

  function findClassLink(pending) {
    const targetName = norm(pending.courseLabel || pending.courseName);
    if (!targetName) return null;
    const links = Array.from(document.querySelectorAll('a[href*="/c/"]')).filter(visible);
    let best = null;
    let bestScore = 0;
    for (const link of links) {
      const txt = norm(link.textContent);
      let score = 0;
      if (txt === targetName) score = 100;
      else if (txt.includes(targetName) || targetName.includes(txt)) score = 80;
      else {
        const name = norm(pending.courseName);
        const section = norm(pending.courseSection);
        if (name && txt.includes(name)) score += 55;
        if (section && txt.includes(section)) score += 25;
      }
      if (score > bestScore) { bestScore = score; best = link; }
    }
    return bestScore >= 55 ? best : null;
  }

  function textCandidates(root = document) {
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
    const exactLabels = ['nouvelle annonce', 'new announcement'];
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);

    // Priorité absolue au vrai bouton montré dans Classroom.
    for (const el of buttons) {
      const txt = composerText(el);
      if (exactLabels.some(label => txt === label || txt.includes(label))) return el;
    }

    // Si le texte est porté par un span enfant, remonter au bouton parent.
    const textNodes = Array.from(document.querySelectorAll('span,div')).filter(visible);
    for (const el of textNodes) {
      const txt = norm(el.textContent || '');
      if (exactLabels.some(label => txt === label || txt.includes(label))) {
        const button = el.closest('button,[role="button"]');
        if (button && visible(button)) return button;
      }
    }

    // Secours pour une éventuelle traduction ou légère variation de Google.
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


  function foldText(value) {
    return norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function findNewAnnouncementButton() {
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);
    return buttons.find(el => {
      const txt = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
      return txt === 'nouvelle annonce' || txt.includes('nouvelle annonce') ||
             txt === 'new announcement' || txt.includes('new announcement');
    }) || null;
  }

  function resolveEditableElement(el) {
    if (!el) return null;
    if (el.matches?.('[contenteditable="true"]')) return el;
    return el.querySelector?.('[contenteditable="true"]') || null;
  }

  function findAnnouncementSurface() {
    const promptMatches = value => {
      const txt = foldText(value);
      return txt.includes('annoncez quelque chose a votre classe') ||
             txt.includes('announce something to your class');
    };
    const actionText = el => foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
    const hasAnnouncementActions = root => {
      const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(visible);
      const texts = buttons.map(actionText);
      const hasCancel = texts.some(t => t === 'annuler' || t === 'cancel');
      const hasPublish = texts.some(t => t === 'publier' || t === 'post' || t.startsWith('publier '));
      return hasCancel || hasPublish;
    };

    // Première méthode : partir du vrai éditeur et vérifier qu'il appartient au panneau « Annonce ».
    const editors = Array.from(document.querySelectorAll('[contenteditable="true"],[role="textbox"]')).filter(visible);
    for (const editor of editors) {
      let root = editor;
      for (let i = 0; i < 14 && root; i++, root = root.parentElement) {
        const descriptor = `${root.textContent || ''} ${root.getAttribute?.('aria-label') || ''} ${root.getAttribute?.('data-placeholder') || ''}`;
        if (promptMatches(descriptor) && hasAnnouncementActions(root)) {
          return { root, editor: resolveEditableElement(editor) || editor };
        }
      }
    }

    // Deuxième méthode : partir du libellé « Annoncez quelque chose à votre classe » puis remonter au panneau.
    const labels = Array.from(document.querySelectorAll('div,span,p,label')).filter(visible);
    for (const label of labels) {
      const descriptor = `${label.textContent || ''} ${label.getAttribute?.('aria-label') || ''} ${label.getAttribute?.('data-placeholder') || ''}`;
      if (!promptMatches(descriptor)) continue;
      let root = label;
      for (let i = 0; i < 14 && root; i++, root = root.parentElement) {
        const editor = Array.from(root.querySelectorAll('[contenteditable="true"],[role="textbox"]')).find(visible);
        if (editor && hasAnnouncementActions(root)) return { root, editor: resolveEditableElement(editor) || editor };
      }
    }
    return null;
  }

  function findAnnouncementEditor() {
    return findAnnouncementSurface()?.editor || null;
  }

  function selectEditorContents(editor) {
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

  function comparableText(value) {
    return foldText(value)
      .replace(/[\uFE0E\uFE0F\u20E3]/g, '')
      .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function meaningfulWords(value) {
    const stop = new Set(['cours','groupe','devoir','devoirs','rappel','rappels','aucun','aucune','pour','dans','avec','sans','les','des','une','est','sont','aout','septembre','octobre','novembre','decembre','janvier','fevrier','mars','avril','mai','juin','juillet']);
    return [...new Set(comparableText(value).split(' ').filter(w => w.length >= 3 && !stop.has(w)))];
  }

  function emojiTokens(value) {
    const s = String(value || '');
    const tokens = [];
    const re = /(?:[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/gu;
    for (const m of s.matchAll(re)) tokens.push(m[0].replace(/[\uFE0E\uFE0F]/g, ''));
    return tokens;
  }

  function emojiCoverageOkay(actualRaw, expectedText) {
    const expected = [...new Set(emojiTokens(expectedText))];
    if (!expected.length) return true;
    const actual = new Set(emojiTokens(actualRaw));
    const hits = expected.filter(x => actual.has(x)).length;
    return hits >= Math.max(1, Math.ceil(expected.length * 0.75));
  }

  function contentLooksInserted(editor, expectedText) {
    const actualRaw = String(editor?.innerText || editor?.textContent || '').trim();
    if (actualRaw.length < 8) return false;
    const actual = comparableText(actualRaw);
    const expected = comparableText(expectedText);
    if (!actual || !expected) return false;

    const words = meaningfulWords(expectedText).slice(0, 12);
    const hits = words.filter(w => actual.includes(w)).length;
    const wordOk = words.length ? hits >= Math.min(3, words.length) : actual.length >= 8;
    return wordOk && emojiCoverageOkay(actualRaw, expectedText);
  }

  async function insertRichHtml(editor, html, expectedText) {
    editor = resolveEditableElement(editor) || editor;
    if (!editor || editor.getAttribute?.('contenteditable') !== 'true') return false;

    editor.scrollIntoView?.({ block:'center' });
    editor.focus();
    clearEditorNative(editor);

    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    await sleep(450);
    if (contentLooksInserted(editor, expectedText)) return true;

    clearEditorNative(editor);
    try { insertRunsWithExecCommand(editor, html); } catch (err) {
      console.warn('[Plan de cours → Classroom] Insertion native échouée:', err);
    }
    await sleep(450);
    return contentLooksInserted(editor, expectedText);
  }

  function findPostButton(surface, allowDisabled = false) {
    const root = surface?.root;
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(el => {
      if (!visible(el)) return false;
      if (!allowDisabled && (el.disabled || el.getAttribute('aria-disabled') === 'true')) return false;
      return true;
    });
    const score = el => {
      const text = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('data-tooltip') || ''}`).trim();
      if (text === 'publier' || text === 'post') return 100;
      if (text.startsWith('publier ') && !text.includes('plus tard')) return 80;
      return 0;
    };
    return buttons.map(el => ({el, score:score(el)})).filter(x => x.score > 0).sort((a,b) => b.score-a.score)[0]?.el || null;
  }

  function pageContainsPublishedPlan(expectedText) {
    if (findAnnouncementSurface()) return false;
    const bodyRaw = String(document.body?.innerText || '');
    const body = comparableText(bodyRaw);
    const firstLine = comparableText(String(expectedText || '').split(/\r?\n/)[0]);
    if (firstLine && firstLine.length >= 8 && body.includes(firstLine)) return true;
    const words = meaningfulWords(expectedText).slice(0, 8);
    if (!words.length) return false;
    const hits = words.filter(w => body.includes(w)).length;
    return hits >= Math.min(4, words.length);
  }

  function showClassroomFallback(message) {
    document.getElementById('pdc-classroom-fallback')?.remove();
    const box = document.createElement('div');
    box.id = 'pdc-classroom-fallback';
    box.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:720px;width:calc(100% - 28px);background:#fff8e1;border:1px solid #e0b84f;border-radius:10px;padding:12px 15px;box-shadow:0 8px 28px rgba(0,0,0,.18);font:14px/1.4 Arial,sans-serif;color:#4b3a08';
    box.textContent = message + ' Le plan riche est déjà dans le presse-papier.';
    document.body.appendChild(box);
  }

  async function automateClassroom() {
    let pending = GM_getValue(PENDING_KEY, null);
    if (!pending || !pending.id) return;
    if (Date.now() - Number(pending.createdAt || 0) > MAX_AGE_MS) {
      GM_deleteValue(PENDING_KEY);
      return;
    }
    if (GM_getValue(LAST_DONE_KEY, '') === pending.id || ['submitted','clicking','manual'].includes(pending.status)) return;

    try { GM_setClipboard(pending.html, 'html'); } catch (_) {}

    if (pending.alternateLink) {
      try {
        const target = new URL(pending.alternateLink);
        if (target.hostname === 'classroom.google.com' && target.pathname.includes('/c/') && !location.pathname.includes('/c/')) {
          location.href = pending.alternateLink;
          return;
        }
      } catch (_) {}
    }

    if (!location.pathname.includes('/c/')) {
      for (let i = 0; i < 20; i++) {
        const link = findClassLink(pending);
        if (link) { link.click(); return; }
        await sleep(500);
      }
      showClassroomFallback(`Je n’ai pas retrouvé automatiquement le groupe « ${pending.courseLabel || pending.courseName} ».`);
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    // Ne jamais prendre un champ de commentaire du fil. Le seul éditeur admissible
    // doit appartenir au panneau « Annonce » avec le libellé Classroom et Annuler/Publier.
    let surface = findAnnouncementSurface();
    if (!surface) {
      let trigger = null;
      for (let i = 0; i < 30 && !trigger; i++) {
        trigger = findNewAnnouncementButton();
        if (!trigger) await sleep(250);
      }
      if (!trigger) {
        showClassroomFallback('Je suis dans le groupe, mais je n’ai pas retrouvé le bouton « Nouvelle annonce ».');
        pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
      }

      activateElement(trigger);

      for (let i = 0; i < 35 && !surface; i++) {
        await sleep(200);
        surface = findAnnouncementSurface();
      }
    }

    if (!surface?.editor) {
      showClassroomFallback('La fenêtre « Annonce » s’est ouverte, mais je n’ai pas retrouvé son champ de rédaction.');
      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;
    }

    const editor = surface.editor;
    const inserted = await insertRichHtml(editor, pending.html, pending.text);
    if (!inserted) {
      showClassroomFallback('Le contenu n’a pas été détecté dans le vrai champ de l’annonce. Aucune autre annonce ne sera ouverte.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    let postButton = null;
    for (let i = 0; i < 60 && !postButton; i++) {
      postButton = findPostButton(surface);
      if (!postButton) await sleep(200);
    }
    if (!postButton) {
      showClassroomFallback('Le contenu est dans l’annonce, mais le bouton « Publier » de cette fenêtre n’est pas disponible.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    if (!contentLooksInserted(editor, pending.text)) {
      showClassroomFallback('Le champ contient du texte, mais pas assez d’éléments du plan pour publier sans risque.');
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    // Verrouiller AVANT le clic : une navigation ou une mutation Classroom ne doit jamais relancer le script.
    pending.status = 'clicking';
    GM_setValue(PENDING_KEY, pending);
    GM_setValue(LAST_DONE_KEY, pending.id);
    try { HTMLButtonElement.prototype.click.call(postButton); } catch (_) { postButton.click(); }

    let confirmed = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      if (pageContainsPublishedPlan(pending.text)) {
        confirmed = true;
        break;
      }
    }

    if (confirmed) {
      pending.status = 'submitted';
      GM_setValue(PENDING_KEY, pending);
      notify(`Plan publié dans ${pending.courseLabel || pending.courseName || 'Classroom'}.`);
      setTimeout(() => GM_deleteValue(PENDING_KEY), 5000);
    } else {
      pending.status = 'manual';
      GM_setValue(PENDING_KEY, pending);
      showClassroomFallback('Classroom a reçu le clic sur « Publier », mais je n’ai pas pu confirmer l’apparition du plan dans le fil. Je ne relance rien automatiquement.');
    }
  }

  if (isPlanPage) launchFromPlanPage();
  if (isClassroom) {
    automateClassroom();
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(automateClassroom, 350);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
