import type { Metadata } from "next";
import AdhkarScreen from "./AdhkarScreen";

export const metadata: Metadata = { title: "معاينة الأذكار", robots: { index: false, follow: false } };

export default function Page() {
  return <AdhkarScreen />;
}
