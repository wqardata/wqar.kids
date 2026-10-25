"use client";
import { useEffect } from "react";

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/**
 * عند تكبير أي مشغّل (مشغّل درايف، مشغّل البث، أو غيرهما) ننتقل تلقائيًا للعرض الأفقي، ونفكّ القفل عند الخروج.
 * حدث fullscreenchange يصل إلى هذه الصفحة حتى لو كان التكبير من داخل إطار درايف.
 * القفل متاح في أندرويد (كروم وما شابهه)؛ آيفون لا يسمح به للمواقع، فيبقى سلوكه الافتراضي.
 */
export default function FullscreenLandscape() {
  useEffect(() => {
    const o = screen.orientation as LockableOrientation | undefined;
    if (!o || typeof o.lock !== "function") return;
    let locked = false;
    const onChange = () => {
      if (document.fullscreenElement) {
        o.lock?.("landscape").then(() => (locked = true)).catch(() => {});
      } else if (locked) {
        locked = false;
        try {
          o.unlock();
        } catch {
          /* غير مدعوم */
        }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);
  return null;
}
