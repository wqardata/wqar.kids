// التقاط لقطة عشوائية (بعد الثانية 10) من فيديو داخل المتصفح.
// المصدر يجب أن يكون من نفس نطاق الموقع (/api/drive-video) وإلا يمنع المتصفح قراءة الصورة (canvas tainted).

const MIN_START = 10; // لا نلتقط قبل هذه الثانية متى كان طول الفيديو يسمح.
const LONG_EDGE = 640; // أطول ضلع في الصورة الناتجة.
const DARK = 18; // متوسط سطوع (0–255) تحته نعدّ اللقطة سوداء تقريبًا ونجرّب غيرها.
const ATTEMPTS = 5;

export type Frame = { dataUrl: string; time: number };
export type Grabber = {
  duration: number;
  /** يلتقط لقطة عشوائية جديدة في كل استدعاء. */
  grab(): Promise<Frame>;
  dispose(): void;
};

/** نطاق اللقطات: بعد الثانية 10 وقبل النهاية بقليل (الشارات/الأسود غالبًا في الآخر). */
export function frameRange(duration: number): [number, number] {
  if (duration > 15) return [MIN_START, duration - 3];
  if (duration > 10.5) return [MIN_START, duration - 0.5];
  return [duration * 0.5, duration * 0.9]; // فيديو قصير جدًا: لا مكان لما بعد الثانية 10.
}

export function pickTime(duration: number, used: number[] = []): number {
  const [lo, hi] = frameRange(duration);
  let t = lo + Math.random() * (hi - lo);
  for (let i = 0; i < 6 && used.some((u) => Math.abs(u - t) < 3); i++) t = lo + Math.random() * (hi - lo);
  return t;
}

function waitFor(v: HTMLVideoElement, ok: string, ms: number, what: string, trigger?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const off = () => {
      clearTimeout(timer);
      v.removeEventListener(ok, onOk);
      v.removeEventListener("error", onErr);
    };
    const onOk = () => (off(), resolve());
    const onErr = () => (off(), reject(new Error(`${what}: error`)));
    const timer = setTimeout(() => (off(), reject(new Error(`${what}: timeout`))), ms);
    v.addEventListener(ok, onOk);
    v.addEventListener("error", onErr);
    trigger?.();
  });
}

function brightness(v: HTMLVideoElement): number {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 18;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 255;
  ctx.drawImage(v, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4);
}

function render(v: HTMLVideoElement): string {
  const k = Math.min(1, LONG_EDGE / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(v.videoWidth * k));
  c.height = Math.max(1, Math.round(v.videoHeight * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(v, 0, 0, c.width, c.height);
  // نخفّض الجودة تدريجيًا كي يبقى الحجم صغيرًا (مستند Firestore حدّه 1 ميغابايت).
  let out = "";
  for (const q of [0.8, 0.65, 0.5]) {
    out = c.toDataURL("image/jpeg", q);
    if (out.length <= 200_000) break;
  }
  return out;
}

/** يفتح الفيديو ويقرأ بياناته الوصفية فقط؛ اللقطات تُطلب لاحقًا بـ grab(). */
export function openGrabber(src: string, timeoutMs = 30_000, preload: "auto" | "metadata" = "auto"): Promise<Grabber> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = preload;
    v.setAttribute("aria-hidden", "true");
    // يُلحَق بالصفحة خارج الشاشة لأن بعض المتصفحات (سفاري) لا تحمّل فيديو منفصلًا.
    Object.assign(v.style, { position: "fixed", left: "-9999px", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(v);

    const dispose = () => {
      v.removeAttribute("src");
      v.load();
      v.remove();
    };
    const timer = setTimeout(() => (dispose(), reject(new Error("metadata: timeout"))), timeoutMs);
    v.onerror = () => (clearTimeout(timer), dispose(), reject(new Error("metadata: error")));
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      v.onerror = null;
      if (!Number.isFinite(v.duration) || v.duration <= 0 || !v.videoWidth || !v.videoHeight) {
        dispose();
        reject(new Error("metadata: invalid"));
        return;
      }
      const used: number[] = [];
      resolve({
        duration: v.duration,
        dispose,
        async grab(): Promise<Frame> {
          let best: (Frame & { b: number }) | null = null;
          for (let i = 0; i < ATTEMPTS; i++) {
            const t = pickTime(v.duration, used);
            used.push(t);
            await waitFor(v, "seeked", 20_000, "seek", () => {
              v.currentTime = t;
            });
            if (v.readyState < 2) await waitFor(v, "canplay", 8_000, "ready");
            const b = brightness(v);
            if (!best || b > best.b) best = { dataUrl: render(v), time: t, b };
            if (b >= DARK) break; // لقطة مضيئة بما يكفي
          }
          if (!best) throw new Error("no frame");
          return { dataUrl: best.dataUrl, time: best.time };
        },
      });
    };
    v.src = src;
  });
}

/**
 * يقرأ مدة فيديو درايف (بالثواني) مباشرةً من متصفح المشرف إلى درايف، دون المرور بسيرفر الموقع،
 * فلا يُحتسب شيء من حصة فيرسل. قراءة المدة وحدها لا تحتاج CORS (بعكس قراءة بكسلات الصورة).
 * يعيد 0 إن منع درايف ذلك أو تعذّر؛ عندها يعود المستدعي إلى الوسيط /api/drive-video.
 */
export function probeDuration(driveId: string, timeoutMs = 12_000): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.setAttribute("aria-hidden", "true");
    Object.assign(v.style, { position: "fixed", left: "-9999px", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(v);
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (d: number) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.removeAttribute("src");
      v.load();
      v.remove();
      resolve(d);
    };
    timer = setTimeout(() => finish(0), timeoutMs);
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : 0);
    v.onerror = () => finish(0);
    v.src = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&confirm=t`;
  });
}
