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

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const ATTEMPT_FILE = path.join(DATA_DIR, 'attempts.json');

/* Confirm the blueprint totals exactly 120 at startup. */
const TOTAL_MARKS = bank.BLUEPRINT.reduce((s, b) => s + b.max, 0);
if (TOTAL_MARKS !== 120) {
  console.error('FATAL: blueprint total is ' + TOTAL_MARKS + ', expected 120');
  process.exit(1);
}
const validation = bank.validateBank();
if (!validation.ok) {
  console.error('FATAL: question bank validation failed:\n - ' + validation.errors.join('\n - '));
  process.exit(1);
}

/* ---------- server-side attempt registry (best effort) ---------- */
let attempts = { byId: {}, byHash: {} };
try { attempts = JSON.parse(fs.readFileSync(ATTEMPT_FILE, 'utf8')); } catch (e) {}
function saveAttempts() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ATTEMPT_FILE, JSON.stringify(attempts, null, 2));
  } catch (e) { console.warn('attempts not persisted:', e.message); }
}
function clientHash(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update('u1u2|' + ip + '|' + ua).digest('hex').slice(0, 32);
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
  if (url === '/api/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const sub = body.submission || {};
    if (!sub.examId) return sendJson(res, 400, { ok: false, error: 'missing examId' });
    /* Grade objectively on the server so the answer key never leaves the server. */
    const result = bank.gradeObjective(sub.answers || {});
    const surprise = bank.gradeSurprise(sub.answers || {});

    if (!attempts.byId[sub.examId]) {
      const record = Object.assign({}, sub, {
        graded: { objective: result.objective, objectiveMax: result.objectiveMax,
                  correct: result.correct, answered: result.answered, unanswered: result.unanswered,
                  bySection: result.bySection },
        surprise: { correct: surprise.correct, total: surprise.total, bonusTotal: surprise.bonusTotal,
                    details: surprise.details },
        serverReceivedAt: Date.now(),
      });
      const entry = { examId: sub.examId, name: sub.name || '', status: 'completed', submittedAt: sub.submittedAt || Date.now() };
      attempts.byId[sub.examId] = entry;
      attempts.byHash[clientHash(req)] = entry;
      saveAttempts();
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(path.join(DATA_DIR, 'submission_' + sub.examId + '.json'), JSON.stringify(record, null, 2));
      } catch (e) { console.warn('submission not persisted:', e.message); }
    }
    return sendJson(res, 200, { ok: true, stored: true, examId: sub.examId, result: result, surprise: surprise });
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
server.listen(PORT, () => console.log('اختبار اللغة العربية U1 running on http://localhost:' + PORT + '  (total marks: ' + TOTAL_MARKS + ')'));
