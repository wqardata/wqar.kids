"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const FIRST_ROWS = 5; // الصفحة تعرض خمسة صفوف فقط
const MORE_ROWS = 2; // وعند النزول لآخر صف يُحمَّل صفّان
const MORE_DELAY = 350; // مهلة قصيرة يظهر فيها ظل التحميل

/**
 * ترقيم بالصفوف: يقيس عدد الأعمدة الفعلي للشبكة (يتغيّر مع حجم الشاشة) ويعرض خمسة صفوف،
 * ثم يضيف صفّين كلما وصل الزائر إلى نهاية القائمة.
 * الاستعمال: ضع gridRef على <ul className="grid">، واعرض items.slice(0, visible)، وأضف <li>الهياكل</li> بعدد pending،
 * ثم ضع <div ref={sentinelRef} /> بعد القائمة.
 */
export function usePaged(total: number) {
  const gridRef = useRef<HTMLUListElement>(null);
  const [cols, setCols] = useState(1);
  const [rows, setRows] = useState(FIRST_ROWS);
  const [loading, setLoading] = useState(false);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => setNode(el), []);

  // عدد الأعمدة الحالي من CSS نفسه، فيبقى صحيحًا على الجوال والحاسوب وعند تدوير الشاشة.
  useLayoutEffect(() => {
    const g = gridRef.current;
    if (!g) return;
    const measure = () => {
      const n = getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length;
      setCols(Math.max(1, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    return () => ro.disconnect();
  }, [total]);

  // تغيّر القائمة (تصنيف جديد، بحث…) يعيدنا إلى خمسة صفوف.
  useEffect(() => {
    setRows(FIRST_ROWS);
    setLoading(false);
  }, [total]);

  const visible = Math.min(total, rows * cols);
  const hasMore = visible < total;

  useEffect(() => {
    if (!node || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setLoading(true);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, hasMore, loading, rows]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setRows((r) => r + MORE_ROWS);
      setLoading(false);
    }, MORE_DELAY);
    return () => clearTimeout(t);
  }, [loading]);

  const pending = loading ? Math.min(cols * MORE_ROWS, total - visible) : 0;
  return { gridRef, sentinelRef, visible, pending };
}
