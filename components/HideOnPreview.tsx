"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isScreenPreviewPath } from "@/lib/previewFrame";

/** لا يعرض أبناءه في صفحات معاينة الشاشات (/preview/...): كي لا تظهر فوقها شاشة الشعار أو نوافذ الأذان والأذكار الحقيقية. */
export default function HideOnPreview({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  return isScreenPreviewPath(path) ? null : <>{children}</>;
}
