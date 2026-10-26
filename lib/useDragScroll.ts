"use client";
import { useEffect, useRef } from "react";

/**
 * يجعل شريطًا أفقيًا قابلًا للسحب يمينًا وشمالًا.
 * - اللمس (الجوال): يعتمد على التمرير الأصلي للمتصفح (overflow-x: auto) فيبقى سلسًا مع القصور الذاتي.
 * - الفأرة (الحاسوب أو محاكي الجوال): سحب بالضغط والتحريك، مع منع فتح الرابط/الزر عند انتهاء السحب.
 * - يمرّر التبويب المختار إلى منتصف الشريط عند تغيّر `activeKey` (يعمل في الاتجاهين RTL وLTR).
 * الاستعمال: const ref = useDragScroll<HTMLDivElement>(activeId); ثم <div ref={ref} className="chips">.
 */
export function useDragScroll<T extends HTMLElement>(activeKey?: string) {
  const ref = useRef<T>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    let blockClick = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return; // اللمس: تمرير المتصفح الأصلي
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.classList.add("dragging");
        try { el.setPointerCapture(e.pointerId); } catch { /* غير مدعوم */ }
      }
      // المحتوى يتبع المؤشر؛ المعادلة نفسها صحيحة في RTL وLTR.
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const onEnd = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      if (moved) {
        el.classList.remove("dragging");
        try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        blockClick = true;
        window.setTimeout(() => { blockClick = false; }, 60);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (blockClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
      el.removeEventListener("click", onClick, true);
    };
  }, []);

  // إظهار التبويب المختار (لا نفعل ذلك في أول عرض كي لا تقفز الصفحة).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const on = ref.current?.querySelector<HTMLElement>("[aria-selected='true']");
    on?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeKey]);

  return ref;
}
