// معرّفات درايف: حروف وأرقام و _ و - فقط.
export const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

/** يستخرج معرّف الملف من أي صيغة رابط درايف شائعة (أو من المعرّف نفسه). */
export function parseDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m =
    s.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) ||
    s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) ||
    s.match(/\/d\/([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return DRIVE_ID.test(s) ? s : null;
}

export function driveThumbnail(id: string, width = 640): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
}

/** يحذف امتداد الملف من الاسم: «حلقة 1.mp4» → «حلقة 1». */
export function stripExtension(name: string): string {
  return name.replace(/\.(mp4|mkv|mov|avi|webm|m4v|wmv|flv|mpg|mpeg|3gp)$/i, "").trim();
}
