"use client";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { AdhanLock } from "@/components/AdhanPopup";
import type { Dhikr } from "@/lib/adhkarCore";

const nf = new Intl.NumberFormat("ar-EG");

/** عدد مرات التكرار بالعربية الفصيحة: مرة واحدة / مرتان / ٣ مرات / ١٠٠ مرة. */
export function repeatLabel(n: number): string {
  if (n <= 1) return "مرة واحدة";
  if (n === 2) return "مرتان";
  if (n <= 10) return `${nf.format(n)} مرات`;
  return `${nf.format(n)} مرة`;
}

/** مسافة السحب (بالبكسل) التي تُعدّ قلبًا للبطاقة. */
const SWIPE_PX = 56;
/** سحبة سريعة (flick) أقصر من SWIPE_PX تكفي إن تمّت خلال هذه المدة (م.ث). */
const FLICK_PX = 28;
const FLICK_MS = 350;

type Props = {
  title: string;
  icon: string;
  items: Dhikr[];
  /** إغلاق دون إتمام (✕ أو Esc). */
  onClose: () => void;
  /** الضغط على «تم» في آخر ذكر. */
  onFinish: () => void;
};

/**
 * قارئ الأذكار: نافذة زجاجية تملأ الشاشة، ذكر واحد في كل مرة.
 * السحب نحو اليسار = التالي، ونحو اليمين = السابق (ترتيب الواجهة العربية: التالي على اليسار).
 * يعمل أيضًا بالأسهم على لوحة المفاتيح وبزرّي التنقل.
 */
export default function AdhkarReader({ title, icon, items, onClose, onFinish }: Props) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<"next" | "prev" | "">("");
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; t: number } | null>(null);
  const dragging = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const last = items.length - 1;
  const go = (to: number) => {
    if (to < 0 || to > last || to === i) return;
    setDir(to > i ? "next" : "prev");
    setI(to);
  };
  const next = () => go(i + 1);
  const prev = () => go(i - 1);

  useEffect(() => {
    root.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, last, onClose]);

  function down(e: RPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: Date.now() };
    dragging.current = false;
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!dragging.current) {
      // نبدأ السحب الأفقي فقط إذا غلب على الرأسي (كي يبقى تمرير النص الطويل سليمًا).
      if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my) * 1.2) return;
      dragging.current = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* لا بأس */ }
    }
    // مقاومة عند أول/آخر ذكر.
    const blocked = (mx < 0 && i >= last) || (mx > 0 && i <= 0);
    setDx(blocked ? mx * 0.25 : mx);
  }
  function up(e: RPointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    if (dragging.current && e.type !== "pointercancel") {
      const quick = Date.now() - s.t < FLICK_MS;
      const need = quick ? FLICK_PX : SWIPE_PX;
      if (dx <= -need) next();
      else if (dx >= need) prev();
    }
    dragging.current = false;
    setDx(0);
  }

  const it = items[i];
  // النص الطويل بخط أصغر ليتّسع قدر الإمكان؛ وما زاد عن الشاشة يُمرَّر رأسيًا داخل البطاقة.
  const size = it.text.length > 420 ? " adhkar-text--xs" : it.text.length > 240 ? " adhkar-text--sm" : "";
  const pct = items.length > 1 ? (i / last) * 100 : 100;

  return (
    <div className="adhkar-reader" role="dialog" aria-modal="true" aria-label={title} ref={root} tabIndex={-1}>
      <AdhanLock />
      <header className="adhkar-head">
        <button type="button" className="adhkar-x" onClick={onClose} aria-label="إغلاق">✕</button>
        <h2><span aria-hidden="true">{icon}</span> {title}</h2>
        <span className="adhkar-count" aria-live="polite">{nf.format(i + 1)} / {nf.format(items.length)}</span>
      </header>
      <div className="adhkar-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>

      <div className="adhkar-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button type="button" className="adhkar-nav adhkar-nav--start" onClick={prev} disabled={i <= 0} aria-label="الذكر السابق">›</button>
        <article
          key={it.id + ":" + i}
          className={`adhkar-card${dir ? ` is-${dir}` : ""}${dx ? " is-drag" : ""}`}
          style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 60}deg)`, opacity: 1 - Math.min(0.4, Math.abs(dx) / 500) } : undefined}
          aria-live="polite"
        >
          <p className={`adhkar-text${size}`}>{it.text}</p>
          <div className="adhkar-meta">
            <span className="adhkar-rep">{repeatLabel(it.repeat)}</span>
            {it.note && <small className="adhkar-note">{it.note}</small>}
          </div>
        </article>
        <button type="button" className="adhkar-nav adhkar-nav--end" onClick={next} disabled={i >= last} aria-label="الذكر التالي">‹</button>
      </div>

      <footer className="adhkar-foot">
        {i < last ? (
          <p className="adhkar-hint">اسحب لليسار للتالي • لليمين للسابق</p>
        ) : (
          <button type="button" className="adhkar-done" onClick={onFinish}>تم — تقبّل الله منك ✓</button>
        )}
        {items.length > 1 && items.length <= 14 && (
          <div className="adhkar-dots" role="tablist" aria-label="الأذكار">
            {items.map((x, k) => (
              <button key={x.id} type="button" role="tab" aria-selected={k === i} aria-label={`الذكر ${nf.format(k + 1)}`} className={k === i ? "on" : ""} onClick={() => go(k)} />
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}
