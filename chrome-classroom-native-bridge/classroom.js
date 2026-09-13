(() => {
  'use strict';

  const VERSION = '1.1.0';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let activeRequestId = '';
  let activePhase = 'idle';
  const fold = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  function courseToken(pathname) {
    const token = pathname.match(/\/c\/([^/?#]+)/)?.[1] || '';
    if (!token) return '';
    try { return atob(token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=')); }
    catch (_) { return ''; }
  }

  function showBanner(message, kind = 'warn') {
    document.getElementById('pdc-native-classroom-status')?.remove();
    const box = document.createElement('div');
    box.id = 'pdc-native-classroom-status';
    box.setAttribute('role', 'status');
    const colors = kind === 'ok' ? ['#e6f4ea', '#8bc49d', '#185b2d'] : kind === 'error' ? ['#fce8e6', '#e09a93', '#7b1b14'] : ['#fff8e1', '#e0b84f', '#4b3a08'];
    box.style.cssText = `position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:760px;width:calc(100% - 28px);background:${colors[0]};border:1px solid ${colors[1]};border-radius:10px;padding:12px 15px;box-shadow:0 8px 28px rgba(0,0,0,.18);font:14px/1.45 Arial,sans-serif;color:${colors[2]}`;
    box.textContent = `${message} — pont natif v${VERSION}`;
    document.body.appendChild(box);
  }

  async function waitFor(read, timeoutMs, intervalMs = 120) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = read();
      if (value) return value;
      await sleep(intervalMs);
    }
    return null;
  }

  function visibleButtons(label, root = document) {
    const target = fold(label);
    return Array.from(root.querySelectorAll('button,[role="button"]')).filter(button => {
      if (!button.getClientRects().length) return false;
      const labels = [
        button.textContent,
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        ...Array.from(button.querySelectorAll('[jsname="V67aGc"],span')).map(node => node.textContent)
      ];
      return labels.some(value => fold(value) === target);
    });
  }

  function visibleButton(label, root = document) {
    return visibleButtons(label, root)[0] || null;
  }

  function newAnnouncementButton() {
    const target = fold('Nouvelle annonce');
    const candidates = Array.from(document.querySelectorAll('main button, main [role="button"], button[jsname="Y2vwzf"]'))
      .filter(button => {
        const values = [button.textContent, button.getAttribute('aria-label'), button.getAttribute('title')];
        return values.some(value => fold(value).includes(target));
      });
    return candidates.find(button => button.getClientRects().length && !button.disabled && button.getAttribute('aria-disabled') !== 'true') || null;
  }

  function announcementEditor() {
    const candidates = Array.from(document.querySelectorAll(
      '[role="dialog"] [contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label*="Annonce"]'
    ));
    return candidates.find(editor => {
      if (!editor.getClientRects().length) return false;
      const label = fold(editor.getAttribute('aria-label'));
      return label.includes('annonce') && !editor.closest('[aria-hidden="true"]');
    }) || null;
  }

  async function openAnnouncementEditor() {
    // Classroom peut afficher le bouton avant que son gestionnaire de clic soit
    // hydraté. Réutiliser un éditeur déjà ouvert, puis retenter le même bouton
    // après activation évite l'échec intermittent sans créer de brouillon en trop.
    let editor = announcementEditor();
    if (editor) return editor;
    for (let attempt = 0; attempt < 3; attempt++) {
      let button = await waitFor(newAnnouncementButton, attempt ? 12000 : 30000, 200);
      if (!button) continue;
      await send({ type: 'activate' });
      await sleep(attempt ? 900 : 450);
      button = newAnnouncementButton() || button;
      button.scrollIntoView({ block: 'center', inline: 'nearest' });
      button.focus();
      button.click();
      editor = await waitFor(announcementEditor, 8000, 150);
      if (editor) return editor;
    }
    return null;
  }

  function announcementCard(id) {
    return Array.from(document.querySelectorAll('[data-stream-item-id]'))
      .find(node => node.getAttribute('data-stream-item-id') === String(id) && node.querySelector('[aria-haspopup="menu"]')) || null;
  }

  async function openExistingAnnouncement(job) {
    if (announcementEditor()) throw new Error('Un éditeur est déjà ouvert. Fermez-le avant de modifier cette annonce.');
    const card = await waitFor(() => announcementCard(job.announcementId), 30000, 200);
    if (!card) throw new Error('L’annonce sélectionnée est introuvable. Aucune nouvelle annonce ne sera créée.');
    const menu = Array.from(card.querySelectorAll('[aria-haspopup="menu"]'))
      .find(button => fold(button.getAttribute('aria-label')).includes("options d'annonce"));
    if (!menu) throw new Error('Menu de modification de cette annonce introuvable.');
    await send({ type: 'activate' });
    menu.scrollIntoView({ block: 'center' });
    menu.click();
    const modify = await waitFor(() => Array.from(document.querySelectorAll('[role="menuitem"]'))
      .find(node => node.getClientRects().length && fold(node.textContent) === 'modifier'), 6000);
    if (!modify) throw new Error('Commande Modifier introuvable pour cette annonce.');
    modify.click();
    const editor = await waitFor(announcementEditor, 10000);
    if (!editor || fold(editor.innerText) !== fold(job.originalText)) {
      throw new Error('Le contenu de cette annonce a changé. Actualisez sa sélection avant de la remplacer.');
    }
    return editor;
  }

  function hasStyledText(root, text, kind) {
    const wanted = fold(text);
    return Array.from(root.querySelectorAll('*')).some(node => {
      if (!fold(node.textContent).includes(wanted)) return false;
      const tag = node.tagName.toLowerCase();
      const style = getComputedStyle(node);
      if (kind === 'underline') {
        return tag === 'u' || String(style.textDecorationLine || '').includes('underline') || String(style.textDecoration || '').includes('underline');
      }
      const weight = Number.parseInt(style.fontWeight, 10);
      return tag === 'b' || tag === 'strong' || style.fontWeight === 'bold' || (Number.isFinite(weight) && weight >= 600);
    });
  }

  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || 'pont Chrome indisponible');
    return result;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'PDC_NATIVE_STATUS') return;
    sendResponse({
      ok: true,
      requestId: activeRequestId,
      phase: activePhase,
      running: Boolean(activeRequestId && !['idle', 'finished'].includes(activePhase))
    });
  });

  async function run() {
    document.documentElement.dataset.pdcNativeClassroomBridgeVersion = VERSION;
    const claimed = await chrome.runtime.sendMessage({ type: 'claim' });
    if (!claimed?.ok || !claimed.job) return;
    const job = claimed.job;
    activeRequestId = String(job.requestId || '');
    activePhase = 'claimed';
    try {
      if (courseToken(location.pathname) !== String(job.courseId)) {
        const target = new URL(job.alternateLink);
        if (target.origin !== location.origin) throw new Error('destination Classroom incohérente');
        location.replace(target.toString());
        return;
      }
      await waitFor(() => document.body?.innerText?.includes(job.courseName || `Groupe ${job.group}`), 12000);
      const existingIds = new Set(Array.from(document.querySelectorAll('[data-stream-item-id]')).map(node => node.getAttribute('data-stream-item-id')));
      const editor = job.announcementId ? await openExistingAnnouncement(job) : await openAnnouncementEditor();
      if (!editor) throw new Error('éditeur natif Classroom introuvable');
      if (!job.announcementId && fold(editor.innerText)) throw new Error('Cet éditeur contient déjà un brouillon. Il a été conservé.');
      editor.focus();
      editor.click();
      if (job.announcementId) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      showBanner(`Collage riche natif en cours dans ${job.courseName || `Groupe ${job.group}`}…`);
      activePhase = 'pasting';
      await send({ type: 'paste' });

      const pasted = await waitFor(() => {
        const text = fold(editor.innerText || '');
        return text.includes(fold(job.title)) && (job.probes || []).slice(1, 3).every(probe => text.includes(fold(probe)));
      }, 7000);
      if (!pasted) throw new Error('le vrai collage riche n’a pas été reconnu');
      const titleUnderlined = hasStyledText(editor, job.title, 'underline');
      const devoirBold = hasStyledText(editor, 'Devoir', 'bold');
      if (!titleUnderlined || !devoirBold) console.warn('[Plan de cours] Classroom a masqué ses styles dans le DOM; le collage riche est conservé et sera publié.');

      const dialog = editor.closest('[data-is-edit-mode="true"]') || editor.closest('[role="dialog"]');
      const publishLabel = job.announcementId ? 'Enregistrer' : 'Publier';
      const publish = await waitFor(() => {
        return visibleButtons(publishLabel, dialog || document)
          .find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true') || null;
      }, 7000);
      if (!publish) throw new Error('bouton Publier natif inactif');
      activePhase = 'publishing';
      await sleep(500);
      publish.focus();
      publish.click();
      await sleep(1500);
      if (document.body.contains(editor)) {
        const refreshed = visibleButtons(publishLabel, dialog || document)
          .find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true') || null;
        if (refreshed) {
          refreshed.scrollIntoView({ block: 'center', inline: 'nearest' });
          const rect = refreshed.getBoundingClientRect();
          await send({ type: 'publish', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      }
      await sleep(2000);
      if (document.body.contains(editor)) {
        const retry = visibleButtons(publishLabel, dialog || document)
          .find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true') || null;
        if (retry) {
          const rect = retry.getBoundingClientRect();
          await send({ type: 'publish', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      }

      activePhase = 'verifying';
      const visible = await waitFor(() => {
        if (announcementEditor()) return null;
        const candidates = job.announcementId ? [announcementCard(job.announcementId)]
          : Array.from(document.querySelectorAll('[data-stream-item-id]')).filter(node => !existingIds.has(node.getAttribute('data-stream-item-id')));
        return candidates.find(node => node && node.getClientRects().length && fold(node.innerText).includes(fold(job.text))) || null;
      }, 30000, 250);
      if (!visible) throw new Error('publication non retrouvée dans le flux visible');
      showBanner(`Plan riche publié et vérifié dans ${job.courseName || `Groupe ${job.group}`}.`, 'ok');
      await send({ type: 'complete', outcome: 'published' });
      activePhase = 'finished';
    } catch (error) {
      console.error('[Plan de cours — pont natif Classroom]', error);
      showBanner(`${error?.message || error}. Aucun autre éditeur ne sera ouvert automatiquement.`, 'error');
      await chrome.runtime.sendMessage({ type: 'fail', error: String(error?.message || error) }).catch(() => {});
      activePhase = 'finished';
    }
  }

  run();
})();
