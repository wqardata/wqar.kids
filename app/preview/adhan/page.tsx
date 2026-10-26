import type { Metadata } from "next";
import AdhanScreen from "./AdhanScreen";

export const metadata: Metadata = { title: "معاينة الأذان", robots: { index: false, follow: false } };

export default function Page() {
  return <AdhanScreen />;
}
