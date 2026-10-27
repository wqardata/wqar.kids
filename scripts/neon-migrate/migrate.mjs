#!/usr/bin/env node
// نقل بيانات Firestore إلى Neon (Postgres). يُشغَّل على جهازك لا على Vercel. التفاصيل في README.md بجانبه.
//
//   node migrate.mjs                      تجربة فقط: يقرأ ويحوّل ويعدّ، ولا يكتب شيئًا (الافتراضي)
//   node migrate.mjs --write              ينفّذ الكتابة (upsert: يمكن إعادة تشغيله دون تكرار)
//   node migrate.mjs --only=videos,users  مجموعات محدّدة فقط
//   --key=المسار/serviceAccount.json      مفتاح حساب الخدمة (أو متغير GOOGLE_APPLICATION_CREDENTIALS)
//
// المتغيرات: DATABASE_URL (سلسلة اتصال Neon). لا يُطبع ولا يُحفظ في أي ملف.
import { readFileSync } from "node:fs";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { neon } from "@neondatabase/serverless";
import { PLAN, upsert } from "./map.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

const WRITE = flag("write");
const only = opt("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const keyFile = opt("key") || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const CONCURRENCY = 8;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (only) {
  const bad = only.filter((n) => !PLAN.some((s) => s.coll === n));
  if (bad.length) fail(`مجموعات غير معروفة: ${bad.join(", ")}\nالمتاح: ${PLAN.map((s) => s.coll).join(", ")}`);
}
if (!process.env.DATABASE_URL && WRITE) fail("DATABASE_URL غير مضبوط (انسخه من لوحة Neon ← Connection string).");

let app;
try {
  app = initializeApp({ credential: keyFile ? cert(JSON.parse(readFileSync(keyFile, "utf8"))) : applicationDefault() });
} catch (e) {
  fail(`تعذّر تهيئة Firebase Admin: ${e.message}\nحمّل مفتاح حساب الخدمة (Project settings ← Service accounts ← Generate new private key) ومرّره بـ --key=الملف.json`);
}
const fs = getFirestore(app);
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

/** ينفّذ مهامًا بتزامن محدود. */
async function pool(items, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

console.log(WRITE ? "الوضع: كتابة فعلية إلى Neon" : "الوضع: تجربة فقط (لن يُكتب شيء). أضف --write للتنفيذ.");

if (WRITE) {
  // مستند allowed في Firestore يحمل حقل name أيضًا، وهو غير موجود في المخطط الأوّلي.
  await sql.query("alter table allowed add column if not exists name text not null default ''");
}

const report = [];
for (const step of PLAN) {
  if (only && !only.includes(step.coll)) continue;
  const rows = [];
  const skipped = [];
  let read = 0;
  for await (const snap of fs.collection(step.coll).stream()) {
    read++;
    const out = step.map(snap.id, snap.data(), snap.createTime);
    if (out.row) rows.push(out.row);
    else skipped.push(`${snap.id}: ${out.skip}`);
  }
  let failed = 0;
  if (WRITE) {
    await pool(rows, async (row) => {
      const { text, params } = upsert(step, row);
      try {
        await sql.query(text, params);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${step.table} ${row[step.pk]}: ${e.message}`);
      }
    });
  }
  let inDb = "-";
  if (WRITE) inDb = Number((await sql.query(`select count(*)::int as n from ${step.table}`))[0].n);
  report.push({ مجموعة: step.coll, "قُرئ": read, "مُحوَّل": rows.length, "تخطّى": skipped.length, "فشل": failed, "في Neon": inDb });
  for (const s of skipped.slice(0, 5)) console.warn(`  ! ${step.coll} تخطّي — ${s}`);
  if (skipped.length > 5) console.warn(`  ! ${step.coll}: و${skipped.length - 5} غيرها متخطّاة`);
}

console.log("");
console.table(report);
const problems = report.filter((r) => r["فشل"] > 0);
if (problems.length) fail("فشلت كتابة بعض الصفوف (انظر الأخطاء أعلاه). أعد التشغيل بعد الإصلاح؛ الـ upsert آمن للتكرار.");
console.log(WRITE ? "✓ تمّ. قارن عمودي «مُحوَّل» و«في Neon»: قد يزيد «في Neon» إن كانت فيه صفوف سابقة." : "✓ التجربة سليمة. شغّل مع --write للتنفيذ.");
