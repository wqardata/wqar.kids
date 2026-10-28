# تسليم: أين وصل نقل wqar.kids إلى Neon وماذا بعده

آخر تحديث: 2026-10-28. اقرأ هذا الملف أولًا ثم `neon/MIGRATION_PLAN.md` (الخطة الكاملة).

## الحالة في سطور
- **الكود جاهز** للمراحل 2 إلى 6ج (قراءة عامة، كتابات الزوار والمشرف، الإعدادات، الإشعارات، الصور المصغّرة). كله خلف `NEXT_PUBLIC_DATA_BACKEND` وقيمته الافتراضية `firestore`، فالموقع الحي لا يتأثر حتى التبديل.
- **الفرع:** `neon-phases-2-6c` على GitHub (`wqardata/wqar.kids`). لم يُدمج في `main`.
- **البناء:** فشل في Vercel بخطأ أنواع في `app/admin/NamedManager.tsx` وأُصلح (commit `d1f9c35`). إن فشل بناء آخر فالسبب في سجل Build Logs (أول سطر `Failed to compile`).
- **الاختبارات:** `npx tsx --test neon/*.test.ts` (46 اختبارًا تنجح). جمل SQL لم تُجرَّب على قاعدة حقيقية بعد.
- **المرحلة 1 (نسخ البيانات من Firestore إلى Neon) لم تتم:** فشلت التجربة بالخطأ `8 RESOURCE_EXHAUSTED: Quota exceeded`، أي أن حصة القراءة اليومية المجانية في Firestore (50 ألف قراءة) نفدت. لم يُكتب شيء في Neon ولم يتغيّر شيء في Firestore.

## القرارات المتخذة (من المالك)
- العضوية والتسجيل تبقى على Firebase (Auth ومجموعتا `users` و`allowed`) ولا تُنقل.
- يُقبل فقدان عدّادات المشاهدات لدقائق قليلة عند التحويل، ولا نافذة صيانة.
- بريد المالك يبقى في `ADMIN_EMAILS`.

## الخطوة التالية بالترتيب
1. **المرحلة 1** (على جهاز المالك، لأنها تحتاج مفتاح Firebase وسلسلة Neon، ولا يُرسل أيٌّ منهما لأحد):
   - تتجدد الحصة نحو الساعة 10 صباحًا بتوقيت القاهرة (منتصف الليل بتوقيت المحيط الهادئ)، أو يُرقّى مشروع Firebase إلى Blaze (الدفع حسب الاستعمال، تكلفته لهذا الحجم سنتات).
   - في `scripts/neon-migrate` نفّذ `npm install` (في Windows PowerShell قد يلزم أولًا `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`، أو استعمل `npm.cmd`).
   - ضع `$env:DATABASE_URL="..."` (سلسلة Neon pooled) ثم شغّل التجربة بلا كتابة، ويُنصح بتخطّي `fingerprints` لأن الكود لا يستعملها:
     `node migrate.mjs --key=المسار\serviceAccount.json --only=categories,series,videos,settings,stats,reports,notifications,thumbs`
   - إن نجحت وأعداد «قُرئ» و«مُحوَّل» سليمة، كرّر الأمر مع `--write` (upsert آمن للتكرار).
   - تنبيه: اسم ملف المفتاح عند المالك الآن `serviceAccount.jso.json` (خطأ إملائي)، فاستعمل الاسم الفعلي.
2. **المرحلة 7 على معاينة Vercel (قبل أي تبديل على الموقع الحي):**
   - في Vercel ← Settings ← Environment Variables أضف `DATABASE_URL` و`NEXT_PUBLIC_DATA_BACKEND=neon` لبيئة **Preview** فقط.
   - Redeploy لنشر الفرع `neon-phases-2-6c` دون Build Cache (القيمة تُدمج وقت البناء).
   - أضف نطاق المعاينة إلى Firebase ← Authentication ← Settings ← Authorized domains.
   - افحص: `/api/db-health` (يجب `tables: 11`)، الرئيسية وصفحة فيديو وتصنيف، المشاهدة والإعجاب، دخول المشرف وإضافة فيديو وتعديله وحذفه، الإعدادات، الإشعارات، الصور المصغّرة.
   - ملاحظة: دخول المشرف يقرأ من Firestore، فقد يتعثر ما دامت الحصة منتهية.
3. **التبديل النهائي:** أعد `--write` مرة أخيرة (لتحديث المشاهدات والإعجابات)، ثم اضبط `DATABASE_URL` و`NEXT_PUBLIC_DATA_BACKEND=neon` لبيئة Production وأعد النشر، وراقب الموقع. للرجوع في أي لحظة: `NEXT_PUBLIC_DATA_BACKEND=firestore` وإعادة النشر.
4. **المرحلة 8 (التنظيف):** إزالة كود Firestore المباشر للبيانات وقواعده بعد أيام من الاستقرار، مع الإبقاء على Auth ومجموعتي `users` و`allowed`.

## ملاحظات
- **فرع `admin-unified-save`:** عمل منفصل غير مكتمل وغير مفحوص (شريط حفظ موحّد في لوحة التحكم). لا يتعلق بالنقل ولا يُدمج قبل إكماله. ما زال يحمل خطأ البناء القديم، فادمج `neon-phases-2-6c` فيه أولًا.
- **أسرار:** لا تُرفع مفاتيح Firebase ولا سلسلة Neon إلى GitHub ولا تُلصق في أي محادثة. احذف ملف المفتاح بعد انتهاء النسخ وألغِه من Firebase ← Service accounts.
- **فحص الأنواع بلا تثبيت حزم:** بيئة العمل السابقة لم تصل إلى سجل npm، فلم يُشغَّل `next build` محليًا. على جهاز عادي شغّل `npm ci` ثم `npm run typecheck` و`npm run build` قبل الدمج.
