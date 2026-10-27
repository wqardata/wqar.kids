// عنصر صوت مشترك لنافذة الأذان.
// المتصفحات (وسفاري على الآيفون خصوصًا) تسمح لعنصر صوت بالتشغيل التلقائي إن كان الزائر قد تفاعل معه سابقًا بلمسة.
// لذلك «نفتح» هذا العنصر عند أول لمسة أو نقرة في الموقع (بتشغيل مقطع صامت)، فإذا حان الأذان لاحقًا والصفحة مفتوحة
// تعمل التكبيرات فور ظهور النافذة دون أن يضغط الزائر شيئًا.

const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let shared: HTMLAudioElement | null = null;
let armed = false;

/** العنصر المشترك (يُنشأ عند أول طلب). */
export function getAdhanAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!shared) {
    shared = new Audio();
    shared.preload = "auto";
  }
  return shared;
}

/** يربط «فتح» العنصر بأول تفاعل من الزائر. آمن للاستدعاء أكثر من مرة. */
export function armAdhanAudio(): void {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  const events = ["pointerdown", "touchend", "keydown", "click"] as const;
  const unlock = () => {
    const a = getAdhanAudio();
    events.forEach((e) => window.removeEventListener(e, unlock, true));
    if (!a) return;
    // نافذة أذان وضعت مصدرها فعلًا: لا نلمسه (النافذة نفسها تشغّل الصوت عند أول لمسة إن كان ممنوعًا).
    const cur = a.getAttribute("src");
    if (cur && cur !== SILENT) return;
    a.muted = true;
    a.src = SILENT;
    a.play()
      .then(() => {
        if (a.getAttribute("src") === SILENT) a.pause();
      })
      .catch(() => {})
      .finally(() => {
        a.muted = false;
        if (a.getAttribute("src") === SILENT) {
          a.removeAttribute("src");
          a.load();
        }
      });
  };
  events.forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));
}
