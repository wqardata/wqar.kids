// كشف مدة الإعلان والمقدمة تلقائيًا (خوارزمية بحتة بلا اعتماد على المتصفح، لتُختبر وحدها).
//
// الفكرة: لكل فيديو «بصمة» = بصمة بصرية صغيرة (dHash من 64 بت) لكل ثانية من أول دقائقه.
//  - المقدمة: مقطع يتكرر في حلقات المجموعة نفسها (بتوقيت قد يختلف قليلًا).
//  - الإعلان: مقطع يتكرر في فيديوهات من مجموعات أخرى أيضًا.
// نبحث عن أطول تتابع متطابق بين الفيديو وكل فيديو مرجعي، ونفصل الإعلان (مشترك مع المجموعات الأخرى)
// عن المقدمة (مشتركة مع مجموعته فقط). النتيجة بالثواني وتُرسَل إلى زر «تخطي».

export type Fingerprint = {
  /** الفاصل بين عيّنتين بالثواني. */
  step: number;
  /** 8 بايت لكل عيّنة (dHash). */
  hashes: Uint8Array;
  /** 1 = لقطة فيها تفاصيل، 0 = لقطة مسطّحة (سوداء/لون واحد) لا يُعتدّ بمطابقتها. */
  info: Uint8Array;
  /** عدد العيّنات. */
  n: number;
};

export const SAMPLE_STEP = 1;
export const SAMPLE_WINDOW = 180; // أول 3 دقائق تكفي للإعلان والمقدمة

const MAX_HAMMING = 12; // أقصى فرق بالبتات (من 64) لنعدّ لقطتين متطابقتين
const MAX_SHIFT = 100; // أقصى فرق بالعيّنات بين موضع المقطع في الفيديو والمرجع
const MIN_MATCHES = 3; // أقل عدد لقطات متطابقة ليُعدّ التتابع مقطعًا مشتركًا
const MIN_SEG = 3; // أقل طول (عيّنات) لمقطع الإعلان
const MIN_INTRO = 4; // أقل طول للمقدمة
const AD_START_MAX = 8; // الإعلان يبدأ في أول 8 ثوانٍ
const INTRO_START_AFTER_AD = 25; // أقصى فراغ بين نهاية الإعلان وبداية المقدمة
const MERGE_GAP = 2; // دمج مقاطع يفصلها أقل من هذا

const POP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = (i & 1) + t[i >> 1];
  return t;
})();

function hamming(a: Uint8Array, i: number, b: Uint8Array, j: number): number {
  let d = 0;
  for (let k = 0; k < 8; k++) d += POP[a[i * 8 + k] ^ b[j * 8 + k]];
  return d;
}

/** 1 = متطابقتان، 0 = مختلفتان، -1 = كلتاهما مسطّحة (محايدة). */
function cmp(a: Fingerprint, i: number, b: Fingerprint, j: number): 1 | 0 | -1 {
  const ai = a.info[i] === 1, bi = b.info[j] === 1;
  if (!ai && !bi) return -1;
  if (ai !== bi) return 0;
  return hamming(a.hashes, i, b.hashes, j) <= MAX_HAMMING ? 1 : 0;
}

export type Run = { a0: number; a1: number; d: number; matches: number };

/** كل التتابعات المتطابقة بين a وb، بعد حذف المتداخل منها (الأطول يغلب). */
export function commonRuns(a: Fingerprint, b: Fingerprint): Run[] {
  const found: Run[] = [];
  for (let d = -MAX_SHIFT; d <= MAX_SHIFT; d++) {
    let start = -1, last = -1, matches = 0, gap = 0;
    const close = () => {
      if (start >= 0 && matches >= MIN_MATCHES && last - start + 1 >= MIN_MATCHES) found.push({ a0: start, a1: last, d, matches });
      start = -1;
      last = -1;
      matches = 0;
      gap = 0;
    };
    for (let i = Math.max(0, -d); i < a.n && i + d < b.n; i++) {
      const s = cmp(a, i, b, i + d);
      if (s === 1) {
        if (start < 0) start = i;
        last = i;
        matches++;
        gap = 0;
      } else if (start >= 0) {
        gap += s === 0 ? 1 : 0.5; // لقطة مسطّحة مشتركة (إظلام) تُحتمل أكثر من اختلاف حقيقي
        if (gap > 2) close();
      }
    }
    close();
  }
  found.sort((x, y) => y.matches - x.matches || Math.abs(x.d) - Math.abs(y.d));
  const taken = new Uint8Array(a.n);
  const out: Run[] = [];
  for (const r of found) {
    let over = 0;
    for (let i = r.a0; i <= r.a1; i++) over += taken[i];
    if (over * 2 > r.a1 - r.a0 + 1) continue;
    for (let i = r.a0; i <= r.a1; i++) taken[i] = 1;
    out.push(r);
  }
  return out.sort((x, y) => x.a0 - y.a0);
}

/** عيّنات الفيديو التي يشاركها `need` مرجعًا على الأقل. */
function covered(target: Fingerprint, refs: readonly Fingerprint[], need: number): boolean[] {
  const count = new Uint8Array(target.n);
  for (const r of refs) {
    for (const run of commonRuns(target, r)) for (let i = run.a0; i <= run.a1; i++) count[i]++;
  }
  return Array.from(count, (c) => c >= need);
}

type Seg = { s: number; e: number };

function segments(mask: readonly boolean[], minLen: number): Seg[] {
  const out: Seg[] = [];
  let s = -1, e = -1;
  for (let i = 0; i <= mask.length; i++) {
    if (i < mask.length && mask[i]) {
      if (s < 0) s = i;
      e = i;
    } else if (s >= 0 && (i === mask.length || i - e > MERGE_GAP)) {
      if (e - s + 1 >= minLen) out.push({ s, e });
      s = -1;
    }
  }
  return out;
}

export type SkipResult = {
  /** مدة الإعلان بالثواني (null = لم يُكتشف). */
  adSec: number | null;
  /** مدة المقدمة بالثواني (null = لم تُكتشف). */
  introSec: number | null;
};

/**
 * @param sameRefs  بصمات حلقات من المجموعة نفسها (غير الفيديو الحالي)
 * @param otherRefs بصمات فيديوهات من مجموعات أخرى
 */
export function detectSkip(target: Fingerprint, sameRefs: readonly Fingerprint[], otherRefs: readonly Fingerprint[]): SkipResult {
  const step = target.step;
  const none: SkipResult = { adSec: null, introSec: null };
  if (target.n < 8 || (sameRefs.length === 0 && otherRefs.length === 0)) return none;

  const S = sameRefs.length ? covered(target, sameRefs, sameRefs.length >= 3 ? 2 : 1) : new Array<boolean>(target.n).fill(false);
  const O = otherRefs.length ? covered(target, otherRefs, otherRefs.length >= 3 ? 2 : 1) : new Array<boolean>(target.n).fill(false);
  const reachesEnd = (g: Seg) => g.e >= target.n - 1; // وصل لنهاية النافذة: لا نعرف أين ينتهي فعلًا

  // الإعلان: مقطع مشترك مع مجموعات أخرى يبدأ في أول ثوانٍ.
  let adEnd = 0;
  const ad = segments(O, MIN_SEG).find((g) => g.s * step <= AD_START_MAX);
  if (ad && !reachesEnd(ad)) adEnd = (ad.e + 1) * step;

  // المقدمة: مشتركة مع المجموعة وليست من الإعلان (نوسّع الإعلان عيّنة لتجاوز حدّه المهزوز).
  const adMask = O.map((v, i) => v || O[i - 1] === true || O[i + 1] === true);
  const I = S.map((v, i) => v && !adMask[i]);
  const intro = segments(I, MIN_INTRO).find((g) => g.s * step <= adEnd + INTRO_START_AFTER_AD);
  let introEnd = 0;
  if (intro && !reachesEnd(intro)) introEnd = (intro.e + 1) * step;

  const adSec = adEnd >= 1 ? Math.round(adEnd) : null;
  const introSec = introEnd > adEnd ? Math.round(introEnd - adEnd) : null;
  return { adSec, introSec: introSec !== null && introSec >= 1 ? introSec : null };
}

// ---- التخزين: بايتات الخرائط (9 بايت لكل عيّنة) ↔ base64 ----

export function encodeFingerprint(fp: Fingerprint): string {
  const buf = new Uint8Array(fp.n * 9);
  for (let i = 0; i < fp.n; i++) {
    buf.set(fp.hashes.subarray(i * 8, i * 8 + 8), i * 9);
    buf[i * 9 + 8] = fp.info[i];
  }
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodeFingerprint(b64: string, step: number): Fingerprint | null {
  try {
    const bin = atob(b64);
    if (bin.length === 0 || bin.length % 9 !== 0) return null;
    const n = bin.length / 9;
    const hashes = new Uint8Array(n * 8), info = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 8; k++) hashes[i * 8 + k] = bin.charCodeAt(i * 9 + k);
      info[i] = bin.charCodeAt(i * 9 + 8) === 1 ? 1 : 0;
    }
    return { step, hashes, info, n };
  } catch {
    return null;
  }
}
