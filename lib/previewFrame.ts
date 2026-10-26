/** اسم إطار المعاينة في لوحة التحكم. يبقى اسم النافذة ثابتًا حتى لو تنقّل المشرف بين صفحات الموقع داخل الإطار. */
export const PREVIEW_FRAME_NAME = "site-preview";

/** هل هذه الصفحة تعمل داخل إطار المعاينة؟ (فيه لا نحسب مشاهدات ولا نكتب سجلًّا ولا نخزّن ثيمًا مؤقتًا.) */
export function isPreviewFrame(): boolean {
  try {
    return typeof window !== "undefined" && window.name === PREVIEW_FRAME_NAME && window.self !== window.top;
  } catch {
    return false;
  }
}

/** صفحات «معاينة الشاشات» (نافذة الأذان، إشعار الأذكار): تُعرض داخل إطار المعاينة بلا ترويسة ولا قوائم ولا نوافذ الموقع الحيّة. */
export function isScreenPreviewPath(path: string): boolean {
  return path === "/preview" || path.startsWith("/preview/");
}
