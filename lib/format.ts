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


const ar = (n: number) => new Intl.NumberFormat("ar-u-nu-latn").format(n);

/** «منذ …» بالعربية الصحيحة (مفرد/مثنى/جمع). */
export function timeAgo(ms: number | null, now = Date.now()): string {
  return ageText(ms, now, "منذ ");
}

/** المدة المنقضية بلا «منذ» (للعرض بجانب أيقونة ساعة): «يوم» • «3 أيام» • «أسبوعين» • «الآن». */
export function ageShort(ms: number | null, now = Date.now()): string {
  return ageText(ms, now, "");
}

/** عدد المشاهدات رقمًا فقط (للعرض بجانب أيقونة عين). */
export function viewsCount(n: number): string {
  return ar(n);
}

function ageText(ms: number | null, now: number, prefix: string): string {
  if (!ms) return "";
  const sec = Math.max(0, Math.floor((now - ms) / 1000));
  if (sec < 45) return "الآن";
  const units: [number, string, string, string, string][] = [
    // [الثواني، مفرد، مثنى، جمع (3–10)، جمع (11+)]
    [31_536_000, "سنة", "سنتين", "سنوات", "سنة"],
    [2_592_000, "شهر", "شهرين", "أشهر", "شهرًا"],
    [604_800, "أسبوع", "أسبوعين", "أسابيع", "أسبوعًا"],
    [86_400, "يوم", "يومين", "أيام", "يومًا"],
    [3_600, "ساعة", "ساعتين", "ساعات", "ساعة"],
    [60, "دقيقة", "دقيقتين", "دقائق", "دقيقة"],
  ];
  for (const [size, one, two, few, many] of units) {
    const n = Math.floor(sec / size);
    if (n < 1) continue;
    if (n === 1) return `${prefix}${one}`;
    if (n === 2) return `${prefix}${two}`;
    return `${prefix}${ar(n)} ${n <= 10 ? few : many}`;
  }
  return "الآن";
}

/** سطر «عدد المشاهدات • منذ كذا» الموحّد تحت الفيديوهات. */
export function viewsAndAge(views: number, createdAt: number | null): string {
  return [viewsLabel(views), timeAgo(createdAt)].filter(Boolean).join(" • ");
}

/** خلط فيشر–ييتس (نسخة جديدة). */
export function shuffled<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
