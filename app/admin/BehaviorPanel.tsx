"use client";
import { useMemo, useState } from "react";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

/** خيارات سلوك الموقع: التشغيل التلقائي للفيديو. (شاشة الشعار صارت في «المظهر».) */
export default function BehaviorPanel() {
  const { settings, ready } = useSettings();
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  usePreviewDraft("behavior", { autoplay });
  const patch = useMemo(() => ({ autoplay }), [autoplay]);
  useSettingsOwner({
    patch,
    afterSave: (saved) => setAutoplay(saved.autoplay),
    reset: () => setAutoplay(DEFAULT_SETTINGS.autoplay),
  });

  if (!ready) return null;
  return (
    <MovableSection id="behavior.play">
      <section className="panel menu-admin" aria-labelledby="bh-h-play">
        <h2 id="bh-h-play">تشغيل الفيديو</h2>
        <label className="check">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          تشغيل الفيديو تلقائيًا عند فتح صفحته
        </label>
        <p className="hint">التشغيل التلقائي طلبٌ للمشغّل؛ قد تمنعه بعض المتصفحات (خاصة الجوال) أو مشغّل درايف نفسه.</p>
      </section>
    </MovableSection>
  );
}
