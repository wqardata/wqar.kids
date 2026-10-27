# خطة النقل من Firestore إلى Neon (مع بقاء Firebase للتسجيل)

الهدف: كل البيانات (فيديوهات، تصنيفات، مجموعات، إعدادات، إحصاء، بلاغات، إشعارات، أعضاء…) تُقرأ وتُكتب من Neon،
وFirebase يبقى لتسجيل الدخول فقط (Firebase Auth). الموقع يبقى يعمل على Firestore حتى نقرّر التحويل، وكل مرحلة قابلة للرجوع.

## ما هو جاهز أصلًا في المستودع
- `neon/schema.sql`: مخطط 11 جدولًا (مُنفَّذ في Neon حسب `/api/db-health`).
- `lib/db.ts`: اتصال Neon للخادم (`query`, `queryOne`) و`isDbConfigured()`.
- `scripts/neon-migrate/`: سكربت نسخ Firestore ← Neon (قراءة من Firestore فقط، upsert آمن للتكرار) مع اختبارات (8 تنجح).
- التحقق من رمز Firebase على الخادم: `lib/serverAuth.ts` (`claimsFromToken`, `adminFromToken`) عبر `jose`.

## كيف يقرأ الموقع Firestore اليوم (جرد)
الكود يتصل بـ Firestore **مباشرة من المتصفح** عبر SDK (القواعد في `firestore.rules` هي الحماية). في Neon لا يصح أن يتصل المتصفح بالقاعدة،
فتُبنى طبقة API على الخادم تتحقق من رمز Firebase وتطبّق الصلاحيات بدل القواعد.

| المجموعة | الجدول | أهم الملفات التي تستعملها |
|---|---|---|
| videos | videos | `lib/videos.ts`، `lib/stats.ts`، `lib/shareMeta.ts`، `app/v/[id]/VideoView.tsx`، `components/FavoriteButton.tsx`، `components/AddedVideos.tsx`، `app/category/[id]`، `app/series/[id]`، `app/add/*`، `app/admin/{VideosTab,VideoEditForm,ShortForm,SeriesOrder,ReportsTab,NamedManager}` |
| categories / series | categories / series | `lib/videos.ts` (`useNamedList`)، `NamedManager`، `app/subscriptions/SeriesList.tsx`، `components/SuggestedVideos.tsx`، `lib/shareMeta.ts` |
| settings | settings | `lib/settings.tsx`، `lib/serverSettings.ts` (REST على Firestore)، `lib/adminLayoutStore.ts`، `app/admin/SettingsTab.tsx` |
| stats | stats | `lib/stats.ts`، `app/admin/StatsTab.tsx` |
| reports | reports | `components/ReportButton.tsx`، `app/admin/ReportsTab.tsx`، `lib/notifications.ts` |
| notifications | notifications | `lib/notifications.ts`، `app/admin/NotificationsTab.tsx` |
| thumbs | thumbs | `lib/thumbs.ts`، `app/api/thumb/[id]/route.ts` |
| allowed / users | allowed / users | `lib/auth.tsx`، `lib/memberAdmin.ts`، `app/admin/MembersTab.tsx`، `lib/serverAuth.ts` (قراءة users عبر REST) |

ملاحظة: مجموعة `fingerprints` لا يستعملها الكود الحالي (موجودة في المخطط فقط).

## المبدأ: مفتاح تشغيل واحد
متغير `NEXT_PUBLIC_DATA_BACKEND` (`firestore` افتراضيًا، أو `neon`). كل وحدة بيانات تُكتب بواجهة واحدة وتختار الخلفية بحسبه،
فيمكن تجربة Neon على معاينة Vercel دون المساس بالموقع الحي، والرجوع بتغيير متغير واحد.

## المراحل (بعد كل مرحلة: رفع إلى GitHub ثم إخبارك)
0. **الجرد والخطة** (هذا الملف). ✔
1. **نسخ البيانات الأولي:** تشغّل أنت `scripts/neon-migrate` على جهازك (يحتاج مفتاح حساب خدمة Firebase ولا يُرفع لأي مكان).
   تجربة ثم `--write`. نقارن الأعداد. (لا أملك مفاتيحك، فهذه المرحلة منك.)
2. **قراءة عامة من Neon (للقراءة فقط):** مسارات API لـ videos/categories/series/settings، وتحويل `lib/videos.ts` و`lib/shareMeta.ts` و`lib/serverSettings.ts` خلف مفتاح التشغيل.
3. **كتابات الزوار:** المشاهدات والإعجابات والإحصاء اليومي والبلاغات (UPDATE ذرّي) بدل قواعد Firestore.
4. **كتابات المشرف:** إضافة/تعديل/حذف الفيديوهات والتصنيفات والمجموعات والترتيب، مع تحقق `adminFromToken`.
5. **الأعضاء والتسجيل:** `users` و`allowed` (Firebase Auth يبقى للدخول؛ الدور والحظر من Neon).
6. **الإعدادات والإشعارات واللوحة:** `settings` (الموقع + ترتيب اللوحة) و`notifications` و`thumbs`.
7. **التحويل النهائي:** نسخة أخيرة للبيانات (لقطة أحدث)، تبديل `NEXT_PUBLIC_DATA_BACKEND=neon`، مراقبة.
8. **التنظيف:** إزالة كود Firestore المباشر وقواعده، والإبقاء على Firebase Auth فقط.

## قرارات تحتاج رأيك قبل المرحلة 7
- **التجميد أم الكتابة المزدوجة؟** بين النسخة الأخيرة والتبديل قد يشاهد الزوار فيديوهات (يزيد `views`). الأبسط: نقبل فقدان عدّادات دقائق قليلة، أو نعمل نافذة صيانة قصيرة.
- **المالك:** يبقى بريده في `ADMIN_EMAILS` كما في القواعد الحالية.

## الرجوع
في أي مرحلة: `NEXT_PUBLIC_DATA_BACKEND=firestore` ويعود الموقع كما كان. Firestore لا يُحذف منه شيء إلا بقرار منك بعد التحويل.
