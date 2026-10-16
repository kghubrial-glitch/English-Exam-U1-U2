/*
 * اختبار اللغة العربية — الوحدة الأولى (الصف الثاني الثانوي بكالوريا)
 * نقطة تشغيل واحدة (Node.js، بلا اعتماديات خارجية).
 * الواجهة عربية بالكامل (RTL)، والمحتوى عربي أيضًا.
 * الدرجة الرسمية: 120 درجة بالضبط.  التشغيل:  node server.js
 * سجل التوثيق متاح في bank.js عبر sourceLedger() وفي tools/validate.js.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bank = require('./bank.js');
const CONFIG = require('./config.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const ATTEMPT_FILE = path.join(DATA_DIR, 'attempts.json');
const SUBMISSION_DIR = path.join(DATA_DIR, 'submissions');

/* تأكيد أن المخطط يطابق الدرجة الرسمية المعرَّفة في config.js عند الإقلاع. */
const TOTAL_MARKS = bank.BLUEPRINT.reduce((s, b) => s + b.max, 0);
if (TOTAL_MARKS !== CONFIG.totalMarks) {
  console.error('FATAL: blueprint total is ' + TOTAL_MARKS + ', expected ' + CONFIG.totalMarks);
  process.exit(1);
}
const validation = bank.validateBank();
if (!validation.ok) {
  console.error('FATAL: question bank validation failed:\n - ' + validation.errors.join('\n - '));
  process.exit(1);
}

/* ---------- سجل المحاولات على الخادم (مفتاحه رمز المادة) ---------- */
let attempts = { byId: {}, byHash: {} };
try { attempts = JSON.parse(fs.readFileSync(ATTEMPT_FILE, 'utf8')); } catch (e) {}
function saveAttempts() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ATTEMPT_FILE, JSON.stringify(attempts, null, 2));
  } catch (e) { console.warn('attempts not persisted:', e.message); }
}
/* رمز المادة جزء من المفتاح حتى لا تتقاطع محاولات المواد المختلفة. */
function clientHash(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(CONFIG.code + '|' + ip + '|' + ua).digest('hex').slice(0, 32);
}
/* رقم إصدار آمن لاسم الملف (منعًا لأي التباس في المسارات). */
function safeExamId(id) { return String(id || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 64); }
function readSubmission(examId) {
  try { return JSON.parse(fs.readFileSync(path.join(SUBMISSION_DIR, safeExamId(examId) + '.json'), 'utf8')); }
  catch (e) { return null; }
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 4e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/exam' && req.method === 'GET') {
    return sendJson(res, 200, bank.publicExam());
  }
  if (url === '/api/attempt' && req.method === 'GET') {
    const ex = attempts.byHash[clientHash(req)];
    if (ex && ex.status === 'completed') return sendJson(res, 200, { ok: true, blocked: true, prior: ex });
    return sendJson(res, 200, { ok: true, blocked: false, prior: ex || null });
  }
  /* إرجاع نتيجة محاولة مكتملة كي تظهر بعد إعادة التحميل (لا يكشف مفتاح الإجابة قبل التسليم). */
  if (url === '/api/result' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    const examId = safeExamId(q.get('examId'));
    if (!examId) return sendJson(res, 400, { ok: false, error: 'missing examId' });
    const rec = readSubmission(examId);
    if (!rec) return sendJson(res, 404, { ok: false, error: 'not_found' });
    return sendJson(res, 200, { ok: true, result: rec.graded, surprise: rec.surprise, record: rec });
  }
  if (url === '/api/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const sub = body.submission || {};
    if (!sub.examId) return sendJson(res, 400, { ok: false, error: 'missing examId' });
    /* Grade objectively on the server so the answer key never leaves the server. */
    const result = bank.gradeObjective(sub.answers || {});
    const surprise = bank.gradeSurprise(sub.answers || {});

    const examId = safeExamId(sub.examId);
    let stored = false;
    if (!attempts.byId[examId]) {
      const record = Object.assign({}, sub, {
        examId: examId,
        examCode: CONFIG.code,
        graded: { objective: result.objective, objectiveMax: result.objectiveMax,
                  correct: result.correct, answered: result.answered, unanswered: result.unanswered,
                  bySection: result.bySection, details: result.details },
        surprise: { correct: surprise.correct, total: surprise.total, bonusTotal: surprise.bonusTotal,
                    details: surprise.details },
        serverReceivedAt: Date.now(),
      });
      const entry = { examId: examId, name: sub.name || '', status: 'completed', submittedAt: sub.submittedAt || Date.now() };
      attempts.byId[examId] = entry;
      attempts.byHash[clientHash(req)] = entry;
      saveAttempts();
      try {
        if (!fs.existsSync(SUBMISSION_DIR)) fs.mkdirSync(SUBMISSION_DIR, { recursive: true });
        fs.writeFileSync(path.join(SUBMISSION_DIR, examId + '.json'), JSON.stringify(record, null, 2));
        stored = true;
      } catch (e) { console.warn('submission not persisted:', e.message); }
    }
    return sendJson(res, 200, { ok: true, stored: stored, examId: examId, result: result, surprise: surprise });
  }

  let file = url === '/' ? '/index.html' : url;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.listen(PORT, () => console.log('اختبار ' + CONFIG.subjectAr + ' [' + CONFIG.code + '] running on http://localhost:' + PORT + '  (total marks: ' + TOTAL_MARKS + ')'));
