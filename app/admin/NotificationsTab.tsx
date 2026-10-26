"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import SoundSettings from "@/app/admin/SoundSettings";
import { usePreviewDraft } from "@/lib/preview";
import { NOTICE_COUNT_MAX, NOTICE_COUNT_MIN, cleanNoticeCount, saveSettings, useSettings } from "@/lib/settings";
import { AUDIENCES, audienceLabel, cleanLink, newNoticeId, NOTICE_KEEP, timeAgo, toNotice, type Audience, type Notice } from "@/lib/notifications";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

const TITLE_MAX = 80;
const BODY_MAX = 500;

/** عدد الإشعارات التي تظهر في قائمة الجرس لكل زائر. */
function NoticeCountSettings() {
  const { settings, update } = useSettings();
  const [value, setValue] = useState(String(settings.noticeCount));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const next = cleanNoticeCount(value);
  const dirty = next !== settings.noticeCount || value.trim() === "";
  usePreviewDraft("notice-count", { noticeCount: next });

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const saved = await saveSettings({ ...settings, noticeCount: next });
      update(saved);
      setValue(String(saved.noticeCount));
      setMsg("تم حفظ عدد الإشعارات المعروضة ✓");
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel auth-form" aria-labelledby="nc-h">
      <h2 id="nc-h">عرض الإشعارات {dirty && <span className="dirty-dot">● تعديلات غير محفوظة</span>}</h2>
      <div className="field">
        <label htmlFor="nc-n">عدد الإشعارات الظاهرة في قائمة الجرس</label>
        <input id="nc-n" type="number" inputMode="numeric" dir="ltr" min={NOTICE_COUNT_MIN} max={NOTICE_COUNT_MAX} step={1} value={value} onChange={(e) => { setMsg(""); setValue(e.target.value); }} />
        <p className="hint">من {NOTICE_COUNT_MIN} إلى {NOTICE_COUNT_MAX}. يرى كل زائر أحدث هذا العدد من إشعارات فئته. يحتفظ الموقع بآخر {NOTICE_KEEP} إشعارًا لكل فئة ويحذف الأقدم تلقائيًا عند إرسال جديد.</p>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ عدد الإشعارات"}</button>
      </div>
    </section>
  );
}

/** إدارة الإشعارات: إرسال إشعار لفئة من الأعضاء، وعرض/حذف ما أُرسل. */
export default function NotificationsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audiences, setAudiences] = useState<Audience[]>(["all"]);
  const toggleAud = (id: Audience) => setAudiences((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(getDb(), "notifications"), limit(100)));
      setItems(snap.docs.map((d) => toNotice(d.id, d.data())).sort((a, b) => b.at - a.at));
    } catch {
      setError("تعذّر تحميل الإشعارات. الصق firestore.rules المحدّث (قسم notifications فيه فئة guests) في Firebase ثم Publish، وتأكد أن بريدك في isOwner() وموثَّق.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const t = title.trim();
    if (!t) return setError("اكتب عنوان الإشعار.");
    if (audiences.length === 0) return setError("اختر فئة واحدة على الأقل.");
    // «الجميع» تشمل المشاهدين والمشرفين: اختيارها مع «المشاهدون» أو «المشرفون» يكرّر الإشعار على العضو نفسه.
    if (audiences.includes("all") && (audiences.includes("viewers") || audiences.includes("admins"))) return setError("«كل الأعضاء» تشمل المشاهدين والمشرفين، فلا تجمعها معهما.");
    const l = link.trim();
    const cl = cleanLink(l);
    if (l && !cl) return setError("الرابط يجب أن يبدأ بـ https:// أو بـ / (صفحة داخل الموقع مثل /new).");
    setSending(true);
    try {
      // وثيقة لكل فئة مختارة (القواعد والاستعلامات تقرأ فئة واحدة لكل وثيقة).
      await Promise.all(
        audiences.map((audience) =>
          setDoc(doc(getDb(), "notifications", newNoticeId()), {
            title: t.slice(0, TITLE_MAX),
            body: body.trim().slice(0, BODY_MAX),
            link: cl,
            audience,
            createdAt: serverTimestamp(),
          }),
        ),
      );
      // نحتفظ بآخر NOTICE_KEEP إشعارًا لكل فئة: يُحذف الأقدم تلقائيًا.
      try {
        const all = await getDocs(query(collection(getDb(), "notifications"), limit(300)));
        const seen: Record<string, number> = {};
        const extra = all.docs
          .map((d) => toNotice(d.id, d.data()))
          .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
          .filter((n) => (seen[n.audience] = (seen[n.audience] ?? 0) + 1) > NOTICE_KEEP);
        await Promise.all(extra.map((n) => deleteDoc(doc(getDb(), "notifications", n.id))));
      } catch {
        /* التنظيف اختياري: القائمة تعرض العدد المضبوط على أي حال */
      }
      setTitle("");
      setBody("");
      setLink("");
      setMsg(`تم إرسال الإشعار إلى: ${audiences.map(audienceLabel).join(" + ")} ✓`);
      await load();
    } catch {
      setError("تعذّر الإرسال. تأكد من صلاحياتك وقواعد Firestore (notifications).");
    } finally {
      setSending(false);
    }
  }

  async function remove(n: Notice) {
    if (!window.confirm(`حذف الإشعار «${n.title}»؟ سيختفي عند الجميع.`)) return;
    setBusy(n.id);
    setError("");
    try {
      await deleteDoc(doc(getDb(), "notifications", n.id));
      setItems((p) => p.filter((x) => x.id !== n.id));
    } catch {
      setError("تعذّر الحذف. تأكد من الصلاحيات.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <MovableSection id="notif.send">
      <form className="panel auth-form notif-admin-form" onSubmit={(e) => void send(e)}>
        <h2>إرسال إشعار</h2>
        <div className="field">
          <label htmlFor="nf-title">العنوان ({title.length}/{TITLE_MAX})</label>
          <input id="nf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} placeholder="مثال: حلقات جديدة هذا الأسبوع" />
        </div>
        <div className="field">
          <label htmlFor="nf-body">النص (اختياري) ({body.length}/{BODY_MAX})</label>
          <textarea id="nf-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} />
        </div>
        <div className="field">
          <label htmlFor="nf-link">رابط عند الضغط (اختياري)</label>
          <input id="nf-link" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} placeholder="/new  أو  https://…" />
        </div>
        <fieldset className="notif-aud">
          <legend>الفئات التي يظهر لها (يمكن اختيار أكثر من فئة)</legend>
          {AUDIENCES.map((a) => (
            <label key={a.id} className="check">
              <input type="checkbox" checked={audiences.includes(a.id)} onChange={() => toggleAud(a.id)} />
              <span><strong>{a.label}</strong><small> — {a.note}</small></span>
            </label>
          ))}
        </fieldset>
        {error && <p className="field-error" role="alert">{error}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}
        <div className="addrow">
          <button type="submit" className="btn" disabled={sending || !title.trim() || audiences.length === 0}>{sending ? "جارٍ الإرسال…" : "إرسال الإشعار"}</button>
        </div>
        <p className="hint">يرى الأعضاء المسجَّلون أحدث الإشعارات من فئتهم بالعدد المضبوط في «عرض الإشعارات» أدناه (ويُحذف الأقدم تلقائيًا عند تجاوز {NOTICE_KEEP})، ويستطيع كل عضو إزالة الإشعار من قائمته بعد قراءته، ويظهر عدّاد على الجرس لما لم يفتحوه بعد. الزائر غير المسجَّل يرى إشعارات فئة «غير المسجَّلين» فقط. بلاغات الزوار الجديدة تظهر للمشرفين فقط على جرسهم تلقائيًا.</p>
      </form>
      </MovableSection>

      <MovableSection id="notif.count"><NoticeCountSettings /></MovableSection>

      <MovableSection id="notif.sound"><SoundSettings /></MovableSection>

      <MovableSection id="notif.sent">
      <div className="panel">
        <h2>الإشعارات المرسلة{items.length > 0 && ` (${items.length})`}</h2>
        {loading ? (
          <p className="empty-note" role="status">جارٍ التحميل…</p>
        ) : items.length === 0 ? (
          <p className="empty-note">لم تُرسل إشعارات بعد.</p>
        ) : (
          <ul className="alist">
            {items.map((n) => (
              <li key={n.id} className="arow report-row">
                <div className="arow-info">
                  <strong>{n.title}</strong>
                  <small>{audienceLabel(n.audience)} • {timeAgo(n.at)}{n.link ? ` • ${n.link}` : ""}</small>
                  {n.body && <p className="desc-note">{n.body}</p>}
                </div>
                <div className="arow-actions">
                  <button type="button" className="btn btn--ghost btn--sm danger" disabled={busy === n.id} onClick={() => void remove(n)}>حذف</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </MovableSection>
    </>
  );
}
