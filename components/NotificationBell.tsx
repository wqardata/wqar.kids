"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { useAuth } from "@/lib/auth";
import { readSeen, timeAgo, useNotifications, useOpenReports, writeSeen, type Notice } from "@/lib/notifications";

const cap = (n: number) => (n > 9 ? "9+" : String(n));

function NoticeLink({ n }: { n: Notice }) {
  if (!n.link) return null;
  return n.link.startsWith("/") ? (
    <Link href={n.link} className="notif-more">عرض</Link>
  ) : (
    <a href={n.link} className="notif-more" target="_blank" rel="noopener noreferrer">فتح الرابط</a>
  );
}

/**
 * جرس الإشعارات في الترويسة (للجميع):
 *  - الزائر غير المسجَّل: رقم 1 دائمًا، وعند الضغط رسالة «الرجاء التسجيل…».
 *  - العضو المسجَّل: إشعارات الإدارة بحسب فئته، والعدّاد لغير المقروء.
 *  - المشرف: يُضاف إلى العدّاد والقائمة عدد البلاغات الجديدة.
 */
export default function NotificationBell() {
  const { user, loading, canAdd } = useAuth();
  const uid = user?.uid ?? null;
  const { items, failed } = useNotifications(uid, canAdd);
  const reports = useOpenReports(canAdd);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [mark, setMark] = useState(0); // حدّ «الجديد» داخل القائمة المفتوحة
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(uid ? readSeen(uid) : 0);
  }, [uid]);

  const unread = items.filter((n) => n.at > seen).length;
  const total = uid ? unread + (canAdd ? reports.count : 0) : 1;

  function toggle() {
    if (open) return close();
    setMark(seen);
    if (uid) {
      const latest = items.reduce((m, n) => Math.max(m, n.at), seen);
      writeSeen(uid, latest);
      setSeen(latest);
      if (canAdd) reports.refresh();
    }
    setOpen(true);
  }
  function close() {
    setOpen(false);
    btn.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    pop.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const showBadge = !loading && total > 0;
  const label = loading ? "الإشعارات" : uid ? (total > 0 ? `الإشعارات (${total} جديد)` : "الإشعارات") : "الإشعارات (1)";

  return (
    <>
      <button ref={btn} type="button" className="bell" aria-label={label} title="الإشعارات" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <Icon name="bell" size={20} />
        {showBadge && <span className="bell-n" aria-hidden="true">{cap(total)}</span>}
      </button>
      {open &&
        createPortal(
          <div className="notif-layer">
            <div className="notif-backdrop" onClick={close} />
            <div className="notif-pop" role="dialog" aria-modal="true" aria-label="الإشعارات" tabIndex={-1} ref={pop} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
              <div className="notif-head">
                <strong>الإشعارات</strong>
                <button type="button" className="acct-close notif-x" aria-label="إغلاق" onClick={close}><Icon name="close" size={20} /></button>
              </div>
              {!uid ? (
                <div className="notif-guest">
                  <p>الرجاء التسجيل لتفعيل جميع المميزات</p>
                  <div className="acct-actions">
                    <Link href="/login?mode=signup" className="acct-btn acct-btn--primary">تسجيل جديد</Link>
                    <Link href="/login?mode=signin" className="acct-btn">تسجيل دخول</Link>
                  </div>
                </div>
              ) : (
                <ul className="notif-list">
                  {canAdd && reports.count > 0 && (
                    <li>
                      <Link href="/admin?go=reports" className="notif-item notif-item--report new">
                        <strong>{reports.count} بلاغ جديد بانتظار المراجعة</strong>
                        <small>للمشرفين فقط — اضغط للانتقال إلى البلاغات</small>
                      </Link>
                    </li>
                  )}
                  {items.map((n) => (
                    <li key={n.id} className={n.at > mark ? "notif-item new" : "notif-item"}>
                      <strong>{n.title}</strong>
                      {n.body && <p>{n.body}</p>}
                      <small>{timeAgo(n.at)}</small>
                      <NoticeLink n={n} />
                    </li>
                  ))}
                  {items.length === 0 && !(canAdd && reports.count > 0) && (
                    <li className="empty-note">{failed ? "تعذّر تحميل الإشعارات حاليًا." : "لا توجد إشعارات حاليًا."}</li>
                  )}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
