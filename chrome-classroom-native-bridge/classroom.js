(() => {
  'use strict';

  const VERSION = '1.0.3';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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

  function duplicateVisible(job) {
    const body = fold(document.body?.innerText || '');
    const titleKey = fold(job.title.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ''));
    const contentProbes = (job.probes || []).slice(1, 4).map(fold).filter(value => value.length >= 12);
    return titleKey.length >= 8 && body.includes(titleKey) && contentProbes.length >= 2 && contentProbes.every(probe => body.includes(probe));
  }

  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || 'pont Chrome indisponible');
    return result;
  }

  async function run() {
    document.documentElement.dataset.pdcNativeClassroomBridgeVersion = VERSION;
    const claimed = await chrome.runtime.sendMessage({ type: 'claim' });
    if (!claimed?.ok || !claimed.job) return;
    const job = claimed.job;
    try {
      if (courseToken(location.pathname) !== String(job.courseId)) {
        const target = new URL(job.alternateLink);
        if (target.origin !== location.origin) throw new Error('destination Classroom incohérente');
        location.replace(target.toString());
        return;
      }
      await waitFor(() => document.body?.innerText?.includes(job.courseName || `Groupe ${job.group}`), 12000);
      if (duplicateVisible(job)) {
        showBanner('Ce plan est déjà visible dans ce groupe; aucune nouvelle annonce n’a été créée.', 'ok');
        await send({ type: 'complete', outcome: 'duplicate' });
        return;
      }

      let newButton = await waitFor(() => visibleButton('Nouvelle annonce'), 12000);
      if (!newButton) {
        await send({ type: 'activate' });
        await sleep(900);
        newButton = await waitFor(() => visibleButton('Nouvelle annonce'), 12000);
      }
      if (!newButton) throw new Error('bouton Nouvelle annonce introuvable');
      newButton.click();
      const editor = await waitFor(() => document.querySelector('[contenteditable="true"][aria-label*="Annoncez"]'), 10000);
      if (!editor) throw new Error('éditeur natif Classroom introuvable');
      editor.focus();
      editor.click();
      showBanner(`Collage riche natif en cours dans ${job.courseName || `Groupe ${job.group}`}…`);
      await send({ type: 'paste' });

      const pasted = await waitFor(() => {
        const text = fold(editor.innerText || '');
        return text.includes(fold(job.title)) && (job.probes || []).slice(1, 3).every(probe => text.includes(fold(probe)));
      }, 7000);
      if (!pasted) throw new Error('le vrai collage riche n’a pas été reconnu');
      const titleUnderlined = Array.from(editor.querySelectorAll('u')).some(node => fold(node.textContent).includes(fold(job.title)) && (node.closest('b,strong') || node.parentElement?.closest('b,strong')));
      const devoirBold = Array.from(editor.querySelectorAll('b,strong')).some(node => /devoir\(s\)/i.test(node.textContent || ''));
      if (!titleUnderlined || !devoirBold) throw new Error('la mise en forme riche n’a pas été conservée');

      const dialog = editor.closest('[data-is-edit-mode="true"]') || editor.closest('[role="dialog"]');
      const publish = await waitFor(() => {
        return visibleButtons('Publier', dialog || document)
          .find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true') || null;
      }, 7000);
      if (!publish) throw new Error('bouton Publier natif inactif');
      await sleep(500);
      const rect = publish.getBoundingClientRect();
      await send({ type: 'publish', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

      const visible = await waitFor(() => !document.body.contains(editor) && fold(document.body.innerText).includes(fold(job.title)), 30000, 250);
      if (!visible) throw new Error('publication non retrouvée dans le flux visible');
      showBanner(`Plan riche publié et vérifié dans ${job.courseName || `Groupe ${job.group}`}.`, 'ok');
      await send({ type: 'complete', outcome: 'published' });
    } catch (error) {
      console.error('[Plan de cours — pont natif Classroom]', error);
      showBanner(`${error?.message || error}. Aucun autre éditeur ne sera ouvert automatiquement.`, 'error');
      await chrome.runtime.sendMessage({ type: 'fail', error: String(error?.message || error) }).catch(() => {});
    }
  }

  run();
})();
