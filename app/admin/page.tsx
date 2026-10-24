import type { Metadata } from "next";
import AdminPanel from "./AdminPanel";

export const metadata: Metadata = { title: "لوحة التحكم", robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  const { go } = await searchParams;
  return <AdminPanel initial={go === "series" ? "series" : go === "reports" ? "reports" : undefined} />;
}
