'use strict';
/* ===== اختبار اللغة العربية — الوحدة الأولى — عميل الطالب =====
 * الواجهة عربية بالكامل (RTL)، والمحتوى عربي.
 * المؤقّت: ٦٠ دقيقة اسمية، يجري الوقت بسرعة ×٣ أثناء خمول الصفحة، وحدّ فعلي ٩٠ دقيقة.
 * تنبيهات الخمول: كل ٣٠ ثانية بلا تفاعل تُحتسب تنبيهًا، وكل تنبيهين يخصمان دقيقة.
 * مفتاح الإجابة لا يصل إلى المتصفح أبدًا؛ التصحيح يجري على الخادم عند التسليم.
 */

const TOTAL_MARKS = 120;
const DURATION_MIN = 60;
const HARD_LIMIT_MIN = 90;
const INACTIVE_MULTIPLIER = 3;
const IDLE_WARN_SEC = 30;        /* ٣٠ ثانية بلا تفاعل = تنبيه */
const IDLE_PENALTY_SEC = 60;     /* كل تنبيهين = خصم ٦٠ ثانية */
const LS_KEY = 'ar_u1_exam_state_v1';
const LS_DONE = 'ar_u1_exam_done_v1';

let EX = null;
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
function saveState(){ try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){} }
function loadState(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch(e){ return null; } }
function toast(msg, warn, ms){ const box = $('toast'); const d = document.createElement('div'); if (warn) d.className = 'warn'; d.textContent = msg; box.appendChild(d); setTimeout(() => d.remove(), ms || 5000); }

/* ---------- التشغيل ---------- */
async function boot(){
  await fetchExam();
  const done = localStorage.getItem(LS_DONE);
  const srv = await checkAttempt();
  if (done || (srv && srv.blocked)) { showBlocked(done ? null : srv.prior); return; }
  const ls = loadState();
  if (ls && !ls.submitted && ls.answers) showResume();
  wireWelcome();
}
async function fetchExam(){
  const r = await fetch('/api/exam', { cache: 'no-store' });
  EX = await r.json();
}
async function checkAttempt(){
  try { const r = await fetch('/api/attempt', { cache: 'no-store' }); return await r.json(); }
  catch(e){ return { ok: true, blocked: false }; }
}

function showBlocked(prior){
  $('blocked').innerHTML = '<div class="warnbanner">لقد سُجّلت محاولة مكتملة سابقًا من هذا الجهاز/الشبكة' +
    (prior && prior.name ? (' للطالب: ' + esc(prior.name)) : '') +
    '. لا يُسمح بمحاولة ثانية. يمكن للمصحح الوصول إلى التقرير الكامل في مجلد data على الخادم، أو إلى ملف التصدير الذي حصل عليه الطالب.</div>';
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
      examId: uid(), name: name, startedAt: now,
      answers: {}, writing: '', cur: 0,
      activeElapsed: 0, idleWarnings: 0, idlePenalties: 0,
      tabWarnings: 0, lastReturnWarningAt: 0, lastInteractionAt: now,
      submitted: false, submitReason: null, submittedAt: null, surprise: null,
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
  $('reviewBtn').onclick = () => { renderReview(); $('exam').classList.add('hidden'); $('review').classList.remove('hidden'); window.scrollTo({ top: 0 }); };
  $('submitBtn').onclick = () => { renderReview(); $('exam').classList.add('hidden'); $('review').classList.remove('hidden'); window.scrollTo({ top: 0 }); };
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
/* تنبيهات الخمول: كل ٣٠ ثانية بلا تفاعل = تنبيه، وكل تنبيهين = خصم ٦٠ ثانية */
function checkInactivity(){
  if (state.submitted) return;
  if (document.hidden || !document.hasFocus()) { state.lastInteractionAt = Date.now(); return; }
  const idle = (Date.now() - (state.lastInteractionAt || Date.now())) / 1000;
  if (idle < IDLE_WARN_SEC) return;
  /* نافذة ٣٠ ثانية واحدة = تنبيه واحد */
  state.lastInteractionAt = Date.now();
  state.idleWarnings = (state.idleWarnings || 0) + 1;
  toast('تنبيه: لم يُرصد أي تفاعل لمدة ٣٠ ثانية. عدد التنبيهات: ' + ar(state.idleWarnings) + '.', true, 6000);
  renderWarnBadge();
  if (state.idleWarnings >= 2) {
    state.idleWarnings = 0;
    state.idlePenalties = (state.idlePenalties || 0) + 1;
    state.activeElapsed += IDLE_PENALTY_SEC;
    toast('تم خصم دقيقة واحدة من زمن الامتحان بسبب تنبيهَي الخمول.', true, 7000);
    renderWarnBadge();
    checkDeadlines();
  }
}
function checkDeadlines(){
  if (state.submitted) return;
  const remain = DURATION_MIN * 60 - state.activeElapsed;
  const hardRemain = HARD_LIMIT_MIN * 60 - (Date.now() - state.startedAt) / 1000;
  if (remain <= 0) autoSubmit('timeup_60');
  else if (hardRemain <= 0) autoSubmit('timeup_90');
}
function renderTimer(){
  const remain = DURATION_MIN * 60 - state.activeElapsed;
  const el = $('timer'); el.textContent = fmt(remain);
  el.classList.toggle('warn', remain <= 600 && remain > 120);
  el.classList.toggle('danger', remain <= 120);
  if (remain <= 300 && remain > 240 && !state._warn5) { state._warn5 = true; toast('تنبيه: بقي أقل من ٥ دقائق!', true); }
  if (remain <= 60 && remain > 30 && !state._warn1) { state._warn1 = true; toast('تنبيه: بقي أقل من دقيقة واحدة!', true); }
}
function renderWarnBadge(){ const b = $('warnBadge'); if (b) b.textContent = 'تنبيهات الخمول: ' + ar(state.idleWarnings || 0); }

/* ---------- العرض ---------- */
function sectionAr(sec){ const b = EX.blueprint.find((x) => x.section === sec); if (b) return b.arName; return sec === 'surprise' ? 'سؤال' : sec; }
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
  if (q.topic === 'قطعة القراءة المتحررة') return EX.readingPassages.filter((p) => p.id === 'RD2');
  if (q.topic === 'العلم بين القانون والضمير') return EX.readingPassages.filter((p) => p.id === 'RD1');
  return EX.readingPassages;
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
    card.insertAdjacentHTML('beforeend',
      '<details class="rev" open><summary>نص القراءة</summary>' + inner + '</details>');
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
    idleWarnings: state.idleWarnings || 0, idlePenalties: state.idlePenalties || 0,
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
  localStorage.setItem(LS_DONE, JSON.stringify({ examId: state.examId, name: state.name, submittedAt: state.submittedAt }));
  $('exam').classList.add('hidden'); $('review').classList.add('hidden'); $('welcome').classList.add('hidden');
  if (result) renderResults(result, submission, surprise); else renderResultsOffline(submission);
  submitting = false;
}
function reasonAr(r){ return { normal: 'تسليم يدوي', timeup_60: 'انتهاء الوقت (٦٠ دقيقة)', timeup_90: 'بلوغ الحد الفعلي (٩٠ دقيقة)' }[r] || r; }

function renderResults(result, submission, surprise){
  const b = result.bySection || {};
  let rows = '';
  EX.blueprint.forEach((bp) => {
    if (bp.section === 'writing') { rows += '<div class="stat"><span>' + esc(bp.arName) + '</span><b><span class="pill pending">قيد الانتظار / ' + ar(bp.max) + '</span></b></div>'; return; }
    const s = b[bp.section] || { score: 0, max: bp.max };
    rows += '<div class="stat"><span>' + esc(bp.arName) + '</span><b>' + ar(s.score) + ' / ' + ar(s.max) + '</b></div>';
  });
  let extra = '';
  if (surprise && surprise.correct > 0) {
    extra = '<div class="goodbanner">إجابات إضافية صحيحة (منفصلة عن الدرجة الرسمية): ' + ar(surprise.correct) + ' من ' + ar(surprise.total) + '.</div>';
  }
  $('results').innerHTML =
    '<div class="card">' +
    '<h2>تم التسليم — ' + esc(state.name) + '</h2>' +
    '<p class="muted">رقم الامتحان: <span dir="ltr">' + esc(state.examId) + '</span> — سبب التسليم: ' + reasonAr(submission.submitReason) + '</p>' +
    extra +
    '<div class="sectionwrap">' +
    '<div class="stat"><span>الدرجة الموضوعية (فورية)</span><b>' + ar(result.objective) + ' / ' + ar(result.objectiveMax) + '</b></div>' +
    rows +
    '<div class="stat"><span>الدرجة النهائية</span><b><span class="pill pending">قيد الانتظار</span> — تظهر بعد رصد التعبير</b></div>' +
    '</div>' +
    '<p class="muted small">الدرجة الرسمية للامتحان = ' + ar(TOTAL_MARKS) + '. وتُعرض أي نقاط إضافية بشكل منفصل ولا تزيد الدرجة الرسمية.</p>' +
    '<div class="row"><button class="btn" id="exportBtn">تصدير الإجابات (ملف JSON)</button>' +
    '<button class="btn secondary" id="reportBtn">تصدير تقرير مقروء (HTML)</button></div>' +
    '<div id="exportMsg" class="muted small"></div>' +
    '</div>' +
    '<div class="card"><h3>مراجعة الأسئلة (بعد التسليم فقط)</h3><div id="reviewList"></div></div>';

  $('exportBtn').onclick = () => downloadExport(result, submission, surprise);
  $('reportBtn').onclick = () => downloadReport(result, submission, surprise);
  renderAnswerReview(result, surprise);
  window.scrollTo({ top: 0 });
}
function renderAnswerReview(result, surprise){
  const host = $('reviewList');
  const groups = {};
  const all = result.details.concat(surprise ? surprise.details : []);
  all.forEach((d) => { (groups[d.section] = groups[d.section] || []).push(d); });
  let html = '';
  Object.keys(groups).forEach((sec) => {
    html += '<div class="sectionwrap"><h3>' + esc(sectionAr(sec)) + '</h3>';
    groups[sec].forEach((d) => {
      const mark = d.correct ? '<span class="pill done">صحيحة</span>' : (d.answered ? '<span class="pill" style="background:#34161a;color:#fecaca">خاطئة</span>' : '<span class="pill" style="background:#243447">بدون إجابة</span>');
      html += '<details class="rev"><summary>' + esc(d.id) + ' ' + mark + ' <span class="muted">' + esc(String(d.question).slice(0, 60)) + '</span></summary>' +
        '<div><p><b>' + esc(d.question) + '</b></p>' +
        '<p>إجابتك: ' + (d.answered ? esc(d.studentAnswer) : '<i>لم تُجب</i>') + '</p>' +
        '<p>الإجابة الصحيحة: ' + esc(d.correctAnswer) + '</p></div>' +
        '<div class="explain">' + esc(d.explanation) + '</div></details>';
    });
    html += '</div>';
  });
  host.innerHTML = html;
}
function renderResultsOffline(submission){
  let rows = '';
  EX.blueprint.forEach((bp) => { rows += '<div class="stat"><span>' + esc(bp.arName) + '</span><b>' + ar(bp.max) + ' درجة</b></div>'; });
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
    $('exportMsg').textContent = 'تم تنزيل الملف: ' + filename + ' (افتحه من مجلد التنزيلات).';
  } catch(e) { $('exportMsg').textContent = 'تعذّر التنزيل على هذا المتصفح.'; }
}
function buildRecord(result, submission, surprise){
  const writing = state.writing || '';
  const words = writing.trim() ? writing.trim().split(/\s+/).length : 0;
  const rubric = (EX.writingRubric || []).map((r) => ({ criterion: r.ar, max: r.marks, awarded: null }));
  const detail = result ? result.details.map((d) => ({
    id: d.id, section: d.section, question: d.question, choices: d.options, marks: d.marks,
    studentAnswer: d.studentAnswer, correctAnswer: d.correctAnswer, correct: d.correct,
    answered: d.answered, explanation: d.explanation,
  })) : [];
  return {
    schema: 'Arabic-Exam-U1/v1',
    examId: state.examId, studentName: state.name,
    startedAt: state.startedAt, submittedAt: state.submittedAt,
    submitReason: submission.submitReason,
    timeSpentSec: submission.timeSpentSec, realElapsedSec: submission.realElapsedSec,
    tabSwitchWarnings: submission.tabSwitchWarnings,
    idleWarnings: submission.idleWarnings, idlePenalties: submission.idlePenalties,
    totalExamMarks: TOTAL_MARKS,
    objectiveScore: result ? result.objective : null, objectiveMax: result ? result.objectiveMax : null,
    correctCount: result ? result.correct : null,
    answeredCount: result ? result.answered : null,
    unansweredCount: result ? result.unanswered : null,
    bySection: result ? result.bySection : null,
    extraAnswers: surprise ? { correct: surprise.correct, total: surprise.total, note: 'منفصلة عن الدرجة الرسمية' } : null,
    writing: { prompt: EX.writingPrompt, response: writing, wordCount: words, gradeStatus: 'pending', rubric },
    questions: detail,
    answers: state.answers,
  };
}
function downloadExport(result, submission, surprise){
  const rec = buildRecord(result, submission, surprise);
  const fn = 'Arabic_Unit1_' + sanitize(state.name) + '_' + state.examId + '.json';
  dl(fn, JSON.stringify(rec, null, 2), 'application/json');
}
function downloadReport(result, submission, surprise){
  const rec = buildRecord(result, submission, surprise);
  let rows = '';
  EX.blueprint.forEach((bp) => {
    if (bp.section === 'writing') return;
    const s = (rec.bySection || {})[bp.section] || { score: '-', max: bp.max };
    rows += '<tr><td>' + bp.arName + '</td><td>' + s.score + ' / ' + s.max + '</td></tr>';
  });
  const qs = rec.questions.map((q) => '<tr><td>' + q.id + '</td><td>' + (q.correct ? 'صحيحة' : (q.answered ? 'خاطئة' : 'بدون إجابة')) + '</td><td>' + esc(q.studentAnswer || '-') + '</td><td>' + esc(q.correctAnswer) + '</td></tr>').join('');
  const html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ' + esc(rec.examId) + '</title>' +
    '<style>body{font-family:sans-serif;margin:24px;direction:rtl}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:right}</style></head><body>' +
    '<h1>تقرير اختبار اللغة العربية — الوحدة الأولى</h1>' +
    '<p>الطالب: ' + esc(rec.studentName) + ' | رقم الامتحان: ' + esc(rec.examId) + '</p>' +
    '<p>وقت التسليم: ' + new Date(rec.submittedAt).toISOString() + ' | السبب: ' + esc(reasonAr(rec.submitReason)) + '</p>' +
    '<p>الدرجة الموضوعية: ' + rec.objectiveScore + ' / ' + rec.objectiveMax + ' | التعبير: قيد الانتظار / ' + (EX.writingMarks) + '</p>' +
    '<h2>درجات الأقسام</h2><table>' + rows + '</table>' +
    '<h2>إجابة التعبير</h2><pre style="white-space:pre-wrap;border:1px solid #ccc;padding:10px;direction:rtl">' + esc(rec.writing.response) + '</pre>' +
    '<h2>تفصيل الإجابات</h2><table><tr><th>المعرّف</th><th>النتيجة</th><th>إجابة الطالب</th><th>الإجابة الصحيحة</th></tr>' + qs + '</table>' +
    '</body></html>';
  const fn = 'Arabic_Unit1_Report_' + sanitize(state.name) + '_' + state.examId + '.html';
  dl(fn, html, 'text/html');
}

boot();
