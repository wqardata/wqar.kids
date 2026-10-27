# نقل بيانات Firestore إلى Neon

سكريبت يُشغَّل على جهازك (ليس على Vercel) وينسخ كل مجموعات Firestore الـ 11 إلى جداول Neon.
لا يعدّل Firestore ولا يحذف منه شيئًا (قراءة فقط)، والموقع يبقى على Firestore حتى تحوّله أنت لاحقًا.

## قبل البدء
1. الجداول موجودة في Neon (نفّذت `neon/schema.sql`، وفحص `/api/db-health` رجّع `tables: 11`).
2. مفتاح حساب خدمة Firebase: Firebase Console ← Project settings ← Service accounts ← **Generate new private key**.
   احفظ الملف خارج المستودع (أو باسم يبدأ بـ `serviceAccount` فهو مُتجاهَل في git). لا ترفعه ولا ترسله لأحد.
3. سلسلة اتصال Neon (Connection string) من لوحة Neon.

## التشغيل
```bash
cd scripts/neon-migrate
npm install

# 1) تجربة: تقرأ وتحوّل وتعدّ فقط، لا تكتب شيئًا
DATABASE_URL="postgresql://..." node migrate.mjs --key=/المسار/serviceAccount.json

# 2) التنفيذ الفعلي (upsert: تعيد التشغيل متى شئت دون تكرار)
DATABASE_URL="postgresql://..." node migrate.mjs --key=/المسار/serviceAccount.json --write

# مجموعات محدّدة فقط
node migrate.mjs --key=... --write --only=videos,users
```
في Windows PowerShell: `$env:DATABASE_URL="postgresql://..."` ثم الأمر.

يطبع جدولًا بعدد ما قُرئ وما حُوِّل وما تُخطّي وما فشل وعدد الصفوف في Neon لكل مجموعة.

## ملاحظات
- **لقطة وقت التشغيل:** المشاهدات والإعجابات تتغيّر في Firestore باستمرار. شغّله مرة أخيرة (`--write`) لحظة التحويل النهائي.
- الصفوف غير الصالحة (إشعار بلا عنوان، عضو بلا بريد…) تُتخطّى مع سطر تحذير بمعرّفها.
- `users.uid` هو معرّف Firebase Auth نفسه؛ تسجيل الدخول يبقى على Firebase.
- اختبار التحويلات بلا شبكة: `npm test`.
