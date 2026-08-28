const NUMERO_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

const EMOJIS_MOIS = {
  0:  ['⛄','❄️','🛷','🎿','🧤','🏔️','🌨️','🍵','☕','🧊','🏒','🌬️','🦌','🐧','🏡','🕯️'],  // janvier
  1:  ['❄️','🏂','⛷️','🧊','🧤','🍁','💝','🌹','🍫','🫶','☁️','🌂','🧣','🐻','🏔️','⛸️'],  // février
  2:  ['🌱','☘️','🌬️','🌂','🐣','🌷','🌼','🐦','🌈','🐰','🍀','🌿','🪴','🌻','🐛','🦗'],  // mars
  3:  ['🌸','🌦️','🐣','🌷','🌻','🦋','🐝','🌼','🪻','🐞','☔','🌿','🐸','🌱','🌈','🎏'],  // avril
  4:  ['🌸','☀️','🌿','🦋','🌻','🐝','🌺','🌼','🍃','🐛','🎑','🌷','🦜','🐢','🍓','🌾'],  // mai
  5:  ['☀️','🏖️','🌊','🌺','⛱️','🍦','🐠','🩴','🧴','🌴','🍹','🐚','🦞','🌻','🎣','🏄'],  // juin
  6:  ['☀️','🏕️','🌊','🍉','🌴','🎆','🎇','🔥','🏄','🐬','🎡','🌽','🍧','🎠','🦀','🌅'],  // juillet
  7:  ['🌻','☀️','🏖️','🍦','🌊','🎒','🍑','🍹','⛺','🌅','🎆','🏊','🐠','🍧','🌽','🎠'],  // août
  8:  ['🍂','📚','✏️','🏫','🍎','🎒','🍇','📐','📏','🖊️','🍁','🌾','🍄','🦔','🐝','🌰'],  // septembre
  9:  ['🍁','🎃','🌧️','🦃','🍂','🏈','🕷️','🕸️','🌽','🍄','🦇','👻','🌰','🍎','🧸','🌙'],  // octobre
  10: ['❄️','🍁','🦃','🌨️','🧣','☁️','🧥','🍂','🌰','🕯️','🍵','☕','🎖️','🦔','🌧️','🍎'],  // novembre
  11: ['🎄','⛄','🎁','🌟','❄️','🎅','🔔','🦌','🍪','🎶','🕯️','🍷','🧦','🎉','✨','🏡'],  // décembre
};

const MOIS_NOMS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS_NOMS = ['dim','lun','mar','mer','jeu','ven','sam'];

function updatePlanModeButtons() {
  const courseBtn = document.getElementById('plan-mode-course');
  const supplyBtn = document.getElementById('plan-mode-supply');
  if (courseBtn) courseBtn.classList.toggle('active', currentPlanMode === 'course');
  if (supplyBtn) supplyBtn.classList.toggle('active', currentPlanMode === 'supply');
  const title = document.querySelector('.left-panel h2');
  if (title) title.textContent = currentPlanMode === 'supply' ? 'Planification suppléance' : 'Informations du cours';
  const courseWrap = document.getElementById('left-plan-course');
  const supplyWrap = document.getElementById('left-plan-supply');
  if (courseWrap) courseWrap.style.display = currentPlanMode === 'course' ? '' : 'none';
  if (supplyWrap) supplyWrap.style.display = currentPlanMode === 'supply' ? '' : 'none';
}
function setPlanMode(mode) {
  currentPlanMode = mode === 'supply' ? 'supply' : 'course';
  updatePlanModeButtons();
  switchRightTab('preview');
  sauvegarderPlanLocal();
}
function switchRightTab(tab) {
  const isPreview = tab === 'preview';
  const isBank = tab === 'bank';
  document.getElementById('right-tab-preview').classList.toggle('active', isPreview);
  document.getElementById('right-tab-bank').classList.toggle('active', isBank);
  document.getElementById('right-tab-btn-preview').classList.toggle('active', isPreview);
  document.getElementById('right-tab-btn-bank').classList.toggle('active', isBank);
}

const GOOGLE_CLIENT_ID = '1063815453063-ncrcg7ujl935e66r53rf4vhmebvrqch6.apps.googleusercontent.com';
const GOOGLE_SCOPES = ['openid','email','profile','https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/classroom.courses.readonly','https://www.googleapis.com/auth/classroom.announcements'].join(' ');
const APP_SHEET_NAME = "Plan de cours Cardinal-Roy - Banque d'activités";
const ACTIVITES_SHEET = 'Activites';
const CONFIG_SHEET = 'Config';
const COURSES_SHEET = 'Cours';
const SUPPLY_PLANS_SHEET = 'PlanificationsSuppleance';
const APP_MARKER = 'CARDINAL_ROY_PLAN_COURS_V1';
const GOOGLE_SESSION_KEY = 'cardinal_google_session_v1';
const LOCAL_PLAN_KEY = 'cardinal_plan_form_state_v2';
const KEEP_FORM_PREF_KEY = 'cardinal_keep_form_filled_v1';
const PRIVILEGED_EMOJI_EMAIL = 'tremblay.kevin@cscapitale.qc.ca';
const SUPPLY_PROFILE_PREFIX = 'cardinal_supply_profile_v1_';
let currentPlanMode = 'course';
let googleTokenExpiry = parseInt(localStorage.getItem('g_access_token_expiry') || '0', 10) || 0;
let googleTokenClient = null;
let googleIdClientInitialized = false;
let googleIdPromptTriggered = false;
let googleAccessToken = localStorage.getItem('g_access_token') || '';
let googleUser = null;
let appSpreadsheetId = localStorage.getItem('plan_cours_sheet_id') || '';
let supplyPlansSheetId = null;
let coursesSheetId = null;
let activitesSheetId = null;
let bankActivities = [];
let savedCourses = [];
let suppressCourseAutoSave = false;
let currentLoadedCourseId = '';
let currentLoadedSupplyId = '';
let hasUnsavedPlan = false;
let _sheetMetaCache = null;
let _sheetMetaCacheTime = 0;
let classroomCourses = [];
let savedSupplyPlans = [];
let latestGeneratedText = '';
let latestGeneratedHtml = '';
let activeActivityEditor = null;
let selectedBankText = null;
const SUPPLY_RULES_DEFAULT = [
  "Pas de sortie aux toilettes ou pour aller boire de l’eau",
  "Pas d’appareils électroniques",
  "Pas de travail en équipe",
  "Travail en silence",
  "Suivre les consignes affichées au tableau",
  "Prendre les absences en début de période"
];

const SUPPLY_LOCAL_KEY = 'cardinal_supply_plan_state_v1';
const SCHOOL_PREF_KEY = 'cardinal_selected_school_v1';
const SCHOOL_OPTIONS = {
  cardinal: { name: "École secondaire Cardinal-Roy", logo: "assets/logo-cardinal-roy.png" },
  camaradiere: { name: "École secondaire La Camaradière", logo: "assets/logo-la-camaradiere.png" },
  neufchatel: { name: "École secondaire de Neufchâtel", logo: "assets/logo-neufchatel.svg" },
  perrault: { name: "École secondaire Joseph-François-Perrault", logo: "assets/logo-joseph-francois-perrault.png" },
  rogercomtois: { name: "École secondaire Roger-Comtois", logo: "assets/logo-roger-comtois.png" }
};

function getCurrentSchoolKey() {
  const key = localStorage.getItem(SCHOOL_PREF_KEY) || 'cardinal';
  return SCHOOL_OPTIONS[key] ? key : 'cardinal';
}
function getCurrentSchoolLogoDataUri() {
  const logo = (SCHOOL_OPTIONS[getCurrentSchoolKey()] || SCHOOL_OPTIONS.cardinal).logo;
  if (!logo || logo.startsWith('data:')) return logo || '';
  try { return new URL(logo, document.baseURI).href; }
  catch (e) { return logo; }
}
function getCurrentSchoolName() {
  return (SCHOOL_OPTIONS[getCurrentSchoolKey()] || SCHOOL_OPTIONS.cardinal).name;
}
function applySchoolLogoSizing(key) {
  const logo = document.getElementById('school-logo');
  if (!logo) return;
  logo.classList.toggle('school-logo-large', key === 'perrault');
}
function applySchoolSelection(key) {
  const safeKey = SCHOOL_OPTIONS[key] ? key : 'cardinal';
  localStorage.setItem(SCHOOL_PREF_KEY, safeKey);
  const logo = document.getElementById('school-logo');
  const select = document.getElementById('school-select');
  if (logo) {
    logo.style.display = 'block';
    logo.src = SCHOOL_OPTIONS[safeKey].logo;
    logo.alt = SCHOOL_OPTIONS[safeKey].name;
    logo.title = SCHOOL_OPTIONS[safeKey].name;
  }
  applySchoolLogoSizing(safeKey);
  if (select) select.value = safeKey;
}
function toggleSchoolSelector() {
  const wrap = document.getElementById('school-select-wrap');
  const btn = document.getElementById('school-toggle-btn');
  if (!wrap || !btn) return;
  const willOpen = wrap.hasAttribute('hidden');
  if (willOpen) {
    wrap.removeAttribute('hidden');
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    closeSchoolSelector();
  }
}
function closeSchoolSelector() {
  const wrap = document.getElementById('school-select-wrap');
  const btn = document.getElementById('school-toggle-btn');
  if (wrap) {
    wrap.setAttribute('hidden', '');
    wrap.classList.remove('open');
  }
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function changeSchool(key) {
  applySchoolSelection(key);
  closeSchoolSelector();
  sauvegarderPlanLocal();
}
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('school-select-wrap');
  const btn = document.getElementById('school-toggle-btn');
  if (!wrap || !btn) return;
  if (wrap.contains(e.target) || btn.contains(e.target)) return;
  closeSchoolSelector();
});

document.addEventListener('DOMContentLoaded', () => {
  applySchoolSelection(getCurrentSchoolKey());
  closeSchoolSelector();
});


// ── Date picker state ──
let dpDate = new Date();   // currently selected date
let dpView = 'days';       // 'days' | 'months' | 'years'
let dpViewYear = dpDate.getFullYear();
let dpOpen = false;

function formatDateStr(d) {
  return `${d.getDate()} ${MOIS_NOMS[d.getMonth()]} ${d.getFullYear()}`;
}

function setCourseDateToToday() {
  dpDate = new Date();
  document.getElementById('date-cours').value = formatDateStr(dpDate);
}

function initDate() {
  setCourseDateToToday();
}

function shiftDay(delta) {
  dpDate.setDate(dpDate.getDate() + delta);
  document.getElementById('date-cours').value = formatDateStr(dpDate);
  sauvegarderPlanLocal();
  if (dpOpen) renderCalendar();
}

function togglePicker() {
  dpOpen = !dpOpen;
  const popup = document.getElementById('date-picker-popup');
  if (dpOpen) {
    dpView = 'days';
    dpViewYear = dpDate.getFullYear();
    renderCalendar();
    popup.style.display = 'block';
  } else {
    popup.style.display = 'none';
  }
}

function closePicker() {
  dpOpen = false;
  document.getElementById('date-picker-popup').style.display = 'none';
}

function renderCalendar() {
  const popup = document.getElementById('date-picker-popup');
  const today = new Date();

  // Stop ALL clicks inside the popup from bubbling to document
  popup.onclick = function(e) { e.stopPropagation(); };

  if (dpView === 'days') {
    const y = dpDate.getFullYear();
    const m = dpDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();

    let html = `<div class="dp-header">
      <button class="dp-nav" onclick="dpNavMonth(-1)">&#8249;</button>
      <span class="dp-title" onclick="dpSetView('months')">${MOIS_NOMS[m]} ${y}</span>
      <button class="dp-nav" onclick="dpNavMonth(1)">&#8250;</button>
    </div><div class="dp-grid">`;

    JOURS_NOMS.forEach(j => { html += `<div class="dp-day-label">${j}</div>`; });

    // Prev month days
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<button class="dp-day dp-other-month">${daysInPrev - i}</button>`;
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
      const isSel  = d === dpDate.getDate() && m === dpDate.getMonth() && y === dpDate.getFullYear();
      const cls = (isToday ? ' dp-today' : '') + (isSel ? ' dp-selected' : '');
      html += `<button class="dp-day${cls}" onclick="dpPickDay(${d})">${d}</button>`;
    }
    // Next month fill
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++) {
      html += `<button class="dp-day dp-other-month">${d}</button>`;
    }
    html += '</div>';
    popup.innerHTML = html;

  } else if (dpView === 'months') {
    let html = `<div class="dp-header">
      <button class="dp-nav" onclick="dpNavYear(-1)">&#8249;</button>
      <span class="dp-title" onclick="dpSetView('years')">${dpDate.getFullYear()}</span>
      <button class="dp-nav" onclick="dpNavYear(1)">&#8250;</button>
    </div><div class="dp-month-grid">`;
    MOIS_NOMS.forEach((n, i) => {
      const isSel = i === dpDate.getMonth() && dpDate.getFullYear() === dpViewYear;
      html += `<button class="dp-month-btn${isSel ? ' dp-sel' : ''}" onclick="dpPickMonth(${i})">${n.slice(0,3)}</button>`;
    });
    html += '</div>';
    popup.innerHTML = html;

  } else { // years
    const startY = Math.floor(dpDate.getFullYear() / 12) * 12;
    let html = `<div class="dp-header">
      <button class="dp-nav" onclick="dpNavYearPage(-1)">&#8249;</button>
      <span class="dp-title">${startY}–${startY+11}</span>
      <button class="dp-nav" onclick="dpNavYearPage(1)">&#8250;</button>
    </div><div class="dp-year-grid">`;
    for (let y = startY; y < startY + 12; y++) {
      const isSel = y === dpDate.getFullYear();
      html += `<button class="dp-year-btn${isSel ? ' dp-sel' : ''}" onclick="dpPickYear(${y})">${y}</button>`;
    }
    html += '</div>';
    popup.innerHTML = html;
  }
}

function dpNavMonth(delta) {
  dpDate.setMonth(dpDate.getMonth() + delta);
  renderCalendar();
}
function dpNavYear(delta) {
  dpDate.setFullYear(dpDate.getFullYear() + delta);
  dpViewYear = dpDate.getFullYear();
  renderCalendar();
}
function dpNavYearPage(delta) {
  dpDate.setFullYear(dpDate.getFullYear() + delta * 12);
  renderCalendar();
}
function dpSetView(v) { dpView = v; renderCalendar(); }
function dpPickMonth(m) {
  dpDate.setMonth(m);
  dpViewYear = dpDate.getFullYear();
  dpView = 'days';
  renderCalendar();
}
function dpPickYear(y) {
  dpDate.setFullYear(y);
  dpView = 'months';
  renderCalendar();
}
function dpPickDay(d) {
  dpDate.setDate(d);
  document.getElementById('date-cours').value = formatDateStr(dpDate);
  sauvegarderPlanLocal();
  closePicker();
}

// ── Supply date picker state ──
let sdpDate = new Date();
let sdpView = 'days';
let sdpViewYear = sdpDate.getFullYear();
let sdpOpen = false;
function initSupplyDate() { document.getElementById('supply-date').value = formatDateStr(sdpDate); }
function shiftSupplyDay(delta) { sdpDate.setDate(sdpDate.getDate() + delta); document.getElementById('supply-date').value = formatDateStr(sdpDate); sauvegarderPlanLocal(); if (sdpOpen) renderSupplyCalendar(); }
function toggleSupplyPicker() { sdpOpen = !sdpOpen; const popup = document.getElementById('supply-date-picker-popup'); if (sdpOpen) { sdpView = 'days'; sdpViewYear = sdpDate.getFullYear(); renderSupplyCalendar(); popup.style.display = 'block'; } else { popup.style.display = 'none'; } }
function closeSupplyPicker() { sdpOpen = false; const popup = document.getElementById('supply-date-picker-popup'); if (popup) popup.style.display = 'none'; }
function renderSupplyCalendar() { const popup = document.getElementById('supply-date-picker-popup'); const today = new Date(); popup.onclick = function(e) { e.stopPropagation(); }; if (sdpView === 'days') { const y = sdpDate.getFullYear(); const m = sdpDate.getMonth(); const firstDay = new Date(y, m, 1).getDay(); const daysInMonth = new Date(y, m + 1, 0).getDate(); const daysInPrev = new Date(y, m, 0).getDate(); let html = `<div class="dp-header"><button class="dp-nav" onclick="sdpNavMonth(-1)">&#8249;</button><span class="dp-title" onclick="sdpSetView('months')">${MOIS_NOMS[m]} ${y}</span><button class="dp-nav" onclick="sdpNavMonth(1)">&#8250;</button></div><div class="dp-grid">`; JOURS_NOMS.forEach(j => { html += `<div class="dp-day-label">${j}</div>`; }); for (let i = firstDay - 1; i >= 0; i--) html += `<button class="dp-day dp-other-month">${daysInPrev - i}</button>`; for (let d = 1; d <= daysInMonth; d++) { const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear(); const isSel = d === sdpDate.getDate() && m === sdpDate.getMonth() && y === sdpDate.getFullYear(); const cls = (isToday ? ' dp-today' : '') + (isSel ? ' dp-selected' : ''); html += `<button class="dp-day${cls}" onclick="sdpPickDay(${d})">${d}</button>`; } const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7; for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++) html += `<button class="dp-day dp-other-month">${d}</button>`; html += '</div>'; popup.innerHTML = html; } else if (sdpView === 'months') { let html = `<div class="dp-header"><button class="dp-nav" onclick="sdpNavYear(-1)">&#8249;</button><span class="dp-title" onclick="sdpSetView('years')">${sdpDate.getFullYear()}</span><button class="dp-nav" onclick="sdpNavYear(1)">&#8250;</button></div><div class="dp-month-grid">`; MOIS_NOMS.forEach((n, i) => { const isSel = i === sdpDate.getMonth() && sdpDate.getFullYear() === sdpViewYear; html += `<button class="dp-month-btn${isSel ? ' dp-sel' : ''}" onclick="sdpPickMonth(${i})">${n.slice(0,3)}</button>`; }); html += '</div>'; popup.innerHTML = html; } else { const startY = Math.floor(sdpDate.getFullYear() / 12) * 12; let html = `<div class="dp-header"><button class="dp-nav" onclick="sdpNavYearPage(-1)">&#8249;</button><span class="dp-title">${startY}–${startY+11}</span><button class="dp-nav" onclick="sdpNavYearPage(1)">&#8250;</button></div><div class="dp-year-grid">`; for (let y = startY; y < startY + 12; y++) { const isSel = y === sdpDate.getFullYear(); html += `<button class="dp-year-btn${isSel ? ' dp-sel' : ''}" onclick="sdpPickYear(${y})">${y}</button>`; } html += '</div>'; popup.innerHTML = html; } }
function sdpNavMonth(delta) { sdpDate.setMonth(sdpDate.getMonth() + delta); renderSupplyCalendar(); }
function sdpNavYear(delta) { sdpDate.setFullYear(sdpDate.getFullYear() + delta); sdpViewYear = sdpDate.getFullYear(); renderSupplyCalendar(); }
function sdpNavYearPage(delta) { sdpDate.setFullYear(sdpDate.getFullYear() + delta * 12); renderSupplyCalendar(); }
function sdpSetView(v) { sdpView = v; renderSupplyCalendar(); }
function sdpPickMonth(m) { sdpDate.setMonth(m); sdpViewYear = sdpDate.getFullYear(); sdpView = 'days'; renderSupplyCalendar(); }
function sdpPickYear(y) { sdpDate.setFullYear(y); sdpView = 'months'; renderSupplyCalendar(); }
function sdpPickDay(d) { sdpDate.setDate(d); document.getElementById('supply-date').value = formatDateStr(sdpDate); sauvegarderPlanLocal(); closeSupplyPicker(); }

// Close picker on outside click - works because popup stops propagation internally
document.addEventListener('click', function(e) {
  if (dpOpen) closePicker();
  if (sdpOpen) closeSupplyPicker();
});

// Wire up the input click and arrow buttons
document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('date-cours');
  const wrapper = document.getElementById('date-input-wrapper');
  // Stop wrapper clicks from bubbling so they don't trigger the document close
  wrapper.addEventListener('click', function(e) { e.stopPropagation(); });
  input.addEventListener('click', togglePicker);
  document.getElementById('date-prev').addEventListener('click', function(e){ e.stopPropagation(); shiftDay(1); });
  document.getElementById('date-next').addEventListener('click', function(e){ e.stopPropagation(); shiftDay(-1); });
  const sInput = document.getElementById('supply-date');
  const sWrapper = document.getElementById('supply-date-wrapper');
  if (sWrapper) sWrapper.addEventListener('click', function(e) { e.stopPropagation(); });
  if (sInput) sInput.addEventListener('click', toggleSupplyPicker);
  const sPrev = document.getElementById('supply-date-prev');
  const sNext = document.getElementById('supply-date-next');
  if (sPrev) sPrev.addEventListener('click', function(e){ e.stopPropagation(); shiftSupplyDay(1); });
  if (sNext) sNext.addEventListener('click', function(e){ e.stopPropagation(); shiftSupplyDay(-1); });
  initNumCours();
  initSupplyDate();
});

// Init 3 activities
function initActivites() {
  for (let i = 0; i < 3; i++) ajouterActivite();
}

let draggedActivity = null;

function ajouterActivite(prefillHtml = '') {
  const list = document.getElementById('activities-list');
  const count = list.children.length;
  if (count >= 10) return;

  const row = document.createElement('div');
  row.className = 'activity-row';
  row.innerHTML = `
    <span class="activity-num">${NUMERO_EMOJIS[count]}</span>
    <div class="rich-editor" contenteditable="true" data-placeholder="Activité ${count + 1}…" spellcheck="true"></div>
    <button type="button" class="activity-handle" title="Glisser pour réorganiser" aria-label="Glisser pour réorganiser">
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="5" cy="3" r="1.25" fill="currentColor"></circle>
        <circle cx="11" cy="3" r="1.25" fill="currentColor"></circle>
        <circle cx="5" cy="8" r="1.25" fill="currentColor"></circle>
        <circle cx="11" cy="8" r="1.25" fill="currentColor"></circle>
        <circle cx="5" cy="13" r="1.25" fill="currentColor"></circle>
        <circle cx="11" cy="13" r="1.25" fill="currentColor"></circle>
      </svg>
    </button>
    <button class="btn-remove" onclick="supprimerActivite(this)" title="Supprimer">✕</button>
    <div class="autocomplete-menu"></div>
  `;
  const editor = row.querySelector('.rich-editor');
  if (prefillHtml) editor.innerHTML = prefillHtml;
  editor.addEventListener('focus', () => { activeActivityEditor = editor; });
  editor.addEventListener('click', () => { activeActivityEditor = editor; });
  pushUndo();
  list.appendChild(row);
  brancherDragActivite(row);
  brancherAutocompleteActivite(row);
  reindexActivites();
  sauvegarderPlanLocal();
}

function supprimerActivite(btn) {
  pushUndo();
  btn.closest('.activity-row').remove();
  reindexActivites();
  sauvegarderPlanLocal();
}

function reindexActivites() {
  const rows = document.querySelectorAll('.activity-row');
  rows.forEach((row, i) => {
    row.querySelector('.activity-num').textContent = NUMERO_EMOJIS[i];
    row.querySelector('.rich-editor').dataset.placeholder = `Activité ${i + 1}…`;
  });
  _updateActivitiesEmptyState();
}

function _updateActivitiesEmptyState() {
  const hint = document.getElementById('activities-empty-hint');
  if (!hint) return;
  const hasRows = document.querySelector('#activities-list .activity-row');
  hint.style.display = hasRows ? 'none' : 'block';
}

function brancherDragActivite(row) {
  const handle = row.querySelector('.activity-handle');
  row.draggable = true;
  handle.setAttribute('draggable', 'false');
  row.addEventListener('dragstart', (e) => {
    draggedActivity = row;
    row.classList.add('dragging');
    document.getElementById('activities-list').classList.add('has-drag');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'activity');
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    document.getElementById('activities-list').classList.remove('has-drag');
    document.querySelectorAll('.activity-row').forEach(r => r.classList.remove('drag-over','drag-over-top','drag-over-bottom'));
    draggedActivity = null;
  });
  row.addEventListener('dragover', (e) => {
    if (!draggedActivity || draggedActivity === row) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    document.querySelectorAll('.activity-row').forEach(r => r.classList.remove('drag-over','drag-over-top','drag-over-bottom'));
    row.classList.add('drag-over', before ? 'drag-over-top' : 'drag-over-bottom');
  });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over','drag-over-top','drag-over-bottom'));
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    row.classList.remove('drag-over','drag-over-top','drag-over-bottom');
    if (!draggedActivity || draggedActivity === row) return;
    pushUndo();
    const rect = row.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    row.parentNode.insertBefore(draggedActivity, before ? row : row.nextSibling);
    reindexActivites();
    sauvegarderPlanLocal();
  });
}


function toggleSansNumero() {
  const cb = document.getElementById('sans-numero');
  const input = document.getElementById('num-cours');
  const hint  = document.getElementById('num-hint');
  input.disabled = cb.checked;
  if (cb.checked) {
    input.value = '';
    if (hint) hint.style.display = 'none';
  }
  sauvegarderPlanLocal();
}


function toggleDevoir() {
  const cb = document.getElementById('pas-devoir');
  const ed = document.getElementById('devoir');
  if (cb.checked) {
    ed.setAttribute('disabled-editor', '');
    ed.contentEditable = 'false';
    ed.innerHTML = '';
  } else {
    ed.removeAttribute('disabled-editor');
    ed.contentEditable = 'true';
  }
  sauvegarderPlanLocal();
}

function toggleRappel() {
  const cb = document.getElementById('pas-rappel');
  const ed = document.getElementById('rappel');
  if (cb.checked) {
    ed.setAttribute('disabled-editor', '');
    ed.contentEditable = 'false';
    ed.innerHTML = '';
  } else {
    ed.removeAttribute('disabled-editor');
    ed.contentEditable = 'true';
  }
  sauvegarderPlanLocal();
}

function getEmojis() {
  const mois = dpDate.getMonth();
  const pool = EMOJIS_MOIS[mois];
  // Shuffle (Fisher-Yates) then pick 5-6
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const count = 5 + Math.floor(Math.random() * 2); // 5 or 6
  return arr.slice(0, count).join('');
}

// ── Dernier numéro de cours utilisé ──
function initNumCours() {
  const hint = document.getElementById('num-hint');
  if (hint) hint.style.display = 'none';
  const input = document.getElementById('num-cours');
  const sansCb = document.getElementById('sans-numero');
  const last = localStorage.getItem('cardinal_last_num');
  if (isPrivilegedEmojiUser()) {
    if (last !== null && !input.value.trim()) {
      input.value = String(last);
      sansCb.checked = false;
    }
  } else if (!input.value.trim()) {
    sansCb.checked = true;
    input.value = '';
  }
  toggleSansNumero();
}

function saveNumCours(num) {
  localStorage.setItem('cardinal_last_num', String(num));
}

async function generer() {
  const sansNumero = document.getElementById('sans-numero').checked;
  const avecEmojis = document.getElementById('avec-emojis').checked;
  const num = document.getElementById('num-cours').value.trim();
  const date = formatDateStr(dpDate);
  const pasDevoir = document.getElementById('pas-devoir').checked;
  const pasRappel = document.getElementById('pas-rappel').checked;

  if (!sansNumero && !num) {
    alert('Veuillez entrer le numéro du cours (ou cocher "Ne pas numéroter le cours").');
    document.getElementById('num-cours').focus();
    return;
  }

  if (!sansNumero && num) {
    saveNumCours(parseInt(num, 10));
    if (googleAccessToken && appSpreadsheetId) { try { await updateLastCourseNumberOnline(parseInt(num, 10)); } catch(e) { console.warn(e); } }
  }

  const emojis = avecEmojis ? (' ' + getEmojis()) : '';
  const titre = sansNumero ? `Cours du ${esc(date)}${emojis}` : `Cours #${esc(num)} (${esc(date)})${emojis}`;

  const activiteEditors = document.querySelectorAll('.activity-row .rich-editor');
  const activites = [];
  const bankEntries = [];
  activiteEditors.forEach((ed, i) => {
    const html = ed.innerHTML.trim();
    const text = ed.innerText.trim();
    if (!text) return;
    activites.push({ num: i, html });
    const normalized = normalizeActivity(text);
    if (normalized) bankEntries.push({ normalized, text, html });
  });
  if (activites.length === 0) {
    alert('Veuillez entrer au moins une activité.');
    return;
  }

  const devoirHTML = document.getElementById('devoir').innerHTML.trim();
  const devoirText = document.getElementById('devoir').innerText.trim();
  const rappelHTML = document.getElementById('rappel').innerHTML.trim();
  const rappelText = document.getElementById('rappel').innerText.trim();

  let previewHTML = `<p class="titre"><b><u>${titre}</u></b></p>`;
  activites.forEach((a, idx) => {
    const lines = richToLines(a.html);
    lines.forEach((line, li) => {
      const inlineLine = sanitizeInlineFragment(line);
      if (li === 0) previewHTML += `<p>${NUMERO_EMOJIS[idx]}&nbsp;${inlineLine}</p>`;
      else previewHTML += `<p style="margin-left:1.8em">${inlineLine}</p>`;
    });
  });

  if (pasDevoir) {
    previewHTML += `<p class="special"><b>Devoir(s) :</b> <b>Aucun devoir</b></p>`;
  } else if (devoirText) {
    previewHTML += buildSpecialPreview('Devoir(s)', devoirHTML);
  }

  if (!pasRappel && rappelText) {
    previewHTML += buildSpecialPreview('Rappel(s)', rappelHTML);
  }

  const planPreview = document.getElementById('plan-preview');
  planPreview.innerHTML = previewHTML;
  planPreview.classList.remove('anim');
  void planPreview.offsetWidth; // force reflow
  planPreview.classList.add('anim');
  clipboardHTML = previewHTML;
  latestGeneratedHtml = previewHTML;
  latestGeneratedText = buildCurrentPlanTextForClassroom();
  document.getElementById('btn-copy').style.display = 'flex';
  document.getElementById('btn-reset').style.display = 'flex';

  if (googleAccessToken && appSpreadsheetId && bankEntries.length) {
    const alreadyInBank = new Set(bankActivities.map(a => a.normalized));
    const dedup = [];
    const seen = new Set();
    bankEntries.forEach(entry => {
      if (!seen.has(entry.normalized)) {
        seen.add(entry.normalized);
        if (!alreadyInBank.has(entry.normalized)) dedup.push(entry);
      }
    });
    if (dedup.length) {
      try { await saveActivitiesToBank(dedup); } catch (e) { setStatus('bank-status', "Plan généré, mais la banque n'a pas pu être mise à jour : " + e.message, 'err'); }
    }
  }

  if (!suppressCourseAutoSave && googleAccessToken && appSpreadsheetId) {
    try {
      await saveCurrentCourseToBank();
      await refreshCourses();
    } catch (e) {
      console.warn(e);
      setStatus('bank-status', "Plan généré, mais le cours n'a pas pu être enregistré : " + (e?.message || e), 'err');
    }
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Convert contenteditable innerHTML to array of HTML lines (split on <br> and <div>)
function richToLines(html) {
  // Normalize: <div> blocks → <br>
  let normalized = html
    .replace(/<div><br\s*\/?><\/div>/gi, '<br>')
    .replace(/<div>(.*?)<\/div>/gi, '<br>$1')
    .replace(/<br\s*\/?>/gi, '\n');
  // Split, trim, and drop empty lines
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.replace(/<[^>]*>/g,'').trim().length > 0);
  return lines.length > 0 ? lines : [''];
}
function richToStructuredLines(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  const lines = [];

  function hasVisibleText(fragment) {
    const probe = document.createElement('div');
    probe.innerHTML = fragment || '';
    return (probe.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
  }
  function push(kind, fragment, number = null) {
    const clean = sanitizeInlineFragment(fragment || '');
    if (hasVisibleText(clean)) lines.push({ kind, html: clean, number });
  }
  function processList(list, ordered) {
    let n = parseInt(list.getAttribute('start') || '1', 10);
    if (!Number.isFinite(n)) n = 1;
    Array.from(list.children).forEach(child => {
      if (child.tagName?.toLowerCase() !== 'li') return;
      const clone = child.cloneNode(true);
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach(nested => nested.remove());
      push(ordered ? 'number' : 'bullet', clone.innerHTML, ordered ? n++ : null);
      Array.from(child.children).forEach(nested => {
        const tag = nested.tagName?.toLowerCase();
        if (tag === 'ul') processList(nested, false);
        if (tag === 'ol') processList(nested, true);
      });
    });
  }
  function process(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.nodeValue || '').trim()) push('text', esc(node.nodeValue || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul') { processList(node, false); return; }
    if (tag === 'ol') { processList(node, true); return; }
    if (tag === 'div' || tag === 'p') {
      const directLists = Array.from(node.children).filter(c => ['ul','ol'].includes(c.tagName.toLowerCase()));
      if (!directLists.length) { push('text', node.innerHTML); return; }
      Array.from(node.childNodes).forEach(process);
      return;
    }
    if (tag === 'br') return;
    push('text', node.outerHTML);
  }
  Array.from(wrapper.childNodes).forEach(process);
  return lines;
}

function buildSpecialPreview(label, html) {
  const lines = richToStructuredLines(html);
  if (!lines.length) return '';
  if (lines.length === 1 && lines[0].kind === 'text') {
    return `<p class="special"><b>${label} :</b> ${lines[0].html}</p>`;
  }
  let out = `<p class="special"><b>${label} :</b></p>`;
  lines.forEach(line => {
    const prefix = line.kind === 'bullet' ? '- ' : (line.kind === 'number' ? `${line.number}. ` : '');
    out += `<p style="margin-left:1.8em">${prefix}${line.html}</p>`;
  });
  return out;
}
function sanitizeInlineFragment(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return esc(node.nodeValue || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    let inner = '';
    node.childNodes.forEach(child => { inner += walk(child); });
    if (tag === 'b' || tag === 'strong') return `<b>${inner}</b>`;
    if (tag === 'i' || tag === 'em') return `<i>${inner}</i>`;
    if (tag === 'u') return `<u>${inner}</u>`;
    if (tag === 's' || tag === 'strike') return `<s>${inner}</s>`;
    if (tag === 'span' || tag === 'font' || tag === 'mark' || tag === 'small' || tag === 'sub' || tag === 'sup') return inner;
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      return href ? `<a href="${esc(href)}">${inner}</a>` : inner;
    }
    return inner;
  }
  return Array.from(wrapper.childNodes).map(walk).join('').replace(/(?:<br>\s*){2,}/g, '<br>').trim();
}

// ── Format toolbar ──

/* ── Toast notifications ── */
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { ok: '✅', err: '❌', info: 'ℹ️', warn: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span style="font-size:1.05em">${icons[type] || icons.info}</span><span>${msg}</span>`;
  container.appendChild(t);
  const remove = () => {
    t.style.animation = 'toastOut 0.22s ease forwards';
    setTimeout(() => t.remove(), 230);
  };
  t.addEventListener('click', remove);
  setTimeout(remove, duration);
}

/* ── Undo stack ── */
const MAX_UNDO = 8;
let undoStack = [];
let _restoringUndo = false;

function snapshotActivites() {
  const rows = document.querySelectorAll('#activities-list .activity-row');
  return Array.from(rows).map(r => r.querySelector('.rich-editor').innerHTML);
}

function pushUndo() {
  if (_restoringUndo) return;
  undoStack.push(snapshotActivites());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  const btn = document.getElementById('btn-undo');
  if (btn) btn.style.display = 'block';
}

function popUndo() {
  if (!undoStack.length) return;
  const snapshot = undoStack.pop();
  const list = document.getElementById('activities-list');
  list.innerHTML = '';
  _restoringUndo = true;
  snapshot.forEach(html => ajouterActivite(html));
  _restoringUndo = false;
  reindexActivites();
  sauvegarderPlanLocal();
  const btn = document.getElementById('btn-undo');
  if (btn) btn.style.display = undoStack.length ? 'block' : 'none';
  showToast('Action annulée', 'info', 2500);
}

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const editable = document.activeElement?.isContentEditable;
  if ((tag === 'input' || tag === 'textarea' || editable)) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    popUndo();
  }
});

function setStatus(id, msg, type='') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'google-status' + (type ? ' ' + type : '');
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function normalizeActivity(s) {
  return (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
async function apiFetch(url, options = {}, _retried = false) {
  const opts = { ...options, headers: { ...(options.headers || {}), Authorization: googleAccessToken ? ('Bearer ' + googleAccessToken) : '' } };
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (!_retried && (resp.status === 401 || resp.status === 403) && await trySilentGoogleRefresh()) {
      return apiFetch(url, options, true);
    }
    throw new Error(data.error?.message || ('HTTP ' + resp.status));
  }
  return data;
}
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function isPrivilegedEmojiUser(email = googleUser?.email) {
  return normalizeEmail(email) === PRIVILEGED_EMOJI_EMAIL;
}
function getSupplyProfileKey(email = googleUser?.email) {
  const clean = normalizeEmail(email);
  return clean ? (SUPPLY_PROFILE_PREFIX + clean) : '';
}
function getSavedSupplyProfile(email = googleUser?.email) {
  const key = getSupplyProfileKey(email);
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
}
function saveSupplyProfileForCurrentUser() {
  const key = getSupplyProfileKey();
  if (!key) return;
  const profile = {
    teacher: document.getElementById('supply-teacher')?.value.trim() || '',
    subject: document.getElementById('supply-subject')?.value.trim() || ''
  };
  localStorage.setItem(key, JSON.stringify(profile));
  // Also persist to Config sheet if connected
  if (googleAccessToken && appSpreadsheetId && (profile.teacher || profile.subject)) {
    apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(CONFIG_SHEET+'!A5:B6')}?valueInputOption=USER_ENTERED`, {
      method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ values: [['teacher_name', profile.teacher], ['teacher_subject', profile.subject]] })
    }).catch(() => {});
  }
}
async function loadSupplyProfileFromSheet() {
  if (!googleAccessToken || !appSpreadsheetId) return;
  try {
    const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(CONFIG_SHEET+'!A:B')}`);
    const rows = data.values || [];
    const map = {};
    rows.slice(1).forEach(r => { if (r[0]) map[r[0]] = r[1] || ''; });
    const teacher = map['teacher_name'] || '';
    const subject = map['teacher_subject'] || '';
    if (teacher || subject) {
      // Save to localStorage for offline use
      const key = getSupplyProfileKey();
      if (key) localStorage.setItem(key, JSON.stringify({ teacher, subject }));
      // Apply to form if empty
      const teacherEl = document.getElementById('supply-teacher');
      const subjectEl = document.getElementById('supply-subject');
      if (teacherEl && !teacherEl.value.trim() && teacher) teacherEl.value = teacher;
      if (subjectEl && !subjectEl.value.trim() && subject) subjectEl.value = subject;
    }
  } catch(e) { console.warn('loadSupplyProfileFromSheet:', e); }
}
function todayIsoLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function updateRoleBasedUi() {
  const emojiRow = document.getElementById('emoji-option-row');
  const emojiCb = document.getElementById('avec-emojis');
  const sansCb = document.getElementById('sans-numero');
  const numInput = document.getElementById('num-cours');
  const privileged = isPrivilegedEmojiUser();
  if (emojiRow) emojiRow.hidden = !privileged;
  if (!privileged) {
    if (emojiCb) emojiCb.checked = false;
    if (sansCb && !numInput.value.trim()) sansCb.checked = true;
  } else {
    if (emojiCb) emojiCb.checked = true;
    const last = localStorage.getItem('cardinal_last_num');
    if (last && !numInput.value.trim()) {
      numInput.value = String(last);
      if (sansCb) sansCb.checked = false;
    }
  }
  toggleSansNumero();
}
function applySupplyDefaultsForCurrentUser(force = false) {
  const dateEl = document.getElementById('supply-date');
  if (dateEl && (force || !dateEl.value)) dateEl.value = todayIsoLocal();
  const teacherEl = document.getElementById('supply-teacher');
  const subjectEl = document.getElementById('supply-subject');
  if (!googleUser?.email) {
    if (force) {
      if (teacherEl) teacherEl.value = '';
      if (subjectEl) subjectEl.value = '';
    }
    return;
  }
  const profile = getSavedSupplyProfile();
  if (teacherEl && (!teacherEl.value.trim() || force) && profile.teacher) teacherEl.value = profile.teacher;
  if (subjectEl && (!subjectEl.value.trim() || force) && profile.subject) subjectEl.value = profile.subject;
}
function getStoredGoogleSession() {
  try {
    return JSON.parse(localStorage.getItem(GOOGLE_SESSION_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function persistGoogleSession() {
  const existing = getStoredGoogleSession();
  localStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify({
    connected: true,
    email: googleUser?.email || existing.email || localStorage.getItem('g_user_hint') || '',
    name: googleUser?.name || existing.name || '',
    updatedAt: new Date().toISOString()
  }));
}
function clearStoredGoogleSession() {
  localStorage.removeItem(GOOGLE_SESSION_KEY);
}
function hasPersistentGoogleSessionIntent() {
  const session = getStoredGoogleSession();
  return !!(session.connected || localStorage.getItem('g_user_hint') || localStorage.getItem('g_access_token'));
}
function decodeJwtPayload(token) {
  try {
    const base64Url = String(token || '').split('.')[1] || '';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function initGoogleIdentityClient() {
  // One Tap volontairement désactivé ici.
  // Cette page doit rester discrète au rechargement et ne pas afficher d'overlay Google au-dessus de l'interface.
  googleIdClientInitialized = true;
}
function triggerGoogleIdPromptIfNeeded() {
  // Désactivé volontairement pour éviter l'apparition du panneau "Se connecter avec Google" au chargement.
}

function initGoogleTokenClient() {
  if (googleTokenClient || typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return;
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: () => {}
  });
}
function requestGoogleToken(promptValue, extraParams = {}) {
  return new Promise((resolve, reject) => {
    initGoogleTokenClient();
    if (!googleTokenClient) { reject(new Error('Google indisponible')); return; }
    googleTokenClient.callback = async (response) => {
      if (!response || response.error) { reject(new Error(response?.error || 'auth_error')); return; }
      googleAccessToken = response.access_token || '';
      localStorage.setItem('g_access_token', googleAccessToken);
      googleTokenExpiry = Date.now() + (((response.expires_in || 3600) - 60) * 1000);
      localStorage.setItem('g_access_token_expiry', String(googleTokenExpiry));
      resolve(response);
    };
    const _tokenParams = { ...extraParams };
    if (typeof promptValue === 'string') _tokenParams.prompt = promptValue;
    const _hint = _tokenParams.login_hint || localStorage.getItem('g_user_hint');
    if (_hint) _tokenParams.login_hint = _hint;
    googleTokenClient.requestAccessToken(_tokenParams);
  });
}
let _silentRefreshPromise = null;
async function trySilentGoogleRefresh(loginHint = '') {
  if (_silentRefreshPromise) return _silentRefreshPromise;
  _silentRefreshPromise = (async () => {
    const extra = {};
    if (loginHint) extra.login_hint = loginHint;
    try {
      await Promise.race([
        requestGoogleToken('none', extra),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      await afterGoogleLogin({ refreshUi: false, silent: true });
      return true;
    } catch (e) {
      return false;
    } finally {
      _silentRefreshPromise = null;
    }
  })();
  return _silentRefreshPromise;
}
function setGoogleConnecting(connecting) {
  const btn = document.getElementById('btn-google-connect');
  if (!btn) return;
  if (connecting) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<span class="g-spinner"></span> Connexion en cours…`;
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    refreshGoogleUi();
  }
}
async function googleConnect() {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'REMPLACER_PAR_VOTRE_CLIENT_ID') { setStatus('google-status', "Remplacez d'abord le CLIENT_ID Google dans index.html.", 'err'); return; }
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) { setStatus('google-status', "La librairie Google ne s'est pas chargée.", 'err'); return; }
  setGoogleConnecting(true);
  try {
    await requestGoogleToken('consent select_account');
    await afterGoogleLogin({ refreshUi: true, silent: false });
  } catch (e) {
    setStatus('google-status', 'Erreur Google: ' + (e?.message || 'inconnue'), 'err');
  } finally {
    setGoogleConnecting(false);
  }
}
async function googleDisconnect() {
  if (googleAccessToken && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(googleAccessToken, () => {});
  if (window.google?.accounts?.id) {
    try { google.accounts.id.disableAutoSelect(); } catch {}
    try { google.accounts.id.cancel(); } catch {}
  }
  googleIdPromptTriggered = false;
  googleAccessToken = '';
  googleTokenExpiry = 0;
  googleUser = null;
  classroomCourses = [];
  bankActivities = [];
  savedCourses = [];
  savedSupplyPlans = [];
  localStorage.removeItem('g_access_token');
  localStorage.removeItem('g_access_token_expiry');
  localStorage.removeItem('g_user_hint');
  clearStoredGoogleSession();
  refreshGoogleUi();
  renderBankList();
  renderCourseOptions();
  renderSupplyPlanOptions();
  document.getElementById('classroom-course-select').innerHTML = '<option value="">Choisir un cours</option>';
  const shareSlot = document.getElementById('share-to-classroom-slot'); if (shareSlot) shareSlot.innerHTML = '';
  setStatus('google-status', 'Déconnecté.', '');
  setStatus('bank-status', '', '');
  setStatus('classroom-status', '', '');
  showToast('Déconnecté de Google', 'info');
  updateRoleBasedUi();
  applySupplyDefaultsForCurrentUser(true);
}
async function afterGoogleLogin(options = {}) {
  const { refreshUi = true, silent = false } = options;
  try {
    await loadGoogleProfile();
    persistGoogleSession();
    setStatus('google-status', silent ? '' : 'Connexion réussie. Chargement...', silent ? '' : 'ok');
    await ensureOnlineStorage();
    await Promise.all([refreshBank(), refreshCourses(), refreshSupplyPlans(), loadClassroomCourses()]);
    await loadSupplyProfileFromSheet();
    if (refreshUi) refreshGoogleUi();
    updateRoleBasedUi();
    applySupplyDefaultsForCurrentUser(false);
    const displayName = googleUser?.name || googleUser?.email || 'Google';
    if (!silent) showToast(`Connecté en tant que ${displayName}`, 'ok');
    setStatus('google-status', '', '');
  } catch (e) {
    googleUser = null;
    if (refreshUi) refreshGoogleUi();
    throw e;
  }
}
async function loadGoogleProfile() {
  googleUser = await apiFetch('https://openidconnect.googleapis.com/v1/userinfo');
  if (googleUser?.email) localStorage.setItem('g_user_hint', googleUser.email);
}
function refreshGoogleUi() {
  const pill = document.getElementById('google-user-pill');
  const btnIn = document.getElementById('btn-google-connect');
  const btnOut = document.getElementById('btn-google-disconnect');
  const isConnected = !!googleUser?.email;

  if (pill) {
    if (isConnected) {
      pill.style.display = '';
      pill.textContent = googleUser.name ? (googleUser.name + ' - ' + googleUser.email) : googleUser.email;
    } else {
      pill.style.display = 'none';
      pill.textContent = '';
    }
  }

  if (btnIn) {
    btnIn.style.display = isConnected ? 'none' : '';
    btnIn.textContent = 'Se connecter avec Google';
    btnIn.classList.toggle('connected', false);
  }
  if (btnOut) btnOut.style.display = isConnected ? '' : 'none';

  const sheetPill = document.getElementById('sheet-pill');
  if (appSpreadsheetId) {
    if (sheetPill) {
      sheetPill.style.display = '';
      sheetPill.textContent = 'Sheet connecté';
    }
  } else if (sheetPill) {
    sheetPill.style.display = 'none';
  }

  if (!isConnected && !document.getElementById('google-status')?.textContent?.trim()) {
    setStatus('google-status', 'Connexion requise pour la banque en ligne et Classroom.', '');
  }
}
async function refreshSheetMetadata(force = false) {
  if (!googleAccessToken || !appSpreadsheetId) return;
  const now = Date.now();
  if (!force && _sheetMetaCache && (now - _sheetMetaCacheTime) < 5 * 60 * 1000) {
    const sheets = _sheetMetaCache;
    supplyPlansSheetId = sheets.find(s => s.properties?.title === SUPPLY_PLANS_SHEET)?.properties?.sheetId ?? null;
    coursesSheetId = sheets.find(s => s.properties?.title === COURSES_SHEET)?.properties?.sheetId ?? null;
    activitesSheetId = sheets.find(s => s.properties?.title === ACTIVITES_SHEET)?.properties?.sheetId ?? null;
    return;
  }
  const meta = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}?fields=sheets(properties(sheetId,title))`);
  const sheets = meta.sheets || [];
  _sheetMetaCache = sheets;
  _sheetMetaCacheTime = now;
  supplyPlansSheetId = sheets.find(s => s.properties?.title === SUPPLY_PLANS_SHEET)?.properties?.sheetId ?? null;
  coursesSheetId = sheets.find(s => s.properties?.title === COURSES_SHEET)?.properties?.sheetId ?? null;
    activitesSheetId = sheets.find(s => s.properties?.title === ACTIVITES_SHEET)?.properties?.sheetId ?? null;
}

async function ensureOnlineStorage() {
  if (!googleAccessToken) return;
  if (!appSpreadsheetId) appSpreadsheetId = await findExistingSpreadsheetId();
  if (!appSpreadsheetId) appSpreadsheetId = await createAppSpreadsheet();
  localStorage.setItem('plan_cours_sheet_id', appSpreadsheetId);
  await refreshSheetMetadata();
  await ensureSheetStructure();
  await syncLastCourseNumberFromSheet();
}
async function findExistingSpreadsheetId() {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name='${APP_SHEET_NAME.replace(/'/g, "\\'")}'`);
  const data = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&orderBy=createdTime asc&pageSize=10`);
  return data.files?.[0]?.id || '';
}
async function createAppSpreadsheet() {
  setStatus('bank-status', 'Création du Google Sheet privé...', '');
  const data = await apiFetch('https://sheets.googleapis.com/v4/spreadsheets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ properties:{ title: APP_SHEET_NAME }, sheets:[{properties:{title:ACTIVITES_SHEET}},{properties:{title:CONFIG_SHEET}},{properties:{title:COURSES_SHEET}},{properties:{title:SUPPLY_PLANS_SHEET}}] }) });
  const id = data.spreadsheetId;
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(CONFIG_SHEET+'!A1:B4')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['key','value'],['app_marker',APP_MARKER],['last_course_number',''],['owner_email',googleUser?.email || '']] }) });
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(ACTIVITES_SHEET+'!A1:E1')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['normalized','text','html','last_used','count']] }) });
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(COURSES_SHEET+'!A1:M1')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['id','title','date_display','date_iso','course_number','sans_numero','avec_emojis','activities_html_json','devoir_html','pas_devoir','rappel_html','pas_rappel','updated_at']] }) });
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A1:D1')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['id','title','updated_at','payload_json']] }) });
  return id;
}
async function ensureSheetStructure() {
  let meta = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}?fields=sheets(properties(sheetId,title))`);
  let sheetsMeta = meta.sheets || [];
  supplyPlansSheetId = (sheetsMeta.find(s => s.properties?.title === SUPPLY_PLANS_SHEET)?.properties?.sheetId) ?? null;
  coursesSheetId = (sheetsMeta.find(s => s.properties?.title === COURSES_SHEET)?.properties?.sheetId) ?? null;
  activitesSheetId = (sheetsMeta.find(s => s.properties?.title === ACTIVITES_SHEET)?.properties?.sheetId) ?? null;
  const titles = new Set(sheetsMeta.map(s => s.properties?.title).filter(Boolean));
  const requests = [];
  if (!titles.has(ACTIVITES_SHEET)) requests.push({ addSheet: { properties: { title: ACTIVITES_SHEET } } });
  if (!titles.has(CONFIG_SHEET)) requests.push({ addSheet: { properties: { title: CONFIG_SHEET } } });
  if (!titles.has(COURSES_SHEET)) requests.push({ addSheet: { properties: { title: COURSES_SHEET } } });
  if (!titles.has(SUPPLY_PLANS_SHEET)) requests.push({ addSheet: { properties: { title: SUPPLY_PLANS_SHEET } } });
  if (requests.length) {
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}:batchUpdate`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ requests }) });
    meta = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}?fields=sheets(properties(sheetId,title))`);
    sheetsMeta = meta.sheets || [];
    supplyPlansSheetId = (sheetsMeta.find(s => s.properties?.title === SUPPLY_PLANS_SHEET)?.properties?.sheetId) ?? null;
    coursesSheetId = (sheetsMeta.find(s => s.properties?.title === COURSES_SHEET)?.properties?.sheetId) ?? null;
  activitesSheetId = (sheetsMeta.find(s => s.properties?.title === ACTIVITES_SHEET)?.properties?.sheetId) ?? null;
  }

  const cfg = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(CONFIG_SHEET+'!A1:B10')}`);
  if (!(cfg.values || []).length) {
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(CONFIG_SHEET+'!A1:B4')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['key','value'],['app_marker',APP_MARKER],['last_course_number',''],['owner_email',googleUser?.email || '']] }) });
  }

  const activitesHeader = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(ACTIVITES_SHEET+'!A1:E1')}`);
  if (!(activitesHeader.values || []).length) {
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(ACTIVITES_SHEET+'!A1:E1')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['normalized','text','html','last_used','count']] }) });
  }

  const coursesHeader = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A1:M1')}`);
  if (!(coursesHeader.values || []).length) {
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A1:M1')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['id','title','date_display','date_iso','course_number','sans_numero','avec_emojis','activities_html_json','devoir_html','pas_devoir','rappel_html','pas_rappel','updated_at']] }) });
  }

  const supplyPlansHeader = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A1:D1')}`);
  if (!(supplyPlansHeader.values || []).length) {
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A1:D1')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['id','title','updated_at','payload_json']] }) });
  }
  await refreshSheetMetadata();
}
async function syncLastCourseNumberFromSheet() {
  try {
    const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(CONFIG_SHEET+'!A:B')}`);
    const rows = data.values || []; const map = {}; rows.slice(1).forEach(r => map[r[0]] = r[1] || '');
    const last = map['last_course_number'];
    if (last) {
      localStorage.setItem('cardinal_last_num', String(last));
      if (!document.getElementById('sans-numero').checked) document.getElementById('num-cours').value = String(last);
    }
  } catch(e) { console.warn(e); }
}
async function updateLastCourseNumberOnline(num) {
  if (!appSpreadsheetId || !googleAccessToken) return;
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(CONFIG_SHEET+'!A3:B3')}?valueInputOption=USER_ENTERED`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values:[['last_course_number', String(num)]] }) });
}
async function refreshBank() {
  if (!googleAccessToken || !appSpreadsheetId) { renderBankList(); return; }
  setStatus('bank-status', 'Chargement de la banque...', '');
  const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(ACTIVITES_SHEET+'!A2:E')}`);
  bankActivities = (data.values || []).map((r, idx) => ({ normalized:r[0] || '', text:r[1] || '', html:r[2] || '', lastUsed:r[3] || '', count:parseInt(r[4] || '0',10) || 0, rowNumber: idx + 2 })).filter(a => a.normalized && a.text);
  bankActivities.sort((a,b) => (a.text || '').localeCompare(b.text || '', 'fr'));
  renderBankList();
  setStatus('bank-status', bankActivities.length ? `${bankActivities.length} activité(s) en banque.` : 'Aucune activité enregistrée pour le moment.', 'ok');
}

function buildCourseTitleWithoutEmojis(state) {
  return state.sansNumero ? `Cours du ${state.dateDisplay}` : `Cours #${state.courseNumber} (${state.dateDisplay})`;
}

function getCurrentCourseState() {
  return {
    dateDisplay: document.getElementById('date-cours').value.trim(),
    dateISO: dpDate ? dpDate.toISOString() : '',
    courseNumber: document.getElementById('num-cours').value.trim(),
    sansNumero: document.getElementById('sans-numero').checked,
    avecEmojis: document.getElementById('avec-emojis').checked,
    activities: [...document.querySelectorAll('.activity-row .rich-editor')].map(ed => ed.innerHTML.trim()).filter(Boolean),
    devoirHtml: document.getElementById('devoir').innerHTML.trim(),
    pasDevoir: document.getElementById('pas-devoir').checked,
    rappelHtml: document.getElementById('rappel').innerHTML.trim(),
    pasRappel: document.getElementById('pas-rappel').checked
  };
}

function fillFormFromCourseState(state) {
  setCourseDateToToday();
  document.getElementById('num-cours').value = state.courseNumber || '';
  document.getElementById('sans-numero').checked = !!state.sansNumero;
  document.getElementById('avec-emojis').checked = state.avecEmojis !== false;
  document.getElementById('pas-devoir').checked = !!state.pasDevoir;
  document.getElementById('pas-rappel').checked = !!state.pasRappel;

  document.querySelectorAll('.activity-row').forEach(r => r.remove());
  const activities = Array.isArray(state.activities) && state.activities.length ? state.activities : [''];
  activities.forEach(html => ajouterActivite(html || ''));

  document.getElementById('devoir').innerHTML = state.devoirHtml || '';
  document.getElementById('rappel').innerHTML = state.rappelHtml || '';

  toggleSansNumero();
  toggleDevoir();
  toggleRappel();
  sauvegarderPlanLocal();
  syncSupplyFromCourse(true);
}

function parseSortTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}
function getCourseSortTimestamp(course) {
  return parseSortTimestamp(course?.updatedAt) || parseSortTimestamp(course?.dateISO) || Number(course?.rowNumber || 0);
}

async function refreshCourses() {
  const select = document.getElementById('reuse-course-select');
  if (!select) return;
  if (!googleAccessToken || !appSpreadsheetId) {
    savedCourses = [];
    renderCourseOptions();
    return;
  }
  const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A2:M')}`);
  savedCourses = (data.values || []).map((r, idx) => ({
    id: r[0] || '',
    title: r[1] || '',
    dateDisplay: r[2] || '',
    dateISO: r[3] || '',
    courseNumber: r[4] || '',
    sansNumero: String(r[5] || '').toLowerCase() === 'true',
    avecEmojis: String(r[6] || '').toLowerCase() !== 'false',
    activities: (() => { try { return JSON.parse(r[7] || '[]'); } catch { return []; } })(),
    devoirHtml: r[8] || '',
    pasDevoir: String(r[9] || '').toLowerCase() === 'true',
    rappelHtml: r[10] || '',
    pasRappel: String(r[11] || '').toLowerCase() === 'true',
    updatedAt: r[12] || '',
    rowNumber: idx + 2
  })).filter(c => c.id && c.title);
  savedCourses.sort((a, b) => {
    const diff = getCourseSortTimestamp(b) - getCourseSortTimestamp(a);
    if (diff !== 0) return diff;
    return (b.rowNumber || 0) - (a.rowNumber || 0);
  });
  renderCourseOptions();
}

function renderCourseOptions() {
  const select = document.getElementById('reuse-course-select');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">Choisir un cours</option>' + savedCourses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join('');
  if (currentValue && savedCourses.some(c => c.id === currentValue)) select.value = currentValue;
  updateDeleteCourseButton();
}

function updateDeleteCourseButton() {
  const select = document.getElementById('reuse-course-select');
  const btn = document.getElementById('btn-delete-course');
  if (!select || !btn) return;
  btn.classList.toggle('show', !!select.value);
}

async function deleteSelectedCourse() {
  const select = document.getElementById('reuse-course-select');
  const id = select?.value || '';
  if (!id || !googleAccessToken || !appSpreadsheetId) return;
  const course = savedCourses.find(c => c.id === id);
  if (!course) return;
  const ok = window.confirm(`Effacer définitivement le cours « ${course.title} » ?`);
  if (!ok) return;
  try {
    await refreshSheetMetadata();
    const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A2:M')}`);
    const rows = data.values || [];
    const idx = rows.findIndex(r => (r[0] || '') === id);
    if (idx >= 0) {
      const rowNumber = idx + 2;
      await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A'+rowNumber+':M'+rowNumber)}:clear`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}
      });
      if (coursesSheetId) {
        try {
          await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}:batchUpdate`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: coursesSheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }] })
          });
          _sheetMetaCache = null; // invalider le cache après écriture structurelle
        } catch (e) { console.warn('Suppression de ligne impossible, contenu vidé seulement.', e); }
      }
    }
    if (currentLoadedCourseId === id) currentLoadedCourseId = '';
    savedCourses = savedCourses.filter(c => c.id !== id);
    if (select) select.value = '';
    renderCourseOptions();
    await refreshCourses();
    updateDeleteCourseButton();
  } catch (e) {
    console.error('Erreur suppression cours :', e);
    alert('Erreur lors de la suppression : ' + (e?.message || e));
  }
}


async function refreshSupplyPlans() {
  const select = document.getElementById('reuse-supply-select');
  if (!select) return;
  if (!googleAccessToken || !appSpreadsheetId) {
    savedSupplyPlans = [];
    renderSupplyPlanOptions();
    return;
  }
  await refreshSheetMetadata();
  const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A2:D')}`);
  savedSupplyPlans = (data.values || []).map((r, idx) => {
    let payload = {};
    try { payload = JSON.parse(r[3] || '{}'); } catch { payload = {}; }
    return { id: r[0] || '', title: r[1] || '', updatedAt: r[2] || '', payload, rowNumber: idx + 2 };
  }).filter(p => p.id && p.title);
  savedSupplyPlans.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  renderSupplyPlanOptions();
}

function renderSupplyPlanOptions() {
  const select = document.getElementById('reuse-supply-select');
  if (!select) return;
  select.innerHTML = '<option value="">Choisir une planification</option>' + savedSupplyPlans.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
  updateDeleteSupplyButton();
}

function updateDeleteSupplyButton() {
  const select = document.getElementById('reuse-supply-select');
  const btn = document.getElementById('btn-delete-supply');
  if (!select || !btn) return;
  btn.classList.toggle('show', !!select.value);
}

async function deleteSelectedSupplyPlan() {
  const select = document.getElementById('reuse-supply-select');
  const id = select?.value || '';
  if (!id || !googleAccessToken || !appSpreadsheetId) return;
  const plan = savedSupplyPlans.find(p => p.id === id);
  if (!plan?.rowNumber) return;
  const ok = window.confirm(`Effacer définitivement la planification « ${plan.title} » ?`);
  if (!ok) return;
  try {
    await refreshSheetMetadata();
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}:batchUpdate`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: supplyPlansSheetId, dimension: 'ROWS', startIndex: plan.rowNumber - 1, endIndex: plan.rowNumber } } }] })
    });
    if (currentLoadedSupplyId === id) currentLoadedSupplyId = '';
    savedSupplyPlans = savedSupplyPlans.filter(p => p.id !== id);
    if (select) select.value = '';
    renderSupplyPlanOptions();
    await refreshSupplyPlans();
  } catch (e) {
    console.error('Erreur suppression planification :', e);
    alert('Erreur lors de la suppression : ' + (e?.message || e));
  }
}

function getSupplyPlanPayload() {
  return {
    courseState: getCurrentCourseState(),
    supplyState: getSupplyState()
  };
}

async function saveSupplyPlan() {
  if (!googleAccessToken || !appSpreadsheetId) {
    setStatus('google-status', 'Connectez-vous à Google pour sauvegarder la planification.', 'err');
    switchRightTab('preview');
    return;
  }
  syncSupplyFromCourse(false);
  const supply = getSupplyState();
  const course = getCurrentCourseState();
  const title = `${supply['supply-date'] || course.dateDisplay || 'Sans date'} - P${supply['supply-period'] || '?'} - Groupe ${supply['supply-group'] || '?'}`;
  saveSupplyProfileForCurrentUser();
  const id = currentLoadedSupplyId || crypto.randomUUID();
  const values = [[id, title, new Date().toISOString(), JSON.stringify({ courseState: course, supplyState: supply })]];

  if (currentLoadedSupplyId) {
    const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A2:A')}`);
    const rows = data.values || [];
    const idx = rows.findIndex(r => (r[0] || '') === currentLoadedSupplyId);
    if (idx >= 0) {
      const rowNumber = idx + 2;
      await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A'+rowNumber+':D'+rowNumber)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ values })
      });
      await refreshSupplyPlans();
      const sel = document.getElementById('reuse-supply-select');
      if (sel) sel.value = id;
      return;
    }
  }
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(SUPPLY_PLANS_SHEET+'!A:D')}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ values })
  });
  currentLoadedSupplyId = id;
  await refreshSupplyPlans();
}

async function loadSavedSupplyPlan(id) {
  const plan = savedSupplyPlans.find(p => p.id === id);
  if (!plan?.payload) return;
  suppressCourseAutoSave = true;
  currentLoadedSupplyId = id;
  try {
    if (plan.payload.courseState) fillFormFromCourseState(plan.payload.courseState);
    if (plan.payload.supplyState) {
      Object.entries(plan.payload.supplyState).forEach(([key, val]) => {
        const el = document.getElementById(key);
        if (!el) return;
        if (key === 'supply-work') el.innerHTML = val || '';
        else el.value = val || '';
      });
    }
    await generer();
    switchRightTab('supply');
  } finally {
    suppressCourseAutoSave = false;
  }
}

function toggleReuseCourse() {
  const enabled = document.getElementById('enable-reuse-course').checked;
  document.getElementById('reuse-course-box').style.display = enabled ? '' : 'none';
  if (!enabled) document.getElementById('reuse-course-select').value = '';
  updateDeleteCourseButton();
}

async function loadSavedCourse(id) {
  const course = savedCourses.find(c => c.id === id);
  if (!course) return;
  suppressCourseAutoSave = true;
  currentLoadedCourseId = id;
  try {
    fillFormFromCourseState(course);
    syncSupplyFromCourse(true);
    await generer();
    const select = document.getElementById('reuse-course-select');
    if (select) select.value = id;
    updateDeleteCourseButton();
  } finally {
    suppressCourseAutoSave = false;
  }
}

async function saveCurrentCourseToBank() {
  if (!googleAccessToken || !appSpreadsheetId) return;
  const state = getCurrentCourseState();
  const title = buildCourseTitleWithoutEmojis(state);
  const id = currentLoadedCourseId || crypto.randomUUID();
  const values = [[
    id, title, state.dateDisplay, state.dateISO, state.courseNumber,
    String(state.sansNumero), String(state.avecEmojis),
    JSON.stringify(state.activities), state.devoirHtml, String(state.pasDevoir),
    state.rappelHtml, String(state.pasRappel), new Date().toISOString()
  ]];

  if (currentLoadedCourseId) {
    const data = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A2:M')}`);
    const rows = data.values || [];
    const idx = rows.findIndex(r => (r[0] || '') === currentLoadedCourseId);
    if (idx >= 0) {
      const rowNumber = idx + 2;
      await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A'+rowNumber+':M'+rowNumber)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ values })
      });
      await refreshCourses();
      const select = document.getElementById('reuse-course-select');
      if (select) select.value = currentLoadedCourseId;
      return;
    }
  }
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(COURSES_SHEET+'!A:M')}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ values })
  });
  currentLoadedCourseId = id;
  await refreshCourses();
}

function renderBankList() {
  const box = document.getElementById('bank-list'); if (!box) return;
  const q = (document.getElementById('bank-search')?.value || '').trim().toLowerCase();
  const filtered = q
    ? bankActivities.filter(a => a.normalized.includes(q) || (a.text || '').toLowerCase().includes(q))
    : bankActivities;
  if (!filtered.length) {
    box.innerHTML = `<div class="bank-item">${bankActivities.length ? 'Aucun résultat.' : 'Aucune activité enregistrée.'}</div>`;
    return;
  }
  box.innerHTML = '';
  filtered.forEach(a => {
    const div = document.createElement('div');
    div.className = 'bank-item' + (a.text === selectedBankText ? ' selected' : '');
    div.textContent = a.text;
    div.draggable = true;
    // Hover preview tooltip
    const tip = document.createElement('span');
    tip.className = 'bank-preview-tip';
    tip.textContent = a.text;
    div.appendChild(tip);
    // Click to select
    div.addEventListener('click', () => selectBankActivity(a.text));
    // Drag from bank
    div.addEventListener('dragstart', (e) => {
      div.classList.add('dragging-bank');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/bank-activity', a.text);
    });
    div.addEventListener('dragend', () => div.classList.remove('dragging-bank'));
    box.appendChild(div);
  });
}
function selectBankActivity(text) {
  selectedBankText = text;
  const delBtn = document.getElementById('btn-delete-bank');
  if (delBtn) delBtn.classList.toggle('active', !!text);
  const addBtn = document.getElementById('btn-add-bank-to-plan');
  if (addBtn) addBtn.classList.toggle('active', !!text);
  renderBankList();
}
function insertBankActivityByText(text) {
  const entry = bankActivities.find(a => a.text === text);
  const html = entry?.html || escapeHtml(text);
  let target = [...document.querySelectorAll('.activity-row .rich-editor')].find(ed => !ed.innerText.trim());
  if (!target) {
    ajouterActivite();
    target = [...document.querySelectorAll('.activity-row .rich-editor')].find(ed => !ed.innerText.trim()) || [...document.querySelectorAll('.activity-row .rich-editor')].pop();
  }
  if (!target) return;
  target.innerHTML = html;
  target.focus();
  activeActivityEditor = target;
  sauvegarderPlanLocal();
}
function addSelectedBankActivityToPlan() {
  if (!selectedBankText) return;
  insertBankActivityByText(selectedBankText);
}
async function deleteSelectedBankActivity() {
  if (!selectedBankText) return;
  if (!googleAccessToken || !appSpreadsheetId) {
    alert('Connectez-vous à Google pour supprimer une activité de la banque.');
    return;
  }
  const entry = bankActivities.find(a => a.text === selectedBankText);
  if (!entry?.rowNumber) return;
  const ok = window.confirm(`Supprimer définitivement « ${entry.text} » de la banque ?`);
  if (!ok) return;
  try {
    await refreshSheetMetadata(true);
    if (!activitesSheetId && activitesSheetId !== 0) throw new Error('ID de la feuille Activites introuvable.');
    await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}:batchUpdate`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: activitesSheetId, dimension: 'ROWS', startIndex: entry.rowNumber - 1, endIndex: entry.rowNumber } } }] })
    });
    selectedBankText = null;
    const delBtn = document.getElementById('btn-delete-bank');
    if (delBtn) delBtn.classList.remove('active');
    const addBtn = document.getElementById('btn-add-bank-to-plan');
    if (addBtn) addBtn.classList.remove('active');
    await refreshBank();
  } catch(e) {
    console.error('Erreur suppression activité :', e);
    alert('Erreur lors de la suppression : ' + (e?.message || e));
  }
}
function brancherAutocompleteActivite(row) {
  const editor = row.querySelector('.rich-editor'); const menu = row.querySelector('.autocomplete-menu'); let activeIndex = -1;
  function closeMenu() { menu.style.display = 'none'; menu.innerHTML = ''; activeIndex = -1; }
  function currentMatches() { const q = normalizeActivity(editor.innerText); if (q.length < 3) return []; return bankActivities.filter(a => a.normalized.includes(q)).sort((a,b) => { const aStarts = a.normalized.startsWith(q) ? 0 : 1; const bStarts = b.normalized.startsWith(q) ? 0 : 1; if (aStarts !== bStarts) return aStarts - bStarts; return (a.text || '').localeCompare(b.text || '', 'fr'); }); }
  function openMenu(matches) {
    if (!matches.length) { closeMenu(); return; }
    menu.innerHTML = matches.map((a,i) => `<div class="autocomplete-item${i===0?' active':''}" data-idx="${i}"><div>${escapeHtml(a.text)}</div></div>`).join('');
    menu.style.display = 'block'; activeIndex = 0;
    [...menu.children].forEach((item, idx) => item.addEventListener('mousedown', (e) => { e.preventDefault(); editor.innerHTML = matches[idx].html || escapeHtml(matches[idx].text); closeMenu(); }));
  }
  editor.addEventListener('input', () => openMenu(currentMatches()));
  editor.addEventListener('focus', () => openMenu(currentMatches()));
  editor.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('.autocomplete-item')];
    const menuOpen = items.length && menu.style.display !== 'none';

    if (menuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((el, idx) => el.classList.toggle('active', idx === activeIndex));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((el, idx) => el.classList.toggle('active', idx === activeIndex));
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        items[activeIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        return;
      }
      if (e.key === 'Escape') {
        closeMenu();
        return;
      }
    }

    if (e.key === 'Enter') {
      const rows = [...document.querySelectorAll('.activity-row')];
      const currentRow = editor.closest('.activity-row');
      const currentIndex = rows.indexOf(currentRow);
      const isLastRow = currentIndex === rows.length - 1;
      if (isLastRow) {
        e.preventDefault();
        ajouterActivite();
        const nextRow = [...document.querySelectorAll('.activity-row')][currentIndex + 1];
        const nextEditor = nextRow?.querySelector('.rich-editor');
        if (nextEditor) {
          nextEditor.focus();
          activeActivityEditor = nextEditor;
        }
        return;
      }
    }

    if (e.key === 'Tab' || e.key === 'ArrowDown') {
      e.preventDefault();
      const rows = [...document.querySelectorAll('.activity-row')];
      const currentRow = editor.closest('.activity-row');
      const currentIndex = rows.indexOf(currentRow);
      let nextRow = rows[currentIndex + 1];
      if (!nextRow) {
        ajouterActivite();
        nextRow = [...document.querySelectorAll('.activity-row')][currentIndex + 1];
      }
      const nextEditor = nextRow?.querySelector('.rich-editor');
      if (nextEditor) {
        nextEditor.focus();
        const range = document.createRange();
        range.selectNodeContents(nextEditor);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        activeActivityEditor = nextEditor;
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...document.querySelectorAll('.activity-row')];
      const currentRow = editor.closest('.activity-row');
      const currentIndex = rows.indexOf(currentRow);
      const prevRow = rows[currentIndex - 1];
      const prevEditor = prevRow?.querySelector('.rich-editor');
      if (prevEditor) {
        prevEditor.focus();
        const range = document.createRange();
        range.selectNodeContents(prevEditor);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        activeActivityEditor = prevEditor;
      }
      return;
    }
  });
  document.addEventListener('mousedown', (e) => { if (!row.contains(e.target)) closeMenu(); });
}
async function saveActivitiesToBank(entries) {
  if (!googleAccessToken || !appSpreadsheetId || !entries.length) return;
  const now = new Date().toISOString();
  const existingByNorm = new Map(bankActivities.map(a => [a.normalized, a]));
  const updates = [];
  const appends = [];
  for (const entry of entries) {
    const existing = existingByNorm.get(entry.normalized);
    if (existing) {
      updates.push({ range: `${ACTIVITES_SHEET}!A${existing.rowNumber}:E${existing.rowNumber}`, values: [[entry.normalized, existing.text || entry.text, existing.html || entry.html, now, (existing.count || 0) + 1]] });
    } else {
      appends.push([entry.normalized, entry.text, entry.html, now, 1]);
    }
  }
  const promises = [];
  if (updates.length) {
    promises.push(apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values:batchUpdate?valueInputOption=USER_ENTERED`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates })
    }));
  }
  if (appends.length) {
    promises.push(apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${appSpreadsheetId}/values/${encodeURIComponent(ACTIVITES_SHEET+'!A:E')}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ values: appends })
    }));
  }
  await Promise.all(promises);
  await refreshBank();
}
const QUICK_CLASSROOM_GROUPS = ['31', '32', '51'];

function classroomCourseScoreGroup(course, group) {
  const raw = `${course?.name || ''} ${course?.section || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const g = String(group || '').trim();
  if (!g) return 0;
  const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\bGROUPE\s*[-–—:]?\s*${escaped}\b`).test(raw)) return 120;
  if (new RegExp(`\b(?:FRA|FRANCAIS|SAE)[^\n]{0,30}(?:-|\s)${escaped}\b`).test(raw)) return 90;
  if (new RegExp(`(?:^|[^0-9])${escaped}(?:[^0-9]|$)`).test(raw)) return 50;
  return 0;
}

function getClassroomCourseForGroup(group) {
  const ranked = classroomCourses
    .map(course => ({ course, score: classroomCourseScoreGroup(course, group) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    console.warn(`Plusieurs cours Classroom correspondent au groupe ${group}`, ranked.slice(0, 3));
    return null;
  }
  return ranked[0].course;
}

function updateQuickClassroomButtons() {
  QUICK_CLASSROOM_GROUPS.forEach(group => {
    const btn = document.getElementById(`btn-publish-group-${group}`);
    if (!btn) return;
    const course = getClassroomCourseForGroup(group);
    btn.disabled = !googleAccessToken || !course;
    btn.dataset.courseId = course?.id ? String(course.id) : '';
    btn.title = course
      ? `Publier dans ${course.name}${course.section ? ' - ' + course.section : ''}`
      : `Aucun cours Classroom actif correspondant au groupe ${group}`;
  });
  const status = document.getElementById('quick-classroom-status');
  if (!status) return;
  if (!googleAccessToken) {
    status.textContent = 'Connectez-vous à Google pour activer la publication en un clic.';
    return;
  }
  const found = QUICK_CLASSROOM_GROUPS.filter(g => getClassroomCourseForGroup(g));
  status.textContent = found.length
    ? `Groupes prêts : ${found.join(', ')}.`
    : 'Aucun des groupes 31, 32 ou 51 n’a été retrouvé dans les cours Classroom actifs.';
}

async function publishPlanToGroup(group) {
  const course = getClassroomCourseForGroup(group);
  const btn = document.getElementById(`btn-publish-group-${group}`);
  const status = document.getElementById('quick-classroom-status');

  if (!googleAccessToken) {
    showToast('Connectez-vous à Google avant de publier dans Classroom.', 'warn', 3500);
    return;
  }
  if (!course) {
    showToast(`Le groupe ${group} n’a pas été retrouvé dans vos cours Classroom actifs.`, 'err', 4000);
    updateQuickClassroomButtons();
    return;
  }
  if (document.documentElement.dataset.pdcClassroomBridge !== '1') {
    showToast('Le script Tampermonkey de publication Classroom n’est pas actif.', 'err', 4500);
    return;
  }

  const emojiBox = document.getElementById('avec-emojis');
  if (emojiBox) emojiBox.checked = true;

  const original = btn?.textContent || `Groupe ${group}`;
  if (btn) { btn.disabled = true; btn.textContent = 'Préparation…'; }
  if (status) status.textContent = `Préparation du plan pour le groupe ${group}…`;

  try {
    latestGeneratedText = '';
    latestGeneratedHtml = '';
    await generer();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!latestGeneratedText || !latestGeneratedHtml) {
      throw new Error('Le plan courant n’a pas pu être généré.');
    }

    const select = document.getElementById('classroom-course-select');
    if (select) select.value = String(course.id);

    document.dispatchEvent(new CustomEvent('pdc:publish-course', {
      detail: {
        courseId: String(course.id),
        group: String(group),
        courseName: course.name || '',
        courseSection: course.section || '',
        alternateLink: course.alternateLink || ''
      }
    }));

    if (btn) btn.textContent = 'Ouverture…';
    if (status) status.textContent = `Ouverture de Classroom - groupe ${group}…`;
    setTimeout(() => {
      if (btn) btn.textContent = original;
      updateQuickClassroomButtons();
    }, 3500);
  } catch (err) {
    console.error('Publication rapide Classroom', err);
    if (btn) btn.textContent = original;
    updateQuickClassroomButtons();
    if (status) status.textContent = `Échec de préparation pour le groupe ${group}.`;
    showToast('Impossible de préparer le plan pour Classroom.', 'err', 4000);
  }
}

document.addEventListener('DOMContentLoaded', updateQuickClassroomButtons);

async function loadClassroomCourses() {
  if (!googleAccessToken) return;
  setStatus('classroom-status', 'Chargement des cours...', '');
  const data = await apiFetch('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&pageSize=100');
  classroomCourses = (data.courses || []).sort((a,b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  const select = document.getElementById('classroom-course-select');
  select.innerHTML = '<option value="">Choisir un cours</option>' + classroomCourses.map(c => `<option value="${c.id}">${escapeHtml(c.name + (c.section ? ' - ' + c.section : ''))}</option>`).join('');
  setStatus('classroom-status', classroomCourses.length ? `${classroomCourses.length} cours actif(s) trouvés.` : 'Aucun cours actif trouvé.', classroomCourses.length ? 'ok' : '');
  updateQuickClassroomButtons();
}
function htmlVersTexteClassroom(html) {
  const wrapper = document.createElement('div'); wrapper.innerHTML = html || '';
  function underlineUnicode(s) { return Array.from(s).map(ch => (ch === ' ' || ch === '\n' || ch === '\t') ? ch : ch + '\u0332').join(''); }
  function walkChildren(node) {
    let out = '';
    node.childNodes.forEach(child => { out += walk(child); });
    return out;
  }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'ul' || tag === 'ol') {
      let number = parseInt(node.getAttribute('start') || '1', 10);
      if (!Number.isFinite(number)) number = 1;
      let listText = '';
      Array.from(node.children).forEach(li => {
        if (li.tagName?.toLowerCase() !== 'li') return;
        let itemText = '';
        li.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE && ['ul','ol'].includes(child.tagName.toLowerCase())) return;
          itemText += walk(child);
        });
        itemText = itemText.replace(/\n+/g, ' ').trim();
        if (itemText) listText += (tag === 'ul' ? '- ' : `${number++}. `) + itemText + '\n';
        Array.from(li.children).forEach(child => {
          const childTag = child.tagName?.toLowerCase();
          if (childTag === 'ul' || childTag === 'ol') listText += walk(child);
        });
      });
      return listText;
    }
    let out = walkChildren(node);
    if (tag === 'u') out = underlineUnicode(out);
    if (tag === 'div' || tag === 'p') return out + '\n';
    return out;
  }
  let result = ''; wrapper.childNodes.forEach(child => result += walk(child));
  return result.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function buildCurrentPlanTextForClassroom() {
  const sansNumero = document.getElementById('sans-numero').checked; const avecEmojis = document.getElementById('avec-emojis').checked; const num = document.getElementById('num-cours').value.trim(); const date = formatDateStr(dpDate); const emojis = avecEmojis ? (' ' + getEmojis()) : '';
  let texte = sansNumero ? `Cours du ${date}${emojis}\n` : `Cours #${num} (${date})${emojis}\n`;
  const activiteEditors = document.querySelectorAll('.activity-row .rich-editor'); let idx = 0;
  activiteEditors.forEach(ed => { const t = htmlVersTexteClassroom(ed.innerHTML); if (!t) return; const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean); if (!lines.length) return; texte += NUMERO_EMOJIS[idx] + ' ' + lines[0] + '\n'; for (let i = 1; i < lines.length; i++) texte += '   ' + lines[i] + '\n'; idx++; });
  const pasDevoir = document.getElementById('pas-devoir').checked; const devoir = htmlVersTexteClassroom(document.getElementById('devoir').innerHTML); const pasRappel = document.getElementById('pas-rappel').checked; const rappel = htmlVersTexteClassroom(document.getElementById('rappel').innerHTML);
  if (pasDevoir) texte += '\nDevoir(s) : Aucun devoir';
  else if (devoir) {
    const dLines = devoir.replace(/\n{2,}/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
    if (dLines.length <= 1) texte += '\nDevoir(s) : ' + (dLines[0] || '');
    else texte += '\nDevoir(s) :\n' + dLines.map(l => '   ' + l).join('\n');
  }
  if (!pasRappel && rappel) {
    const rLines = rappel.replace(/\n{2,}/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
    if (rLines.length <= 1) texte += '\nRappel(s) : ' + (rLines[0] || '');
    else texte += '\nRappel(s) :\n' + rLines.map(l => '   ' + l).join('\n');
  }
  return texte.trim();
}
async function publishToClassroom() {
  const courseId = document.getElementById('classroom-course-select').value;
  if (!courseId) { setStatus('classroom-status', 'Choisissez un cours.', 'err'); return; }
  const text = latestGeneratedText || buildCurrentPlanTextForClassroom();
  if (!text) { setStatus('classroom-status', 'Générez un plan avant de publier.', 'err'); return; }
  const btn = document.getElementById('btn-classroom-publish');
  if (btn) { btn.disabled = true; btn.textContent = 'Publication…'; }
  setStatus('classroom-status', 'Publication en cours…', '');
  try {
    await apiFetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/announcements`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text, state: 'PUBLISHED' })
    });
    const courseName = document.getElementById('classroom-course-select').selectedOptions[0]?.text || '';
    const slot = document.getElementById('share-to-classroom-slot');
    if (slot) {
      slot.innerHTML = `<div style="margin-top:6px;padding:10px 14px;background:#e6f4ea;border:1px solid #a8d5b5;border-radius:10px;color:#1e6b3a;font-size:0.88rem;font-weight:600;">✅ Plan publié avec succès dans <em>${escapeHtml(courseName)}</em></div>`;
      setTimeout(() => { if (slot) slot.innerHTML = ''; }, 6000);
    }
    showToast(`Plan publié dans « ${courseName} »`, 'ok');
    setStatus('classroom-status', '', '');
  } catch (e) {
    console.error('Classroom publish error:', e);
    showToast('Erreur lors de la publication : ' + (e?.message || e), 'err');
    setStatus('classroom-status', 'Erreur lors de la publication : ' + (e?.message || e), 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Publier'; }
  }
}


function getPlanStateForLocal() {
  return {
    version: 3,
    activities: [...document.querySelectorAll('.activity-row .rich-editor')].map(ed => ed.innerHTML),
    devoirHtml: document.getElementById('devoir').innerHTML,
    pasDevoir: document.getElementById('pas-devoir').checked,
    rappelHtml: document.getElementById('rappel').innerHTML,
    pasRappel: document.getElementById('pas-rappel').checked,
    dateDisplay: document.getElementById('date-cours')?.value?.trim() || '',
    dateISO: dpDate ? dpDate.toISOString() : '',
    courseNumber: document.getElementById('num-cours')?.value?.trim() || '',
    sansNumero: !!document.getElementById('sans-numero')?.checked,
    avecEmojis: !!document.getElementById('avec-emojis')?.checked,
    reuseCourseEnabled: !!document.getElementById('enable-reuse-course')?.checked,
    currentPlanMode,
    schoolKey: getCurrentSchoolKey(),
    supplyDateISO: sdpDate ? sdpDate.toISOString() : '',
    supplyState: getSupplyState()
  };
}

let _saveDebounceTimer = null;
let _saveIndicatorTimer = null;
function shouldPersistLocalPlan() {
  const cb = document.getElementById('keep-form-filled');
  if (cb) return !!cb.checked;
  const pref = localStorage.getItem(KEEP_FORM_PREF_KEY);
  return pref === null ? true : pref === '1';
}
function sauvegarderPlanLocal() {
  clearTimeout(_saveDebounceTimer);
  if (!shouldPersistLocalPlan()) return;
  _saveDebounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(getPlanStateForLocal()));
      _showSaveIndicator();
    } catch (e) {
      console.warn('sauvegarderPlanLocal', e);
    }
  }, 400);
}
function _showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('visible');
  clearTimeout(_saveIndicatorTimer);
  _saveIndicatorTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

function restaurerPlanLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_PLAN_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state) return;

    if (state.schoolKey) applySchoolSelection(state.schoolKey);

    setCourseDateToToday();

    document.getElementById('num-cours').value = state.courseNumber || '';
    document.getElementById('sans-numero').checked = !!state.sansNumero;
    document.getElementById('avec-emojis').checked = state.avecEmojis !== false;
    document.getElementById('enable-reuse-course').checked = !!state.reuseCourseEnabled;

    document.querySelectorAll('.activity-row').forEach(r => r.remove());
    const activities = Array.isArray(state.activities) && state.activities.length ? state.activities : [''];
    activities.forEach(html => ajouterActivite(html || ''));

    document.getElementById('devoir').innerHTML = state.devoirHtml || '';
    document.getElementById('pas-devoir').checked = !!state.pasDevoir;
    document.getElementById('rappel').innerHTML = state.rappelHtml || '';
    document.getElementById('pas-rappel').checked = !!state.pasRappel;

    if (state.supplyDateISO) {
      const parsedSupplyDate = new Date(state.supplyDateISO);
      if (!isNaN(parsedSupplyDate)) sdpDate = parsedSupplyDate;
    }
    if (state.supplyState && typeof state.supplyState === 'object') {
      Object.entries(state.supplyState).forEach(([key, val]) => {
        const el = document.getElementById(key);
        if (!el) return;
        if (key === 'supply-work') el.innerHTML = val || '';
        else el.value = val || '';
      });
    }
    if (document.getElementById('supply-date')) {
      document.getElementById('supply-date').value = state.supplyState?.['supply-date'] || formatDateStr(sdpDate);
    }

    toggleSansNumero();
    toggleReuseCourse();
    toggleDevoir();
    toggleRappel();
    syncSupplyFromCourse(true);
    setPlanMode(state.currentPlanMode === 'supply' ? 'supply' : 'course');
  } catch (e) {
    console.warn('restaurerPlanLocal', e);
  }
}

function toggleKeepFormFilled() {
  const cb = document.getElementById('keep-form-filled');
  const enabled = cb && cb.checked;
  localStorage.setItem(KEEP_FORM_PREF_KEY, enabled ? '1' : '0');
  if (enabled) sauvegarderPlanLocal();
  else effacerPlanLocal();
}

function effacerPlanLocal() {
  clearTimeout(_saveDebounceTimer);
  localStorage.removeItem(LOCAL_PLAN_KEY);
}


function initSupplyRuleBank() {
  const box = document.getElementById('supply-rules-bank');
  if (!box) return;
  box.innerHTML = SUPPLY_RULES_DEFAULT.map(rule => `<button type="button" class="rule-chip">${escapeHtml(rule)}</button>`).join('');
  [...box.querySelectorAll('.rule-chip')].forEach((btn, idx) => btn.addEventListener('click', () => appendSupplyRule(SUPPLY_RULES_DEFAULT[idx])));
}
function appendSupplyRule(rule) {
  const ta = document.getElementById('supply-rules');
  if (!ta) return;
  const lines = ta.value.split(/\n+/).map(v => v.trim()).filter(Boolean);
  if (!lines.includes(rule)) lines.push(rule);
  ta.value = lines.join('\n');
}
function buildSupplyWorkTextFromCourse() {
  let html = '';
  const activities = [...document.querySelectorAll('.activity-row .rich-editor')].map(ed => htmlVersTexteClassroom(ed.innerHTML).trim()).filter(Boolean);
  activities.forEach((txt, idx) => {
    const lines = txt.split(/\n+/).filter(Boolean);
    if (!lines.length) return;
    html += `<div>${idx + 1}. ${escapeHtml(lines[0])}</div>`;
    for (let i = 1; i < lines.length; i++) html += `<div style="margin-left:1.5em">${escapeHtml(lines[i])}</div>`;
  });
  const devoir = document.getElementById('pas-devoir').checked ? '' : htmlVersTexteClassroom(document.getElementById('devoir').innerHTML).trim();
  const rappel = document.getElementById('pas-rappel').checked ? '' : htmlVersTexteClassroom(document.getElementById('rappel').innerHTML).trim();
  if (devoir) {
    if (html) html += '<br>';
    const dLines = devoir.split('\n').map(l => l.trim()).filter(Boolean);
    if (dLines.length <= 1) {
      html += `<div><strong><u>Devoir(s) :</u></strong> ${escapeHtml(dLines[0] || '')}</div>`;
    } else {
      html += `<div><strong><u>Devoir(s) :</u></strong></div>`;
      dLines.forEach(l => { html += `<div style="margin-left:1.5em">${escapeHtml(l)}</div>`; });
    }
  }
  if (rappel) {
    const rLines = rappel.split('\n').map(l => l.trim()).filter(Boolean);
    if (rLines.length <= 1) {
      html += `<div><strong><u>Rappel(s) :</u></strong> ${escapeHtml(rLines[0] || '')}</div>`;
    } else {
      html += `<div><strong><u>Rappel(s) :</u></strong></div>`;
      rLines.forEach(l => { html += `<div style="margin-left:1.5em">${escapeHtml(l)}</div>`; });
    }
  }
  return html;
}
function syncSupplyFromCourse(forceWork) {
  const workEl = document.getElementById('supply-work');
  const generated = buildSupplyWorkTextFromCourse();
  if (workEl && (forceWork || !workEl.innerText.trim() || workEl.dataset.synced === '1')) {
    workEl.innerHTML = generated;
    workEl.dataset.synced = '1';
  }
}
function getSupplyDateISO() { return sdpDate ? sdpDate.toISOString() : ''; }
function parseFrenchDateStr(value) {
  if (!value) return null;
  const m = value.match(/^(\d{1,2})\s+([A-Za-zéûîôàç]+)\s+(\d{4})$/i);
  if (!m) return null;
  const idx = MOIS_NOMS.map(v => v.toLowerCase()).indexOf(m[2].toLowerCase());
  if (idx < 0) return null;
  return new Date(Number(m[3]), idx, Number(m[1]));
}
function getSupplyState() {
  const ids = ['supply-date','supply-period','supply-group','supply-subject','supply-room','supply-teacher','supply-replacement','supply-level','supply-rules','supply-note','supply-return','supply-links'];
  const out = {};
  ids.forEach(id => out[id] = document.getElementById(id)?.value || '');
  out['supply-work'] = document.getElementById('supply-work')?.innerHTML || '';
  return out;
}
function sauvegarderSupplyLocal() { sauvegarderPlanLocal(); }
function restaurerSupplyLocal() { restaurerPlanLocal(); }
function clearSupplyLocal() { effacerPlanLocal(); }
function supplyLinesHtml(count, filledLines) {
  const lines = [];
  const src = (filledLines || []).map(v => escapeHtml(v));
  for (let i = 0; i < count; i++) lines.push(`<div class="line-fill">${src[i] || '&nbsp;'}</div>`);
  return lines.join('');
}
function formatSupplyDateForPrint(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return `${d} ${MOIS_NOMS[m - 1]} ${y}`;
  }
  return value;
}

const PDF_LIBRARY_URLS = {
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
};
let pdfLibrariesPromise = null;

function loadExternalScriptOnce(src, ready) {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const absoluteSrc = new URL(src, document.baseURI).href;
    const existing = Array.from(document.scripts).find(script => script.src === absoluteSrc);
    const finish = () => ready() ? resolve() : reject(new Error(`Bibliothèque chargée mais indisponible: ${src}`));
    if (existing) {
      if (ready()) {
        resolve();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Impossible de charger ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.head.appendChild(script);
  });
}

function ensurePdfLibraries() {
  const hasHtml2Canvas = () => typeof window.html2canvas === 'function';
  const hasJsPdf = () => Boolean((window.jspdf && window.jspdf.jsPDF) || window.jsPDF);
  if (hasHtml2Canvas() && hasJsPdf()) return Promise.resolve();
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = Promise.all([
      loadExternalScriptOnce(PDF_LIBRARY_URLS.html2canvas, hasHtml2Canvas),
      loadExternalScriptOnce(PDF_LIBRARY_URLS.jspdf, hasJsPdf)
    ]).then(() => undefined).catch(error => {
      pdfLibrariesPromise = null;
      throw error;
    });
  }
  return pdfLibrariesPromise;
}

async function downloadSupplyPDF() {
  const btn = document.querySelector('.btn-pdf-supply');
  const origContent = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '⏳ Génération…'; btn.disabled = true; }

  let iframe = null;
  try {
    await ensurePdfLibraries();
    syncSupplyFromCourse(false);
    const s = getSupplyState();
    const dateStr = (s['supply-date'] || 'planification').replace(/\s+/g, '_');
    const filename = `Suppléance_${dateStr}.pdf`;

    // Build EXACTLY the same document as printSupplyPlan, minus the auto-print script
    const absentLines = [];
    const workHtml = `<div class="work-content">${s['supply-work'] || ''}</div>`;
    const rulesLines = (s['supply-rules'] || '').split(/\n+/).map(v => v.trim()).filter(Boolean);
    const commentLines = [];
    const ratings = ['Excellente période','Bonne période','Période moyenne','Mauvaise période'];
    const ratingHtml = ratings.map(r => `<div class="rating-row"><span class="box">☐</span><span>${escapeHtml(r)}</span></div>`).join('');
    const noteHtml = escapeHtml(s['supply-note'] || '');
    const linksLines = (s['supply-links'] || '').split(/\n/).map(v => v.trim()).filter(Boolean);
    const linksHtml = linksLines.length ? `<div class="links-section"><strong>Liens utiles :</strong><ul>${linksLines.map(l => `<li><a href="${escapeHtml(l)}">${escapeHtml(l)}</a></li>`).join('')}</ul></div>` : '';
    const logoSrc = getCurrentSchoolLogoDataUri();
    const logoTag = logoSrc ? `<img src="${logoSrc}" alt="${escapeHtml(getCurrentSchoolName())}">` : '';

    // Same doc as print but no @page/print script, and table layout instead of grid
    // (html2canvas doesn't support CSS Grid — tables render identically)
    const fullDocHtml = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { margin:0.45in; font:15px/1.35 Arial,Helvetica,sans-serif; color:#111; background:#fff; width:7.6in; }
      .top-table { width:100%; border-collapse:collapse; margin-bottom:0; }
      .top-table td { vertical-align:top; }
      .brand-cell { width:58%; padding-right:20px; }
      .brand-inner { display:flex; align-items:center; gap:18px; margin-top:4px; }
      .brand-inner img { height:58px; width:auto; flex-shrink:0; }
      .plan-title { font-weight:700; font-size:19px; text-align:center; flex:1; }
      .meta-cell { width:42%; }
      .meta-row { display:flex; justify-content:flex-end; gap:8px; margin-bottom:6px; font-size:14px; }
      .line { display:inline-block; min-width:130px; border-bottom:1px solid #111; }
      .line.short { min-width:75px; }
      .middle-table { width:100%; border-collapse:collapse; margin-top:12px; }
      .middle-table td { vertical-align:top; }
      .left-cell { width:57%; padding-right:22px; }
      .right-cell { width:43%; }
      .label-line { margin:4px 0; font-size:14px; }
      .section-title { font-size:16px; font-weight:700; text-decoration:underline; margin:14px 0 8px; }
      .line-fill { min-height:20px; border-bottom:1px solid #111; margin-bottom:7px; padding:0 2px 2px; }
      .rating-box { border:1px solid #111; padding:12px 14px; }
      .rating-title { font-size:15px; text-decoration:underline; margin-bottom:10px; }
      .rating-row { display:flex; align-items:center; gap:10px; margin:13px 0; font-size:14px; }
      .box { display:inline-block; width:18px; text-align:center; font-size:16px; }
      .work-content { font-size:14px; line-height:1.5; }
      .work-content div { min-height:18px; margin-bottom:4px; }
      .work-content br { display:block; margin:4px 0; }
      .rules { margin-top:10px; font-size:14px; }
      .rules ul { margin:6px 0 0 22px; list-style:disc; }
      .rules li { margin:7px 0; }
      .note-box { border:1px solid #111; padding:8px 10px; margin-top:18px; text-align:center; min-height:42px; font-size:14px; }
      .comments-title { display:inline-block; background:#fff16a; font-weight:700; text-decoration:underline; padding:1px 2px; margin-top:18px; font-size:14px; }
      .footer-line { margin-top:14px; text-align:center; font-weight:700; font-size:14px; }
      .footer-line span { display:inline-block; min-width:210px; border-bottom:1px solid #111; vertical-align:middle; }
      .links-section { margin-top:14px; font-size:14px; }
      .links-section ul { margin:6px 0 0 22px; list-style:disc; }
      .links-section li { margin:5px 0; }
      .links-section a { color:#0000ee; word-break:break-all; }
    </style></head><body>
      <table class="top-table"><tr>
        <td class="brand-cell"><div class="brand-inner">${logoTag}<div class="plan-title">Planification de la suppléance</div></div></td>
        <td class="meta-cell">
          <div class="meta-row"><strong>Date :</strong> <span class="line">${escapeHtml(formatSupplyDateForPrint(s['supply-date']))}</span></div>
          <div class="meta-row"><strong>Période(s) :</strong> <span class="line short">${escapeHtml(s['supply-period'])}</span></div>
          <div style="height:12px"></div>
          <div class="meta-row"><strong>Enseignant absent :</strong> <span class="line">${escapeHtml(s['supply-teacher'])}</span></div>
          <div class="meta-row"><strong>Suppléant(e) :</strong> <span class="line">${escapeHtml(s['supply-replacement'])}</span></div>
        </td>
      </tr></table>
      <table class="middle-table"><tr>
        <td class="left-cell">
          <div class="label-line"><strong>Matière :</strong> ${escapeHtml(s['supply-subject'])}</div>
          <div class="label-line"><strong>Niveau :</strong> ${escapeHtml(s['supply-level'])}</div>
          <div class="label-line"><strong>Groupe(s) :</strong> ${escapeHtml(s['supply-group'])}</div>
          <div class="label-line"><strong>Local :</strong> ${escapeHtml(s['supply-room'])}</div>
          <div class="section-title">Élève(s) absent(s) :</div>
          ${supplyLinesHtml(2, absentLines)}
        </td>
        <td class="right-cell">
          <div class="rating-box"><div class="rating-title">Période en général</div>${ratingHtml}</div>
        </td>
      </tr></table>
      <div class="section-title">Travail à faire</div>
      ${workHtml}
      <div class="rules"><strong>Règles :</strong><ul>${rulesLines.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>
      <div class="note-box">${noteHtml || '&nbsp;'}</div>
      ${linksHtml}
      <div class="comments-title">Commentaires sur la période :</div>
      ${supplyLinesHtml(3, commentLines)}
      <div class="footer-line">Laisser le rapport <span>${escapeHtml(s['supply-return'])}</span></div>
      <div style="text-align:right;font-weight:700;font-size:14px;margin-top:8px;">Merci !<br>${escapeHtml(s['supply-teacher'])}</div>
    </body></html>`;

    // ── Write into a hidden iframe so CSS is in <head> and layout is correct ──
    iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:7.6in;height:11in;border:none;visibility:hidden;';
    document.body.appendChild(iframe);
    await new Promise(resolve => {
      iframe.onload = resolve;
      const d = iframe.contentDocument || iframe.contentWindow.document;
      // Remove body margin — jsPDF adds 0.45in margins itself when placing the image
      const docNoMargin = fullDocHtml.replace('body { margin:0.45in;', 'body { margin:0;');
      d.open(); d.write(docNoMargin); d.close();
    });
    // Let layout fully paint
    await new Promise(r => setTimeout(r, 350));

    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iBody = iDoc.body;

    // ── Capture with html2canvas ──────────────────────────────────────────────
    const H2C = window.html2canvas;
    if (!H2C) throw new Error('html2canvas non disponible — vérifiez votre connexion internet');
    const canvas = await H2C(iBody, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: iBody.scrollWidth,
      height: iBody.scrollHeight,
      windowWidth: iBody.scrollWidth,
      windowHeight: iBody.scrollHeight,
    });

    // ── Build PDF letter 8.5×11 with 0.45in margins ──────────────────────────
    const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!JsPDF) throw new Error('jsPDF non disponible — vérifiez votre connexion internet');
    const pdf = new JsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
    const margin = 0.45;
    const pageW = pdf.internal.pageSize.getWidth();   // 8.5
    const pageH = pdf.internal.pageSize.getHeight();  // 11
    const imgW = pageW - 2 * margin;                  // 7.6
    const imgH = (canvas.height / canvas.width) * imgW;
    const imgData = canvas.toDataURL('image/jpeg', 0.97);
    if (imgH <= pageH - 2 * margin) {
      pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
    } else {
      // Multi-page: slice canvas by available print height
      const printH = pageH - 2 * margin;
      const canvasPxPerIn = canvas.width / imgW;
      const sliceH = Math.floor(printH * canvasPxPerIn);
      let offsetY = 0;
      let pageNum = 0;
      while (offsetY < canvas.height) {
        if (pageNum > 0) pdf.addPage();
        const thisSlice = Math.min(sliceH, canvas.height - offsetY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = thisSlice;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, offsetY, canvas.width, thisSlice, 0, 0, canvas.width, thisSlice);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.97);
        const sliceInH = (thisSlice / canvas.width) * imgW;
        pdf.addImage(sliceData, 'JPEG', margin, margin, imgW, sliceInH);
        offsetY += thisSlice;
        pageNum++;
      }
    }
    pdf.save(filename);

    // ── Toast ─────────────────────────────────────────────────────────────────
    const actionsBar = document.querySelector('.supply-actions');
    if (actionsBar) {
      // Remove existing toast if any
      actionsBar.querySelectorAll('.pdf-toast').forEach(t => t.remove());
      const toast = document.createElement('span');
      toast.className = 'pdf-toast';
      toast.textContent = '✅ Téléchargement démarré — vérifiez vos téléchargements !';
      actionsBar.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 5000);
    }

  } catch(e) {
    console.error('PDF suppléance :', e);
    alert('Erreur lors de la génération du PDF : ' + (e?.message || e));
  } finally {
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    if (btn) { btn.innerHTML = origContent; btn.disabled = false; }
  }
}

function printSupplyPlan() {
  syncSupplyFromCourse(false);
  const s = getSupplyState();
  const absentLines = [];
  const workLines = (s['supply-work'] || '').split(/\n/).map(v => v.replace(/\s+$/,'')).filter((v, i, arr) => v || i < arr.length - 1);
  const rulesLines = (s['supply-rules'] || '').split(/\n+/).map(v => v.trim()).filter(Boolean);
  const commentLines = [];
  const ratings = ['Excellente période','Bonne période','Période moyenne','Mauvaise période'];
  const ratingHtml = ratings.map(r => `<div class="rating-row"><span class="box">☐</span><span>${escapeHtml(r)}</span></div>`).join('');
  const workHtml = `<div class="work-content">${s['supply-work'] || ''}</div>`;
  const noteHtml = escapeHtml(s['supply-note'] || '');
  const linksLines = (s['supply-links'] || '').split(/\n/).map(v => v.trim()).filter(Boolean);
  const linksHtml = linksLines.length ? `<div class="links-section"><strong>Liens utiles :</strong><ul>${linksLines.map(l => `<li><a href="${escapeHtml(l)}">${escapeHtml(l)}</a></li>`).join('')}</ul></div>` : '';
  const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planification suppléance</title><style>
    @page { size: letter portrait; margin: 0.45in; }
    body { margin:0; font: 15px/1.35 Arial, Helvetica, sans-serif; color:#111; }
    .page { width: 100%; box-sizing:border-box; }
    .top { display:grid; grid-template-columns: 1.4fr 1fr; column-gap: 26px; align-items:start; }
    .brand { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:18px; margin-top:4px; }
    .brand img { height:58px; width:auto; }
    .title { font-weight:700; font-size:19px; text-align:center; align-self:center; justify-self:center; width:100%; }
    .meta-right { font-size:14px; }
    .meta-right .row { display:flex; justify-content:flex-end; gap:8px; margin-bottom:6px; }
    .line { display:inline-block; min-width:140px; border-bottom:1px solid #111; }
    .line.short { min-width:80px; }
    .middle { display:grid; grid-template-columns: 1.2fr 0.9fr; gap:26px; margin-top:12px; }
    .label-line { margin: 4px 0; font-size:14px; }
    .section-title { font-size:16px; font-weight:700; text-decoration:underline; margin: 14px 0 8px; }
    .line-fill { min-height:20px; border-bottom:1px solid #111; margin-bottom:7px; padding:0 2px 2px; }
    .rating-box { border:1px solid #111; padding:12px 14px; }
    .rating-title { font-size:16px; text-decoration:underline; margin-bottom:10px; }
    .rating-row { display:flex; align-items:center; gap:10px; margin:15px 0; font-size:14px; }
    .box { display:inline-block; width:18px; text-align:center; font-size:16px; }
    .work-content { font-size:14px; line-height:1.5; }
    .work-content div { min-height:18px; margin-bottom:4px; }
    .work-content br { display:block; margin:4px 0; }
    .rules { margin-top:10px; }
    .rules ul { margin:6px 0 0 22px; }
    .rules li { margin:7px 0; }
    .note-box { border:1px solid #111; padding:8px 10px; margin-top:18px; text-align:center; min-height:42px; }
    .comments-title { display:inline-block; background:#fff16a; font-weight:700; text-decoration:underline; padding:1px 2px; margin-top:18px; }
    .footer-line { margin-top:14px; text-align:center; font-weight:700; }
    .footer-line span { display:inline-block; min-width:210px; border-bottom:1px solid #111; vertical-align:middle; }
    .links-section { margin-top:14px; font-size:14px; }
    .links-section ul { margin:6px 0 0 22px; }
    .links-section li { margin:5px 0; }
    .links-section a { color:#0000ee; word-break:break-all; }
  </style></head><body><div class="page">
    <div class="top">
      <div class="brand">${getCurrentSchoolLogoDataUri() ? `<img src="${getCurrentSchoolLogoDataUri()}" alt="${escapeHtml(getCurrentSchoolName())}">` : ''}<div class="title">Planification de la suppléance</div></div>
      <div class="meta-right">
        <div class="row"><strong>Date :</strong> <span class="line">${escapeHtml(formatSupplyDateForPrint(s['supply-date']))}</span></div>
        <div class="row"><strong>Période(s) :</strong> <span class="line short">${escapeHtml(s['supply-period'])}</span></div>
        <div style="height:12px"></div>
        <div class="row"><strong>Enseignant absent :</strong> <span class="line">${escapeHtml(s['supply-teacher'])}</span></div>
        <div class="row"><strong>Suppléant(e) :</strong> <span class="line">${escapeHtml(s['supply-replacement'])}</span></div>
      </div>
    </div>
    <div class="middle">
      <div>
        <div class="label-line"><strong>Matière :</strong> ${escapeHtml(s['supply-subject'])}</div>
        <div class="label-line"><strong>Niveau :</strong> ${escapeHtml(s['supply-level'])}</div>
        <div class="label-line"><strong>Groupe(s) :</strong> ${escapeHtml(s['supply-group'])}</div>
        <div class="label-line"><strong>Local :</strong> ${escapeHtml(s['supply-room'])}</div>
        <div class="section-title">Élève(s) absent(s) :</div>
        ${supplyLinesHtml(2, absentLines)}
      </div>
      <div>
        <div class="rating-box"><div class="rating-title">Période en général</div>${ratingHtml}</div>
      </div>
    </div>
    <div class="section-title">Travail à faire</div>
    ${workHtml}
    <div class="rules"><strong>Règles :</strong><ul>${rulesLines.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>
    <div class="note-box">${noteHtml || '&nbsp;'}</div>
    ${linksHtml}
    <div class="comments-title">Commentaires sur la période :</div>
    ${supplyLinesHtml(3, commentLines)}
    <div class="footer-line">Laisser le rapport <span>${escapeHtml(s['supply-return'])}</span></div>
      <div style="text-align:right;font-weight:700;font-size:14px;margin-top:8px;">Merci !<br>${escapeHtml(s['supply-teacher'])}</div>
  </div><script>window.onload = function(){ setTimeout(function(){ window.print(); }, 150); };<\/script></body></html>`;
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) { alert('La fenêtre d’impression a été bloquée par le navigateur.'); return; }
  win.document.open();
  win.document.write(doc);
  win.document.close();
}

let _lastRange = null;

function saveRange() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    // Only save if inside a rich-editor
    if (range.commonAncestorContainer.closest && range.commonAncestorContainer.closest('.rich-editor')) {
      _lastRange = range.cloneRange();
    } else if (range.commonAncestorContainer.parentElement && range.commonAncestorContainer.parentElement.closest('.rich-editor')) {
      _lastRange = range.cloneRange();
    }
  }
}

function fmt(cmd) {
  if (_lastRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_lastRange);
  }
  document.execCommand(cmd, false, null);
  hideToolbar();
}

function formatEditorList(editorId, type) {
  const editor = document.getElementById(editorId);
  if (!editor || editor.contentEditable === 'false') return;
  const sel = window.getSelection();
  const currentRange = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  const anchor = currentRange ? (currentRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? currentRange.commonAncestorContainer : currentRange.commonAncestorContainer.parentElement) : null;
  const selectionIsInside = !!(anchor && editor.contains(anchor));
  if (!selectionIsInside) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.execCommand(type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
  editor.focus();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  sauvegarderPlanLocal();
}

const toolbar = document.getElementById('format-toolbar');

function showToolbar(rect) {
  toolbar.style.display = 'flex';
  const top = rect.top - toolbar.offsetHeight - 10;
  const left = rect.left + rect.width / 2;
  toolbar.style.top  = Math.max(8, top) + 'px';
  toolbar.style.left = Math.max(16, Math.min(window.innerWidth - 16, left)) + 'px';
}

function hideToolbar() {
  toolbar.style.display = 'none';
}

document.addEventListener('selectionchange', function() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.toString().trim() === '') {
    hideToolbar();
    return;
  }
  // Check if selection is inside a rich-editor
  const anchor = sel.anchorNode;
  const el = anchor.nodeType === 3 ? anchor.parentElement : anchor;
  if (!el.closest('.rich-editor')) { hideToolbar(); return; }

  saveRange();
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  toolbar.style.display = 'flex';
  const top = rect.top - toolbar.offsetHeight - 10;
  toolbar.style.top  = Math.max(8, top) + 'px';
  toolbar.style.left = Math.max(16, Math.min(window.innerWidth - 16, (rect.left + rect.width / 2))) + 'px';
});

// Hide toolbar on click outside rich editors
document.addEventListener('mousedown', function(e) {
  if (!e.target.closest('.rich-editor') && !e.target.closest('#format-toolbar')) {
    hideToolbar();
  }
});

async function copier() {
  if (!clipboardHTML) return;

  // Method 1 — ClipboardItem API (Chrome / Edge)
  try {
    const blob = new Blob([clipboardHTML], { type: 'text/html' });
    const plainText = htmlVersTexteClassroom(clipboardHTML);
    const plainBlob = new Blob([plainText], { type: 'text/plain' });
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': plainBlob })]);
    afficherCopie();
    return;
  } catch(e) { /* fall through */ }

  // Method 2 — hidden contenteditable + execCommand (Firefox / Safari fallback)
  const temp = document.createElement('div');
  temp.setAttribute('contenteditable', 'true');
  temp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  temp.innerHTML = clipboardHTML;
  document.body.appendChild(temp);

  const range = document.createRange();
  range.selectNodeContents(temp);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  try { document.execCommand('copy'); } catch(e2) { console.warn('copy failed', e2); }
  sel.removeAllRanges();
  document.body.removeChild(temp);
  afficherCopie();
}

function afficherCopie() {
  const btn = document.getElementById('btn-copy');
  btn.classList.add('copied');
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copié !`;
  showToast('Plan copié dans le presse-papiers', 'ok', 2500);
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copier le plan`;
  }, 2500);
}

function reinitialiser() {
  document.getElementById('confirm-reset-overlay').classList.add('open');
}
function closeConfirmReset() {
  document.getElementById('confirm-reset-overlay').classList.remove('open');
}
function reinitialiserConfirmed() {
  closeConfirmReset();
  latestGeneratedText = "";
  latestGeneratedHtml = "";
  currentLoadedCourseId = '';
  currentLoadedSupplyId = '';
  dpDate = new Date();
  document.getElementById('date-cours').value = formatDateStr(dpDate);
  // Reset new options
  document.getElementById('sans-numero').checked = false;
  document.getElementById('num-cours').disabled = false;
  document.getElementById('avec-emojis').checked = true;
  document.getElementById('enable-reuse-course').checked = false;
  toggleReuseCourse();
  document.getElementById('reuse-course-select').value = '';
  initNumCours();
  document.querySelectorAll('.activity-row').forEach(r => r.remove());
  initActivites();
  document.getElementById('devoir').innerHTML = '';
  document.getElementById('devoir').contentEditable = 'true';
  document.getElementById('devoir').removeAttribute('disabled-editor');
  document.getElementById('pas-devoir').checked = false;
  document.getElementById('rappel').innerHTML = '';
  document.getElementById('rappel').contentEditable = 'true';
  document.getElementById('rappel').removeAttribute('disabled-editor');
  document.getElementById('pas-rappel').checked = false;
  document.getElementById('plan-preview').innerHTML = `
    <div class="empty-state">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      <p>Remplissez le formulaire<br>et cliquez sur <em>Générer</em></p>
    </div>`;
  document.getElementById('btn-copy').style.display = 'none';
  document.getElementById('btn-reset').style.display = 'none';
  syncSupplyFromCourse(true);
  effacerPlanLocal();
}


const classroomSelectEl = document.getElementById('classroom-course-select');
if (classroomSelectEl) classroomSelectEl.addEventListener('change', () => { const shareSlot = document.getElementById('share-to-classroom-slot'); if (shareSlot) shareSlot.innerHTML = ''; });

const reuseCourseSelectEl = document.getElementById('reuse-course-select');
if (reuseCourseSelectEl) reuseCourseSelectEl.addEventListener('change', (e) => { updateDeleteCourseButton(); if (e.target.value) loadSavedCourse(e.target.value); });

initDate();
initActivites();
// Init case "Conserver les informations entre les sessions"
(function() {
  const pref = localStorage.getItem(KEEP_FORM_PREF_KEY);
  const cb = document.getElementById('keep-form-filled');
  // Coché par défaut si jamais défini
  const enabled = pref === null ? true : pref === '1';
  if (cb) cb.checked = enabled;
  if (enabled) restaurerPlanLocal();
})();
applySchoolSelection(getCurrentSchoolKey());
refreshGoogleUi();
renderBankList();
renderCourseOptions();
renderSupplyPlanOptions();
initSupplyRuleBank();
applySupplyDefaultsForCurrentUser(true);
syncSupplyFromCourse(true);
updateRoleBasedUi();
setPlanMode('course');
document.getElementById('devoir').addEventListener('input', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('rappel').addEventListener('input', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('pas-devoir').addEventListener('change', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('pas-rappel').addEventListener('change', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('num-cours').addEventListener('input', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('date-cours').addEventListener('change', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('sans-numero').addEventListener('change', () => { sauvegarderPlanLocal(); syncSupplyFromCourse(true); });
document.getElementById('avec-emojis').addEventListener('change', () => { sauvegarderPlanLocal(); });
document.getElementById('enable-reuse-course').addEventListener('change', () => { sauvegarderPlanLocal(); });
document.getElementById('activities-list').addEventListener('input', (e) => { if (e.target.classList.contains('rich-editor')) { sauvegarderPlanLocal(); syncSupplyFromCourse(true); } });
const supplyPanelHost = document.getElementById('left-plan-supply');
const originalSupplyPanel = document.querySelector('#right-tab-supply .google-card');
if (supplyPanelHost && originalSupplyPanel && !supplyPanelHost.hasChildNodes()) supplyPanelHost.appendChild(originalSupplyPanel);
const rightSupplyBtn = document.getElementById('right-tab-btn-supply'); if (rightSupplyBtn) rightSupplyBtn.style.display = 'none';
const rightSupplyPanel = document.getElementById('right-tab-supply'); if (rightSupplyPanel) rightSupplyPanel.style.display = 'none';
const reuseSupplySelectEl = document.getElementById('reuse-supply-select');
if (reuseSupplySelectEl) reuseSupplySelectEl.addEventListener('change', (e) => { updateDeleteSupplyButton(); if (e.target.value) loadSavedSupplyPlan(e.target.value); });

['supply-teacher','supply-subject'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => { saveSupplyProfileForCurrentUser(); sauvegarderPlanLocal(); });
});
['supply-rules','supply-note','supply-return','supply-room','supply-level','supply-group','supply-period','supply-replacement','supply-date'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => { sauvegarderPlanLocal(); });
});
const supplyWorkEl = document.getElementById('supply-work');
if (supplyWorkEl) supplyWorkEl.addEventListener('input', () => { supplyWorkEl.dataset.synced = '0'; sauvegarderPlanLocal(); });
function waitForGoogle(maxMs = 8000) {
  return new Promise(resolve => {
    if (typeof google !== 'undefined' && google?.accounts?.oauth2) { resolve(true); return; }
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (typeof google !== 'undefined' && google?.accounts?.oauth2) { clearInterval(iv); resolve(true); }
      else if (Date.now() - t0 > maxMs) { clearInterval(iv); resolve(false); }
    }, 100);
  });
}
const maybeConnectSilently = async () => {
  const loaded = await waitForGoogle(8000);
  if (!loaded) return;

  initGoogleIdentityClient();

  const hasSessionIntent = hasPersistentGoogleSessionIntent();
  const storedSession = getStoredGoogleSession();
  if (!hasSessionIntent && !(googleAccessToken && googleTokenExpiry)) return;

  if (googleAccessToken && googleTokenExpiry && Date.now() < googleTokenExpiry) {
    setGoogleConnecting(true);
    try {
      await afterGoogleLogin({ refreshUi: true, silent: true });
    } catch (err) {
      googleAccessToken = '';
      googleTokenExpiry = 0;
      localStorage.removeItem('g_access_token');
      localStorage.removeItem('g_access_token_expiry');
      refreshGoogleUi();
    } finally {
      setGoogleConnecting(false);
    }
    return;
  }

  setGoogleConnecting(true);
  try {
    const ok = await trySilentGoogleRefresh(storedSession.email || localStorage.getItem('g_user_hint') || '');
    if (!ok) {
      googleAccessToken = '';
      googleTokenExpiry = 0;
      localStorage.removeItem('g_access_token');
      localStorage.removeItem('g_access_token_expiry');
      googleUser = null;
      refreshGoogleUi();
    }
  } finally {
    setGoogleConnecting(false);
  }
};
// Reconnexion silencieuse automatique au chargement
maybeConnectSilently();
window.addEventListener('beforeunload', () => {
  try {
    if (shouldPersistLocalPlan()) localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(getPlanStateForLocal()));
  } catch (e) {
    console.warn('beforeunload save', e);
  }
});
function openChangelog() {
  document.getElementById('changelog-overlay').classList.add('open');
}
function closeChangelog() {
  document.getElementById('changelog-overlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeChangelog(); closeConfirmReset(); } });
