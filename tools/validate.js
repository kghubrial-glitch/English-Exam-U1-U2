'use strict';
/*
 * أداة التحقق من بنك الأسئلة + تفريغ سجل التوثيق.
 * التشغيل:  node tools/validate.js
 * تنتهي بالرمز 1 عند فشل أي فحص. تكتب data/question-bank.json
 * (سجل تطوير داخلي: مقتطف المصدر، طريقة المعالجة، الدرجة، الإجابة).
 */
const fs = require('fs');
const path = require('path');
const bank = require('../bank.js');

const OUT = path.join(__dirname, '..', 'data', 'question-bank.json');
const problems = [];

const res = bank.validateBank();
if (!res.ok) problems.push(...res.errors);

/* --- فحوص إضافية مستقلة عن validateBank() --- */
const ids = new Set();
for (const it of bank.Q.concat(bank.SURPRISE)) {
  if (ids.has(it.id)) problems.push('معرّف مكرر ' + it.id);
  ids.add(it.id);
  if (!it.src || !it.src.excerpt) problems.push('سجل توثيق ناقص: ' + it.id);
  if (typeof it.answer !== 'number') problems.push('إجابة غير مفهرسة للعنصر ' + it.id);
  /* خيار صحيح واحد فقط: نتحقق من أن الخيارات فريدة وأن الفهرس صالح */
  if (new Set(it.options.map((o) => String(o).trim())).size !== it.options.length) problems.push('خيارات مكررة: ' + it.id);
}
if (bank.Q.length !== 51) problems.push('عدد الأسئلة المعيارية ليس 51: ' + bank.Q.length);
if (bank.SURPRISE.length !== 2) problems.push('عدد الأسئلة المفاجئة ليس 2: ' + bank.SURPRISE.length);
if (bank.WRITING_RUBRIC.reduce((s, r) => s + r.marks, 0) !== bank.WRITING.marks) problems.push('مجموع سلّم التعبير لا يساوي درجة التعبير');
if (bank.BLUEPRINT.reduce((s, b) => s + b.max, 0) !== 120) problems.push('مجموع المخطط ليس 120');
if (!bank.READING_PASSAGES.length) problems.push('لا توجد نصوص قراءة');
if (!bank.WRITING_PROMPT) problems.push('لا يوجد سؤال تعبير');
if (bank.SURPRISE[0].options[bank.SURPRISE[0].answer] !== '2') problems.push('إجابة J01 ليست 2');
if (bank.SURPRISE[1].options[bank.SURPRISE[1].answer] !== '560') problems.push('إجابة J02 ليست 560');

const bySection = {};
for (const it of bank.Q) bySection[it.section] = (bySection[it.section] || 0) + 1;

console.log('== المخطط ==');
for (const b of bank.BLUEPRINT) {
  console.log(`  ${b.section.padEnd(12)} ${String(b.max).padStart(3)} درجة  (${bySection[b.section] || (b.section === 'writing' ? 1 : 0)} سؤال)`);
}
console.log('  المجموع      ' + bank.BLUEPRINT.reduce((s, b) => s + b.max, 0) + ' درجة');
console.log('== الأعداد ==');
console.log('  الأسئلة الموضوعية:', bank.Q.length);
console.log('  الأسئلة المفاجئة:', bank.SURPRISE.length);
console.log('  نصوص القراءة:', bank.READING_PASSAGES.length ? 'نعم' : 'لا');
console.log('  سؤال التعبير:', bank.WRITING_PROMPT ? 'نعم' : 'لا');
console.log('  مجموع سلّم التعبير:', bank.WRITING_RUBRIC.reduce((s, r) => s + r.marks, 0));

/* --- تفريغ سجل التوثيق (تطوير فقط، يحتوي مفتاح الإجابة) --- */
try {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalMarks: 120,
    blueprint: bank.BLUEPRINT,
    ledger: bank.sourceLedger(),
  }, null, 2));
  console.log('== تمت كتابة ' + path.relative(path.join(__dirname, '..'), OUT) + ' ==');
} catch (e) {
  problems.push('تعذّرت كتابة ملف التوثيق: ' + e.message);
}

if (problems.length) {
  console.error('\nفشل التحقق:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\nنجح التحقق');
