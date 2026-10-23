"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import VideosTab from "./VideosTab";
import SettingsTab from "./SettingsTab";
import AppearanceTab from "./AppearanceTab";
import NamedManager from "./NamedManager";
import LiveTab from "./LiveTab";
import MenuTab from "./MenuTab";
import ReportsTab from "./ReportsTab";
import MembersTab from "./MembersTab";
import VideoPageTab from "./VideoPageTab";

type Tab = "videos" | "shorts" | "live" | "reports" | "members" | "categories" | "series" | "menu" | "videopage" | "appearance" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "videos", label: "الفيديوهات" },
  { id: "shorts", label: "المقاطع القصيرة" },
  { id: "live", label: "البث المباشر" },
  { id: "reports", label: "البلاغات" },
  { id: "members", label: "الأعضاء" },
  { id: "categories", label: "التصنيفات" },
  { id: "series", label: "السلاسل" },
  { id: "menu", label: "القائمة" },
  { id: "videopage", label: "صفحة الفيديو" },
  { id: "appearance", label: "المظهر" },
  { id: "settings", label: "إعدادات الموقع" },
];

export default function AdminPanel() {
  const { user, loading, configured, canAdd, isOwner } = useAuth();
  const [tab, setTab] = useState<Tab>("videos");

  if (!configured) return <p className="note admin-note">لم يُضبط Firebase بعد — راجع README.</p>;
  if (loading) return <p className="note admin-note" role="status">جارٍ التحميل…</p>;
  if (!user) {
    return (
      <div className="admin-note">
        <p className="note">سجّل الدخول للوصول إلى لوحة التحكم.</p>
        <Link href="/login" className="btn">تسجيل الدخول بجوجل</Link>
      </div>
    );
  }
  if (!canAdd) return <p className="note admin-note" role="alert">حسابك ({user.email}) غير مخوّل بدخول لوحة التحكم.</p>;

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>لوحة التحكم</h1>
        <Link href="/add" className="btn btn--sm">＋ إضافة فيديو</Link>
      </div>

      <div role="tablist" aria-label="أقسام لوحة التحكم" className="tabs">
        {TABS.filter((t) => t.id !== "members" || isOwner).map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="admin-panel"
            className={tab === t.id ? "tab on" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "videos" && <VideosTab />}
        {tab === "shorts" && <VideosTab shortsOnly />}
        {tab === "live" && <LiveTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "members" && isOwner && <MembersTab />}
        {tab === "categories" && <NamedManager coll="categories" />}
        {tab === "series" && <NamedManager coll="series" />}
        {tab === "menu" && <MenuTab />}
        {tab === "videopage" && <VideoPageTab />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
