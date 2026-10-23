# موقع الفيديو — الخطوة 3

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
