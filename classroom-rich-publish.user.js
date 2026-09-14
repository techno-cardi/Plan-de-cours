// ==UserScript==
// @name         Plan de cours - Publication riche Classroom
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      1.4.0
// @description  Prépare le plan riche et le transmet au pont Chrome natif depuis le générateur ou Agenda.
// @author       techno-cardi
// @match        https://techno-cardi.github.io/Plan-de-cours/*
// @match        https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin/*
// @match        https://classroom.google.com/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_notification
// @updateURL    https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/classroom-rich-publish.user.js
// @downloadURL  https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/classroom-rich-publish.user.js
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.4.0';
  const REQUEST = 'PDC_NATIVE_PUBLISH_REQUEST';
  const ACK = 'PDC_NATIVE_PUBLISH_ACK';
  const RESULT = 'PDC_NATIVE_PUBLISH_RESULT';
  const GROUP_MAP_UPDATE = 'PDC_NATIVE_GROUP_MAP_UPDATE';
  const OLD_PENDING_KEY = 'plan_de_cours_classroom_rich_pending_v1';
  const OLD_DONE_KEY = 'plan_de_cours_classroom_rich_last_done_v1';
  const MIGRATION_KEY = 'plan_de_cours_native_bridge_migrated_v1';
  const QUICK_GROUPS = ['31', '32', '51'];

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
    return source.replace(/<!--[\s\S]*?-->|<\/?\s*[a-z][^<>]*>/gi, token => {
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
    }).replace(/(?:<p>\s*<\/p>){2,}/gi, '<p><br></p>').trim();
  }

  function richHtmlToText(html) {
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

  function normalizeGroup(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/(?:^|[^0-9])(31|32|51)(?:[^0-9]|$)/);
    return match ? match[1] : raw;
  }

  function classroomToken(courseId) {
    const base64 = btoa(String(courseId || ''));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function courseOptionScore(text, group) {
    const raw = String(text || '');
    if (new RegExp(`groupe\\s*${group}(?:\\D|$)`, 'i').test(raw)) return 100;
    if (new RegExp(`(?:^|\\D)${group}(?:\\D|$)`).test(raw)) return 40;
    return 0;
  }

  function discoverGeneratorGroupMap() {
    if (!location.pathname.startsWith('/Plan-de-cours/')) return [];
    const select = document.getElementById('classroom-course-select');
    if (!select) return [];
    const options = [...select.options].filter(option => /^\d+$/.test(String(option.value || '')));
    const groups = [];
    for (const group of QUICK_GROUPS) {
      const ranked = options
        .map(option => ({ option, score: courseOptionScore(option.textContent, group) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
      if (!ranked.length) continue;
      if (ranked.length > 1 && ranked[0].score === ranked[1].score) continue;
      const option = ranked[0].option;
      const courseId = String(option.value || '');
      groups.push({
        group,
        courseId,
        courseName: String(option.textContent || '').trim(),
        courseSection: '',
        alternateLink: `https://classroom.google.com/c/${classroomToken(courseId)}`
      });
    }
    return groups;
  }

  function publishDiscoveredGroupMap() {
    const groups = discoverGeneratorGroupMap();
    if (!groups.length) return false;
    window.postMessage({ type: GROUP_MAP_UPDATE, groups }, location.origin);
    return groups.length === QUICK_GROUPS.length;
  }

  function startGeneratorGroupDiscovery() {
    if (!location.pathname.startsWith('/Plan-de-cours/')) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const complete = publishDiscoveredGroupMap();
      if (complete || attempts >= 90) clearInterval(timer);
    }, 1000);
    const root = document.documentElement;
    new MutationObserver(() => publishDiscoveredGroupMap()).observe(root, { childList: true, subtree: true });
  }

  function installGeneratorBridge() {
    document.documentElement.dataset.pdcClassroomBridge = '1';
    document.documentElement.dataset.pdcClassroomBridgeVersion = VERSION;
    document.documentElement.dataset.pdcClassroomBridgeMode = 'native-extension';
    let handling = false;
    let lastNativeResult = '';

    function deliverNativeResult(value) {
      if (!value || value === lastNativeResult) return;
      let data;
      try { data = JSON.parse(value); }
      catch (_) { return; }
      if (!data?.requestId) return;
      lastNativeResult = value;
      handling = false;
      document.dispatchEvent(new CustomEvent('pdc:publish-result', {
        detail: {
          requestId: String(data.requestId || ''),
          outcome: String(data.outcome || 'failed'),
          group: String(data.group || ''),
          error: String(data.error || '')
        }
      }));
    }

    new MutationObserver(() => deliverNativeResult(document.documentElement.dataset.pdcNativePublishResult || ''))
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-pdc-native-publish-result'] });
    deliverNativeResult(document.documentElement.dataset.pdcNativePublishResult || '');

    window.addEventListener('message', message => {
      if (message.source !== window || message.origin !== location.origin || message.data?.type !== RESULT) return;
      handling = false;
      document.dispatchEvent(new CustomEvent('pdc:publish-result', {
        detail: {
          requestId: String(message.data.requestId || ''),
          outcome: String(message.data.outcome || 'failed'),
          group: String(message.data.group || ''),
          error: String(message.data.error || '')
        }
      }));
    });

    document.addEventListener('pdc:publish-course', event => {
      event.stopImmediatePropagation();
      if (handling) return;
      handling = true;
      const input = event.detail || {};
      const group = normalizeGroup(input.group || '');
      const courseId = String(input.courseId || '').trim();
      const preview = document.getElementById('plan-preview');
      let acked = false;
      let timer = 0;
      let ackPoll = 0;

      function finishAck(ok, error = '') {
        if (acked) return;
        acked = true;
        clearTimeout(timer);
        clearInterval(ackPoll);
        window.removeEventListener('message', onAck);
        handling = false;
        if (!ok) {
          document.dispatchEvent(new CustomEvent('pdc:publish-result', { detail: { requestId, outcome: 'failed', error: error || 'pont Chrome indisponible' } }));
          alert(`Publication Classroom impossible : ${error || 'pont Chrome indisponible'}`);
        }
      }

      function onAck(message) {
        if (message.source !== window || message.data?.type !== ACK || message.data?.requestId !== requestId) return;
        finishAck(Boolean(message.data.ok), message.data.error || '');
      }

      const requestId = String(input.requestId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`));
      try {
        if (!group) throw new Error('groupe Classroom manquant');
        if (courseId && !/^\d+$/.test(courseId)) throw new Error('identifiant de groupe invalide');
        let alternateLink = String(input.alternateLink || '').trim();
        if (alternateLink) {
          const target = new URL(alternateLink);
          if (target.hostname !== 'classroom.google.com' || !/\/c\//.test(target.pathname)) throw new Error('lien exact du groupe introuvable');
          alternateLink = target.toString();
        }

        const sourceHtml = String(input.richHtml || preview?.innerHTML || '');
        const html = cleanRichHtml(sourceHtml).normalize('NFC');
        const text = String(input.text || richHtmlToText(html)).trim().normalize('NFC');
        if (!html || !text || (!input.richHtml && preview?.querySelector('.empty-state'))) throw new Error('le plan courant est vide');

        if (courseId && alternateLink) {
          window.postMessage({
            type: GROUP_MAP_UPDATE,
            groups: [{
              group,
              courseId,
              courseName: String(input.courseName || ''),
              courseSection: String(input.courseSection || ''),
              alternateLink
            }]
          }, location.origin);
        }

        GM_setClipboard(html, 'html');
        window.addEventListener('message', onAck);
        window.postMessage({
          type: REQUEST,
          requestId,
          payload: {
            requestId,
            createdAt: Date.now(),
            courseId,
            group,
            courseName: String(input.courseName || ''),
            courseSection: String(input.courseSection || ''),
            alternateLink,
            announcementId: String(input.announcementId || ''),
            originalText: String(input.originalText || ''),
            text,
            title: String(input.title || text.split(/\r?\n/).find(Boolean) || ''),
            probes: Array.isArray(input.probes)
              ? input.probes.map(String).slice(0, 5)
              : text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length >= 12).slice(0, 5)
          }
        }, location.origin);
        ackPoll = setInterval(() => {
          if (document.documentElement.dataset.pdcNativeRequestAck === requestId) finishAck(true);
        }, 100);
        timer = setTimeout(() => {
          if (acked) return;
          finishAck(false, 'pont Chrome natif non détecté');
        }, 10000);
      } catch (error) {
        window.removeEventListener('message', onAck);
        clearInterval(ackPoll);
        handling = false;
        document.dispatchEvent(new CustomEvent('pdc:publish-result', { detail: { requestId, outcome: 'failed', error: String(error?.message || error) } }));
        alert(`Publication Classroom impossible : ${error?.message || error}`);
      }
    }, true);

    startGeneratorGroupDiscovery();
  }

  function retireOldRpcState() {
    document.documentElement.dataset.pdcClassroomPublisherVersion = VERSION;
    document.documentElement.dataset.pdcClassroomPublisherMode = 'native-extension';
    if (GM_getValue(MIGRATION_KEY, false)) return;
    GM_deleteValue(OLD_PENDING_KEY);
    GM_deleteValue(OLD_DONE_KEY);
    GM_setValue(MIGRATION_KEY, true);
  }

  if (location.hostname === 'techno-cardi.github.io') installGeneratorBridge();
  if (location.hostname === 'classroom.google.com') retireOldRpcState();
})();
