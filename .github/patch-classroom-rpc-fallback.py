from pathlib import Path
import re

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')
s = s.replace('// @version      1.0.5', '// @version      1.0.6', 1)

rpc_helpers = r'''
  const CLASSROOM_CREATE_TEMPLATE = [[[3,null,[[[null,[0]],null,null,null,null,"",null,null,null,[3],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,[1,1,null,1]];

  const CLASSROOM_PUBLISH_TEMPLATE = [[[3,null,[[[0,[0]],null,null,null,[0],"",null,null,3,[2,[0]],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[null,null,null,null,null,1],[]],[[null,null,null,null,null,1]],[[null,null,null,null,null,1],[]],null,null,[[null,null,null,null,null,1]]],[[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,null,[1,1,null,1]];

  function deepCloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function classroomHtmlForRpc(html) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    box.querySelectorAll('p').forEach(p => {
      const div = document.createElement('div');
      while (p.firstChild) div.appendChild(p.firstChild);
      p.replaceWith(div);
    });
    return box.innerHTML.trim();
  }

  function getClassroomRpcContext() {
    const wiz = (typeof unsafeWindow !== 'undefined' && unsafeWindow.WIZ_global_data) || window.WIZ_global_data || {};
    let sid = wiz.FdrFJe || '';
    let bl = wiz.cfb2h || '';
    let at = wiz.SNlM0e || '';

    const resources = performance.getEntriesByType('resource').map(x => x.name).reverse();
    for (const name of resources) {
      if (!name.includes('/ClassroomUi/data/batchexecute')) continue;
      try {
        const u = new URL(name);
        sid = sid || u.searchParams.get('f.sid') || '';
        bl = bl || u.searchParams.get('bl') || '';
      } catch (_) {}
      if (sid && bl) break;
    }

    if (!at) {
      const html = document.documentElement?.innerHTML || '';
      const m = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
      if (m) at = m[1].replace(/\\u003d/g, '=');
    }
    return { sid, bl, at };
  }

  function buildClassroomRpcUrl(rpcId, ctx) {
    const sourcePath = location.pathname;
    const u = new URL('/u/0/_/ClassroomUi/data/batchexecute', location.origin);
    u.searchParams.set('rpcids', rpcId);
    u.searchParams.set('source-path', sourcePath);
    u.searchParams.set('f.sid', ctx.sid);
    u.searchParams.set('bl', ctx.bl);
    u.searchParams.set('hl', document.documentElement.lang || 'fr');
    u.searchParams.set('soc-app', '1');
    u.searchParams.set('soc-platform', '1');
    u.searchParams.set('soc-device', '1');
    u.searchParams.set('_reqid', String(Math.floor(Math.random() * 8000000) + 1000000));
    u.searchParams.set('rt', 'c');
    return u.toString();
  }

  function buildBatchRequest(rpcId, inner) {
    return JSON.stringify([[[rpcId, JSON.stringify(inner), null, 'generic']]]);
  }

  function parseClassroomBatchResponse(text, rpcId) {
    const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.startsWith('[[')) continue;
      try {
        const rows = JSON.parse(line);
        for (const row of rows) {
          if (row?.[0] === 'wrb.fr' && row?.[1] === rpcId && typeof row?.[2] === 'string') {
            return JSON.parse(row[2]);
          }
        }
      } catch (_) {}
    }
    return null;
  }

  async function callClassroomRpc(rpcId, inner, ctx) {
    const body = new URLSearchParams();
    body.set('f.req', buildBatchRequest(rpcId, inner));
    body.set('at', ctx.at);
    const response = await fetch(buildClassroomRpcUrl(rpcId, ctx), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString()
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`RPC ${rpcId}: HTTP ${response.status}`);
    const parsed = parseClassroomBatchResponse(text, rpcId);
    if (!parsed) throw new Error(`RPC ${rpcId}: réponse Classroom illisible`);
    return parsed;
  }

  function makeRichDocumentId() {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid.toUpperCase();
  }

  function fillRichMessage(item, uuid, text, html) {
    item[27][0][1] = uuid;
    item[27][0][3] = ['edu.rt', text];
    item[27][0][6] = ['edu.rt', text, null, null, [null, html]];
  }

  function findCancelAnnouncementButton(surface) {
    if (!surface?.root) return null;
    return Array.from(surface.root.querySelectorAll('button,[role="button"]')).find(el => {
      if (!visible(el)) return false;
      const txt = foldText(`${el.textContent || ''} ${el.getAttribute?.('aria-label') || ''}`);
      return txt === 'annuler' || txt === 'cancel';
    }) || null;
  }

  async function publishRichViaClassroomRpc(pending, surface) {
    const ctx = getClassroomRpcContext();
    if (!ctx.sid || !ctx.bl || !ctx.at) {
      throw new Error('jetons de session Classroom introuvables');
    }

    const courseId = Number(pending.courseId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
      throw new Error('identifiant du groupe Classroom invalide');
    }

    const text = String(pending.text || '').trim();
    const html = classroomHtmlForRpc(pending.html);
    if (!text || !html) throw new Error('plan vide');

    const uuid = pending.rpcUuid || makeRichDocumentId();
    let announcementId = pending.rpcDraftId ? Number(pending.rpcDraftId) : null;
    let userId = pending.rpcUserId ? Number(pending.rpcUserId) : null;

    if (!announcementId || !userId) {
      const create = deepCloneJson(CLASSROOM_CREATE_TEMPLATE);
      const item = create[0][0][2][0];
      item[0] = [null, [courseId]];
      fillRichMessage(item, uuid, text, html);

      const created = await callClassroomRpc('n5NjMc', create, ctx);
      const createdItem = created?.[1]?.[0]?.[1]?.[2]?.[0];
      announcementId = Number(createdItem?.[0]?.[0]);
      userId = Number(createdItem?.[4]?.[0]);
      if (!Number.isSafeInteger(announcementId) || !Number.isSafeInteger(userId)) {
        throw new Error('Classroom n’a pas retourné le brouillon attendu');
      }

      pending.rpcUuid = uuid;
      pending.rpcDraftId = String(announcementId);
      pending.rpcUserId = String(userId);
      pending.status = 'rpc-draft';
      GM_setValue(PENDING_KEY, pending);
    }

    const publish = deepCloneJson(CLASSROOM_PUBLISH_TEMPLATE);
    const item = publish[0][0][2][0];
    item[0] = [announcementId, [courseId]];
    item[4] = [userId];
    item[9] = [2, [userId]];
    fillRichMessage(item, uuid, text, html);

    const published = await callClassroomRpc('F7Tqub', publish, ctx);
    const publishedItem = published?.[1]?.[0]?.[1]?.[2]?.[0];
    const returnedId = Number(publishedItem?.[0]?.[0]);
    const state = Number(publishedItem?.[8]);
    if (returnedId !== announcementId || state !== 3) {
      throw new Error('Classroom n’a pas confirmé la publication');
    }

    const cancel = findCancelAnnouncementButton(surface);
    if (cancel) activateElement(cancel);
    return true;
  }
'''

marker = '  function findPostButton(editor, allowDisabled = false) {'
assert marker in s, 'findPostButton introuvable'
s = s.replace(marker, rpc_helpers + '\n' + marker, 1)

old = '''    const editor = surface.editor;\n    const inserted = await insertRichHtml(editor, pending.html, pending.text);\n    if (!inserted) {\n      console.warn('[Plan de cours → Classroom] Mauvais éditeur évité. Panneau annonce détecté:', surface.root, 'éditeur:', editor);\n      showClassroomFallback('La bonne fenêtre « Annonce » est ouverte, mais Classroom a refusé l’insertion riche automatique.');\n      pending.status = 'manual'; GM_setValue(PENDING_KEY, pending); return;\n    }\n'''
new = '''    const editor = surface.editor;\n    const inserted = await insertRichHtml(editor, pending.html, pending.text);\n    if (!inserted) {\n      console.warn('[Plan de cours → Classroom] Insertion DOM refusée; passage au RPC Web Classroom.');\n      try {\n        const rpcPublished = await publishRichViaClassroomRpc(pending, surface);\n        if (rpcPublished) {\n          pending.status = 'submitted';\n          GM_setValue(PENDING_KEY, pending);\n          GM_setValue(LAST_DONE_KEY, pending.id);\n          notify(`Plan publié dans ${pending.courseLabel || pending.courseName || 'Classroom'} via Classroom Web.`);\n          setTimeout(() => { GM_deleteValue(PENDING_KEY); location.reload(); }, 1200);\n          return;\n        }\n      } catch (err) {\n        console.error('[Plan de cours → Classroom] Fallback RPC échoué:', err);\n        showClassroomFallback('La fenêtre « Annonce » est correcte, mais le fallback réseau de Classroom a échoué : ' + (err?.message || err));\n        pending.status = pending.rpcDraftId ? 'rpc-draft' : 'manual';\n        GM_setValue(PENDING_KEY, pending);\n        return;\n      }\n    }\n'''
assert old in s, 'bloc échec insertion introuvable'
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
