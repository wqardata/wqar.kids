"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { clearVideoCache } from "@/lib/videos";
import VideosTab from "./VideosTab";
import SettingsTab from "./SettingsTab";
import SignupTab from "./SignupTab";
import AppearanceTab from "./AppearanceTab";
import NamedManager from "./NamedManager";
import MenuTab from "./MenuTab";
import ReportsTab from "./ReportsTab";
import MembersTab from "./MembersTab";
import WatchButtonsEditor from "./WatchButtonsEditor";
import BehaviorPanel from "./BehaviorPanel";
import AdhanTab from "./AdhanTab";
import AdhkarTab from "./AdhkarTab";
import NotificationsTab from "./NotificationsTab";
import DisplayTab from "./DisplayTab";

type Group = "settings" | "tarbawi" | "notifications" | "organize" | "content";
type Sub = "settings" | "signup" | "appearance" | "menu" | "watch" | "adhan" | "adhkar" | "notifications" | "members" | "videos" | "shorts" | "display" | "categories" | "series" | "reports";

type SubTab = { id: Sub; label: string; ownerOnly?: boolean };
const GROUPS: { id: Group; label: string; subs: SubTab[] }[] = [
  { id: "settings", label: "الإعدادات", subs: [{ id: "settings", label: "إعدادات الموقع" }, { id: "signup", label: "التسجيل" }] },
  { id: "tarbawi", label: "إعدادات تربوية", subs: [{ id: "adhan", label: "إعدادات الأذان" }, { id: "adhkar", label: "إعدادات الأذكار" }] },
  { id: "notifications", label: "الإشعارات", subs: [{ id: "notifications", label: "إدارة الإشعارات" }] },
  {
    id: "organize",
    label: "التنظيم",
    subs: [
      { id: "appearance", label: "المظهر" },
      { id: "menu", label: "القوائم" },
      { id: "watch", label: "صفحة الفيديو" },
      { id: "members", label: "الأعضاء", ownerOnly: true },
    ],
  },
  {
    id: "content",
    label: "إدارة المحتوى",
    subs: [
      { id: "videos", label: "الفيديوهات" },
      { id: "shorts", label: "المقاطع القصيرة" },
      { id: "categories", label: "التصنيفات" },
      { id: "series", label: "المجموعات" },
      { id: "display", label: "العرض" },
      { id: "reports", label: "البلاغات" },
    ],
  },
];

export default function AdminPanel({ initial }: { initial?: "series" | "reports" }) {
  const { user, loading, configured, canAdd, isOwner } = useAuth();
  const [group, setGroup] = useState<Group>("content");
  // يُتذكَّر آخر تبويب فرعي في كل مجموعة عند التنقل بينها.
  const [subs, setSubs] = useState<Record<Group, Sub>>({ settings: "settings", tarbawi: "adhan", notifications: "notifications", organize: "appearance", content: initial === "series" ? "series" : initial === "reports" ? "reports" : "videos" });

  // ما يتغيّر في اللوحة (فيديوهات/مجموعات/تصنيفات) يجب أن يظهر فورًا للمشرف: نمسح التخزين المؤقت عند مغادرتها.
  useEffect(() => () => clearVideoCache(), []);

  // الانتقال من الإشعار إلى /admin?go=reports وأنت داخل اللوحة: نفتح التبويب المطلوب.
  useEffect(() => {
    if (!initial) return;
    setGroup("content");
    setSubs((p) => ({ ...p, content: initial === "series" ? "series" : "reports" }));
  }, [initial]);

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

  const current = GROUPS.find((g) => g.id === group) ?? GROUPS[0];
  const visibleSubs = current.subs.filter((s) => !s.ownerOnly || isOwner);
  const sub = visibleSubs.some((s) => s.id === subs[group]) ? subs[group] : visibleSubs[0].id;

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>لوحة التحكم</h1>
        <Link href="/add" className="btn btn--sm">＋ إضافة فيديو</Link>
      </div>

      <div role="tablist" aria-label="أقسام لوحة التحكم" className="tabs tabs--main">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            id={`group-${g.id}`}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            aria-controls="admin-panel"
            className={group === g.id ? "tab on" : "tab"}
            onClick={() => setGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {visibleSubs.length > 1 && (
        <div role="tablist" aria-label={`أقسام ${current.label}`} className="tabs tabs--sub">
          {visibleSubs.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={sub === t.id}
              aria-controls="admin-panel"
              className={sub === t.id ? "tab on" : "tab"}
              onClick={() => setSubs((s) => ({ ...s, [group]: t.id }))}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div id="admin-panel" role="tabpanel" aria-labelledby={visibleSubs.length > 1 ? `tab-${sub}` : `group-${group}`}>
        {sub === "settings" && <SettingsTab />}
        {sub === "signup" && <SignupTab />}
        {sub === "appearance" && (
          <div className="admin-stack">
            <AppearanceTab />
            <BehaviorPanel />
          </div>
        )}
        {sub === "adhan" && <AdhanTab />}
        {sub === "adhkar" && <AdhkarTab />}
        {sub === "notifications" && <NotificationsTab />}
        {sub === "menu" && <MenuTab />}
        {sub === "watch" && <WatchButtonsEditor />}
        {sub === "members" && isOwner && <MembersTab />}
        {sub === "videos" && <VideosTab />}
        {sub === "shorts" && <VideosTab shortsOnly />}
        {sub === "categories" && <NamedManager coll="categories" />}
        {sub === "series" && <NamedManager coll="series" />}
        {sub === "display" && <DisplayTab />}
        {sub === "reports" && <ReportsTab />}
      </div>
    </div>
  );
}
