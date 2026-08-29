// ==UserScript==
// @name         Plan de cours - Publication riche Classroom
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      1.1.2
// @description  Publie le plan riche dans le groupe Classroom choisi, sans automatiser l'éditeur d'annonce.
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

  const VERSION = '1.1.2';
  const LOG_PREFIX = `[Plan de cours → Classroom v${VERSION}]`;
  const PENDING_KEY = 'plan_de_cours_classroom_rich_pending_v1';
  const LAST_DONE_KEY = 'plan_de_cours_classroom_rich_last_done_v1';
  const MAX_AGE_MS = 5 * 60 * 1000;
  const VERIFY_TIMEOUT_MS = 60 * 1000;
  const CREATE_SETTLE_MS = 1200;
  const SAVE_SETTLE_MS = 5200;
  const isPlanPage = location.hostname === 'techno-cardi.github.io';
  const isClassroom = location.hostname === 'classroom.google.com';
  const runtimeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const fold = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  function log(stage, details = {}) {
    console.info(LOG_PREFIX, { stage, ...details });
  }

  function notify(text) {
    try { GM_notification({ title: 'Plan de cours → Classroom', text, timeout: 6000 }); }
    catch (_) { /* notification facultative */ }
  }

  function showBanner(message, kind = 'warn') {
    document.getElementById('pdc-classroom-status')?.remove();
    const colors = kind === 'ok'
      ? { bg: '#e6f4ea', border: '#8bc49d', text: '#185b2d' }
      : kind === 'error'
        ? { bg: '#fce8e6', border: '#e09a93', text: '#7b1b14' }
        : { bg: '#fff8e1', border: '#e0b84f', text: '#4b3a08' };
    const box = document.createElement('div');
    box.id = 'pdc-classroom-status';
    box.setAttribute('role', 'status');
    box.style.cssText = `position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:760px;width:calc(100% - 28px);background:${colors.bg};border:1px solid ${colors.border};border-radius:10px;padding:12px 15px;box-shadow:0 8px 28px rgba(0,0,0,.18);font:14px/1.45 Arial,sans-serif;color:${colors.text}`;
    box.textContent = `${message} — v${VERSION}`;
    document.body.appendChild(box);
    return box;
  }

  function exposePending(pending) {
    if (!pending) return;
    document.documentElement.dataset.pdcClassroomPendingId = String(pending.id || '');
    document.documentElement.dataset.pdcClassroomPendingStatus = String(pending.status || '');
    document.documentElement.dataset.pdcClassroomAnnouncementId = String(pending.rpcAnnouncementId || pending.rpcDraftId || '');
  }

  function waitRemaining(startedAt, minimumMs, stage) {
    const remaining = Math.max(0, minimumMs - (Date.now() - Number(startedAt || 0)));
    if (!remaining) return Promise.resolve();
    log('settling', { stage, waitMs: remaining });
    return sleep(remaining);
  }

  function decodeHtmlText(value) {
    const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
    return String(value || '').replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, code) => {
      if (code[0] !== '#') return Object.prototype.hasOwnProperty.call(named, code.toLowerCase()) ? named[code.toLowerCase()] : entity;
      const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      try { return Number.isInteger(point) && point >= 0 && point <= 0x10FFFF ? String.fromCodePoint(point) : entity; }
      catch (_) { return entity; }
    });
  }

  function escapeHtmlText(value) {
    return String(value || '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
  }

  function cleanRichHtml(html) {
    let source = String(html || '').replace(/\u0000/g, '');
    let previous = '';
    while (source !== previous) {
      previous = source;
      source = source.replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    }

    const allowed = new Map([
      ['p', 'p'], ['div', 'p'], ['br', 'br'],
      ['b', 'b'], ['strong', 'b'], ['i', 'i'], ['em', 'i'],
      ['u', 'u'], ['s', 's'], ['strike', 's']
    ]);
    const clean = source.replace(/<!--[\s\S]*?-->|<\/?\s*[a-z][^<>]*>/gi, token => {
      if (token.startsWith('<!--')) return '';
      const match = token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)/i);
      if (!match) return '';
      const closing = Boolean(match[1]);
      const sourceTag = match[2].toLowerCase();
      if (sourceTag === 'img' && !closing) {
        const fallback = token.match(/\s(?:alt|data-emoji|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const emoji = decodeHtmlText(fallback?.[1] || fallback?.[2] || fallback?.[3] || '');
        return /[\u2600-\u27BF]|[\u{1F300}-\u{1FAFF}]/u.test(emoji) ? escapeHtmlText(emoji) : '';
      }
      const tag = allowed.get(sourceTag);
      if (!tag) return '';
      if (tag === 'br') return closing ? '' : '<br>';
      return closing ? `</${tag}>` : `<${tag}>`;
    });

    return clean
      .replace(/(?:<p>\s*<\/p>){2,}/gi, '<p><br></p>')
      .trim();
  }

  function richHtmlToClassroomText(html) {
    return decodeHtmlText(String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div)>\s*/gi, '\n\n')
      .replace(/<[^>]*>/g, ''))
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .normalize('NFC');
  }

  function requestCourseDetails(courseId) {
    return new Promise(resolve => {
      const token = `pdc-${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, 900);

      function onMessage(event) {
        if (event.source !== window || event.data?.type !== 'PDC_COURSE_DETAILS' || event.data?.token !== token) return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(event.data.course || null);
      }

      window.addEventListener('message', onMessage);
      const script = document.createElement('script');
      script.textContent = `(() => { try { const id=${JSON.stringify(String(courseId))}; const c=(typeof classroomCourses!=='undefined'&&Array.isArray(classroomCourses))?classroomCourses.find(x=>String(x.id)===id):null; window.postMessage({type:'PDC_COURSE_DETAILS',token:${JSON.stringify(token)},course:c?{id:String(c.id||''),name:c.name||'',section:c.section||'',alternateLink:c.alternateLink||''}:null},location.origin); } catch(e) { window.postMessage({type:'PDC_COURSE_DETAILS',token:${JSON.stringify(token)},course:null},location.origin); } })();`;
      (document.documentElement || document.head).appendChild(script);
      script.remove();
    });
  }

  function installPlanBridge() {
    const preview = document.getElementById('plan-preview');
    if (!preview) return;
    document.documentElement.dataset.pdcClassroomBridge = '1';
    document.documentElement.dataset.pdcClassroomBridgeVersion = VERSION;
    let handling = false;

    document.addEventListener('pdc:publish-course', async event => {
      event.stopImmediatePropagation();
      if (handling) return;
      handling = true;
      try {
        const input = event.detail || {};
        const courseId = String(input.courseId || '');
        if (!/^\d+$/.test(courseId)) throw new Error('identifiant de groupe invalide');
        let details = {
          id: courseId,
          name: input.courseName || '',
          section: input.courseSection || '',
          alternateLink: input.alternateLink || ''
        };
        if (!details.alternateLink || !details.name) details = { ...details, ...(await requestCourseDetails(courseId) || {}) };
        const target = new URL(details.alternateLink || '');
        if (target.hostname !== 'classroom.google.com' || !/\/c\//.test(target.pathname)) throw new Error('lien exact du groupe Classroom introuvable');

        const html = cleanRichHtml(preview.innerHTML).normalize('NFC');
        const text = richHtmlToClassroomText(html);
        if (!html || !text || preview.querySelector('.empty-state')) throw new Error('le plan courant est vide');

        const pending = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          version: VERSION,
          courseId,
          courseLabel: details.name || `Groupe ${input.group || ''}`,
          courseName: details.name || '',
          courseSection: details.section || '',
          alternateLink: target.toString(),
          html,
          text,
          createdAt: Date.now(),
          status: 'pending'
        };
        GM_setValue(PENDING_KEY, pending);
        try { GM_setClipboard(html, 'html'); } catch (_) { /* copie de secours */ }
        log('plan-prepared', { courseId, textLength: text.length, htmlLength: html.length });
        GM_openInTab(pending.alternateLink, { active: true, insert: true, setParent: true });
      } catch (error) {
        console.error(LOG_PREFIX, error);
        alert(`Publication Classroom impossible : ${error?.message || error}`);
      } finally {
        handling = false;
      }
    }, true);

    let note = document.querySelector('.pdc-bridge-ready-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'pdc-bridge-ready-note';
      document.getElementById('btn-copy')?.parentElement?.appendChild(note);
    }
    if (note) note.textContent = `Automatisation Classroom riche active — v${VERSION}`;
  }

  // Publication riche via les mêmes RPC internes que l'interface Classroom.
  // Le diagnostic a confirmé qu'un collage manuel fonctionne grâce à des
  // événements navigateur isTrusted=true, impossibles à fabriquer en JS.
  // On ne touche donc plus au contenteditable pour la publication automatique.
  const CLASSROOM_CREATE_TEMPLATE = [[[3,null,[[[null,[0]],null,null,null,null,"",null,null,null,[3],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,[1,1,null,1]];

  // Appel F7Tqub intermédiaire observé dans le HAR avant la publication finale.
  const CLASSROOM_SAVE_TEMPLATE = [[[3,null,[[[0,[0]],null,null,null,null,"",null,null,null,[2],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]],[1,1,1,1,1,[1],[1],1,null,null,null,null,1],null,[1,1]],[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]]],[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]],[1,1,1,1,1,[1],[1],1,null,null,null,null,1],[1]],null,null,[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]]]],[ [[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,null,[1,1,null,1]];

  const CLASSROOM_PUBLISH_TEMPLATE = [[[3,null,[[[0,[0]],null,null,null,[0],"",null,null,3,[2,[0]],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[null,null,null,null,null,1],[]],[[null,null,null,null,null,1]],[[null,null,null,null,null,1],[]],null,null,[[null,null,null,null,null,1]]],[[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,null,[1,1,null,1]];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readEmbeddedWizValue(key) {
    const html = document.documentElement?.innerHTML || '';
    const match = html.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
    if (!match) return '';
    try { return JSON.parse(`"${match[1]}"`); }
    catch (_) { return match[1].replace(/\\u003d/g, '='); }
  }

  function getRpcContext() {
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const wiz = pageWindow.WIZ_global_data || {};
    let sid = String(wiz.FdrFJe || readEmbeddedWizValue('FdrFJe') || '');
    let bl = String(wiz.cfb2h || readEmbeddedWizValue('cfb2h') || '');
    let at = String(wiz.SNlM0e || readEmbeddedWizValue('SNlM0e') || '');
    const resources = performance.getEntriesByType('resource').map(entry => entry.name).reverse();
    for (const name of resources) {
      if (!name.includes('/ClassroomUi/data/batchexecute')) continue;
      try {
        const url = new URL(name);
        sid ||= url.searchParams.get('f.sid') || '';
        bl ||= url.searchParams.get('bl') || '';
      } catch (_) { /* ressource non exploitable */ }
      if (sid && bl) break;
    }
    if (!sid || !bl || !at) throw new Error('paramètres de session Classroom incomplets; rechargez Classroom');
    return { sid, bl, at, requestId: Math.floor(Math.random() * 8000000) + 1000000 };
  }

  function accountIndex() {
    return location.pathname.match(/^\/u\/(\d+)\//)?.[1] || '0';
  }

  function sourcePath() {
    const account = accountIndex();
    const path = location.pathname.replace(/^\/u\/\d+/, '');
    return `/u/${account}${path.startsWith('/') ? path : `/${path}`}`;
  }

  function rpcUrl(rpcId, context) {
    const url = new URL(`/u/${accountIndex()}/_/ClassroomUi/data/batchexecute`, location.origin);
    url.searchParams.set('rpcids', rpcId);
    url.searchParams.set('source-path', sourcePath());
    url.searchParams.set('f.sid', context.sid);
    url.searchParams.set('bl', context.bl);
    url.searchParams.set('hl', document.documentElement.lang || 'fr');
    url.searchParams.set('soc-app', '1');
    url.searchParams.set('soc-platform', '1');
    url.searchParams.set('soc-device', '1');
    context.requestId += 100000;
    url.searchParams.set('_reqid', String(context.requestId));
    url.searchParams.set('rt', 'c');
    return url.toString();
  }

  function parseBatchResponse(text, rpcId) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.startsWith('[[')) continue;
      try {
        const rows = JSON.parse(line);
        for (const row of rows) {
          if (row?.[0] === 'wrb.fr' && row?.[1] === rpcId && typeof row?.[2] === 'string') return JSON.parse(row[2]);
        }
      } catch (_) { /* passer au fragment suivant */ }
    }
    return null;
  }

  async function callRpc(rpcId, inner, context, stage) {
    const form = new URLSearchParams();
    form.set('f.req', JSON.stringify([[[rpcId, JSON.stringify(inner), null, 'generic']]]));
    form.set('at', context.at);
    const started = performance.now();
    const response = await fetch(rpcUrl(rpcId, context), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'x-same-domain': '1'
      },
      body: form.toString()
    });
    const body = await response.text();
    log('rpc-response', { stage, rpcId, status: response.status, elapsedMs: Math.round(performance.now() - started) });
    if (!response.ok) throw new Error(`${stage}: HTTP ${response.status}`);
    const parsed = parseBatchResponse(body, rpcId);
    if (!parsed) throw new Error(`${stage}: réponse Classroom illisible`);
    return parsed;
  }

  function makeDocumentId() {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const random = Math.random() * 16 | 0;
      return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
    });
    return uuid.toUpperCase();
  }

  function fillRichMessage(item, uuid, text, html) {
    item[27][0][1] = uuid;
    item[27][0][3] = ['edu.rt', text];
    item[27][0][6] = ['edu.rt', text, null, null, [null, html]];
  }

  function returnedItem(parsed) {
    return parsed?.[1]?.[0]?.[1]?.[2]?.[0] || null;
  }

  async function publishByRpc(pending) {
    const context = getRpcContext();
    const courseId = Number(pending.courseId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0) throw new Error('identifiant numérique du groupe invalide');
    const html = cleanRichHtml(pending.html).normalize('NFC');
    const text = richHtmlToClassroomText(html);
    if (!html || !text) throw new Error('plan vide après validation');
    pending.html = html;
    pending.text = text;

    const uuid = pending.rpcUuid || makeDocumentId();
    let announcementId = pending.rpcDraftId ? Number(pending.rpcDraftId) : null;
    let userId = pending.rpcUserId ? Number(pending.rpcUserId) : null;

    if (!announcementId || !userId) {
      const create = deepClone(CLASSROOM_CREATE_TEMPLATE);
      const item = create[0][0][2][0];
      item[0] = [null, [courseId]];
      fillRichMessage(item, uuid, text, html);
      const result = await callRpc('n5NjMc', create, context, 'création du brouillon riche');
      const created = returnedItem(result);
      announcementId = Number(created?.[0]?.[0]);
      userId = Number(created?.[4]?.[0]);
      if (!Number.isSafeInteger(announcementId) || !Number.isSafeInteger(userId) || Number(created?.[8]) !== 2) throw new Error('création: Classroom n’a pas confirmé le brouillon');
      Object.assign(pending, { rpcUuid: uuid, rpcDraftId: String(announcementId), rpcUserId: String(userId), rpcStage: 'created' });
      pending.createdConfirmedAt = Date.now();
      GM_setValue(PENDING_KEY, pending);
    }

    if (pending.rpcStage !== 'saved' && pending.rpcStage !== 'published') {
      await waitRemaining(pending.createdConfirmedAt, CREATE_SETTLE_MS, 'avant sauvegarde');
      const save = deepClone(CLASSROOM_SAVE_TEMPLATE);
      const item = save[0][0][2][0];
      item[0] = [announcementId, [courseId]];
      fillRichMessage(item, uuid, text, html);
      const result = await callRpc('F7Tqub', save, context, 'sauvegarde riche');
      const saved = returnedItem(result);
      if (Number(saved?.[0]?.[0]) !== announcementId || Number(saved?.[8]) !== 2) throw new Error('sauvegarde: Classroom n’a pas confirmé l’état brouillon');
      pending.rpcStage = 'saved';
      pending.savedConfirmedAt = Date.now();
      GM_setValue(PENDING_KEY, pending);
    }

    await waitRemaining(pending.savedConfirmedAt, SAVE_SETTLE_MS, 'avant publication');
    const publish = deepClone(CLASSROOM_PUBLISH_TEMPLATE);
    const item = publish[0][0][2][0];
    item[0] = [announcementId, [courseId]];
    item[4] = [userId];
    item[9] = [2, [userId]];
    fillRichMessage(item, uuid, text, html);
    const result = await callRpc('F7Tqub', publish, context, 'publication finale');
    const published = returnedItem(result);
    if (Number(published?.[0]?.[0]) !== announcementId || Number(published?.[8]) !== 3) {
      throw new Error(`publication: état ${Number.isFinite(Number(published?.[8])) ? Number(published?.[8]) : 'inconnu'} au lieu de 3`);
    }
    Object.assign(pending, { rpcStage: 'published', status: 'verifying', publishedAt: Date.now(), rpcAnnouncementId: String(announcementId) });
    GM_setValue(PENDING_KEY, pending);
    exposePending(pending);
    return pending;
  }

  function courseTokenFromPath(pathname) {
    const token = pathname.match(/\/c\/([^/?#]+)/)?.[1] || '';
    if (!token) return '';
    try { return atob(token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=')); }
    catch (_) { return ''; }
  }

  function onExpectedCourse(pending) {
    if (courseTokenFromPath(location.pathname) === String(pending.courseId)) return true;
    try {
      const target = new URL(pending.alternateLink);
      return location.pathname.replace(/^\/u\/\d+/, '') === target.pathname.replace(/^\/u\/\d+/, '');
    } catch (_) { return false; }
  }

  function findExactCourseLink(courseId) {
    return Array.from(document.querySelectorAll('a[href*="/c/"]')).find(link => {
      try { return courseTokenFromPath(new URL(link.href).pathname) === String(courseId); }
      catch (_) { return false; }
    }) || null;
  }

  async function routeToExpectedCourse(pending) {
    if (onExpectedCourse(pending)) return true;
    try {
      const target = new URL(pending.alternateLink);
      if (target.hostname === 'classroom.google.com' && /\/c\//.test(target.pathname)) {
        location.assign(target.toString());
        return false;
      }
    } catch (_) { /* tenter le lien exact présent dans l'accueil */ }
    const link = findExactCourseLink(pending.courseId);
    if (link) {
      location.assign(link.href);
      return false;
    }
    throw new Error('le cours exact ne peut pas être atteint sans ambiguïté');
  }

  function publishedPlanVisible(pending) {
    const body = fold(document.body?.innerText || '');
    const lines = String(pending.text || '').split(/\r?\n/).map(fold).filter(line => line.length >= 5);
    if (!lines.length) return false;
    const probes = [lines[0], ...lines.slice(1).filter(line => line.length >= 12).slice(0, 3)];
    return probes.length >= 2 && probes.every(probe => body.includes(probe));
  }

  async function verifyPublished(pending) {
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (publishedPlanVisible(pending)) {
        GM_setValue(LAST_DONE_KEY, pending.id);
        GM_deleteValue(PENDING_KEY);
        showBanner(`Plan riche publié et vérifié visuellement dans ${pending.courseLabel || pending.courseName || 'Classroom'}.`, 'ok');
        notify(`Plan riche publié et vérifié dans ${pending.courseLabel || pending.courseName || 'Classroom'}.`);
        log('verified-visible', { courseId: pending.courseId, announcementId: pending.rpcAnnouncementId || pending.rpcDraftId });
        return true;
      }
      await sleep(500);
    }
    pending.status = 'verification-needed';
    pending.verificationError = 'publication confirmée par Classroom, mais contenu non retrouvé dans le flux visible';
    GM_setValue(PENDING_KEY, pending);
    showBanner('Classroom a retourné l’état publié, mais la vérification visuelle n’a pas trouvé le plan. Aucune nouvelle annonce ne sera créée automatiquement.', 'error');
    return false;
  }

  async function claimPending(pending) {
    if (pending.claimedBy && pending.claimedBy !== runtimeId && Date.now() - Number(pending.claimedAt || 0) < 90_000) return false;
    pending.claimedBy = runtimeId;
    pending.claimedAt = Date.now();
    pending.status = 'rpc-running';
    GM_setValue(PENDING_KEY, pending);
    await sleep(100 + Math.floor(Math.random() * 120));
    return GM_getValue(PENDING_KEY, null)?.claimedBy === runtimeId;
  }

  function showResumeBanner(pending) {
    const announcementId = String(pending.rpcAnnouncementId || pending.rpcDraftId || '');
    if (!/^\d+$/.test(announcementId) || !/^\d+$/.test(String(pending.rpcUserId || ''))) {
      showBanner('La publication réseau est terminée, mais sa présence dans le flux reste à vérifier. Le script ne republiera pas.', 'warn');
      return;
    }
    const box = showBanner('La publication réseau est terminée, mais sa présence dans le flux reste à vérifier. Vous pouvez finaliser la même annonce, sans créer de nouveau brouillon.', 'warn');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Finaliser la même annonce';
    button.style.cssText = 'display:block;margin:10px auto 0;border:0;border-radius:7px;padding:8px 13px;background:#185abc;color:#fff;font-weight:700;cursor:pointer';
    button.addEventListener('click', async () => {
      button.disabled = true;
      const latest = GM_getValue(PENDING_KEY, null);
      if (String(latest?.id || '') !== String(pending.id) || String(latest?.rpcDraftId || '') !== announcementId) {
        showBanner('La demande de reprise ne correspond plus à cette annonce; aucune action n’a été envoyée.', 'error');
        return;
      }
      Object.assign(latest, {
        status: 'pending',
        rpcStage: 'saved',
        savedConfirmedAt: Date.now() - SAVE_SETTLE_MS,
        claimedBy: '',
        claimedAt: 0,
        resumeRequestedAt: Date.now()
      });
      GM_setValue(PENDING_KEY, latest);
      exposePending(latest);
      await automateClassroom();
    }, { once: true });
    box.appendChild(button);
  }

  async function automateClassroom() {
    let pending = GM_getValue(PENDING_KEY, null);
    if (!pending?.id) return;
    exposePending(pending);
    if (GM_getValue(LAST_DONE_KEY, '') === pending.id) {
      GM_deleteValue(PENDING_KEY);
      return;
    }
    if (Date.now() - Number(pending.createdAt || 0) > MAX_AGE_MS && pending.status !== 'verifying') {
      showBanner('La demande de publication a expiré; aucun brouillon ne sera créé.', 'error');
      GM_deleteValue(PENDING_KEY);
      return;
    }

    if (!(await routeToExpectedCourse(pending))) return;
    if (pending.status === 'verifying') {
      await verifyPublished(pending);
      return;
    }
    if (pending.status === 'verification-needed') {
      showResumeBanner(pending);
      return;
    }
    if (pending.status === 'rpc-error') {
      showBanner(`Publication interrompue à l’étape ${pending.rpcStage || 'initiale'} : ${pending.rpcError || 'erreur inconnue'}. Aucun nouvel essai automatique ne sera lancé.`, 'error');
      return;
    }
    if (pending.status === 'rpc-running' && pending.claimedBy !== runtimeId) {
      if (Date.now() - Number(pending.claimedAt || 0) >= 90_000) {
        pending.status = 'rpc-error';
        pending.rpcError = 'état d’une tentative précédente incertain';
        GM_setValue(PENDING_KEY, pending);
        showBanner('Une tentative précédente est restée dans un état incertain. Le script ne créera pas de second brouillon.', 'error');
      }
      return;
    }
    if (!(await claimPending(pending))) return;

    pending = GM_getValue(PENDING_KEY, pending) || pending;
    try {
      showBanner(`Publication riche en cours dans ${pending.courseLabel || pending.courseName || 'le groupe choisi'}…`, 'warn');
      pending = await publishByRpc(pending);
      showBanner('Classroom a confirmé l’état publié. Vérification du contenu visible…', 'warn');
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      console.error(LOG_PREFIX, error);
      pending = GM_getValue(PENDING_KEY, pending) || pending;
      pending.status = 'rpc-error';
      pending.rpcError = String(error?.message || error);
      GM_setValue(PENDING_KEY, pending);
      showBanner(`Publication interrompue : ${pending.rpcError}. Aucun autre brouillon ne sera créé automatiquement.`, 'error');
      log('failed', { stage: pending.rpcStage || 'preflight', message: pending.rpcError });
    }
  }

  if (isPlanPage) installPlanBridge();
  if (isClassroom) {
    document.documentElement.dataset.pdcClassroomPublisherVersion = VERSION;
    automateClassroom();
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      setTimeout(automateClassroom, 350);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
