/** صيغة عدد المشاهدات بالمفرد والمثنى والجمع الصحيحة في العربية. */
export function viewsLabel(n: number): string {
  if (n === 0) return "لا مشاهدات";
  if (n === 1) return "مشاهدة واحدة";
  if (n === 2) return "مشاهدتان";
  const num = new Intl.NumberFormat("ar-u-nu-latn").format(n);
  return n <= 10 ? `${num} مشاهدات` : `${num} مشاهدة`;
}

/** ثوانٍ → «m:ss» أو «h:mm:ss». */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
