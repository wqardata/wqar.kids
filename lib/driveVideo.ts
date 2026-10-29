/**
 * رابط تشغيل فيديو درايف مباشرة في عنصر <video> (لا يمرّ على خادم الموقع فلا يستهلك نقل بيانات فيرسل).
 * الملف يجب أن يكون مشاركًا «أي شخص لديه الرابط – مشاهد».
 *
 * إن وُجد NEXT_PUBLIC_DRIVE_API_KEY يُستعمل رابط Drive API (أثبت مع الملفات الكبيرة)؛
 * ذلك المفتاح ظاهر للمتصفح، فقيّده في Google Cloud بنطاق موقعك (HTTP referrers) وبواجهة Drive API فقط.
 */
/**
 * المشغّل الخاص للفيديوهات (components/DriveVideoPlayer.tsx): عنصر video بأزرارنا يقرأ الملف مباشرة من درايف كما تفعل الإذاعة،
 * وإن رفضه المتصفح رجع تلقائيًا إلى مشغّل درايف الأصلي. مفعّل افتراضيًا؛ لتعطيله ضع NEXT_PUBLIC_DRIVE_CUSTOM_PLAYER=0 في متغيرات البيئة.
 */
export const CUSTOM_VIDEO_PLAYER = process.env.NEXT_PUBLIC_DRIVE_CUSTOM_PLAYER !== "0";

export function driveVideoUrl(id: string): string {
  const key = process.env.NEXT_PUBLIC_DRIVE_API_KEY;
  const safe = encodeURIComponent(id);
  if (key) return `https://www.googleapis.com/drive/v3/files/${safe}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`;
  return `https://drive.usercontent.google.com/download?id=${safe}&export=download&confirm=t`;
}
