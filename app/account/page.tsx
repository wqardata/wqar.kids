import type { Metadata } from "next";
import AccountPanel from "./AccountPanel";

export const metadata: Metadata = { title: "حسابي", robots: { index: false, follow: false } };

export default function Account() {
  return (
    <div className="auth auth--wide">
      <h1>حسابي</h1>
      <AccountPanel />
    </div>
  );
}
