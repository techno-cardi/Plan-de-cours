// ==UserScript==
// @name         Plan de cours - Publication riche Classroom
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      1.2.0
// @description  Prépare le plan riche et le transmet au pont Chrome natif, sans RPC privée ni brouillon orphelin.
// @author       techno-cardi
// @match        https://techno-cardi.github.io/Plan-de-cours/*
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

  const VERSION = '1.2.0';
  const REQUEST = 'PDC_NATIVE_PUBLISH_REQUEST';
  const ACK = 'PDC_NATIVE_PUBLISH_ACK';
  const OLD_PENDING_KEY = 'plan_de_cours_classroom_rich_pending_v1';
  const OLD_DONE_KEY = 'plan_de_cours_classroom_rich_last_done_v1';
  const MIGRATION_KEY = 'plan_de_cours_native_bridge_migrated_v1';

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

  function note(text) {
    let target = document.querySelector('.pdc-bridge-ready-note');
    if (!target) {
      target = document.createElement('div');
      target.className = 'pdc-bridge-ready-note';
      document.getElementById('btn-copy')?.parentElement?.appendChild(target);
    }
    if (target) target.textContent = text;
  }

  function installGeneratorBridge() {
    document.documentElement.dataset.pdcClassroomBridge = '1';
    document.documentElement.dataset.pdcClassroomBridgeVersion = VERSION;
    document.documentElement.dataset.pdcClassroomBridgeMode = 'native-extension';
    note(`Publication native Classroom active — v${VERSION}`);
    let handling = false;

    document.addEventListener('pdc:publish-course', event => {
      event.stopImmediatePropagation();
      if (handling) return;
      handling = true;
      const input = event.detail || {};
      const courseId = String(input.courseId || '');
      const preview = document.getElementById('plan-preview');
      let acked = false;
      let timer = 0;

      function onAck(message) {
        if (message.source !== window || message.data?.type !== ACK || message.data?.requestId !== requestId) return;
        acked = true;
        clearTimeout(timer);
        window.removeEventListener('message', onAck);
        handling = false;
        if (message.data.ok) note(`Publication native lancée vers ${input.courseName || `Groupe ${input.group || ''}`} — v${VERSION}`);
        else alert(`Publication Classroom impossible : ${message.data.error || 'pont Chrome indisponible'}`);
      }

      const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        if (!/^\d+$/.test(courseId)) throw new Error('identifiant de groupe invalide');
        const target = new URL(input.alternateLink || '');
        if (target.hostname !== 'classroom.google.com' || !/\/c\//.test(target.pathname)) throw new Error('lien exact du groupe introuvable');
        const html = cleanRichHtml(preview?.innerHTML || '').normalize('NFC');
        const text = richHtmlToText(html);
        if (!html || !text || preview?.querySelector('.empty-state')) throw new Error('le plan courant est vide');

        GM_setClipboard(html, 'html');
        window.addEventListener('message', onAck);
        window.postMessage({
          type: REQUEST,
          requestId,
          payload: {
            requestId,
            createdAt: Date.now(),
            courseId,
            group: String(input.group || ''),
            courseName: String(input.courseName || ''),
            courseSection: String(input.courseSection || ''),
            alternateLink: target.toString(),
            text,
            title: text.split(/\r?\n/).find(Boolean) || '',
            probes: text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length >= 12).slice(0, 5)
          }
        }, location.origin);
        timer = setTimeout(() => {
          if (acked) return;
          window.removeEventListener('message', onAck);
          handling = false;
          note(`Pont Chrome natif non détecté — v${VERSION}`);
          alert('Le pont Chrome natif de publication Classroom n’est pas actif. Le plan riche reste dans le presse-papier.');
        }, 1800);
      } catch (error) {
        window.removeEventListener('message', onAck);
        handling = false;
        alert(`Publication Classroom impossible : ${error?.message || error}`);
      }
    }, true);
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
