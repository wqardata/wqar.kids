// أخذ «البصمة» من أول دقائق فيديو داخل المتصفح (للمشرف فقط). المصدر يجب أن يكون من نفس نطاق الموقع
// (/api/drive-video) وإلا يمنع المتصفح قراءة البكسلات. نشغّل الفيديو مكتومًا بسرعة عالية ونلتقط لقطة كل ثانية.
import { SAMPLE_STEP, SAMPLE_WINDOW, type Fingerprint } from "./introDetect";

const FLAT_STD = 5; // انحراف معياري للسطوع تحته نعدّ اللقطة مسطّحة (سوداء/لون واحد)
const RATE = 4; // سرعة التشغيل أثناء الالتقاط

export type SampleOptions = {
  maxSec?: number;
  step?: number;
  signal?: AbortSignal;
  /** 0–1 */
  onProgress?: (frac: number) => void;
};

type RVFC = (cb: (now: number, meta: { mediaTime: number }) => void) => number;

/** dHash 9×8: بت لكل مقارنة بين بكسلين متجاورين (64 بت) + هل في اللقطة تفاصيل. */
function hashFrame(v: HTMLVideoElement, ctx: CanvasRenderingContext2D): { bytes: Uint8Array; informative: boolean } {
  ctx.drawImage(v, 0, 0, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  const g = new Float32Array(72);
  let sum = 0;
  for (let i = 0; i < 72; i++) {
    g[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    sum += g[i];
  }
  const mean = sum / 72;
  let varSum = 0;
  for (let i = 0; i < 72; i++) varSum += (g[i] - mean) ** 2;
  const bytes = new Uint8Array(8);
  let bit = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++, bit++) if (g[y * 9 + x] > g[y * 9 + x + 1]) bytes[bit >> 3] |= 1 << (bit & 7);
  }
  return { bytes, informative: Math.sqrt(varSum / 72) >= FLAT_STD };
}

function once(v: HTMLVideoElement, ok: string, ms: number, what: string, trigger?: () => void): Promise<void> {
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

/** يرجع البصمة ومدة الفيديو الكلية. يرمي خطأ إن تعذّر فتح الفيديو أو كان أقصر من 10 ثوانٍ. */
export async function sampleFingerprint(src: string, opts: SampleOptions = {}): Promise<{ fp: Fingerprint; duration: number }> {
  const step = opts.step ?? SAMPLE_STEP;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("aria-hidden", "true");
  // داخل نافذة العرض (لا خارجها) لأن بعض المتصفحات لا ترسم إطارات الفيديو الخارج عن الشاشة فلا تصل أحداث الإطارات.
  Object.assign(v.style, { position: "fixed", right: "0", bottom: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none", zIndex: "-1" });
  document.body.appendChild(v);
  const dispose = () => {
    v.pause();
    v.removeAttribute("src");
    v.load();
    v.remove();
  };
  const aborted = () => opts.signal?.aborted === true;
  try {
    v.src = src;
    await once(v, "loadedmetadata", 30_000, "metadata");
    const duration = v.duration;
    if (!Number.isFinite(duration) || duration < 10 || !v.videoWidth) throw new Error("video too short or invalid");
    const n = Math.max(1, Math.floor(Math.min(opts.maxSec ?? SAMPLE_WINDOW, duration) / step));
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas unavailable");

    const hashes = new Uint8Array(n * 8), info = new Uint8Array(n);
    let next = 0; // أول عيّنة لم تُؤخذ بعد
    const put = () => {
      const h = hashFrame(v, ctx);
      hashes.set(h.bytes, next * 8);
      info[next] = h.informative ? 1 : 0;
      next++;
      opts.onProgress?.(next / n);
    };

    // الطريقة 1: تشغيل سريع مع requestVideoFrameCallback.
    const rvfc = (v as unknown as { requestVideoFrameCallback?: RVFC }).requestVideoFrameCallback;
    if (typeof rvfc === "function") {
      await new Promise<void>((resolve) => {
        let lastFrameAt = performance.now();
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearInterval(watch);
          resolve();
        };
        const onFrame = (_now: number, meta: { mediaTime: number }) => {
          if (done) return;
          lastFrameAt = performance.now();
          while (next < n && meta.mediaTime >= next * step - 0.02) put();
          if (next >= n || aborted()) return finish();
          rvfc.call(v, onFrame);
        };
        // إن لم تصل إطارات لمدة 6 ثوانٍ (متصفح لا يرسم هذا الفيديو) ننتقل للطريقة 2.
        const watch = setInterval(() => {
          if (aborted() || performance.now() - lastFrameAt > 6000) finish();
        }, 500);
        v.playbackRate = RATE;
        rvfc.call(v, onFrame);
        v.play().catch(finish);
      });
      v.pause();
    }
    if (aborted()) throw new Error("aborted");

    // الطريقة 2 (احتياط): قفز إلى كل ثانية وأخذ لقطة.
    while (next < n) {
      if (aborted()) throw new Error("aborted");
      const t = next * step;
      await once(v, "seeked", 20_000, "seek", () => {
        v.currentTime = Math.min(t, duration - 0.1);
      });
      if (v.readyState < 2) await once(v, "canplay", 8_000, "ready");
      put();
    }
    return { fp: { step, hashes, info, n }, duration };
  } finally {
    dispose();
  }
}
