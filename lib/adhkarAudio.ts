// روابط صوت الأذكار من درايف. الملف يجب أن يكون مشاركًا «أي شخص لديه الرابط – مشاهد».
import { DRIVE_ID, parseDriveId } from "./drive";
export { parseDriveId };

/** رابط التشغيل المباشر من درايف (لا يمرّ على خادم الموقع فلا يستهلك نقل بيانات فيرسل). */
export function driveAudioUrl(id: string): string {
  const safe = encodeURIComponent(id);
  // مع NEXT_PUBLIC_DRIVE_API_KEY يُستعمل رابط Drive API (المسار الرسمي للملفات العامة، وأثبت في المتصفح)؛ وإلا رابط التنزيل العام.
  const key = process.env.NEXT_PUBLIC_DRIVE_API_KEY;
  if (key) return `https://www.googleapis.com/drive/v3/files/${safe}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`;
  return `https://drive.usercontent.google.com/download?id=${safe}&export=download&confirm=t`;
}

/**
 * المسار الاحتياطي عبر الموقع (فيرسل): مفعّل افتراضيًا لأن المتصفح كثيرًا ما يرفض رابط درايف المباشر (حدود درايف وملفات تعريف الارتباط)،
 * بينما يقرؤه الخادم دون مشكلة. لا يُطلب إلا بعد فشل الرابط المباشر، وملفات الصوت صغيرة فاستهلاكه قليل.
 * لتعطيله ضع NEXT_PUBLIC_ADHKAR_AUDIO_PROXY=0 في متغيرات البيئة.
 */
export const AUDIO_PROXY_ON = process.env.NEXT_PUBLIC_ADHKAR_AUDIO_PROXY !== "0";

/** مصادر التشغيل المحتملة لقيمة محفوظة بالترتيب: الرابط المباشر ثم المسار عبر الموقع (لمعرّفات درايف فقط). */
export function audioCandidates(v: string): string[] {
  if (!DRIVE_ID.test(v)) return [v];
  return AUDIO_PROXY_ON ? [driveAudioUrl(v), proxyAudioUrl(v)] : [driveAudioUrl(v)];
}

/** مسار احتياطي عبر الموقع إن رفض المتصفح الرابط المباشر (انظر app/api/drive-audio). */
export function proxyAudioUrl(id: string): string {
  return `/api/drive-audio?id=${encodeURIComponent(id)}`;
}

/** مصدر تشغيل جاهز من قيمة محفوظة: معرّف درايف ← رابط التشغيل المباشر، وغير ذلك (رابط كامل أو مسار داخل الموقع) كما هو. */
export function resolveAudioSrc(v: string): string {
  return DRIVE_ID.test(v) ? driveAudioUrl(v) : v;
}
