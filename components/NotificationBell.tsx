"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { armSounds, playAlert } from "@/lib/sounds";
import { readGone, readSeenIds, timeAgo, writeGone, useNotifications, useOpenReports, writeSeenIds, type Notice } from "@/lib/notifications";

const GUEST = "guest"; // مفتاح «آخر ما رآه» للزائر غير المسجَّل
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
 *  - الزائر غير المسجَّل: إشعارات فئة «غير المسجَّلين» إن وُجدت، ورقم 1 دائمًا لرسالة «الرجاء التسجيل…».
 *  - العضو المسجَّل: إشعارات الإدارة بحسب فئته، والعدّاد لغير المقروء.
 *  - المشرف: يُضاف إلى العدّاد والقائمة عدد البلاغات الجديدة.
 */
export default function NotificationBell() {
  const { user, loading, canAdd } = useAuth();
  const uid = user?.uid ?? null;
  const { settings } = useSettings();
  const { items: all, failed, loaded } = useNotifications(uid, canAdd, !loading, settings.noticeCount);
  const snd = settings.sounds;
  const [gone, setGone] = useState<string[]>([]);
  const reports = useOpenReports(canAdd);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[] | null>(null); // معرّفات ما رآه العضو (null = لم يُقرأ بعد)
  const [mark, setMark] = useState<string[]>([]); // الجديد وقت فتح القائمة (للتمييز داخلها)
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(readSeenIds(uid ?? GUEST));
    setGone(readGone(uid ?? GUEST));
  }, [uid]);

  // أول زيارة (لا سجل محفوظ): ما وصل عند التحميل لا يُعدّ جديدًا، وما يصل بعده يزيد العدّاد.
  useEffect(() => {
    if (seen !== null || !loaded || loading) return;
    const ids = all.map((n) => n.id);
    setSeen(ids);
    writeSeenIds(uid ?? GUEST, ids);
  }, [seen, loaded, loading, all, uid]);

  // صوت تنبيه عند وصول إشعار جديد أثناء فتح الموقع (ما كان موجودًا عند التحميل لا يُصدر صوتًا).
  // أول ثانيتين بعد الاشتراك نكتفي بتسجيل ما وصل (لقطات الفئات تصل متفرقة)، وبعدها أي معرّف جديد = نغمة.
  const known = useRef<Set<string>>(new Set());
  const armedAt = useRef(0);
  const lastReports = useRef<number | null>(null);
  useEffect(() => armSounds(), []);
  useEffect(() => {
    known.current = new Set();
    lastReports.current = null;
    armedAt.current = Date.now() + 2500;
  }, [uid, loading]);
  useEffect(() => {
    if (loading) return;
    const armed = Date.now() >= armedAt.current;
    let fresh = false;
    for (const n of all) {
      if (!known.current.has(n.id)) {
        known.current.add(n.id);
        if (armed && !gone.includes(n.id)) fresh = true;
      }
    }
    if (fresh && snd.notify) playAlert("notify", snd.volume);
  }, [all, loading, gone, snd.notify, snd.volume]);
  useEffect(() => {
    if (!canAdd) return;
    const prev = lastReports.current;
    lastReports.current = reports.count;
    if (prev !== null && reports.count > prev && Date.now() >= armedAt.current && snd.notify) playAlert("notify", snd.volume);
  }, [reports.count, canAdd, snd.notify, snd.volume]);

  // ما أزاله المستخدم لا يظهر ولا يُعدّ في العدّاد.
  const items = all.filter((n) => !gone.includes(n.id));
  function dismiss(id: string) {
    const next = [...gone, id];
    setGone(next);
    writeGone(uid ?? GUEST, next);
  }

  const unread = seen === null ? 0 : items.filter((n) => !seen.includes(n.id)).length;
  const total = uid ? unread + (canAdd ? reports.count : 0) : unread;

  function toggle() {
    if (open) return close();
    const cur = seen ?? [];
    setMark(items.filter((n) => !cur.includes(n.id)).map((n) => n.id));
    const next = [...cur, ...items.map((n) => n.id).filter((id) => !cur.includes(id))];
    writeSeenIds(uid ?? GUEST, next);
    setSeen(next);
    if (uid && canAdd) reports.refresh();
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

  // تنبيه عائم للمشرف عند وجود بلاغات جديدة (يعاد إظهاره إن زاد العدد)، ينقله إلى صفحة متابعة البلاغات.
  const [toastSeen, setToastSeen] = useState(0);
  useEffect(() => {
    try { setToastSeen(Number(sessionStorage.getItem("reports-toast")) || 0); } catch { /* لا بأس */ }
  }, []);
  const showToast = !!uid && canAdd && reports.count > toastSeen && !open;
  const hideToast = () => {
    setToastSeen(reports.count);
    try { sessionStorage.setItem("reports-toast", String(reports.count)); } catch { /* لا بأس */ }
  };

  const showBadge = !loading && total > 0;
  const label = loading ? "الإشعارات" : total > 0 ? `الإشعارات (${total} جديد)` : "الإشعارات";

  return (
    <>
      <button ref={btn} type="button" className="bell" aria-label={label} title="الإشعارات" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <Icon name="bell" size={20} />
        {showBadge && <span className="bell-n" aria-hidden="true">{cap(total)}</span>}
      </button>
      {showToast &&
        createPortal(
          <div className="report-toast" role="status" aria-live="polite">
            <Link href="/admin?go=reports" onClick={hideToast}>
              <strong>{reports.count === 1 ? "بلاغ جديد عن فيديو" : `${reports.count} بلاغات جديدة عن فيديوهات`}</strong>
              <small>اضغط لفتح متابعة البلاغات</small>
            </Link>
            <button type="button" aria-label="إخفاء التنبيه" onClick={hideToast}><Icon name="close" size={16} /></button>
          </div>,
          document.body,
        )}
      {open &&
        createPortal(
          <div className="notif-layer">
            <div className="notif-backdrop" onClick={close} />
            <div className="notif-pop" role="dialog" aria-modal="true" aria-label="الإشعارات" tabIndex={-1} ref={pop} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
              <div className="notif-head">
                <strong>الإشعارات</strong>
                <button type="button" className="acct-close notif-x" aria-label="إغلاق" onClick={close}><Icon name="close" size={20} /></button>
              </div>
              {(
              <ul className="notif-list">
                {uid && canAdd && reports.count > 0 && (
                  <li>
                    <Link href="/admin?go=reports" className="notif-item notif-item--report new">
                      <strong>{reports.count} بلاغ جديد بانتظار المراجعة</strong>
                      <small>للمشرفين فقط — اضغط للانتقال إلى البلاغات</small>
                    </Link>
                  </li>
                )}
                {items.map((n) => (
                  <li key={n.id} className={mark.includes(n.id) ? "notif-item new" : "notif-item"}>
                    <strong>{n.title}</strong>
                    {n.body && <p>{n.body}</p>}
                    <small>{timeAgo(n.at)}</small>
                    <NoticeLink n={n} />
                    <button type="button" className="notif-del" aria-label={`إزالة الإشعار: ${n.title}`} title="إزالة" onClick={() => dismiss(n.id)}>
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
                {items.length === 0 && !(uid && canAdd && reports.count > 0) && (
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
