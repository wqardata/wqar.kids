"use client";

/** فقاعة زجاجية تنبّه باقتراب الصلاة. تظهر أسفل الشاشة دون أن تحجب الموقع. */
export default function AdhanRemind({ text, prayerLabel, minutes, onClose }: { text: string; prayerLabel: string; minutes: number; onClose: () => void }) {
  const msg = text.replaceAll("{prayer}", prayerLabel).replaceAll("{min}", String(minutes));
  return (
    <div className="adhan-remind" role="status" aria-live="polite">
      <span className="adhan-remind-ico" aria-hidden="true">🕌</span>
      <p>{msg}</p>
      <button type="button" className="adhan-remind-x" aria-label="إغلاق التنبيه" onClick={onClose}>✕</button>
    </div>
  );
}
