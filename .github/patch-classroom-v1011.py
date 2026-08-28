from pathlib import Path
import re

p = Path('classroom-rich-publish.user.js')
s = p.read_text(encoding='utf-8')

s = s.replace('@version      1.0.10', '@version      1.0.11', 1)

rpc_block = r'''
  // Publication riche via les mêmes RPC internes que l'interface Classroom.
  // Le diagnostic a confirmé qu'un collage manuel fonctionne grâce à des
  // événements navigateur isTrusted=true, impossibles à fabriquer en JS.
  // On ne touche donc plus au contenteditable pour la publication automatique.
  const CLASSROOM_CREATE_TEMPLATE = [[[3,null,[[[null,[0]],null,null,null,null,"",null,null,null,[3],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,[1,1,null,1]];

  // Appel F7Tqub intermédiaire observé dans le HAR avant la publication finale.
  const CLASSROOM_SAVE_TEMPLATE = [[[3,null,[[[0,[0]],null,null,null,null,"",null,null,null,[2],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]],[1,1,1,1,1,[1],[1],1,null,null,null,null,1],null,[1,1]],[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]]],[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]],[1,1,1,1,1,[1],[1],1,null,null,null,null,1],[1]],null,null,[[1,null,null,[1,null,1,1],null,1,4,1,null,null,null,null,null,1,4,[null,1,1,1,1]]]],[ [[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,null,[1,1,null,1]];

  const CLASSROOM_PUBLISH_TEMPLATE = [[[3,null,[[[0,[0]],null,null,null,[0],"",null,null,3,[2,[0]],null,null,null,null,null,1,null,null,null,null,null,null,null,null,null,[0],null,[[null,"__UUID__",null,["edu.rt","__TEXT__"],null,null,["edu.rt","__TEXT__",null,null,[null,"__HTML__"]]]]]]]],[[[null,null,null,null,null,1],[]],[[null,null,null,null,null,1]],[[null,null,null,null,null,1],[]],null,null,[[null,null,null,null,null,1]]],[[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[null,1],null,[1,1]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]],[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]],[1,1,1,1,1,1,[1],1,null,[1,1],1,1,null,1,[[1,1,[],[null,1]],1,1],null,null,null,1],[1]],null,null,[[1,1,1,1,1,null,null,[1,1,1,null,1,1,1],1,1,1,1,1,1,null,null,null,null,1,null,null,null,1,[1],1,[null,null,1,1,1,null,1]]]],null,[1,1,1],null,null,null,null,null,null,[1,1,null,1]];

  function deepCloneJson(value) {
    return JSON.parse(JSON.stringify(value));
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

  function classroomAccountIndex() {
    const m = location.pathname.match(/^\/u\/(\d+)\//);
    return m ? m[1] : '0';
  }

  function classroomSourcePath() {
    const account = classroomAccountIndex();
    const path = location.pathname.replace(/^\/u\/\d+/, '');
    return `/u/${account}${path.startsWith('/') ? path : '/' + path}`;
  }

  function buildClassroomRpcUrl(rpcId, ctx) {
    const account = classroomAccountIndex();
    const u = new URL(`/u/${account}/_/ClassroomUi/data/batchexecute`, location.origin);
    u.searchParams.set('rpcids', rpcId);
    u.searchParams.set('source-path', classroomSourcePath());
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
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'x-same-domain': '1'
      },
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

  function rpcReturnedItem(parsed) {
    return parsed?.[1]?.[0]?.[1]?.[2]?.[0] || null;
  }

  async function publishRichViaClassroomRpc(pending) {
    const ctx = getClassroomRpcContext();
    if (!ctx.sid || !ctx.bl || !ctx.at) throw new Error('jetons de session Classroom introuvables');

    const courseId = Number(pending.courseId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0) throw new Error('identifiant du groupe Classroom invalide');

    const text = String(pending.text || '').normalize('NFC').trim();
    const html = String(pending.html || '').normalize('NFC').trim();
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
      const createdItem = rpcReturnedItem(created);
      announcementId = Number(createdItem?.[0]?.[0]);
      userId = Number(createdItem?.[4]?.[0]);
      const createState = Number(createdItem?.[8]);
      if (!Number.isSafeInteger(announcementId) || !Number.isSafeInteger(userId) || createState !== 2) {
        throw new Error('Classroom n’a pas confirmé la création du brouillon');
      }

      pending.rpcUuid = uuid;
      pending.rpcDraftId = String(announcementId);
      pending.rpcUserId = String(userId);
      pending.rpcStage = 'created';
      GM_setValue(PENDING_KEY, pending);
    }

    // Le HAR montre un premier F7Tqub distinct qui sauvegarde l'annonce en état 2.
    if (pending.rpcStage !== 'saved' && pending.rpcStage !== 'published') {
      const save = deepCloneJson(CLASSROOM_SAVE_TEMPLATE);
      const item = save[0][0][2][0];
      item[0] = [announcementId, [courseId]];
      fillRichMessage(item, uuid, text, html);

      const saved = await callClassroomRpc('F7Tqub', save, ctx);
      const savedItem = rpcReturnedItem(saved);
      const returnedId = Number(savedItem?.[0]?.[0]);
      const saveState = Number(savedItem?.[8]);
      if (returnedId !== announcementId || saveState !== 2) {
        throw new Error('Classroom n’a pas confirmé la sauvegarde intermédiaire');
      }
      pending.rpcStage = 'saved';
      GM_setValue(PENDING_KEY, pending);
    }

    // Deuxième F7Tqub: celui du clic Publier dans le HAR. Il doit retourner l'état 3.
    const publish = deepCloneJson(CLASSROOM_PUBLISH_TEMPLATE);
    const item = publish[0][0][2][0];
    item[0] = [announcementId, [courseId]];
    item[4] = [userId];
    item[9] = [2, [userId]];
    fillRichMessage(item, uuid, text, html);

    const published = await callClassroomRpc('F7Tqub', publish, ctx);
    const publishedItem = rpcReturnedItem(published);
    const returnedId = Number(publishedItem?.[0]?.[0]);
    const state = Number(publishedItem?.[8]);
    if (returnedId !== announcementId || state !== 3) {
      throw new Error(`Classroom n’a pas confirmé l’état publié (état reçu: ${Number.isFinite(state) ? state : 'inconnu'})`);
    }

    pending.rpcStage = 'published';
    pending.status = 'submitted';
    GM_setValue(PENDING_KEY, pending);
    return { announcementId, state };
  }
'''

marker = '  function showClassroomFallback(message) {'
if 'const CLASSROOM_SAVE_TEMPLATE' not in s:
    if marker not in s:
        raise SystemExit('marker showClassroomFallback introuvable')
    s = s.replace(marker, rpc_block + '\n' + marker, 1)

new_automate = r'''  async function automateClassroom() {
    let pending = GM_getValue(PENDING_KEY, null);
    if (!pending || !pending.id) return;
    if (Date.now() - Number(pending.createdAt || 0) > MAX_AGE_MS) {
      GM_deleteValue(PENDING_KEY);
      return;
    }
    if (GM_getValue(LAST_DONE_KEY, '') === pending.id || pending.status === 'submitted') return;
    if (pending.status === 'rpc-running') return;

    try { GM_setClipboard(pending.html, 'html'); } catch (_) {}

    // Toujours atteindre d'abord le bon cours, mais ne jamais ouvrir l'éditeur d'annonce.
    if (pending.alternateLink) {
      try {
        const target = new URL(pending.alternateLink);
        const targetPath = target.pathname.replace(/^\/u\/\d+/, '');
        const currentPath = location.pathname.replace(/^\/u\/\d+/, '');
        if (target.hostname === 'classroom.google.com' && targetPath.includes('/c/') && currentPath !== targetPath) {
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
      pending.status = 'rpc-error';
      GM_setValue(PENDING_KEY, pending);
      return;
    }

    pending.status = 'rpc-running';
    GM_setValue(PENDING_KEY, pending);

    try {
      await publishRichViaClassroomRpc(pending);
      GM_setValue(LAST_DONE_KEY, pending.id);
      GM_deleteValue(PENDING_KEY);
      notify(`Plan publié dans ${pending.courseLabel || pending.courseName || 'Classroom'}.`);
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      console.error('[Plan de cours → Classroom] RPC publication:', err);
      pending = GM_getValue(PENDING_KEY, pending) || pending;
      pending.status = 'rpc-error';
      pending.rpcError = String(err?.message || err);
      GM_setValue(PENDING_KEY, pending);
      showClassroomFallback(`Publication réseau Classroom interrompue: ${pending.rpcError}. Aucun autre brouillon ne sera créé automatiquement lors de cette tentative.`);
    }
  }'''

pat = re.compile(r'  async function automateClassroom\(\) \{.*?\n  \}\n\n  if \(isPlanPage\)', re.S)
m = pat.search(s)
if not m:
    raise SystemExit('automateClassroom introuvable')
s = s[:m.start()] + new_automate + '\n\n  if (isPlanPage)' + s[m.end():]

p.write_text(s, encoding='utf-8')
print('patch v1.0.11 applique')
