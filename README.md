# موقع الفيديو — الخطوة 1

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

## المسارات
`/` الرئيسية • `/watch/[id]` المشاهدة • `/search?q=` البحث • `/login` (قيد البناء) • باقي الأقسام تعرض صفحة "قيد البناء" من `app/[section]`.
