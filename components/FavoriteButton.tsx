"use client";

import { useEffect, useState } from "react";
import { doc, increment, updateDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { createLocalSet } from "@/lib/localSet";
import { USE_NEON } from "@/lib/backend";
import { neonPost } from "@/lib/neonClient";

// الفيديوهات التي عدّها هذا المتصفح (لمنع أن يزيد الزائر العدّاد أكثر من مرة، ولتمكينه من التراجع).
const counted = createLocalSet("fav-counted");

const fmt = (n: number) => new Intl.NumberFormat("ar-u-nu-latn").format(n);

/**
 * زر المفضلة: لا يحفظ قائمة ولا صفحة، بل يعدّ المعجبين بكل فيديو (عدّاد عام في videos/{id}.likes).
 * الضغطة الأولى تزيد العدّاد 1 والثانية تتراجع؛ ما عدّه المتصفح يُحفظ محليًا فقط ليبقى القلب مضيئًا.
 */
export default function FavoriteButton({ id, initial = 0 }: { id: string; initial?: number }) {
  const mine = counted.useIds().includes(id);
  const [count, setCount] = useState(Math.max(0, initial));
  const [busy, setBusy] = useState(false);
  useEffect(() => setCount(Math.max(0, initial)), [initial, id]);

  async function toggle() {
    if (busy) return;
    const delta = mine ? -1 : 1;
    // لا نغيّر العدّاد العام إن كان الصفر ولا يزال المتصفح يحاول التراجع.
    if (delta < 0 && count <= 0) {
      counted.toggle(id);
      return;
    }
    setBusy(true);
    setCount((c) => Math.max(0, c + delta));
    counted.toggle(id);
    try {
      if (USE_NEON) await neonPost("/api/data/like", { id, delta });
      else {
        if (!isFirebaseConfigured) throw new Error("no-firebase");
        await updateDoc(doc(getDb(), "videos", id), { likes: increment(delta) });
      }
    } catch {
      // فشل الكتابة (قواعد قديمة أو لا اتصال): نتراجع كي لا يُظهر الزر رقمًا لم يُسجَّل.
      setCount((c) => Math.max(0, c - delta));
      counted.toggle(id);
    } finally {
      setBusy(false);
    }
  }

  const label = mine ? "إلغاء إعجابي بهذا الفيديو" : "أُعجبني هذا الفيديو";
  return (
    <button type="button" className={`ibtn${mine ? " on" : ""}`} aria-pressed={mine} aria-label={`${label} (${fmt(count)} معجب)`} title={label} onClick={() => void toggle()} disabled={busy}>
      <Icon name="heart" size={20} />
      <span className="ibtn-count">{fmt(count)}</span>
    </button>
  );
}
