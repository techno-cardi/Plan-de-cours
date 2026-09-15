(() => {
  'use strict';

  const GROUP_MAP_KEY = 'pdcNativeClassroomGroupMapV1';
  const QUICK_GROUPS = ['31', '32', '51'];
  const COURSE_PATH_RE = /\/c\/([^/?#]+)/;
  let lastSignature = '';
  let scanTimer = 0;

  function decodeCourseId(token) {
    const raw = String(token || '').trim();
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return raw;
    try {
      const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const decoded = atob(padded);
      return /^\d+$/.test(decoded) ? decoded : '';
    } catch (_) {
      return '';
    }
  }

  function groupFromText(value) {
    const text = String(value || '').replace(/\u00a0/g, ' ');
    const explicit = text.match(/\bgroupe\s*[-–—:]?\s*(31|32|51)\b/i);
    if (explicit) return explicit[1];
    const coded = text.match(/\bFRA(?:3|5)SE[-\s]?(31|32|51)\b/i);
    return coded?.[1] || '';
  }

  function sectionForGroup(group) {
    return group === '51' ? '5e secondaire' : '3e secondaire';
  }

  function normalizedCourseLink(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== 'https://classroom.google.com') return null;
      const token = url.pathname.match(COURSE_PATH_RE)?.[1] || '';
      const courseId = decodeCourseId(token);
      if (!courseId) return null;
      return {
        token,
        courseId,
        alternateLink: `${url.origin}/c/${token}`
      };
    } catch (_) {
      return null;
    }
  }

  function candidateText(anchor) {
    const own = [
      anchor.textContent,
      anchor.getAttribute('aria-label'),
      anchor.getAttribute('title')
    ].filter(Boolean).join(' ');
    if (groupFromText(own)) return own;

    let node = anchor.parentElement;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const text = String(node.innerText || node.textContent || '').trim();
      const groups = QUICK_GROUPS.filter(group => new RegExp(`(?:groupe\\s*[-–—:]?\\s*${group}\\b|FRA(?:3|5)SE[-\\s]?${group}\\b)`, 'i').test(text));
      if (groups.length === 1) return text;
      if (groups.length > 1) break;
    }
    return own;
  }

  function currentCourseCandidate() {
    const link = normalizedCourseLink(location.href);
    if (!link) return null;
    const sources = [
      document.title,
      ...Array.from(document.querySelectorAll('h1,h2,[role="heading"]')).slice(0, 12).map(node => node.textContent)
    ];
    for (const source of sources) {
      const group = groupFromText(source);
      if (!group) continue;
      return {
        group,
        courseId: link.courseId,
        courseName: String(source || '').trim(),
        courseSection: sectionForGroup(group),
        alternateLink: link.alternateLink,
        savedAt: Date.now(),
        learnedAutomatically: true
      };
    }
    return null;
  }

  function discoverCandidates() {
    const byGroup = new Map();
    const current = currentCourseCandidate();
    if (current) byGroup.set(current.group, current);

    for (const anchor of document.querySelectorAll('a[href*="/c/"]')) {
      const link = normalizedCourseLink(anchor.href);
      if (!link) continue;
      const text = candidateText(anchor);
      const group = groupFromText(text);
      if (!group || byGroup.has(group)) continue;
      byGroup.set(group, {
        group,
        courseId: link.courseId,
        courseName: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 240),
        courseSection: sectionForGroup(group),
        alternateLink: link.alternateLink,
        savedAt: Date.now(),
        learnedAutomatically: true
      });
    }

    return [...byGroup.values()];
  }

  async function persist(candidates) {
    if (!candidates.length) return;
    const signature = candidates.map(item => `${item.group}:${item.courseId}`).sort().join('|');
    if (!signature || signature === lastSignature) return;

    const stored = await chrome.storage.local.get(GROUP_MAP_KEY);
    const map = stored[GROUP_MAP_KEY] || {};
    let changed = false;
    for (const item of candidates) {
      const existing = map[item.group];
      if (String(existing?.courseId || '') === item.courseId && String(existing?.alternateLink || '') === item.alternateLink) continue;
      map[item.group] = item;
      changed = true;
    }
    if (changed) {
      await chrome.storage.local.set({ [GROUP_MAP_KEY]: map });
      console.info('[Plan de cours] Liaisons Classroom détectées automatiquement :', candidates.map(item => `groupe ${item.group}`).join(', '));
    }
    lastSignature = signature;
  }

  async function scan() {
    try {
      await persist(discoverCandidates());
    } catch (error) {
      console.warn('[Plan de cours] Auto-liaison Classroom impossible :', error);
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 350);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('hashchange', scheduleScan);
  setInterval(scan, 5000);
  scheduleScan();
})();
