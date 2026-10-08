// ==UserScript==
// @name         Cardinal - Classroom depuis ChatGPT
// @namespace    https://github.com/techno-cardi/Plan-de-cours
// @version      0.1.0
// @description  Copie une réponse ChatGPT en HTML espacé ou l'envoie à Classroom via l'Agenda et le pont existant.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin
// @match        https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/cardinal-chatgpt-classroom.user.js
// @downloadURL  https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/cardinal-chatgpt-classroom.user.js
// ==/UserScript==

(() => {
  'use strict';
  const BASE = 'https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin/';
  const KEY = 'cardinal.classroom.chatgpt.pending.v1';
  const GROUPS = 'cardinal.classroom.linked-groups.v1';
  const RESULTS = 'cardinal.classroom.result.v1';
  const REQUEST = 'PDC_NATIVE_GROUP_MAP_STATUS_REQUEST';
  const STATUS = 'PDC_NATIVE_GROUP_MAP_STATUS';
  const MAX_AGE = 5 * 60 * 1000;
  const esc = x => String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function makeHtml(title, message) {
    const chunks = String(message).replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ')
      .split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
    if(!chunks.length)throw Error('Le message est vide.');
    if(message.length > 18000)throw Error('Message trop long (18 000 caractères maximum).');
    const heading=String(title||'Message aux élèves').trim().slice(0,140);
    const html = '<p><b><u>'+esc(heading)+'</u></b><br><br></p>' +
      chunks.map((p,i)=>'<p>'+p.split('\n').map(esc).join('<br>')+(i<chunks.length-1?'<br><br>':'')+'</p>').join('');
    return {html,text:heading+'\n\n'+chunks.join('\n\n'),title:heading,probes:chunks.filter(x=>x.length>=12).slice(0,4)};
  }
  function detectMessage() {
    const selected=String(window.getSelection()?.toString()||'').trim();
    if(selected.length>=20)return {text:selected,kind:'texte sélectionné'};
    const assistant=[...document.querySelectorAll('[data-message-author-role="assistant"]')];
    if(!assistant.length)throw Error('Aucune réponse ChatGPT trouvée.');
    const msg=assistant[assistant.length-1];
    const writing=[...msg.querySelectorAll('[data-testid*="writing"],[data-testid*="artifact"]')].filter(x=>x.textContent.trim().length>20);
    const markdown=[...msg.querySelectorAll('.markdown,.prose')].filter(x=>x.textContent.trim().length>20);
    const block=writing[writing.length-1]||markdown[markdown.length-1]||msg;
    const clone=block.cloneNode(true);
    clone.querySelectorAll('button,svg,nav,aside,[role="toolbar"],[aria-hidden="true"],script,style').forEach(el=>el.remove());
    const nodes=[...clone.querySelectorAll('h1,h2,h3,p,li,blockquote')].filter(x=>!x.parentElement?.closest('h1,h2,h3,p,li,blockquote'));
    const text=(nodes.length?nodes.map(x=>x.textContent.trim()).filter(Boolean).join('\n\n'):clone.textContent.trim()).slice(0,18001);
    if(text.length>18000)throw Error('Cette réponse est trop longue. Sélectionne seulement le passage utile.');
    if(!text)throw Error('Impossible de lire le message. Sélectionne le texte dans ChatGPT.');
    return {text,kind:writing.length?'dernière boîte':'dernière réponse'};
  }
  function element(tag,txt,cls){const e=document.createElement(tag);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;}
  function validMap(value) {
    const groups=value&&typeof value==='object'?value:{};
    return Object.entries(groups).filter(([g,v])=>/^\d{1,3}$/.test(g)&&/^\d+$/.test(String(v?.courseId||''))
      &&/^https:\/\/classroom\.google\.com\/c\//.test(String(v?.alternateLink||'')));
  }
  function chatGptUI(){
    if(document.getElementById('cardinalClassroomTrigger'))return;
    const root=element('div');root.id='cardinalClassroomTrigger';root.style='position:fixed;bottom:78px;right:22px;z-index:2147482000;';
    const shadow=root.attachShadow({mode:'open'});
    const css=element('style');css.textContent=`:host{font:13px system-ui;color:#1f2937}*{box-sizing:border-box}
      button{border:1px solid #bbcad6;border-radius:9px;padding:9px 12px;cursor:pointer;font:600 13px system-ui;background:white;color:#173a51}
      button.main{background:#0a5d80;border-color:#0a5d80;color:white;box-shadow:0 6px 15px #153c5230}button:hover{filter:brightness(.97)}button:disabled{opacity:.5}
      .box{margin:0 0 10px;width:min(410px,92vw);max-height:75vh;overflow:auto;background:#fff;border:1px solid #c9d5df;border-radius:15px;padding:15px;box-shadow:0 12px 35px #0003}
      .box[hidden]{display:none}.head{display:flex;justify-content:space-between;align-items:center;gap:8px}
      h2{font:700 17px system-ui;margin:0 0 9px}p{line-height:1.45;color:#45576b;margin:7px 0}
      label{font-weight:600;display:block;margin:9px 0 5px}textarea,input,select{border:1px solid #b5c3d2;border-radius:8px;padding:9px;width:100%;font:13px system-ui;line-height:1.45}
      textarea{min-height:155px;resize:vertical}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
      .actions button{flex:1;min-width:130px}.notice{font-size:11px;color:#50677a}
      @media(prefers-color-scheme:dark){.box{background:#252932;color:#f8fafc}.box p{color:#d1d5db}textarea,input,select{color:#fff;background:#303843}}`;
    const trigger=element('button','Cardinal → Classroom','main');const panel=element('section','','box');panel.hidden=true;
    const head=element('div','','head');head.append(element('h2','Préparer une publication'));
    const close=element('button','Fermer');close.addEventListener('click',()=>{panel.hidden=true;});head.append(close);
    const notice=element('p','Vérifie toujours le texte et le groupe avant de publier.');
    const titleLabel=element('label','Titre de la publication');const title=element('input');title.value='Message aux élèves';
    const textLabel=element('label','Texte détecté');const editor=element('textarea');
    const groupLabel=element('label','Groupe Classroom');const group=element('select');
    const status=element('p','','notice');status.setAttribute('role','status');
    const actions=element('div','','actions');const copy=element('button','Copier HTML');
    const publish=element('button','Publier dans Classroom','main');actions.append(copy,publish);
    panel.append(head,notice,titleLabel,title,textLabel,editor,groupLabel,group,actions,status);
    shadow.append(css,panel,trigger);document.body.append(root);
    function fillGroups(){
      group.replaceChildren();const empty=element('option','Choisir un groupe');empty.value='';group.append(empty);
      const known=validMap(GM_getValue(GROUPS,{}));
      const list=known.length?known.map(([n])=>n):['31','32','51'];
      for(const num of list){const o=element('option',`Groupe ${num}${known.length?' (lié)':' (à vérifier)'}`);o.value=num;group.append(o);}
    }
    trigger.addEventListener('click',()=>{
      panel.hidden=false;fillGroups();
      try{const value=detectMessage();editor.value=value.text;status.textContent=`Source : ${value.kind}. Corrige le contenu si nécessaire.`;}
      catch(e){status.textContent=e.message||String(e);editor.value='';}
    });
    copy.addEventListener('click',()=>{
      try{const v=makeHtml(title.value,editor.value);GM_setClipboard(v.html,'html');status.textContent='HTML copié avec paragraphes espacés. Utilise Ctrl + V dans Classroom.';}
      catch(e){status.textContent=e.message||String(e);}
    });
    publish.addEventListener('click',()=>{
      if(!group.value){status.textContent='Choisis un groupe avant de publier.';return;}
      let prepared;try{prepared=makeHtml(title.value,editor.value);}catch(e){status.textContent=e.message;return;}
      if(!window.confirm(`Publier maintenant ce message dans Classroom, groupe ${group.value} ?`))return;
      const requestId='cardinal-classroom-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      GM_setValue(KEY,{requestId,createdAt:Date.now(),group:group.value,...prepared});
      window.open(BASE+'?cardinal_classroom='+encodeURIComponent(requestId),'_blank','noopener');
      status.textContent=`Ouverture de l’Agenda pour publier dans le groupe ${group.value}. Si rien ne s’ouvre, autorise les fenêtres de ChatGPT.`;
    });
    let last=GM_getValue(RESULTS,{}).requestId;
    setInterval(()=>{const result=GM_getValue(RESULTS,{});if(result?.requestId&&result.requestId!==last){last=result.requestId;status.textContent=result.outcome==='published'?`Publication confirmée dans le groupe ${result.group}.`:`Publication : ${result.error||result.outcome}.`; }},3000);
  }
  function agendaRelay(){
    const requestId=new URLSearchParams(location.search).get('cardinal_classroom');
    // Recueillir uniquement les groupes réellement reliés au pont Classroom.
    const groupRequestId='group-status-'+Date.now();
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin||event.data?.type!==STATUS)return;
      if(event.data.requestId!==groupRequestId||!event.data.ok)return;
      const valid=Object.fromEntries(validMap(event.data.groups));GM_setValue(GROUPS,valid);
    });
    setTimeout(()=>window.postMessage({type:REQUEST,requestId:groupRequestId},location.origin),1200);
    if(!requestId)return;
    const job=GM_getValue(KEY,null);
    if(!job||job.requestId!==requestId||Date.now()-job.createdAt>MAX_AGE){return;}
    const hud=element('div');hud.style='position:fixed;right:16px;top:16px;z-index:2147483000;max-width:380px;padding:14px;border-radius:12px;background:#fff;border:2px solid #0a5d80;box-shadow:0 10px 35px #0002;color:#132a4a;font:13px/1.5 system-ui';
    hud.textContent=`Cardinal : préparation de la publication du groupe ${job.group}…`;
    document.body.append(hud);
    let sent=false;let attempts=0;
    document.addEventListener('pdc:publish-result',event=>{
      if(event.detail?.requestId!==requestId)return;
      const res=event.detail;GM_setValue(RESULTS,{requestId,group:job.group,outcome:res.outcome,error:res.error||''});
      hud.textContent=res.outcome==='published'?'Publication Classroom confirmée.':`Publication non confirmée : ${res.error||res.outcome}`;
      if(res.outcome==='published'||res.outcome==='duplicate')setTimeout(()=>hud.remove(),12000);
    });
    const timer=setInterval(()=>{
      attempts++;
      if(sent||attempts>35){clearInterval(timer);if(!sent)hud.textContent='Pont Classroom non détecté. Aucun message publié.';return;}
      if(!document.documentElement.dataset.pdcNativePublisherVersion||!document.documentElement.dataset.pdcClassroomBridgeVersion)return;
      sent=true;clearInterval(timer);GM_deleteValue(KEY);
      hud.textContent=`Publication du groupe ${job.group} en cours via le pont Classroom…`;
      document.dispatchEvent(new CustomEvent('pdc:publish-course',{detail:{
        requestId:job.requestId,group:job.group,courseName:`Français SAÉ — Groupe ${job.group}`,
        courseSection:job.group==='51'?'5e secondaire':'3e secondaire',
        richHtml:job.html,text:job.text,title:job.title,probes:job.probes
      }}));
    },400);
  }
  if(location.hostname==='chatgpt.com'||location.hostname==='chat.openai.com')chatGptUI();
  else if(location.hostname==='techno-cardi.github.io'&&location.pathname.startsWith('/Portail-Cardinal-Roy/agendakevin'))agendaRelay();
  if(typeof module!=='undefined'&&module.exports)module.exports={makeHtml,validMap};
})();