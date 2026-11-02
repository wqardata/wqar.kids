// تجميع المشاهدات في ذاكرة الخادم وكتابتها في Neon دفعة واحدة كل فترة، بدل كتابة لكل مشاهدة.
// الهدف: تقليل مرّات إيقاظ قاعدة Neon (تُحتسب ساعات الحساب بمدة بقائها مستيقظة). منطق خالص بلا اتصال بالقاعدة ليسهل اختباره.
// الثمن المقبول من المالك: قد تضيع مشاهدات قليلة إن أُعيد تشغيل النسخة قبل الكتابة، ويتأخر ظهورها في الإحصاءات بضع دقائق.

export type FlushFn = (counts: Map<string, number>) => Promise<void>;

export type ViewBufferOptions = {
  /** أقل فاصل بين كتابتين بالمللي ثانية (الافتراضي 5 دقائق). */
  intervalMs?: number;
  /** عدد الفيديوهات المختلفة المعلّقة التي تُجبر على الكتابة فورًا (حماية الذاكرة). */
  maxIds?: number;
};

export function createViewBuffer(flushFn: FlushFn, opts: ViewBufferOptions = {}) {
  const intervalMs = opts.intervalMs ?? 300_000;
  const maxIds = opts.maxIds ?? 500;
  let pending = new Map<string, number>();
  let lastFlush = 0;
  let inflight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  /** يكتب المعلّق الآن. لا يرمي أبدًا: عند الفشل يُعاد المعلّق إلى الذاكرة ويُعاد المحاولة بعد الفاصل التالي. */
  function flush(now = Date.now()): Promise<void> {
    if (inflight) return inflight;
    clearTimer();
    if (pending.size === 0) return Promise.resolve();
    const batch = pending;
    pending = new Map();
    lastFlush = now;
    inflight = flushFn(batch)
      .catch(() => {
        // فشل مؤقت (القاعدة غير متاحة…): نُرجع الأعداد دون تجاوز الحد كي لا تكبر الذاكرة بلا نهاية.
        for (const [id, n] of batch) {
          if (pending.has(id) || pending.size < maxIds * 2) pending.set(id, (pending.get(id) ?? 0) + n);
        }
      })
      .finally(() => {
        inflight = null;
        if (pending.size > 0) arm(Date.now());
      });
    return inflight;
  }

  /** مؤقّت يكتب المعلّق عند انتهاء الفاصل حتى لو لم تصل مشاهدات أخرى (أفضل جهد؛ لا يمنع إغلاق العملية). */
  function arm(now: number) {
    if (timer !== null) return;
    const wait = Math.max(1_000, lastFlush + intervalMs - now);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, wait);
    (timer as { unref?: () => void }).unref?.();
  }

  /**
   * يسجّل مشاهدة. يكتب فورًا فقط إن مضى الفاصل منذ آخر كتابة (فالقاعدة ستُوقَظ بسبب طلب الزائر على أي حال)
   * أو تجاوز المعلّق الحد؛ وإلا يؤجَّل إلى المؤقّت أو إلى أول مشاهدة بعد الفاصل.
   */
  async function add(id: string, now = Date.now()): Promise<void> {
    pending.set(id, (pending.get(id) ?? 0) + 1);
    if (now - lastFlush >= intervalMs || pending.size >= maxIds) {
      await flush(now);
      return;
    }
    arm(now);
  }

  return { add, flush, pendingCount: () => pending.size };
}
