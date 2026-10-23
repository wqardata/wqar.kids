# موقع الفيديو — الخطوة 4

## التشغيل محليًا
```
npm install
npm run dev        # ثم افتح http://localhost:3000
npm run typecheck  # فحص TypeScript
npm run build      # بناء الإنتاج
```
بعد أول `npm install` سيُنشأ `package-lock.json` — ارفعه مع المشروع لتثبيت الإصدارات.

## النشر على Vercel
1. ارفع المجلد إلى مستودع GitHub.
2. في Vercel: Add New → Project → اختر المستودع → Deploy.
3. من Settings → Domains أضف دومينك.

## أين أغيّر ماذا؟
- اسم الموقع ووصفه: `lib/data.ts` (`SITE_NAME`, `SITE_DESCRIPTION`) — يُستخدم تلقائيًا في العنوان والـ manifest.
- القوائم والبيانات التجريبية: `lib/data.ts`.
- الألوان: متغيرات `:root` في `app/globals.css`.
- الأيقونات: `public/icons/` و`app/icon.png` و`app/apple-icon.png`.

## الإعدادات (في lib/data.ts)
- `DRIVE_IDS`: معرّف درايف لكل حلقة.
- `CONTACT_EMAIL`: بريد استقبال رسائل «تواصل معنا».
- `SUPPORT_LINKS`: روابط الدعم. `LIVE_URL`: رابط البث. `GAMES`: قائمة الألعاب.
- `SERIES_LIST`: المسلسلات (تظهر في «مجموعاتي»).

## المسارات
`/` الرئيسية • `/watch/[id]` المشاهدة • `/search?q=` البحث • `/shorts` قصيرة (أقل من 5 دقائق) • `/subscriptions` مجموعاتي • `/series/[id]` مسلسل • `/live` • `/games` • `/new` • `/favorites` (محفوظة في المتصفح) • `/downloads` • `/support` • `/contact` • `/login` (قيد البناء: يحتاج قاعدة بيانات).


## الخطوة 3: الدخول بجوجل + إضافة فيديو
**الإعداد (مرة واحدة):**
1. أنشئ مشروعًا في [Firebase Console](https://console.firebase.google.com) ← Authentication ← Sign-in method ← فعّل **Google**.
2. Build ← **Firestore Database** ← Create (Production mode).
3. Project settings ← Add app ← Web: انسخ القيم إلى `.env.local` (انظر `.env.example`).
4. Authentication ← Settings ← Authorized domains: أضف دومينك ودومين Vercel.
5. Firestore ← Rules: الصق محتوى `firestore.rules` بعد وضع بريدك، ثم Publish.
6. على Vercel: Settings ← Environment Variables: أضف نفس المتغيرات.

**الاستخدام:** `/login` ← الدخول بجوجل ← `/add`: الصق رابط درايف فيُجلب الاسم والصورة تلقائيًا، اختر التصنيف/السلسلة أو أضف جديدًا من آخر القائمة. الفيديوهات المضافة تظهر في الرئيسية وتُشاهد على `/v/[id]`.

**ملاحظات:** الملف يجب أن يكون «أي شخص لديه الرابط – مشاهد». الإضافة محصورة بالبريدات في `ADMIN_EMAILS` / `NEXT_PUBLIC_ADMIN_EMAILS` وقواعد Firestore.


## الخطوة 4: لوحة التحكم `/admin`
- **الوصول:** `/login` ثم تُحوَّل تلقائيًا للوحة (للبريدات في `ADMIN_EMAILS` فقط). زر «لوحة التحكم» في الهيدر.
- **الفيديوهات:** بحث، تعديل (العنوان، الوصف، التصنيف، السلسلة/الموسم/الحلقة)، إخفاء/إظهار، تحويل إلى قصير، حذف.
- **المقاطع القصيرة:** أنشئ مقطعًا من رابط درايف مباشرة، فيظهر في `/shorts`. أي فيديو عادي يمكن تحويله إلى «قصير» بزر واحد.
- **الشعار:** ارفع صورة (PNG/SVG/JPG/WebP) من «إعدادات الموقع» ← الشعار، واضبط حجمه وأظهر الاسم بجانبه أو أخفِه. تُصغَّر تلقائيًا وتُحفظ داخل Firestore، وتظهر في الهيدر. (أيقونة التبويب والتطبيق تبقى من `app/icon.png` و`public/icons/`.)
- **إعدادات الموقع:** اسم الموقع ووصفه، بريد «تواصل معنا»، رابط البث، روابط الدعم. تُحفظ في Firestore (`settings/site`) وتتغيّر فورًا بلا إعادة نشر.
- **مهم:** حدّث قواعد Firestore من `firestore.rules` (أُضيف `settings`) ثم Publish، وإلا لن يعمل حفظ الإعدادات.
- المخفي لا يظهر في الرئيسية ولا يُفتح رابطه لغير المشرفين. الفيديو القصير لا يظهر في الرئيسية.
- ملاحظة: عنوان التبويب (`<title>`) والـ manifest ما زالا يقرآن `SITE_NAME` من `lib/data.ts`؛ الاسم الجديد يظهر في الهيدر والصفحات.
