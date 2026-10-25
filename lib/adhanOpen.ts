"use client";
// هل شاشة الأذان مفتوحة الآن؟ تقفل شاشة الأذان كل ما خلفها (inert)، وإشعار الأذكار يبدأ في الوقت نفسه (من أذان الفجر/العصر)،
// فكان يظهر خلفها معتّمًا ولا يستجيب لأي ضغطة. لذلك يُخفى الإشعار طوال ظهور شاشة الأذان ويعود بعد إغلاقها.
import { useSyncExternalStore } from "react";

let open = false;
const subs = new Set<() => void>();

export function setAdhanOpen(v: boolean): void {
  if (open === v) return;
  open = v;
  subs.forEach((f) => f());
}

export function useAdhanOpen(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => open,
    () => false,
  );
}
