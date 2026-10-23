"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { openGrabber } from "@/lib/frameGrab";
import { EMPTY_LIVE, LIVE_MAX_ITEMS, formatTotal, parseLive, totalSeconds, type LiveDoc, type LiveItem } from "@/lib/live";
import { toVideo, type VideoDoc } from "@/lib/videos";

function norm(s: string) {
  return s.toLowerCase().replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
}

const toItem = (v: VideoDoc): LiveItem => ({ videoId: v.id, title: v.title, driveId: v.driveId, thumbnail: v.thumbnail, duration: v.duration ?? 0 });

export default function LiveTab() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<LiveDoc>(EMPTY_LIVE);
  const [title, setTitle] = useState("");
  const [loop, setLoop] = useState(true);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<null | { replace: number | null }>(null);
  const [q, setQ] = useState("");
  const [probe, setProbe] = useState("");

  useEffect(() => {
    let off = false;
    Promise.all([
      getDoc(doc(getDb(), "live", "current")),
      getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(200))),
    ])
      .then(([cur, snap]) => {
        if (off) return;
        const l = parseLive(cur.exists() ? cur.data() : undefined);
        setSaved(l);
        setTitle(l.title);
        setLoop(l.loop);
        setItems(l.items);
        setVideos(snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => v.driveId));
      })
      .catch(() => !off && setError("تعذّر التحميل. تأكد من قواعد Firestore (live)."))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, []);

  const total = totalSeconds(items);
  const unknown = items.filter((i) => i.duration <= 0).length;
  const dirty = useMemo(
    () => title !== saved.title || loop !== saved.loop || JSON.stringify(items) !== JSON.stringify(saved.items),
    [title, loop, items, saved],
  );

  const shown = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return videos.filter((v) => {
      const hay = norm(`${v.title} ${v.seriesName} ${v.categoryName}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [videos, q]);

  function move(i: number, d: -1 | 1) {
    setItems((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function choose(v: VideoDoc) {
    if (!picker) return;
    const it = toItem(v);
    if (picker.replace !== null) {
      setItems((prev) => prev.map((x, i) => (i === picker.replace ? it : x)));
      setPicker(null);
    } else {
      if (items.length >= LIVE_MAX_ITEMS) return setError(`الحد الأقصى ${LIVE_MAX_ITEMS} فيديو في القائمة.`);
      setError("");
      setItems((prev) => [...prev, it]);
    }
  }

  /** يقرأ مدد الفيديوهات الناقصة من الفيديو نفسه (بيانات وصفية فقط) ويحفظها في مستند كل فيديو. */
  async function fetchMissing() {
    if (!user) return;
    const missing = [...new Set(items.filter((i) => i.duration <= 0).map((i) => i.videoId))];
    if (missing.length === 0) return;
    setError("");
    const got = new Map<string, number>();
    for (let n = 0; n < missing.length; n++) {
      const id = missing[n];
      const it = items.find((x) => x.videoId === id);
      if (!it) continue;
      setProbe(`جارٍ قراءة مدة الفيديو ${n + 1} من ${missing.length}…`);
      try {
        const token = await user.getIdToken();
        const g = await openGrabber(`/api/drive-video?id=${encodeURIComponent(it.driveId)}&token=${encodeURIComponent(token)}`);
        const d = Math.round(g.duration);
        g.dispose();
        if (d > 0) {
          got.set(id, d);
          await updateDoc(doc(getDb(), "videos", id), { duration: d }).catch(() => {});
        }
      } catch {
        /* نكمل مع الباقي */
      }
    }
    setProbe("");
    if (got.size) {
      setItems((prev) => prev.map((x) => (got.has(x.videoId) && x.duration <= 0 ? { ...x, duration: got.get(x.videoId) ?? 0 } : x)));
      setVideos((prev) => prev.map((v) => (got.has(v.id) ? { ...v, duration: got.get(v.id) ?? null } : v)));
    }
    if (got.size < missing.length) setError("تعذّرت قراءة مدة بعض الفيديوهات (صيغة غير مدعومة في المتصفح أو الملف غير مشارك). لا يمكن بدء البث قبل معرفة كل المدد.");
  }

  async function persist(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await setDoc(
        doc(getDb(), "live", "current"),
        { title: title.trim().slice(0, 100), loop, items, updatedAt: serverTimestamp(), ...extra },
        { merge: true },
      );
      const cur = await getDoc(doc(getDb(), "live", "current"));
      const l = parseLive(cur.data());
      setSaved(l);
      return true;
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (live).");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (await persist()) setMsg(saved.active ? "تم الحفظ. التغيير يسري على البث الجاري فورًا." : "تم حفظ القائمة ✓");
  }

  async function start() {
    if (items.length === 0) return setError("أضف فيديو واحدًا على الأقل.");
    if (unknown > 0) return setError("بعض الفيديوهات بلا مدة معروفة. اضغط «جلب المدد الناقصة» أولًا.");
    if (await persist({ active: true, startedAt: serverTimestamp() })) setMsg("بدأ البث ✓ — يراه الزوار في صفحة «بث مباشر».");
  }

  async function stop() {
    if (!window.confirm("إيقاف البث الحالي؟")) return;
    if (await persist({ active: false })) setMsg("تم إيقاف البث.");
  }

  if (loading) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <div className="panel live-admin">
      <div className="live-total" role="status" aria-live="polite">
        <div>
          <small>إجمالي الوقت</small>
          <strong>{formatTotal(total)}</strong>
        </div>
        <div>
          <small>عدد الفيديوهات</small>
          <strong>{items.length}</strong>
        </div>
        <div>
          <small>الحالة</small>
          <strong className={saved.active ? "live-on" : ""}>{saved.active ? "● يبث الآن" : "متوقف"}</strong>
        </div>
      </div>
      {unknown > 0 && (
        <p className="hint" role="status">
          {unknown} فيديو بلا مدة معروفة (غير محسوبة في الإجمالي).{" "}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void fetchMissing()} disabled={!!probe}>جلب المدد الناقصة</button>
          {probe && <> {probe}</>}
        </p>
      )}

      <div className="field">
        <label htmlFor="lv-title">عنوان البث</label>
        <input id="lv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="مثال: بث الجمعة" />
      </div>
      <label className="check"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> إعادة القائمة تلقائيًا عند انتهائها</label>

      {items.length === 0 ? (
        <p className="empty-note">القائمة فارغة. اضغط «إضافة فيديوهات».</p>
      ) : (
        <ol className="live-list">
          {items.map((it, i) => (
            <li key={`${it.videoId}-${i}`} className="live-row">
              <span className="live-n">{i + 1}</span>
              <div className="arow-thumb">
                {it.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
              <div className="arow-info">
                <strong>{it.title}</strong>
                <small>{it.duration > 0 ? formatClock(it.duration) : "المدة غير معروفة"}</small>
              </div>
              <div className="live-btns">
                <button type="button" className="ibtn" aria-label="تحريك للأعلى" title="تحريك للأعلى" onClick={() => move(i, -1)} disabled={i === 0}><Icon name="up" size={18} /></button>
                <button type="button" className="ibtn" aria-label="تحريك للأسفل" title="تحريك للأسفل" onClick={() => move(i, 1)} disabled={i === items.length - 1}><Icon name="chevdown" size={18} /></button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setPicker({ replace: i }); setQ(""); }}>تغيير</button>
                <button type="button" className="ibtn" aria-label="حذف من القائمة" title="حذف من القائمة" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="addrow">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setPicker({ replace: null }); setQ(""); }} disabled={items.length >= LIVE_MAX_ITEMS}>＋ إضافة فيديوهات</button>
        {items.length > 1 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { if (window.confirm("مسح كل القائمة؟")) setItems([]); }}>مسح القائمة</button>
        )}
      </div>

      {picker && (
        <div className="live-picker" role="region" aria-label={picker.replace !== null ? "اختر الفيديو البديل" : "اختر الفيديوهات لإضافتها"}>
          <div className="addrow">
            <strong>{picker.replace !== null ? `اختر بديلًا للفيديو رقم ${picker.replace + 1}` : "اضغط على الفيديو لإضافته للنهاية"}</strong>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPicker(null)}>إغلاق</button>
          </div>
          <div className="field">
            <label htmlFor="lv-q" className="sr-only">بحث</label>
            <input id="lv-q" type="search" placeholder="ابحث في فيديوهاتك" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="alist live-pick-list">
            {shown.length === 0 && <li className="empty-note">لا توجد نتائج.</li>}
            {shown.map((v) => {
              const count = items.filter((x) => x.videoId === v.id).length;
              return (
                <li key={v.id}>
                  <button type="button" className="live-pick" onClick={() => choose(v)}>
                    <span className="arow-thumb">
                      {v.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                      )}
                    </span>
                    <span className="arow-info">
                      <strong>{v.title}</strong>
                      <small>{v.duration ? formatClock(v.duration) : "المدة غير معروفة"}{count > 0 && ` • في القائمة ×${count}`}{v.hidden && " • مخفي"}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ القائمة"}</button>
        {saved.active ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => { if (window.confirm("إعادة البث من أول القائمة؟")) void persist({ active: true, startedAt: serverTimestamp() }); }} disabled={busy || unknown > 0 || items.length === 0}>إعادة من البداية</button>
            <button type="button" className="btn btn--ghost danger" onClick={() => void stop()} disabled={busy}>إيقاف البث</button>
          </>
        ) : (
          <button type="button" onClick={() => void start()} disabled={busy}>بدء البث</button>
        )}
      </div>
      <p className="hint">
        البث يعمل بجدول زمني مشترك: كل المشاهدين يرون الفيديو نفسه في الوقت نفسه. لأن مشغّل درايف لا يقبل القفز لنقطة معيّنة، من ينضم أثناء مقطع يبدأ ذلك المقطع من أوله ثم يلتحق بالجدول عند المقطع التالي.
      </p>
    </div>
  );
}
