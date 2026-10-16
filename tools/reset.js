'use strict';
/*
 * تصفير بيانات التشغيل قبل بدء مادة جديدة.
 * يحذف سجل المحاولات وملفات التسليم في data/ (لا يمسّ بنك الأسئلة).
 * الاستخدام:  node tools/reset.js
 */
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');
let removed = 0;
for (const f of ['attempts.json']) {
  const p = path.join(DATA, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
}
const subs = path.join(DATA, 'submissions');
if (fs.existsSync(subs)) {
  for (const f of fs.readdirSync(subs)) { fs.unlinkSync(path.join(subs, f)); removed++; }
}
console.log('تم تصفير بيانات التشغيل: حُذف ' + removed + ' ملفًا. بنك الأسئلة لم يتغيّر.');
console.log('لتغيير المادة: عدّل config.js واستبدل محتوى bank.js، ثم أعد تشغيل الخادم.');
