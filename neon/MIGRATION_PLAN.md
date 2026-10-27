# خطة النقل من Firestore إلى Neon (مع بقاء Firebase للتسجيل)

الهدف: كل البيانات (فيديوهات، تصنيفات، مجموعات، إعدادات، إحصاء، بلاغات، إشعارات، أعضاء…) تُقرأ وتُكتب من Neon،
وFirebase يبقى لكل ما يخص العضوية والتسجيل (Firebase Auth + مجموعتا `users` و`allowed` في Firestore). الموقع يبقى يعمل على Firestore حتى نقرّر التحويل، وكل مرحلة قابلة للرجوع.

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
2. **قراءة عامة من Neon (للقراءة فقط):** مسارات API لـ videos/categories/series/settings، وتحويل `lib/videos.ts` و`lib/shareMeta.ts` و`lib/serverSettings.ts` خلف مفتاح التشغيل. ✔ (الكود جاهز: `lib/backend.ts`، `lib/neonServer.ts`، `app/api/data/*`؛ اختبار المحوّلات: `npx tsx --test neon/rows.test.ts`. يبقى فحصه على معاينة Vercel بعد المرحلة 1.)
3. **كتابات الزوار:** المشاهدات والإعجابات والإحصاء اليومي والبلاغات (UPDATE ذرّي) بدل قواعد Firestore. ✔ (الكود جاهز: `app/api/data/{view,like,report}`، `lib/neonWrites.ts`، `lib/visitorInput.ts`؛ اختباراته: `npx tsx --test neon/visitor.test.ts`. لم تُجرَّب جمل SQL على قاعدة حقيقية بعد.)
4. **كتابات المشرف:** إضافة/تعديل/حذف الفيديوهات والتصنيفات والمجموعات والترتيب والبلاغات، مع تحقق `adminFromToken`. ✔ (الكود جاهز: `app/api/admin/{videos,named,reports}`، `lib/adminInput.ts` (التحقق)، `lib/adminSql.ts` و`lib/neonAdmin.ts` (SQL)، `lib/neonAdminClient.ts` (المتصفح)؛ المكوّنات تتفرّع بحسب `USE_NEON`؛ اختباراته: `npx tsx --test neon/admin.test.ts`. لم تُجرَّب جمل SQL على قاعدة حقيقية بعد.
   - كل كتابة ترفع `videosVersion` داخل الخادم؛ حذف/فصل التصنيف والمجموعة وتغيير اسمهما (مع مزامنة نسخ الاسم في الفيديوهات) جملة SQL واحدة ذرّية.
   - (كانت الصور المصغّرة وعدّاد الجرس للبلاغات باقيين على Firestore حتى المرحلة 6؛ نُقلا في 6ب و6ج.)
5. **الأعضاء والتسجيل: أُلغيت بقرار المالك.** كل ما يخص العضوية والتسجيل بأنواعه (Firebase Auth، `users`، `allowed`، الأدوار والحظر، إضافة الأعضاء) يبقى على Firebase/Firestore ولا يُنقل. جدولا `users` و`allowed` في `schema.sql` غير مستعملين ولا يُنسخ إليهما شيء.
6. **الإعدادات والإشعارات واللوحة:** تُنفَّذ على ثلاث دفعات.
   - **6أ. الإعدادات وتخطيط اللوحة** ✔ (الكود جاهز: `app/api/admin/settings`، التحقق في `lib/adminInput.ts` (`cleanSitePatch`, `cleanLayout`)، SQL في `lib/adminSql.ts`، التنفيذ في `lib/neonAdmin.ts`، والمتصفح في `lib/neonAdminClient.ts`؛ `saveSettings` في `lib/settings.tsx` و`lib/adminLayoutStore.ts` يتفرّعان بحسب `USE_NEON`؛ اختباراته: `npx tsx --test neon/settings.test.ts`. لم تُجرَّب جمل SQL على قاعدة حقيقية بعد.)
     - حفظ `settings/site` يدمج الحقول المعدَّلة فقط فوق المحفوظ (`data || excluded.data`) كما كان `updateDoc`، وكل قيمة تُنظَّف في الخادم بنفس `merge` التي تنظّفها عند القراءة (شعار/رابط/لون غير صالح يُرفض)، ثم يُبطل الخادم كاش الإعدادات مباشرة.
     - تخطيط اللوحة (`adminLayout`) صار يُقرأ ويُكتب عبر مسار المشرفين فقط (في Firestore كانت قراءته عامة).
   - **6ب. الإشعارات وعدّاد الجرس** ✔ (الكود جاهز: القراءة `app/api/data/notifications` والإدارة `app/api/admin/notifications`، وعدّاد البلاغات `app/api/admin/reports?count=1`؛ المنطق النقي في `lib/noticeCore.ts`، وSQL في `lib/adminSql.ts`، والتنفيذ في `lib/neonNotices.ts`؛ `useNotifications` و`useOpenReports` و`NotificationsTab` يتفرّعان بحسب `USE_NEON`؛ اختباراته: `npx tsx --test neon/notices.test.ts`. لم تُجرَّب جمل SQL على قاعدة حقيقية بعد.)
     - الفئات يحدّدها الخادم من رمز Firebase لا العميل (بلا رمز = زائر `all+guests`، عضو `all+viewers`، مشرف `all+admins`)، ورمز غير صالح = 401.
     - الإرسال يُنشئ صفًّا لكل فئة في جملة واحدة ثم يحذف ما زاد عن آخر `NOTICE_KEEP` في كل فئة؛ فشل التنظيف لا يُفشل الإرسال.
     - **فرق سلوك:** لا اشتراك مباشر على Neon، فالجرس يتحدّث عند التحميل وعند العودة للتطبيق (عدّاد البلاغات للمشرف بفاصل أدناه 60 ثانية، والإشعارات 5 دقائق) بدل التحديث الفوري في Firestore.
   - **6ج. الصور المصغّرة** ✔ (الكود جاهز: الكتابة `app/api/admin/thumbs` (حفظ/حذف دفعة)، والقراءة العامة `app/api/thumb/[id]` صارت تقرأ من جدول `thumbs` حين `USE_NEON`؛ الأجزاء النقية في `lib/thumbCore.ts`، والتحقق في `lib/adminInput.ts` (`cleanThumbSave`, `cleanThumbIds`)، وSQL في `lib/adminSql.ts`؛ `saveThumb` و`deleteThumb` و`deleteThumbs` في `lib/thumbs.ts` تتفرّع بحسب `USE_NEON`؛ اختباراته: `npx tsx --test neon/thumbs.test.ts`. لم تُجرَّب جمل SQL على قاعدة حقيقية بعد.)
     - الحد نفسه كما في القواعد (أقل من 300000 حرف base64، JPEG فقط بترويسته)، والرابط `/api/thumb/{id}?v=…` لم يتغيّر فلا يتأثر المخزَّن في الفيديوهات.
     - حذف الفيديوهات الجماعي يحذف صورها بطلب واحد (`deleteThumbs`) بدل طلب لكل فيديو، كي لا يصطدم بحد المعدّل.
     - بهذا انتهت المرحلة 6 كلها: لا شيء من بيانات الموقع (عدا العضوية والتسجيل) يُقرأ أو يُكتب من Firestore حين `NEXT_PUBLIC_DATA_BACKEND=neon`.
7. **التحويل النهائي:** نسخة أخيرة للبيانات (لقطة أحدث)، تبديل `NEXT_PUBLIC_DATA_BACKEND=neon`، مراقبة.
8. **التنظيف:** إزالة كود Firestore المباشر للبيانات وقواعده، مع الإبقاء على Firebase Auth ومجموعتي `users` و`allowed` وقواعدهما في `firestore.rules`.

## قرارات تحتاج رأيك قبل المرحلة 7
- **التجميد أم الكتابة المزدوجة؟** بين النسخة الأخيرة والتبديل قد يشاهد الزوار فيديوهات (يزيد `views`). الأبسط: نقبل فقدان عدّادات دقائق قليلة، أو نعمل نافذة صيانة قصيرة.
- **المالك:** يبقى بريده في `ADMIN_EMAILS` كما في القواعد الحالية.

## الرجوع
في أي مرحلة: `NEXT_PUBLIC_DATA_BACKEND=firestore` ويعود الموقع كما كان. Firestore لا يُحذف منه شيء إلا بقرار منك بعد التحويل.
