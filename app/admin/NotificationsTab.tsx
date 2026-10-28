"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc } from "firebase/firestore";
import { USE_NEON } from "@/lib/backend";
import { getDb } from "@/lib/firebase";
import { adminDeleteNotices, adminNotices, adminSendNotice } from "@/lib/neonAdminClient";
import SoundSettings from "@/app/admin/SoundSettings";
import { usePreviewDraft } from "@/lib/preview";
import { NOTICE_COUNT_MAX, NOTICE_COUNT_MIN, NOTICE_REFRESH_MAX, NOTICE_REFRESH_MIN, cleanNoticeCount, cleanNoticeRefreshMin, saveSettings, useSettings } from "@/lib/settings";
import { AUDIENCES, DEFAULT_AUDIENCE, audienceLabel, cleanLink, newNoticeId, NOTICE_KEEP, timeAgo, toNotice, type Audience, type Notice } from "@/lib/notifications";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

const TITLE_MAX = 80;
const BODY_MAX = 500;

/** عدد الإشعارات التي تظهر في قائمة الجرس لكل زائر، ومدة تحديث الجرس. */
function NoticeCountSettings() {
  const { settings, update } = useSettings();
  const [value, setValue] = useState(String(settings.noticeCount));
  const [refresh, setRefresh] = useState(String(settings.noticeRefreshMin));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const next = cleanNoticeCount(value);
  const nextRefresh = cleanNoticeRefreshMin(refresh);
  const dirty = next !== settings.noticeCount || value.trim() === "" || nextRefresh !== settings.noticeRefreshMin || refresh.trim() === "";
  usePreviewDraft("notice-count", { noticeCount: next, noticeRefreshMin: nextRefresh });

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const saved = await saveSettings({ ...settings, noticeCount: next, noticeRefreshMin: nextRefresh });
      update(saved);
      setValue(String(saved.noticeCount));
      setRefresh(String(saved.noticeRefreshMin));
      setMsg("تم حفظ إعدادات عرض الإشعارات ✓");
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
      <div className="field">
        <label htmlFor="nc-r">مدة تحديث الجرس (بالدقائق)</label>
        <input id="nc-r" type="number" inputMode="numeric" dir="ltr" min={0} max={NOTICE_REFRESH_MAX} step={1} value={refresh} onChange={(e) => { setMsg(""); setRefresh(e.target.value); }} />
        <p className="hint">من {NOTICE_REFRESH_MIN} إلى {NOTICE_REFRESH_MAX} دقيقة (الافتراضي 30). يحدّث الجرس نفسه بهذه المدة ما دامت الصفحة ظاهرة أمام الزائر، وأيضًا عند عودته إليها بعد غياب (بفاصل 5 دقائق على الأقل). اكتب 0 لإيقاف التحديث الدوري فيكتفي بالتحديث عند العودة. كلما قصرت المدة زاد استهلاك قاعدة البيانات.</p>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </section>
  );
}

/** إدارة الإشعارات: إرسال إشعار لفئة من الأعضاء، وعرض/حذف ما أُرسل. */
export default function NotificationsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audiences, setAudiences] = useState<Audience[]>([DEFAULT_AUDIENCE]);
  // «الجميع» تشمل الزوار والأعضاء والمشرفين، فاختيارها يلغي بقية الفئات (والعكس) بدل الجمع بينها فيتكرّر الإشعار.
  const toggleAud = (id: Audience) =>
    setAudiences((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (id === "all") return ["all"];
      return [...p.filter((x) => x !== "all"), id];
    });
  const sendingRef = useRef(false); // قفل فوري: الضغط المزدوج أو Enter مرتين قبل أن يُحدَّث state كان يرسل نسختين
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      if (USE_NEON) setItems(await adminNotices());
      else {
        const snap = await getDocs(query(collection(getDb(), "notifications"), limit(100)));
        setItems(snap.docs.map((d) => toNotice(d.id, d.data())).sort((a, b) => b.at - a.at));
      }
    } catch {
      setError("تعذّر تحميل الإشعارات. الصق firestore.rules المحدّث (قسم notifications: «الجميع» و«الزوار» مقروءتان بلا تسجيل دخول) في Firebase ثم Publish، وتأكد أن بريدك في isOwner() وموثَّق.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sendingRef.current) return;
    setError("");
    setMsg("");
    const t = title.trim();
    if (!t) return setError("اكتب عنوان الإشعار.");
    if (audiences.length === 0) return setError("اختر فئة واحدة على الأقل.");
    // «الجميع» تشمل كل الفئات: اختيارها مع أي فئة أخرى يكرّر الإشعار على الشخص نفسه.
    if (audiences.includes("all") && audiences.length > 1) return setError("«الجميع» تشمل الزوار والأعضاء والمشرفين، فلا تجمعها مع فئة أخرى.");
    const l = link.trim();
    const cl = cleanLink(l);
    if (l && !cl) return setError("الرابط يجب أن يبدأ بـ https:// أو بـ / (صفحة داخل الموقع مثل /new).");
    sendingRef.current = true;
    setSending(true);
    try {
      if (USE_NEON) {
        // الخادم ينشئ صفًّا لكل فئة ويحذف الأقدم من آخر NOTICE_KEEP في جملتين، ويتحقق من الحقول بالحدود نفسها.
        await adminSendNotice({ title: t.slice(0, TITLE_MAX), body: body.trim().slice(0, BODY_MAX), link: cl, audiences });
      } else {
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
      }
      setTitle("");
      setBody("");
      setLink("");
      setMsg(`تم إرسال الإشعار إلى: ${audiences.map(audienceLabel).join(" + ")} ✓`);
      await load();
    } catch {
      setError("تعذّر الإرسال. تأكد من صلاحياتك وقواعد Firestore (notifications).");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  // إشعار أُرسل لعدة فئات = وثيقة لكل فئة في Firestore؛ نعرضه هنا صفًّا واحدًا بفئاته مجمّعة (نفس النص والرابط وفي نفس اللحظة).
  const groups = useMemo(() => {
    const out: { key: string; head: Notice; ids: string[]; audiences: Audience[] }[] = [];
    for (const n of items) {
      const g = out.find((x) => x.head.title === n.title && x.head.body === n.body && x.head.link === n.link && Math.abs(x.head.at - n.at) <= 15_000);
      if (g) {
        g.ids.push(n.id);
        if (!g.audiences.includes(n.audience)) g.audiences.push(n.audience);
      } else out.push({ key: n.id, head: n, ids: [n.id], audiences: [n.audience] });
    }
    const order = AUDIENCES.map((a) => a.id);
    for (const g of out) g.audiences.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return out;
  }, [items]);

  async function remove(g: { key: string; head: Notice; ids: string[] }) {
    if (!window.confirm(`حذف الإشعار «${g.head.title}»؟ سيختفي عند الجميع.`)) return;
    setBusy(g.key);
    setError("");
    try {
      if (USE_NEON) await adminDeleteNotices(g.ids);
      else await Promise.all(g.ids.map((id) => deleteDoc(doc(getDb(), "notifications", id))));
      setItems((p) => p.filter((x) => !g.ids.includes(x.id)));
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
        <p className="hint">يرى الأعضاء المسجَّلون أحدث الإشعارات من فئتهم بالعدد المضبوط في «عرض الإشعارات» أدناه (ويُحذف الأقدم تلقائيًا عند تجاوز {NOTICE_KEEP})، ويستطيع كل عضو إزالة الإشعار من قائمته بعد قراءته، ويظهر عدّاد على الجرس لما لم يفتحوه بعد. الزائر غير المسجَّل يرى إشعارات فئتي «الزوار» و«الجميع». بلاغات الزوار الجديدة تظهر للمشرفين فقط على جرسهم تلقائيًا.</p>
      </form>
      </MovableSection>

      <MovableSection id="notif.count"><NoticeCountSettings /></MovableSection>

      <MovableSection id="notif.sound"><SoundSettings /></MovableSection>

      <MovableSection id="notif.sent">
      <div className="panel">
        <h2>الإشعارات المرسلة{groups.length > 0 && ` (${groups.length})`}</h2>
        {loading ? (
          <p className="empty-note" role="status">جارٍ التحميل…</p>
        ) : groups.length === 0 ? (
          <p className="empty-note">لم تُرسل إشعارات بعد.</p>
        ) : (
          <ul className="alist">
            {groups.map((g) => (
              <li key={g.key} className="arow report-row">
                <div className="arow-info">
                  <strong>{g.head.title}</strong>
                  <small>{g.audiences.map(audienceLabel).join(" + ")} • {timeAgo(g.head.at)}{g.head.link ? ` • ${g.head.link}` : ""}</small>
                  {g.head.body && <p className="desc-note">{g.head.body}</p>}
                </div>
                <div className="arow-actions">
                  <button type="button" className="btn btn--ghost btn--sm danger" disabled={busy === g.key} onClick={() => void remove(g)}>حذف</button>
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
