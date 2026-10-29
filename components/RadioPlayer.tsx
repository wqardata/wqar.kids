"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import DrivePlayer from "@/components/DrivePlayer";
import Icon from "@/components/Icon";
import { audioCandidates } from "@/lib/adhkarAudio";
import { useSettings } from "@/lib/settings";

const num = new Intl.NumberFormat("ar-EG");

/** ألوان مبهجة تتناوب على أناشيد القائمة. */
const COLORS = ["#ff6b6b", "#ffb02e", "#34c759", "#22b8f0", "#a66cff", "#ff6fb5"];

/** خلط عشوائي (Fisher–Yates) لنسخة من المصفوفة. */
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * صفحة الإذاعة: مشغّل صوت بسيط في الأعلى (عنصر audio يقرأ الملف مباشرة من درايف دون المرور بخادم الموقع، وإن رفضه المتصفح فعبر المسار الاحتياطي /api/drive-audio)،
 * وتحته قائمة الأناشيد المتحرّكة. الضغط على نشيد يشغّله فورًا (التشغيل يبدأ داخل الضغطة نفسها فلا يمنعه المتصفح).
 * إن رفض المتصفح المصدرين معًا لنشيد ما نعرض له مشغّل درايف الأصلي بدلًا منه.
 */
export default function RadioPlayer() {
  const { settings, ready } = useSettings();
  const raw = settings.radio.items;
  // ترتيب عشوائي جديد عند كل فتح للصفحة إن فُعّل «العشوائي» (ويبقى ثابتًا ما دامت الأناشيد نفسها؛ تعديل عنوان نشيد لا يعيد الخلط)، وإلا فترتيب القائمة.
  const idsKey = raw.map((x) => x.id).join(",");
  const mix = settings.radio.shuffle;
  const order = useMemo(() => (mix ? shuffle(idsKey ? idsKey.split(",") : []) : idsKey ? idsKey.split(",") : []), [idsKey, mix]);
  const items = useMemo(() => {
    const byId = new Map(raw.map((x) => [x.id, x]));
    return order.map((id) => byId.get(id)).filter((x): x is (typeof raw)[number] => Boolean(x));
  }, [raw, order]);
  const [curId, setCurId] = useState("");
  // التشغيل تلقائي عند فتح الصفحة (قد تمنعه بعض المتصفحات، وخاصة الجوال، حتى يلمس الزائر الصفحة).
  const [chosen, setChosen] = useState(true);
  const list = useRef<HTMLUListElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const loadedId = useRef("");
  // رقم المصدر المجرَّب للنشيد الحالي (0 = الرابط المباشر من درايف، 1 = المسار الاحتياطي عبر الموقع).
  const tryNo = useRef(0);
  // إن فشل الرابط المباشر مرة نبدأ بقية الأناشيد بالمسار الاحتياطي فلا ننتظر فشله في كل نشيد.
  const directBad = useRef(false);
  const started = useRef(false);
  // هل نريد التشغيل الآن؟ يصير false فقط حين يوقفه الزائر بنفسه، فلا نستأنفه رغمًا عنه.
  const want = useRef(true);
  const unlock = useRef<(() => void) | null>(null);
  // مستوى الصوت (0–1) والكتم؛ يُحفظان في المتصفح. ملاحظة: iOS يتجاهل audio.volume فيعمل زر الكتم وحده هناك.
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  // أناشيد رفض المتصفح تشغيلها مباشرة: يُعرض لها مشغّل درايف الأصلي.
  const [frameIds, setFrameIds] = useState<string[]>([]);

  const found = items.findIndex((x) => x.id === curId);
  const idx = found >= 0 ? found : 0;
  const cur = items[idx];

  const disarm = () => {
    const f = unlock.current;
    if (!f) return;
    unlock.current = null;
    window.removeEventListener("click", f, true);
    window.removeEventListener("keydown", f, true);
    window.removeEventListener("touchend", f, true);
  };
  /**
   * يشغّل عنصر audio. إن منع المتصفح التشغيل التلقائي (لم يلمس الزائر الصفحة بعد) ننتظر أول ضغطة أو لمسة أو مفتاح في أي مكان
   * ثم نشغّل حينها، فيبدأ الصوت من أول لمسة دون أن يبحث الزائر عن زر التشغيل.
   */
  const play = (a: HTMLAudioElement) => {
    a.play().then(disarm, (e: unknown) => {
      if ((e as { name?: string } | null)?.name !== "NotAllowedError" || unlock.current) return;
      const f = () => {
        disarm();
        const el = audio.current;
        if (el && want.current && el.paused && el.src) void el.play().catch(() => {});
      };
      unlock.current = f;
      window.addEventListener("click", f, true);
      window.addEventListener("keydown", f, true);
      window.addEventListener("touchend", f, true);
    });
  };
  useEffect(() => disarm, []);

  /** يبدأ تشغيل نشيد بعنصر audio. يُستدعى داخل معالج الضغط نفسه كي يسمح المتصفح (خاصة الجوال) بالصوت. */
  const start = (it: { id: string; drive: string }) => {
    const a = audio.current;
    if (!a) return;
    if (frameIds.includes(it.id)) { a.pause(); return; } // له مشغّل درايف الأصلي
    loadedId.current = it.id;
    const urls = audioCandidates(it.drive);
    tryNo.current = directBad.current && urls.length > 1 ? 1 : 0;
    setTime(0);
    setDur(0);
    want.current = true;
    a.src = urls[tryNo.current];
    play(a);
  };
  const pick = (id: string) => {
    setCurId(id);
    setChosen(true);
    const it = items.find((x) => x.id === id);
    if (it) start(it);
  };
  const step = (d: -1 | 1) => {
    const j = idx + d;
    if (j >= 0 && j < items.length) pick(items[j].id);
  };

  // استرجاع مستوى الصوت المحفوظ (بعد التركيب كي لا يختلف العرض بين الخادم والمتصفح).
  useEffect(() => {
    try {
      const s = localStorage.getItem("radio-vol");
      if (s !== null) { const v = Number(s); if (Number.isFinite(v)) setVol(Math.min(1, Math.max(0, v))); }
      if (localStorage.getItem("radio-muted") === "1") setMuted(true);
    } catch { /* التخزين غير متاح */ }
  }, []);
  // تطبيق الصوت على عنصر audio (يُرسم بعد جاهزية الإعدادات، وكل نشيد جديد يحتفظ بالمستوى نفسه).
  useEffect(() => {
    const a = audio.current;
    if (a) { a.volume = vol; a.muted = muted; }
  }, [vol, muted, ready, items.length]);
  const changeVol = (v: number) => {
    setVol(v);
    const m = v === 0;
    setMuted(m);
    try { localStorage.setItem("radio-vol", String(v)); localStorage.setItem("radio-muted", m ? "1" : "0"); } catch { /* التخزين غير متاح */ }
  };
  // منزلق الصوت الطولي: يُغلق بالضغط خارجه أو بمفتاح Escape (وبعد التحديد، انظر onPointerUp).
  const [volOpen, setVolOpen] = useState(false);
  const volBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!volOpen) return;
    const down = (e: PointerEvent) => { if (!volBox.current?.contains(e.target as Node)) setVolOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setVolOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [volOpen]);

  // عند فتح الصفحة: نجهّز أول نشيد ونحاول تشغيله (قد يمنعه المتصفح حتى يضغط الزائر زر التشغيل).
  useEffect(() => {
    if (!ready || started.current || items.length === 0 || !audio.current) return;
    started.current = true;
    if (!settings.radio.autoplay) { want.current = false; return; } // بلا تشغيل تلقائي: يبدأ حين يضغط الزائر زر التشغيل (انظر زر التشغيل: يبدأ النشيد الحالي إن لم يُحمَّل شيء)
    start(items[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, items]);

  // يُبقي النشيد الحالي ظاهرًا داخل القائمة (تمرير داخل القائمة نفسها دون تحريك الصفحة).
  useEffect(() => {
    if (!chosen) return;
    const box = list.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return; // ظاهر كاملًا: لا نحرّك القائمة
    // الموضع الحالي للتمرير + بُعد النشيد عن أعلى القائمة المرئي (offsetTop يتجاهل التمرير فكانت القائمة تقفز لأعلاها).
    const top = box.scrollTop + (r.top - b.top) - (box.clientHeight - el.offsetHeight) / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [curId, chosen]);

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  if (items.length === 0) {
    return (
      <div className="empty">
        <h1>إذاعة</h1>
        <p>لا توجد أناشيد حاليًا، وسنضيفها قريبًا.</p>
      </div>
    );
  }

  return (
    <section className="radio" aria-labelledby="radio-h">
      <h1 id="radio-h" className="page-title">إذاعة</h1>

      <div className="radio-player">
        {frameIds.includes(cur.id) ? (
          <DrivePlayer driveId={cur.drive} title={cur.title} hue={170} autoplay={chosen} />
        ) : (
          <div className="radio-bar">
            <button
              type="button"
              className="radio-play"
              onClick={() => {
                const a = audio.current;
                if (!a) return;
                if (a.paused) { if (!a.src) start(cur); else { want.current = true; play(a); } } else { want.current = false; a.pause(); }
              }}
              aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <Icon name="play" size={26} />
              )}
            </button>
            <input
              type="range"
              dir="ltr"
              min={0}
              max={Math.max(1, dur)}
              step={1}
              value={Math.min(time, Math.max(1, dur))}
              onChange={(e) => { const v = Number(e.target.value); if (audio.current) audio.current.currentTime = v; setTime(v); }}
              disabled={dur <= 0}
              aria-label="موضع التشغيل"
            />
            <span className="radio-time" dir="ltr">{fmt(time)} / {fmt(dur)}</span>
            <div className="radio-vol" ref={volBox}>
              <button type="button" onClick={() => setVolOpen((o) => !o)} aria-label="مستوى الصوت" aria-haspopup="true" aria-expanded={volOpen} title="الصوت">
                {muted || vol === 0 ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" /></svg>
                )}
              </button>
              {volOpen && (
                <div className="radio-vol-pop">
                  <input
                    type="range"
                    dir="ltr"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : vol}
                    onChange={(e) => changeVol(Number(e.target.value))}
                    onPointerUp={() => setVolOpen(false)}
                    onKeyUp={(e) => { if (e.key === "Enter" || e.key === "Escape") setVolOpen(false); }}
                    aria-label="مستوى الصوت"
                    aria-orientation="vertical"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <audio
          ref={audio}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onDurationChange={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
          onEnded={() => { if (idx < items.length - 1) step(1); else if (settings.radio.loop && items.length > 1) pick(items[0].id); else setPlaying(false); }} // بعد آخر نشيد: نعود لأول القائمة إن فُعّل التكرار (الافتراضي) وإلا نتوقف
          onError={() => {
            // رفض المتصفح الرابط المباشر (حدود درايف وغيرها): نعرض مشغّل درايف الأصلي لهذا النشيد.
            const id = loadedId.current;
            const it = items.find((x) => x.id === id);
            const a = audio.current;
            if (!id || !it || !a) return;
            // نجرّب المصدر التالي (المسار عبر الموقع) قبل الرجوع لمشغّل درايف.
            const urls = audioCandidates(it.drive);
            if (tryNo.current === 0) directBad.current = true;
            if (tryNo.current + 1 < urls.length) {
              tryNo.current += 1;
              a.src = urls[tryNo.current];
              play(a);
              return;
            }
            setPlaying(false);
            setChosen(true);
            setFrameIds((f) => (f.includes(id) ? f : [...f, id]));
          }}
        />
        <div className="radio-now">
          <button type="button" className="radio-step" onClick={() => step(-1)} disabled={idx <= 0} aria-label="النشيد السابق" title="السابق">
            <Icon name="up" size={20} />
          </button>
          <p className="radio-title" aria-live="polite">
            <small>{num.format(idx + 1)} من {num.format(items.length)}</small>
            <strong>{cur.title}</strong>
          </p>
          <button type="button" className="radio-step" onClick={() => step(1)} disabled={idx >= items.length - 1} aria-label="النشيد التالي" title="التالي">
            <Icon name="chevdown" size={20} />
          </button>
        </div>
      </div>

      <div className="radio-glass">
        <h2 className="radio-glass-h"><span aria-hidden="true">🎵</span> أناشيدنا</h2>
        <ul className="radio-list" ref={list} aria-label="قائمة الأناشيد">
          {items.map((it, i) => {
            const on = i === idx;
            return (
              <li key={it.id} style={{ "--i": Math.min(i, 14), "--c": COLORS[i % COLORS.length] } as CSSProperties}>
                <button type="button" className={on ? "radio-item on" : "radio-item"} aria-current={on ? "true" : undefined} onClick={() => pick(it.id)}>
                  <span className="radio-n" aria-hidden="true">
                    {on ? <span className="radio-eq"><i /><i /><i /></span> : num.format(i + 1)}
                  </span>
                  <span className="radio-t">{it.title}</span>
                  <span className="radio-go" aria-hidden="true"><Icon name="play" size={18} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
