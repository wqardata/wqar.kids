"use client";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { openGrabber } from "@/lib/frameGrab";
import {
  DAY_NAMES, DEFAULT_LIVE_TEXTS, EMPTY_STREAMS, EMPTY_LIVE, LIVE_MAX_ITEMS, LIVE_TEXT_FIELDS, START_TIME_RE, WEEK_ORDER, dayInTz, formatTotal, isRunning, liveDocId, parseLive, parseLocalInput, parseStreams, todayAt, toLocalInput, totalSeconds,
  type LiveConfig, type LiveDoc, type LiveItem, type LiveMode, type LiveStreams, type LiveTexts,
} from "@/lib/live";
import LivePreview from "./LivePreview";
import { toVideo, type VideoDoc } from "@/lib/videos";

function norm(s: string) {
  return s.toLowerCase().replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
}

const toItem = (v: VideoDoc): LiveItem => ({ videoId: v.id, title: v.title, driveId: v.driveId, thumbnail: v.thumbnail, duration: v.duration ?? 0 });

type EditorProps = {
  docId: string;
  /** وصف البث للرسائل (مثال: «بث يوم الجمعة»). */
  label: string;
  isDay: boolean;
  videos: VideoDoc[];
  setVideos: Dispatch<SetStateAction<VideoDoc[]>>;
  onSaved: (docId: string, l: LiveDoc) => void;
  /** المنطقة الزمنية المعتمدة لساعة البدء (المحفوظة في الإعداد أو منطقة جهاز المشرف). */
  tz: string;
  /** هل المنطقة محفوظة فعلًا في live/config؟ إن لم تكن نحفظها عند أول جدولة بساعة محددة. */
  tzSaved: boolean;
  onTz: (tz: string) => void;
  texts: LiveTexts;
};

/** أقرب ساعة كاملة قادمة بصيغة datetime-local (قيمة مقترحة لوقت البدء). */
function nextFullHour(tz: string): string {
  const t = Math.ceil((Date.now() + 60_000) / 3_600_000) * 3_600_000;
  return toLocalInput(t, tz);
}

/** محرر بث واحد (مستند live/<docId>): القائمة، العنوان، الإعادة، البدء والإيقاف. */
function StreamEditor({ docId, label, isDay, videos, setVideos, onSaved, tz, tzSaved, onTz, texts }: EditorProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<LiveDoc>(EMPTY_LIVE);
  const [title, setTitle] = useState("");
  const [loop, setLoop] = useState(true);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<null | { replace: number | null }>(null);
  const [q, setQ] = useState("");
  const [probe, setProbe] = useState("");
  // وقت البدء: «now» = لحظة الضغط على «بدء البث»، «at» = وقت يحدده المشرف.
  const [startMode, setStartMode] = useState<"now" | "at">("now");
  const [startAtInput, setStartAtInput] = useState(""); // بث عام: datetime-local
  const [startTimeInput, setStartTimeInput] = useState("20:00"); // بث يوم: HH:mm
  const [preview, setPreview] = useState(false);

  /** يملأ حقول وقت البدء من المستند المحفوظ. */
  function syncStart(l: LiveDoc) {
    if (isDay) {
      setStartMode(l.startTime ? "at" : "now");
      setStartTimeInput(l.startTime || "20:00");
    } else {
      setStartMode(l.active && l.startedAt !== null ? "at" : "now");
      setStartAtInput(l.startedAt !== null ? toLocalInput(l.startedAt, tz) : nextFullHour(tz));
    }
  }

  useEffect(() => {
    let off = false;
    getDoc(doc(getDb(), "live", docId))
      .then((cur) => {
        if (off) return;
        const l = parseLive(cur.exists() ? cur.data() : undefined);
        setSaved(l);
        setTitle(l.title);
        setLoop(l.loop);
        setItems(l.items);
        syncStart(l);
      })
      .catch(() => !off && setError("تعذّر التحميل. تأكد من قواعد Firestore (live)."))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const total = totalSeconds(items);
  const unknown = items.filter((i) => i.duration <= 0).length;
  // الحقول التي تُكتب في المستند عند البدء أو عند حفظ بث جارٍ (أو string = رسالة خطأ).
  function startFields(): Record<string, unknown> | string {
    if (isDay) {
      if (startMode === "now") return { startTime: "", startedAt: serverTimestamp() };
      if (!START_TIME_RE.test(startTimeInput)) return "اختر ساعة البدء.";
      return { startTime: startTimeInput, startedAt: serverTimestamp() };
    }
    if (startMode === "now") return { startTime: "", startedAt: serverTimestamp() };
    const ms = parseLocalInput(startAtInput, tz);
    if (!Number.isFinite(ms)) return "اختر تاريخ ووقت البدء.";
    return { startTime: "", startedAt: Timestamp.fromMillis(ms) };
  }
  // هل تغيّر وقت البدء عمّا هو محفوظ؟ (يهمّ فقط والبث مفعّل؛ قبل التفعيل يُطبَّق عند «بدء البث»).
  const startChanged = useMemo(() => {
    if (!saved.active) return false;
    if (isDay) return (startMode === "at" ? startTimeInput : "") !== saved.startTime;
    if (startMode === "now") return false;
    return saved.startedAt === null || startAtInput !== toLocalInput(saved.startedAt, tz);
  }, [saved, isDay, startMode, startTimeInput, startAtInput, tz]);
  const dirty = useMemo(
    () => title !== saved.title || loop !== saved.loop || JSON.stringify(items) !== JSON.stringify(saved.items) || startChanged,
    [title, loop, items, saved, startChanged],
  );

  // موعد البدء المختار (للمعاينة): قد يكون في المستقبل.
  const previewStart = useMemo(() => {
    if (startMode !== "at") return null;
    if (isDay) return START_TIME_RE.test(startTimeInput) ? todayAt(Date.now(), tz, startTimeInput) : null;
    const ms = parseLocalInput(startAtInput, tz);
    return Number.isFinite(ms) ? ms : null;
  }, [startMode, isDay, startTimeInput, startAtInput, tz]);

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
    // عنوان فارغ يعود إلى عنوان الفيديو الأصلي.
    const cleanItems = items.map((i) => ({ ...i, title: i.title.trim().slice(0, 200) || videos.find((v) => v.id === i.videoId)?.title || "بدون عنوان" }));
    try {
      if (isDay && extra.startTime && !tzSaved) {
        // «اليوم» وساعة البدء يُحسبان بهذه المنطقة لكل الزوار، فنثبّتها عند أول جدولة بساعة محددة.
        await setDoc(doc(getDb(), "live", "config"), { tz, updatedAt: serverTimestamp() }, { merge: true });
        onTz(tz);
      }
      await setDoc(
        doc(getDb(), "live", docId),
        { title: title.trim().slice(0, 100), loop, items: cleanItems, updatedAt: serverTimestamp(), ...extra },
        { merge: true },
      );
      const cur = await getDoc(doc(getDb(), "live", docId));
      const l = parseLive(cur.data());
      setSaved(l);
      setItems(l.items);
      syncStart(l);
      onSaved(docId, l);
      return true;
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (live).");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    let extra: Record<string, unknown> = {};
    if (saved.active && startChanged) {
      const f = startFields();
      if (typeof f === "string") return setError(f);
      extra = f;
    }
    if (await persist(extra)) setMsg(saved.active ? "تم الحفظ. التغيير يسري على البث الجاري فورًا." : "تم حفظ القائمة ✓");
  }

  async function start() {
    if (items.length === 0) return setError("أضف فيديو واحدًا على الأقل.");
    if (unknown > 0) return setError("بعض الفيديوهات بلا مدة معروفة. اضغط «جلب المدد الناقصة» أولًا.");
    const f = startFields();
    if (typeof f === "string") return setError(f);
    if (await persist({ active: true, ...f })) {
      const timed = isDay ? startMode === "at" : startMode === "at" && previewStart !== null && previewStart > Date.now();
      setMsg(
        timed
          ? isDay
            ? `فُعّل ${label} ✓ — يبدأ كل ${DAY_NAMES[Number(docId.slice(3))]} عند الساعة ${startTimeInput}.`
            : "تمت جدولة البث ✓ — يرى الزوار رسالة انتظار حتى يحين الموعد."
          : isDay
            ? `بدأ ${label} ✓ — يراه الزوار في صفحة «بث مباشر» في هذا اليوم.`
            : "بدأ البث ✓ — يراه الزوار في صفحة «بث مباشر».",
      );
    }
  }

  async function stop() {
    if (!window.confirm(`إيقاف ${isDay ? label : "البث الحالي"}؟`)) return;
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
          <strong className={saved.active ? "live-on" : ""}>{saved.active ? (isDay ? "● مفعّل" : "● يبث الآن") : "متوقف"}</strong>
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
        <label htmlFor={`lv-title-${docId}`}>عنوان البث</label>
        <input id={`lv-title-${docId}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={isDay ? `مثال: ${label}` : "مثال: بث الجمعة"} />
      </div>
      <label className="check"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> إعادة القائمة تلقائيًا عند انتهائها</label>

      <fieldset className="live-start">
        <legend>وقت بدء البث</legend>
        <label className="check">
          <input type="radio" name={`start-${docId}`} checked={startMode === "now"} onChange={() => setStartMode("now")} />
          {" "}{saved.active ? (isDay ? "من لحظة الحفظ، بلا ساعة ثابتة" : "كما بدأ البث (للبدء من جديد استعمل «إعادة من البداية»)") : "فور الضغط على «بدء البث»"}
        </label>
        <label className="check">
          <input type="radio" name={`start-${docId}`} checked={startMode === "at"} onChange={() => setStartMode("at")} />
          {" "}{isDay ? "عند ساعة أحددها (تتكرر في هذا اليوم من كل أسبوع)" : "في تاريخ ووقت أحددهما"}
        </label>
        {startMode === "at" && (
          <div className="field">
            {isDay ? (
              <>
                <label htmlFor={`lv-time-${docId}`}>ساعة البدء</label>
                <input id={`lv-time-${docId}`} type="time" dir="ltr" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} required />
              </>
            ) : (
              <>
                <label htmlFor={`lv-at-${docId}`}>تاريخ ووقت البدء</label>
                <input id={`lv-at-${docId}`} type="datetime-local" dir="ltr" value={startAtInput} onChange={(e) => setStartAtInput(e.target.value)} required />
              </>
            )}
            <p className="hint">
              بتوقيت {tz || "جهازك"}.{" "}
              {isDay
                ? "قبل هذه الساعة يرى الزوار رسالة انتظار بعدّاد تنازلي، وعندها يبدأ الجدول من أول القائمة."
                : "إن كان الوقت في المستقبل يرى الزوار رسالة انتظار حتى يحين، وإن كان في الماضي يُعرض البث كأنه بدأ في ذلك الوقت."}
            </p>
          </div>
        )}
      </fieldset>

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
                <input
                  className="live-title-input"
                  aria-label={`نص المقطع رقم ${i + 1} في الجدول`}
                  value={it.title}
                  maxLength={200}
                  onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                />
                <small>
                  {it.duration > 0 ? formatClock(it.duration) : "المدة غير معروفة"}
                  {(() => {
                    const orig = videos.find((v) => v.id === it.videoId)?.title;
                    return orig && orig !== it.title ? (
                      <> • <button type="button" className="linkbtn linkbtn--sm" onClick={() => setItems((p) => p.map((x, j) => (j === i ? { ...x, title: orig } : x)))}>استعادة العنوان الأصلي</button></>
                    ) : null;
                  })()}
                </small>
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
            {!(isDay && saved.startTime) && (
              <button type="button" className="btn btn--ghost" onClick={() => { if (window.confirm("إعادة البث من أول القائمة؟")) void persist({ active: true, startTime: "", startedAt: serverTimestamp() }); }} disabled={busy || unknown > 0 || items.length === 0}>إعادة من البداية</button>
            )}
            <button type="button" className="btn btn--ghost danger" onClick={() => void stop()} disabled={busy}>إيقاف البث</button>
          </>
        ) : (
          <button type="button" onClick={() => void start()} disabled={busy}>{startMode === "at" ? "جدولة البث" : "بدء البث"}</button>
        )}
        <button type="button" className="btn btn--ghost" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>{preview ? "إخفاء المعاينة" : "معاينة"}</button>
      </div>
      {preview && (
        <LivePreview
          texts={texts}
          tz={tz}
          title={title.trim()}
          items={items}
          loop={loop}
          startAt={previewStart}
          scenarios={["playing", "waiting", "ended"]}
        />
      )}
      <p className="hint">
        البث يعمل بجدول زمني مشترك: كل المشاهدين يرون الفيديو نفسه في الوقت نفسه. لأن مشغّل درايف لا يقبل القفز لنقطة معيّنة، من ينضم أثناء مقطع يبدأ ذلك المقطع من أوله ثم يلتحق بالجدول عند المقطع التالي.
      </p>
    </div>
  );
}

/** تعديل نصوص صفحة البث (الشارة، العناوين، الرسائل) مع معاينة لحظية قبل الحفظ. */
function TextsEditor({ saved, weekly, tz, onSaved }: { saved: LiveTexts; weekly: boolean; tz: string; onSaved: (t: LiveTexts) => void }) {
  const [draft, setDraft] = useState<LiveTexts>(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const dirty = LIVE_TEXT_FIELDS.some((f) => draft[f.key] !== saved[f.key]);
  const isDefault = LIVE_TEXT_FIELDS.every((f) => draft[f.key] === DEFAULT_LIVE_TEXTS[f.key]);

  const set = (k: keyof LiveTexts, v: string) => {
    setMsg("");
    setDraft((d) => ({ ...d, [k]: v }));
  };

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    // حقل فارغ = الافتراضي.
    const clean = { ...draft };
    for (const f of LIVE_TEXT_FIELDS) if (!clean[f.key].trim()) clean[f.key] = DEFAULT_LIVE_TEXTS[f.key];
    try {
      await setDoc(doc(getDb(), "live", "config"), { texts: clean, updatedAt: serverTimestamp() }, { merge: true });
      setDraft(clean);
      onSaved(clean);
      setMsg("تم حفظ النصوص ✓ — تظهر للزوار فورًا.");
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (live).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel live-admin" aria-labelledby="lt-h">
      <h2 id="lt-h">نصوص صفحة البث {dirty && <span className="dirty-dot">● تعديلات غير محفوظة</span>}</h2>
      <p className="hint">
        عدّل النصوص التي تظهر للزائر في صفحة «بث مباشر». المعاينة بالأسفل تتغيّر أثناء الكتابة ولا يُحفظ شيء قبل الضغط على «حفظ النصوص».
        أسماء المقاطع في الجدول تُعدَّل من قائمة كل بث أعلاه.
      </p>
      {LIVE_TEXT_FIELDS.map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={`lt-${f.key}`}>{f.label}</label>
          <input id={`lt-${f.key}`} value={draft[f.key]} maxLength={f.max} onChange={(e) => set(f.key, e.target.value)} />
          <div className="live-vars">
            {f.vars.length > 0 && <small>متغيرات: {f.vars.map((v) => <code key={v} dir="ltr">{`{${v}}`}</code>)}</small>}
            {f.hint && <small>{f.hint}</small>}
            {draft[f.key] !== DEFAULT_LIVE_TEXTS[f.key] && (
              <button type="button" className="linkbtn linkbtn--sm" onClick={() => set(f.key, DEFAULT_LIVE_TEXTS[f.key])}>الافتراضي</button>
            )}
          </div>
        </div>
      ))}

      <LivePreview
        texts={draft}
        tz={tz}
        title="عنوان البث"
        items={[]}
        loop
        scenarios={weekly ? ["playing", "waiting", "idle-weekly", "ended"] : ["playing", "waiting", "idle", "ended"]}
      />

      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ النصوص"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => setDraft(saved)} disabled={busy || !dirty}>تراجع عن التعديلات</button>
        <button type="button" className="btn btn--ghost" onClick={() => setDraft(DEFAULT_LIVE_TEXTS)} disabled={busy || isDefault}>استعادة كل الافتراضي</button>
      </div>
    </div>
  );
}

const MODES: { id: LiveMode; title: string; note: string }[] = [
  { id: "general", title: "بث عام", note: "قائمة واحدة تُعرض كل يوم." },
  { id: "weekly", title: "بث حسب أيام الأسبوع", note: "قائمة مستقلة لكل يوم، تبدأ وتتوقف بشكل منفصل." },
];

export default function LiveTab() {
  const [streams, setStreams] = useState<LiveStreams>(EMPTY_STREAMS);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [savingCfg, setSavingCfg] = useState(false);
  const [sel, setSel] = useState<number | "current">("current");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let off = false;
    Promise.all([
      getDocs(collection(getDb(), "live")),
      getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(200))),
    ])
      .then(([live, snap]) => {
        if (off) return;
        const st = parseStreams(live.docs.map((d) => ({ id: d.id, data: d.data() })));
        setStreams(st);
        setSel(st.config.mode === "weekly" ? dayInTz(Date.now(), st.config.tz) : "current");
        setVideos(snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => v.driveId));
      })
      .catch(() => !off && setError("تعذّر التحميل. تأكد من قواعد Firestore (live)."))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, []);

  // لتحديد «اليوم» في الشارة (يتبدّل عند منتصف الليل).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cfg = streams.config;
  const today = dayInTz(now, cfg.tz);
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  async function saveConfig(next: LiveConfig) {
    setSavingCfg(true);
    setError("");
    setMsg("");
    // المنطقة الزمنية تُؤخذ من جهاز المشرف أول مرة (يُحسب بها «اليوم» لكل الزوار).
    const tz = next.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const cleaned = { ...next, tz };
    try {
      const { texts: _texts, ...toWrite } = cleaned; // النصوص لها محرّرها الخاص
      void _texts;
      await setDoc(doc(getDb(), "live", "config"), { ...toWrite, updatedAt: serverTimestamp() }, { merge: true });
      setStreams((p) => ({ ...p, config: cleaned }));
      setMsg("تم حفظ نمط البث ✓");
      return true;
    } catch {
      setError("تعذّر حفظ النمط. تأكد من صلاحياتك وقواعد Firestore (live).");
      return false;
    } finally {
      setSavingCfg(false);
    }
  }

  async function chooseMode(mode: LiveMode) {
    if (mode === cfg.mode) return;
    if (await saveConfig({ ...cfg, mode })) setSel(mode === "weekly" ? today : "current");
  }

  const onSaved = useCallback((id: string, l: LiveDoc) => {
    setStreams((p) => {
      if (id === "current") return { ...p, current: l };
      const m = /^day([0-6])$/.exec(id);
      if (!m) return p;
      const days = [...p.days];
      days[Number(m[1])] = l;
      return { ...p, days };
    });
  }, []);

  if (loading) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  const weekly = cfg.mode === "weekly";
  const selDay = sel === "current" ? null : sel;
  const label = selDay === null ? "البث العام" : `بث يوم ${DAY_NAMES[selDay]}`;

  return (
    <div className="live-wrap">
      <div className="panel live-admin">
        <fieldset className="live-modes">
          <legend>نمط البث</legend>
          {MODES.map((m) => (
            <label key={m.id} className="check live-mode">
              <input type="radio" name="live-mode" checked={cfg.mode === m.id} disabled={savingCfg} onChange={() => void chooseMode(m.id)} />
              <span><strong>{m.title}</strong><small> — {m.note}</small></span>
            </label>
          ))}
        </fieldset>
        {weekly && (
          <label className="check">
            <input type="checkbox" checked={cfg.fallback} disabled={savingCfg} onChange={(e) => void saveConfig({ ...cfg, fallback: e.target.checked })} />
            {" "}إن لم يكن لليوم بث فعّال، اعرض «البث العام» بدلًا من «لا يوجد بث»
          </label>
        )}
        <p className="hint">
          {weekly
            ? `اليوم (${DAY_NAMES[today]}) يعرض الزوار بثّ هذا اليوم${cfg.fallback ? "، وإن لم يكن مفعّلًا فالبث العام" : ""}.`
            : "يعرض الزوار البث العام في كل الأيام."}
          {cfg.tz && ` الأيام تُحسب بتوقيت: ${cfg.tz}.`}
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}
      </div>

      {weekly && (
        <div className="live-days" role="tablist" aria-label="أيام الأسبوع">
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={sel === d}
              className={`btn btn--sm ${sel === d ? "" : "btn--ghost"}`}
              onClick={() => setSel(d)}
            >
              {isRunning(streams.days[d]) ? "● " : ""}{DAY_NAMES[d]}{d === today ? " (اليوم)" : ""}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={sel === "current"}
            className={`btn btn--sm ${sel === "current" ? "" : "btn--ghost"}`}
            onClick={() => setSel("current")}
          >
            {isRunning(streams.current) ? "● " : ""}البث العام
          </button>
        </div>
      )}

      <StreamEditor
        key={liveDocId(sel)}
        docId={liveDocId(sel)}
        label={label}
        isDay={selDay !== null}
        videos={videos}
        setVideos={setVideos}
        onSaved={onSaved}
        tz={cfg.tz || deviceTz}
        tzSaved={Boolean(cfg.tz)}
        onTz={(tz) => setStreams((p) => ({ ...p, config: { ...p.config, tz } }))}
        texts={cfg.texts}
      />

      <TextsEditor
        saved={cfg.texts}
        weekly={weekly}
        tz={cfg.tz || deviceTz}
        onSaved={(texts) => setStreams((p) => ({ ...p, config: { ...p.config, texts } }))}
      />
    </div>
  );
}
