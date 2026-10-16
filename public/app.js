'use strict';
/* ===== عميل الطالب — اختبار عام (مادة واحدة، محاولة واحدة) =====
 * الواجهة عربية بالكامل (RTL). الإعدادات (العنوان، المدة، رمز المادة) تأتي من
 * /api/exam (المشتق من config.js + bank.js)، لذا لا شيء خاص بالمادة مكتوب هنا.
 * المؤقّت: مدة اسمية، يجري الوقت بسرعة ×٣ أثناء خمول الصفحة، وحدّ فعلي مطلق.
 * تنبيهات الخمول: كل فترة خمول = تنبيه، وكل تنبيهين يخصمان دقيقة من الزمن.
 * مفتاح الإجابة لا يصل إلى المتصفح؛ التصحيح على الخادم، والنتيجة تُستعاد بعد التحميل.
 */

const INACTIVE_MULTIPLIER = 3;
const IDLE_WARN_SEC = 30;        /* كل ٣٠ ثانية بلا تفاعل = تنبيه واحد */
const IDLE_PENALTY_SEC = 60;     /* كل تنبيهين متتاليين = خصم ٦٠ ثانية */
const GRACE_SEC = 3;             /* مهلة سماح صغيرة قبل احتساب التنبيه */

let EX = null;
let CFG = { code: 'exam', titleAr: 'الاختبار', durationMinutes: 60, hardLimitMinutes: 90, totalMarks: 120 };
let state = null;
let tickHandle = null;
let lastTick = 0;
let submitting = false;

const $ = (id) => document.getElementById(id);
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function ar(x){ return String(x).replace(/[0-9]/g, (c) => AR_DIGITS[+c]); }
const uid = () => 'X' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function fmt(sec){ sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60), s = sec % 60; return ar(String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0')); }
function sanitize(name){ return (name || 'student').replace(/[^\w\-\u0600-\u06FF]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'student'; }
function esc(s){ return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
/* مفاتيح التخزين مرتبطة برمز المادة حتى لا تتداخل المواد. */
function lsKey(kind){ return 'exam_' + kind + '_' + CFG.code; }
function saveState(){ try { localStorage.setItem(lsKey('state'), JSON.stringify(state)); } catch(e){} }
function loadState(){ try { return JSON.parse(localStorage.getItem(lsKey('state')) || 'null'); } catch(e){ return null; } }
function saveDone(obj){ try { localStorage.setItem(lsKey('done'), JSON.stringify(obj)); } catch(e){} }
function loadDone(){ try { return JSON.parse(localStorage.getItem(lsKey('done')) || 'null'); } catch(e){ return null; } }
function saveResultSnapshot(snap){ try { localStorage.setItem(lsKey('result'), JSON.stringify(snap)); } catch(e){} }
function loadResultSnapshot(){ try { return JSON.parse(localStorage.getItem(lsKey('result')) || 'null'); } catch(e){ return null; } }
function toast(msg, warn, ms){ const box = $('toast'); if (!box) return; const d = document.createElement('div'); if (warn) d.className = 'warn'; d.textContent = msg; box.appendChild(d); setTimeout(() => d.remove(), ms || 5000); }

/* ---------- التشغيل ---------- */
async function boot(){
  try { EX = await (await fetch('/api/exam', { cache: 'no-store' })).json(); } catch(e){ EX = null; }
  if (EX) {
    CFG = {
      code: EX.code || 'exam',
      titleAr: EX.titleAr || 'الاختبار',
      subjectAr: EX.subjectAr || '',
      gradeAr: EX.gradeAr || '',
      durationMinutes: EX.durationMinutes || 60,
      hardLimitMinutes: EX.hardLimitMinutes || 90,
      totalMarks: EX.totalMarks || 120,
    };
  }
  applyConfigToDom();

  /* إن كانت هناك محاولة مكتملة سابقة، اعرض النتيجة/التحليل بدل شاشة البداية. */
  const done = loadDone();
  if (done && done.examId) { showPastResult(done); return; }

  const srv = await checkAttempt();
  if (srv && srv.blocked) { showBlocked(srv.prior); return; }

  const ls = loadState();
  if (ls && !ls.submitted && ls.answers) showResume();
  wireWelcome();
}
async function checkAttempt(){
  try { const r = await fetch('/api/attempt', { cache: 'no-store' }); return await r.json(); }
  catch(e){ return { ok: true, blocked: false }; }
}
function applyConfigToDom(){
  document.title = CFG.titleAr;
  const t = $('examTitle'); if (t) t.textContent = CFG.titleAr;
  const g = $('examGrade'); if (g) g.textContent = [CFG.subjectAr, CFG.gradeAr].filter(Boolean).join(' — ');
  const d = $('examDuration'); if (d) d.textContent = ar(CFG.durationMinutes);
  const h = $('examHardLimit'); if (h) h.textContent = ar(CFG.hardLimitMinutes);
  const h2 = $('examHardLimit2'); if (h2) h2.textContent = ar(CFG.hardLimitMinutes);
  const tm = $('examTotalMarks'); if (tm) tm.textContent = ar(CFG.totalMarks);
  const tm2 = $('examTotalMarks2'); if (tm2) tm2.textContent = ar(CFG.totalMarks);
}

/* ---------- شاشة محاولة سابقة مكتملة: اعرض النتيجة والتحليل ---------- */
async function showPastResult(done){
  let payload = null;
  try {
    const r = await fetch('/api/result?examId=' + encodeURIComponent(done.examId), { cache: 'no-store' });
    if (r.ok) payload = await r.json();
  } catch(e){}
  const snap = loadResultSnapshot();
  if (payload && payload.ok && payload.result) {
    $('welcome').classList.add('hidden');
    renderResults(payload.result, payload.record || { name: done.name, examId: done.examId, submitReason: payload.record && payload.record.submitReason, timeSpentSec: payload.record && payload.record.timeSpentSec, realElapsedSec: payload.record && payload.record.realElapsedSec, tabSwitchWarnings: payload.record && payload.record.tabSwitchWarnings, idleWarningTotal: payload.record && payload.record.idleWarningTotal, idlePenalties: payload.record && payload.record.idlePenalties }, payload.surprise, true);
  } else if (snap) {
    $('welcome').classList.add('hidden');
    renderResults(snap.result, snap.submission, snap.surprise, true);
    toast('تُعرض نسخة محفوظة في هذا المتصفح؛ تعذّر الاتصال بالخادم للتحقق.', true, 8000);
  } else {
    showBlocked(done);
  }
}

function showBlocked(prior){
  $('welcome').classList.remove('hidden');
  $('blocked').innerHTML = '<div class="warnbanner">لقد سُجّلت محاولة مكتملة سابقًا من هذا الجهاز/الشبكة' +
    (prior && prior.name ? (' للطالب: ' + esc(prior.name)) : '') +
    '. لا يُسمح بمحاولة ثانية لهذه المادة.</div>' +
    '<button class="btn secondary small" id="viewResultBtn" style="margin-top:8px">عرض نتيجة المحاولة</button>';
  const vb = $('viewResultBtn');
  if (vb) vb.onclick = () => { const d = loadDone() || prior; if (d && d.examId) showPastResult(d); };
  $('startBtn').disabled = true;
  $('nameInput').disabled = true;
  $('agree').disabled = true;
}
function showResume(){
  $('resume').innerHTML = '<div class="goodbanner">توجد محاولة غير مكتملة محفوظة في هذا المتصفح. يمكنك المتابعة من حيث توقفت دون فقدان إجاباتك.</div>';
  const b = document.createElement('button');
  b.className = 'btn small secondary'; b.style.marginTop = '8px'; b.textContent = 'استئناف المحاولة';
  b.onclick = () => startExam(true, null);
  $('resume').appendChild(b);
}

/* ---------- شاشة الترحيب ---------- */
function wireWelcome(){
  $('startBtn').onclick = async () => {
    const name = $('nameInput').value.trim();
    if (name.length < 3) { $('startErr').textContent = 'الرجاء إدخال اسم صحيح (٣ أحرف على الأقل).'; return; }
    if (!/^[\p{L}\p{M} .'\-]+$/u.test(name)) { $('startErr').textContent = 'الاسم يحتوي على رموز غير مسموح بها.'; return; }
    if (!$('agree').checked) { $('startErr').textContent = 'يجب تأكيد قراءة التعليمات أولًا.'; return; }
    $('startErr').textContent = '';
    const chk = await checkAttempt();
    if (chk && chk.blocked) { showBlocked(chk.prior); return; }
    startExam(false, name);
  };
}

/* ---------- بدء/استئناف ---------- */
function totalSteps(){ return EX.questions.length + 1; } /* +1 لخطوة التعبير */
function startExam(resume, name){
  if (resume) { state = loadState(); }
  if (!state || !state.answers) {
    const now = Date.now();
    state = {
      examCode: CFG.code, examId: uid(), name: name, startedAt: now,
      answers: {}, writing: '', cur: 0,
      activeElapsed: 0,
      idleWarningTotal: 0,   /* إجمالي التنبيهات (تراكمي، لا يُصفَّر) */
      idleWarnCycle: 0,      /* العدّاد الذي يخصم كل تنبيهين */
      idlePenalties: 0,      /* عدد الخصومات المطبَّقة */
      tabWarnings: 0, lastReturnWarningAt: 0, lastInteractionAt: now,
      submitted: false, submitReason: null, submittedAt: null,
    };
  }
  if (!state.lastInteractionAt) state.lastInteractionAt = Date.now();
  $('welcome').classList.add('hidden');
  $('exam').classList.remove('hidden');
  wireExamControls();
  renderAll();
  startTimer();
  saveState();
}
function wireExamControls(){
  $('prevBtn').onclick = () => go(state.cur - 1);
  $('nextBtn').onclick = () => go(state.cur + 1);
  const toReview = () => { renderReview(); $('exam').classList.add('hidden'); $('review').classList.remove('hidden'); window.scrollTo({ top: 0 }); };
  $('reviewBtn').onclick = toReview;
  $('submitBtn').onclick = toReview;
  $('backBtn').onclick = () => { $('review').classList.add('hidden'); $('exam').classList.remove('hidden'); renderAll(); window.scrollTo({ top: 0 }); };
  $('confirmSubmit').onclick = () => finalSubmit('normal');
}

/* ---------- المؤقّت ---------- */
function markInteraction(){ if (state) state.lastInteractionAt = Date.now(); }
function startTimer(){
  if (tickHandle) clearInterval(tickHandle);
  lastTick = Date.now();
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onVis);
  window.addEventListener('focus', onFocus);
  ['pointerdown','touchstart','mousedown','click','keydown','scroll','input','wheel']
    .forEach((ev) => document.addEventListener(ev, markInteraction, { passive: true }));
  tickHandle = setInterval(tick, 250);
}
function onVis(){
  if (document.hidden) { lastTick = Date.now(); }
  else { applyElapsed(); markInteraction(); }
}
function onFocus(){
  applyElapsed();
  markInteraction();
  const now = Date.now();
  if (state && state.activeElapsed > 5 && now - (state.lastReturnWarningAt || 0) > 8000) {
    state.lastReturnWarningAt = now;
    state.tabWarnings = (state.tabWarnings || 0) + 1;
    toast('تم اكتشاف عودتك إلى الامتحان بعد مغادرة الصفحة. الوقت خارج الصفحة يُحتسب بثلاثة أضعاف.', true);
  }
}
function applyElapsed(){
  const now = Date.now();
  let delta = (now - lastTick) / 1000;
  if (delta < 0) delta = 0;
  if (delta > 300) delta = 300;
  lastTick = now;
  let mult = 1;
  if (document.hidden || !document.hasFocus()) mult = INACTIVE_MULTIPLIER;
  state.activeElapsed += delta * mult;
  checkDeadlines();
}
function tick(){
  applyElapsed();
  if (!state.submitted) checkInactivity();
  renderTimer();
  saveState();
}
/* تنبيهات الخمول: كل فترة خمول = تنبيه واحد (يُحسب مرة واحدة لكل نافذة)،
 * والتنبيهات تتراكم في العدّاد الكلي. وكل تنبيهين متتاليين يخصمان دقيقة. */
function checkInactivity(){
  if (state.submitted) return;
  if (document.hidden || !document.hasFocus()) { state.lastInteractionAt = Date.now(); return; }
  const idle = (Date.now() - (state.lastInteractionAt || Date.now())) / 1000;
  if (idle < IDLE_WARN_SEC + GRACE_SEC) return;
  /* نافذة خمول واحدة = تنبيه واحد: نعيد ضبط مرجع التفاعل فورًا. */
  state.lastInteractionAt = Date.now();
  state.idleWarningTotal = (state.idleWarningTotal || 0) + 1;
  state.idleWarnCycle = (state.idleWarnCycle || 0) + 1;
  toast('تنبيه: لم يُرصد أي تفاعل لمدة ٣٠ ثانية. إجمالي التنبيهات: ' + ar(state.idleWarningTotal) + '.', true, 6000);
  renderWarnBadge();
  if (state.idleWarnCycle >= 2) {
    state.idleWarnCycle = 0;
    state.idlePenalties = (state.idlePenalties || 0) + 1;
    state.activeElapsed += IDLE_PENALTY_SEC;
    toast('تم خصم دقيقة واحدة من زمن الامتحان بسبب تنبيهَي الخمول.', true, 7000);
    renderWarnBadge();
    checkDeadlines();
  }
  saveState();
}
function checkDeadlines(){
  if (state.submitted) return;
  const remain = CFG.durationMinutes * 60 - state.activeElapsed;
  const hardRemain = CFG.hardLimitMinutes * 60 - (Date.now() - state.startedAt) / 1000;
  if (remain <= 0) autoSubmit('timeup_60');
  else if (hardRemain <= 0) autoSubmit('timeup_90');
}
function renderTimer(){
  const remain = CFG.durationMinutes * 60 - state.activeElapsed;
  const el = $('timer'); if (!el) return;
  el.textContent = fmt(remain);
  el.classList.toggle('warn', remain <= 600 && remain > 120);
  el.classList.toggle('danger', remain <= 120);
  if (remain <= 300 && remain > 240 && !state._warn5) { state._warn5 = true; toast('تنبيه: بقي أقل من ٥ دقائق!', true); }
  if (remain <= 60 && remain > 30 && !state._warn1) { state._warn1 = true; toast('تنبيه: بقي أقل من دقيقة واحدة!', true); }
}
function renderWarnBadge(){
  const b = $('warnBadge'); if (!b) return;
  b.textContent = 'تنبيهات الخمول: ' + ar(state.idleWarningTotal || 0) +
    ((state.idlePenalties || 0) ? (' — خصومات: ' + ar(state.idlePenalties) + ' د') : '');
}

/* ---------- العرض ---------- */
function sectionAr(sec){ const b = (EX.blueprint || []).find((x) => x.section === sec); if (b) return b.arName; return sec === 'surprise' ? 'سؤال' : sec; }
function isAnswered(qid){ const a = state.answers[qid]; return a !== undefined && a !== null && a !== ''; }
function go(i){ if (!state) return; state.cur = Math.max(0, Math.min(i, totalSteps() - 1)); saveState(); renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function renderAll(){ if (!state.submitted) { renderProgress(); renderNav(); renderQuestionCard(); } }
function renderProgress(){
  const ans = EX.questions.filter((q) => isAnswered(q.id)).length;
  $('qProgress').textContent = ar(ans) + '/' + ar(EX.questions.length) + ' سؤال مُجاب';
  $('progBar').style.width = (ans / EX.questions.length * 100) + '%';
  renderWarnBadge();
}
function renderNav(){
  const g = $('navGrid'); g.innerHTML = '';
  EX.questions.forEach((q, i) => {
    const b = document.createElement('button');
    b.textContent = ar(i + 1);
    b.className = (isAnswered(q.id) ? 'ans ' : '') + (i === state.cur ? 'cur' : '');
    b.title = sectionAr(q.section);
    b.setAttribute('aria-label', 'سؤال ' + ar(i + 1));
    b.onclick = () => go(i);
    g.appendChild(b);
  });
  const w = document.createElement('button');
  w.textContent = 'ت';
  const wi = EX.questions.length;
  w.className = ((state.writing && state.writing.trim()) ? 'ans ' : '') + (wi === state.cur ? 'cur' : '');
  w.title = 'التعبير';
  w.setAttribute('aria-label', 'سؤال التعبير');
  w.onclick = () => go(wi);
  g.appendChild(w);
}
function passagesFor(q){
  if (q.section !== 'reading') return [];
  const all = EX.readingPassages || [];
  if (all.length <= 1) return all;
  /* أول نص لكل موضوع، وإلا فكل النصوص. */
  const match = all.filter((p) => q.topic && (q.topic.indexOf(p.title) >= 0 || (p.title && p.title.indexOf(q.topic) >= 0)));
  if (match.length) return match;
  if (/متحرر/.test(q.topic || '')) return all.filter((p) => /متحرر|RD2/.test(p.title + p.id));
  return all;
}
function renderQuestionCard(){
  const i = state.cur;
  const card = $('questionCard');
  if (i >= EX.questions.length) return renderWritingCard(card);
  const q = EX.questions[i];
  $('secTitle').textContent = sectionAr(q.section);
  $('sectionBadge').textContent = sectionAr(q.section);
  card.innerHTML = '<div class="badge">سؤال ' + ar(i + 1) + ' من ' + ar(EX.questions.length) + ' — ' + ar(q.marks) + ' درجة</div>' +
    '<div class="qtext">' + esc(q.q) + '</div>';

  const ps = passagesFor(q);
  if (ps.length) {
    let inner = '';
    ps.forEach((p) => { inner += '<div class="passage"><b>' + esc(p.title) + '</b><p>' + esc(p.text) + '</p></div>'; });
    card.insertAdjacentHTML('beforeend', '<details class="rev" open><summary>نص القراءة</summary>' + inner + '</details>');
  }

  const chosen = state.answers[q.id];
  q.options.forEach((opt) => {
    const label = document.createElement('label');
    label.className = 'opt' + (String(chosen) === String(opt) ? ' sel' : '');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'q_' + q.id;
    input.checked = String(chosen) === String(opt);
    input.onchange = () => { state.answers[q.id] = opt; saveState(); renderNav(); renderProgress(); renderQuestionCard(); };
    const span = document.createElement('span');
    span.textContent = opt;
    label.appendChild(input); label.appendChild(span);
    card.appendChild(label);
  });
}
function renderWritingCard(card){
  $('secTitle').textContent = 'التعبير (المقالي)';
  $('sectionBadge').textContent = 'التعبير';
  card.innerHTML = '<div class="badge">سؤال التعبير — ' + ar(EX.writingMarks) + ' درجة</div>' +
    '<div class="qtext">' + esc(EX.writingPrompt) + '</div>' +
    '<textarea id="writingBox" dir="rtl" lang="ar" rows="10" placeholder="اكتب فقرتك هنا باللغة العربية..." aria-label="إجابة التعبير"></textarea>' +
    '<div class="muted small">تُحفظ إجابتك تلقائيًّا أثناء الكتابة، وتُصحَّح يدويًّا بعد التسليم.</div>';
  const box = $('writingBox');
  box.value = state.writing || '';
  let t = null;
  box.addEventListener('input', () => { markInteraction(); clearTimeout(t); t = setTimeout(() => { state.writing = box.value; saveState(); renderNav(); }, 500); });
}

/* ---------- المراجعة ---------- */
function unansweredList(){ return EX.questions.filter((q) => !isAnswered(q.id)); }
function renderReview(){
  const miss = unansweredList();
  const wc = (state.writing || '').trim() ? (state.writing.trim().split(/\s+/).length) : 0;
  let html = '<p>عدد الأسئلة غير المُجابة: <b>' + ar(miss.length) + '</b>.</p>';
  if (miss.length) {
    html += '<div class="sectionwrap">';
    miss.forEach((q) => { const idx = EX.questions.indexOf(q); html += '<div class="muted small">سؤال ' + ar(idx + 1) + ' — ' + esc(sectionAr(q.section)) + '</div>'; });
    html += '</div>';
  } else { html += '<div class="goodbanner">أجبت عن جميع الأسئلة الموضوعية.</div>'; }
  html += '<p>سؤال التعبير: <b>' + (wc ? ('مكتوب (' + ar(wc) + ' كلمة)') : 'لم يُكتب بعد') + '</b>.</p>';
  html += '<p class="muted small">تنبيهات الخمول حتى الآن: ' + ar(state.idleWarningTotal || 0) + ' — خصومات الوقت: ' + ar(state.idlePenalties || 0) + ' دقيقة.</p>';
  html += '<p class="muted small">بعد التسليم لا يمكن تعديل الإجابات. تُصحَّح الأسئلة الموضوعية فورًا، وتبقى درجة التعبير قيد الانتظار حتى يرصدها المصحح.</p>';
  $('reviewBody').innerHTML = html;
}

/* ---------- التسليم ---------- */
function autoSubmit(reason){ finalSubmit(reason); }
async function finalSubmit(reason){
  if (submitting || state.submitted) return;
  submitting = true;
  state.submitReason = reason;
  state.submittedAt = Date.now();
  const realElapsed = Math.round((state.submittedAt - state.startedAt) / 1000);
  const submission = {
    examId: state.examId, name: state.name, startedAt: state.startedAt,
    submittedAt: state.submittedAt, submitReason: reason,
    answers: state.answers, writing: state.writing,
    timeSpentSec: Math.round(state.activeElapsed), realElapsedSec: realElapsed,
    tabSwitchWarnings: state.tabWarnings || 0,
    idleWarningTotal: state.idleWarningTotal || 0,
    idleWarnCycle: state.idleWarnCycle || 0,
    idlePenalties: state.idlePenalties || 0,
  };
  let result = null, surprise = null;
  try {
    const r = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission }) });
    const j = await r.json();
    result = j.result; surprise = j.surprise;
  } catch(e) { /* بلا اتصال: نعرض ملخصًا ونسمح بالتصدير */ }
  state.submitted = true;
  state.surprise = surprise ? { correct: surprise.correct, total: surprise.total, bonusTotal: surprise.bonusTotal } : null;
  saveState();
  if (tickHandle) clearInterval(tickHandle);
  saveDone({ examId: state.examId, name: state.name, submittedAt: state.submittedAt, examCode: CFG.code });
  if (result) {
    saveResultSnapshot({ result, submission, surprise });
    renderResults(result, submission, surprise, false);
  } else {
    renderResultsOffline(submission);
  }
  submitting = false;
}
function reasonAr(r){ return { normal: 'تسليم يدوي', timeup_60: 'انتهاء الوقت الاسمي', timeup_90: 'بلوغ الحد الفعلي' }[r] || r; }

/* ---------- شاشة النتيجة والتحليل ---------- */
function gradeBand(pct){
  if (pct >= 90) return { label: 'ممتاز', cls: 'band-a' };
  if (pct >= 80) return { label: 'جيد جدًّا', cls: 'band-b' };
  if (pct >= 70) return { label: 'جيد', cls: 'band-c' };
  if (pct >= 60) return { label: 'مقبول', cls: 'band-d' };
  if (pct >= 50) return { label: 'ضعيف', cls: 'band-e' };
  return { label: 'راسب', cls: 'band-f' };
}
function renderResults(result, submission, surprise, fromReload){
  const b = result.bySection || {};
  const objMax = result.objectiveMax || 0;
  const pct = objMax ? Math.round(result.objective / objMax * 100) : 0;
  const band = gradeBand(pct);

  /* تحليل الأقسام: شريط لكل قسم + عدد الصحيح. */
  let rows = '';
  (EX.blueprint || []).forEach((bp) => {
    if (bp.section === 'writing') {
      rows += '<div class="bar-row"><div class="bar-head"><span>' + esc(bp.arName) + '</span><b><span class="pill pending">قيد الانتظار / ' + ar(bp.max) + '</span></b></div>' +
        '<div class="bar"><span class="pending" style="width:100%"></span></div></div>';
      return;
    }
    const s = b[bp.section] || { score: 0, max: bp.max, correct: 0, count: bp.count };
    const p = s.max ? Math.round(s.score / s.max * 100) : 0;
    const cls = p >= 80 ? 'ok' : (p >= 50 ? 'mid' : 'low');
    rows += '<div class="bar-row"><div class="bar-head"><span>' + esc(bp.arName) + '</span>' +
      '<b>' + ar(s.score) + ' / ' + ar(s.max) + ' <span class="muted small">(' + ar(s.correct || 0) + '/' + ar(s.count || bp.count) + ')</span></b></div>' +
      '<div class="bar"><span class="' + cls + '" style="width:' + p + '%"></span></div></div>';
  });

  /* الأسئلة الخاطئة وغير المُجابة. */
  const details = (result.details || []);
  const wrong = details.filter((d) => d.answered && !d.correct);
  const blank = details.filter((d) => !d.answered);
  let analysis = '';
  if (wrong.length) {
    analysis += '<h3>الأسئلة الخاطئة (' + ar(wrong.length) + ')</h3><div class="sectionwrap">';
    wrong.forEach((d) => {
      analysis += '<details class="rev"><summary>' + esc(d.id) + ' — ' + esc(sectionAr(d.section)) + '</summary>' +
        '<div><p><b>' + esc(d.question) + '</b></p>' +
        '<p>إجابتك: <span class="wrong">' + esc(d.studentAnswer) + '</span></p>' +
        '<p>الصواب: <span class="right">' + esc(d.correctAnswer) + '</span></p>' +
        (d.explanation ? '<div class="explain">' + esc(d.explanation) + '</div>' : '') + '</div></details>';
    });
    analysis += '</div>';
  }
  if (blank.length) {
    analysis += '<h3>أسئلة لم تُجب عنها (' + ar(blank.length) + ')</h3><div class="sectionwrap">';
    blank.forEach((d) => { analysis += '<div class="muted small">' + esc(d.id) + ' — ' + esc(sectionAr(d.section)) + '</div>'; });
    analysis += '</div>';
  }
  if (!wrong.length && !blank.length) analysis = '<div class="goodbanner">لا توجد أخطاء في الأسئلة الموضوعية.</div>';

  /* الأسئلة المفاجئة (نقاط منفصلة). */
  let extra = '';
  if (surprise && surprise.details) {
    const sc = surprise.correct || 0;
    extra = '<div class="goodbanner">أسئلة إضافية (نقاط منفصلة عن الدرجة الرسمية): ' +
      ar(sc) + ' من ' + ar(surprise.total) + ' — مكافأة: ' + ar(surprise.bonusTotal || 0) + ' نقطة.</div>';
  }

  /* ملخّص الوقت والتنبيهات. */
  const warns = submission.idleWarningTotal != null ? submission.idleWarningTotal : (submission.idleWarnings || 0);
  const pens = submission.idlePenalties || 0;
  const mins = Math.round((submission.timeSpentSec || 0) / 60);
  const timing = '<div class="sectionwrap">' +
    '<div class="stat"><span>الزمن المستغرق</span><b>' + ar(mins) + ' دقيقة</b></div>' +
    '<div class="stat"><span>تنبيهات الخمول (إجمالي)</span><b>' + ar(warns) + '</b></div>' +
    '<div class="stat"><span>خصومات الخمول</span><b>' + ar(pens) + ' دقيقة</b></div>' +
    '<div class="stat"><span>تنبيهات مغادرة الصفحة</span><b>' + ar(submission.tabSwitchWarnings || 0) + '</b></div>' +
    '</div>';

  const title = fromReload ? 'نتيجة محاولتك' : 'تم التسليم';
  $('results').innerHTML =
    '<div class="card">' +
    '<h2>' + title + ' — ' + esc(submission.name || state.name || '') + '</h2>' +
    '<p class="muted">رقم الامتحان: <span dir="ltr">' + esc(submission.examId || state.examId) + '</span> — السبب: ' + esc(reasonAr(submission.submitReason)) + '</p>' +
    extra +
    '<div class="score-hero ' + band.cls + '">' +
    '<div class="score-num">' + ar(result.objective) + ' <span class="muted">/ ' + ar(objMax) + '</span></div>' +
    '<div class="score-sub">الدرجة الموضوعية — التقدير: ' + band.label + ' (' + ar(pct) + '%)</div>' +
    '<div class="score-note">التعبير (' + ar(EX.writingMarks) + ' درجة) قيد الانتظار حتى يرصده المصحح، ثم تُحتسب الدرجة النهائية من ' + ar(CFG.totalMarks) + '.</div>' +
    '</div>' +
    '<h3>تحليل الأقسام</h3>' + rows +
    '<h3>الوقت والتنبيهات</h3>' + timing +
    '<div class="row"><button class="btn" id="exportBtn">تصدير الإجابات (JSON)</button>' +
    '<button class="btn secondary" id="reportBtn">تصدير تقرير مقروء (HTML)</button>' +
    '<button class="btn ghost" id="printBtn">طباعة / حفظ PDF</button></div>' +
    '<div id="exportMsg" class="muted small"></div>' +
    '</div>' +
    '<div class="card"><h3>تحليل الإجابات</h3>' + analysis + '</div>';

  $('exportBtn').onclick = () => downloadExport(result, submission, surprise);
  $('reportBtn').onclick = () => downloadReport(result, submission, surprise);
  $('printBtn').onclick = () => window.print();
  window.scrollTo({ top: 0 });
}
function renderResultsOffline(submission){
  let rows = '';
  (EX.blueprint || []).forEach((bp) => { rows += '<div class="stat"><span>' + esc(bp.arName) + '</span><b>' + ar(bp.max) + ' درجة</b></div>'; });
  $('results').innerHTML = '<div class="card"><h2>ملخص التسليم</h2>' +
    '<p class="muted">سبب التسليم: ' + esc(reasonAr(submission.submitReason)) + ' — رقم الامتحان: <span dir="ltr">' + esc(submission.examId) + '</span></p>' +
    '<div class="sectionwrap">' + rows + '</div>' +
    '<p class="warnbanner">لم يتوفر تصحيح فوري لعدم الوصول للخادم. يمكنك تصدير إجاباتك الآن، وسيحتاج المصحح لتصحيحها يدويًّا.</p>' +
    '<button class="btn" id="exportBtn2">تصدير الإجابات (ملف JSON)</button>' +
    '<div id="exportMsg"></div></div>';
  $('exportBtn2').onclick = () => downloadExport(null, submission, null);
}

/* ---------- التصدير ---------- */
function dl(filename, text, mime){
  try {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    const m = $('exportMsg'); if (m) m.textContent = 'تم تنزيل الملف: ' + filename + ' (افتحه من مجلد التنزيلات).';
  } catch(e) { const m = $('exportMsg'); if (m) m.textContent = 'تعذّر التنزيل على هذا المتصفح.'; }
}
function buildRecord(result, submission, surprise){
  const writing = (state && state.writing) || submission.writing || '';
  const words = writing.trim() ? writing.trim().split(/\s+/).length : 0;
  const rubric = (EX.writingRubric || []).map((r) => ({ criterion: r.ar, max: r.marks, awarded: null }));
  const detail = result ? (result.details || []).map((d) => ({
    id: d.id, section: d.section, question: d.question, choices: d.options, marks: d.marks,
    studentAnswer: d.studentAnswer, correctAnswer: d.correctAnswer, correct: d.correct,
    answered: d.answered, explanation: d.explanation,
  })) : [];
  return {
    schema: 'Exam/' + CFG.code + '/v1',
    examCode: CFG.code, examId: submission.examId, studentName: submission.name,
    startedAt: submission.startedAt, submittedAt: submission.submittedAt,
    submitReason: submission.submitReason,
    timeSpentSec: submission.timeSpentSec, realElapsedSec: submission.realElapsedSec,
    tabSwitchWarnings: submission.tabSwitchWarnings,
    idleWarningTotal: submission.idleWarningTotal != null ? submission.idleWarningTotal : submission.idleWarnings,
    idlePenalties: submission.idlePenalties,
    totalExamMarks: CFG.totalMarks,
    objectiveScore: result ? result.objective : null, objectiveMax: result ? result.objectiveMax : null,
    correctCount: result ? result.correct : null,
    answeredCount: result ? result.answered : null,
    unansweredCount: result ? result.unanswered : null,
    bySection: result ? result.bySection : null,
    extraAnswers: surprise ? { correct: surprise.correct, total: surprise.total, bonusTotal: surprise.bonusTotal, note: 'منفصلة عن الدرجة الرسمية' } : null,
    writing: { prompt: EX.writingPrompt, response: writing, wordCount: words, gradeStatus: 'pending', rubric },
    questions: detail,
    answers: submission.answers,
  };
}
function downloadExport(result, submission, surprise){
  const rec = buildRecord(result, submission, surprise);
  dl('Exam_' + sanitize(submission.name) + '_' + submission.examId + '.json', JSON.stringify(rec, null, 2), 'application/json');
}
function downloadReport(result, submission, surprise){
  const rec = buildRecord(result, submission, surprise);
  let rows = '';
  (EX.blueprint || []).forEach((bp) => {
    if (bp.section === 'writing') return;
    const s = (rec.bySection || {})[bp.section] || { score: '-', max: bp.max };
    rows += '<tr><td>' + esc(bp.arName) + '</td><td>' + s.score + ' / ' + s.max + '</td></tr>';
  });
  const qs = rec.questions.map((q) => '<tr><td>' + esc(q.id) + '</td><td>' + (q.correct ? 'صحيحة' : (q.answered ? 'خاطئة' : 'بدون إجابة')) + '</td><td>' + esc(q.studentAnswer || '-') + '</td><td>' + esc(q.correctAnswer) + '</td></tr>').join('');
  const html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ' + esc(rec.examId) + '</title>' +
    '<style>body{font-family:sans-serif;margin:24px;direction:rtl}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:right}</style></head><body>' +
    '<h1>تقرير ' + esc(CFG.titleAr) + '</h1>' +
    '<p>الطالب: ' + esc(rec.studentName) + ' | رقم الامتحان: ' + esc(rec.examId) + '</p>' +
    '<p>وقت التسليم: ' + new Date(rec.submittedAt).toISOString() + ' | السبب: ' + esc(reasonAr(rec.submitReason)) + '</p>' +
    '<p>الدرجة الموضوعية: ' + rec.objectiveScore + ' / ' + rec.objectiveMax + ' | التعبير: قيد الانتظار / ' + (EX.writingMarks) + '</p>' +
    '<p>تنبيهات الخمول: ' + rec.idleWarningTotal + ' | خصومات: ' + rec.idlePenalties + ' دقيقة</p>' +
    '<h2>درجات الأقسام</h2><table>' + rows + '</table>' +
    '<h2>إجابة التعبير</h2><pre style="white-space:pre-wrap;border:1px solid #ccc;padding:10px;direction:rtl">' + esc(rec.writing.response) + '</pre>' +
    '<h2>تفصيل الإجابات</h2><table><tr><th>المعرّف</th><th>النتيجة</th><th>إجابة الطالب</th><th>الإجابة الصحيحة</th></tr>' + qs + '</table>' +
    '</body></html>';
  dl('Exam_Report_' + sanitize(rec.studentName) + '_' + rec.examId + '.html', html, 'text/html');
}

boot();
