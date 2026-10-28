"use client";
import { useState } from "react";
import { DEFAULT_SETTINGS, savePatch, useSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection } from "./sectionKit";
import { useSaveBar } from "./saveKit";

/** خيارات سلوك الموقع: التشغيل التلقائي للفيديو. (شاشة الشعار صارت في «المظهر».) */
export default function BehaviorPanel() {
  const { settings, update, ready } = useSettings();
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  usePreviewDraft("behavior", { autoplay });

  useSaveBar("behavior", {
    label: "تشغيل الفيديو",
    draftSig: JSON.stringify(autoplay),
    savedSig: JSON.stringify(settings.autoplay),
    defaultSig: JSON.stringify(DEFAULT_SETTINGS.autoplay),
    onSave: async () => {
      const saved = await savePatch({ autoplay });
      update(saved);
      setAutoplay(saved.autoplay);
    },
    onDiscard: () => setAutoplay(settings.autoplay),
    onReset: () => setAutoplay(DEFAULT_SETTINGS.autoplay),
  });

  if (!ready) return null;
  return (
    <>
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
    </>
  );
}
