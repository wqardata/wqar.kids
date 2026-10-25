// هوية الموقع الثابتة: تعمل دائمًا حتى لو تعذّر Firebase (انتهاء الحد اليومي مثلًا).
// الاسم والشعار يظلّان قابلين للتعديل من لوحة التحكم؛ هذه القيم احتياطية، وأيقونات التبويب والتطبيق ثابتة من الملفات.
// للتغيير: عدّل القيم واستبدل الملفات في public/brand و public/icons ثم أعد النشر.

export const IDENTITY = {
  /** اسم الموقع الاحتياطي. */
  siteName: "عالم الصغار",
  /** اسم التبويب الاحتياطي (فارغ = نفس siteName). */
  tabName: "",
  /** شعار الهيدر الاحتياطي (مسار داخل public، فارغ = الاسم فقط). */
  logo: "",
  logoHeight: 32,
  showName: true,
  /** صورة شاشة الشعار عند فتح الموقع (إن لم تُرفع صورة من لوحة التحكم). */
  splashImage: "/brand/splash.png",
  /** أيقونة التبويب (favicon) وأيقونات التطبيق عند تثبيته؛ ثابتة من الملفات ولا تتأثر بـ Firebase. */
  favicon: "/icons/favicon-32.png",
  icon192: "/icons/icon-192.png",
  icon512: "/icons/icon-512.png",
  iconMaskable: "/icons/maskable-512.png",
} as const;
