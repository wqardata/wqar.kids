import type { Metadata } from "next";
import AdhanPrefsPanel from "./AdhanPrefsPanel";

export const metadata: Metadata = { title: "إعدادات الأذان" };

export default function AdhanPrefsPage() {
  return (
    <div className="auth auth--wide">
      <h1>إعدادات الأذان</h1>
      <AdhanPrefsPanel />
    </div>
  );
}
