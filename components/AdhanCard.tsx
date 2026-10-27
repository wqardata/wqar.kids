"use client";
import { useEffect, useRef, useState } from "react";
import { audioSources, type AdhanSettings, type PrayerId } from "@/lib/adhanCore";
import { audioCandidates } from "@/lib/adhkarAudio";

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  cfg: AdhanSettings;
  prayerLabel: string;
  /** الصلاة الحالية: تحدّد أي ملف صوت يُشغَّل (لكل صلاة ملفاتها). */
  prayerId: PrayerId;
  /** ثوانٍ متبقية في العدّ التنازلي. */
  remainingSec: number;
  /** محاولة تشغيل التكبيرات تلقائيًا (المتصفح قد يمنعها قبل أي تفاعل مع الموقع). */
  playAudio: boolean;
  onClose: () => void;
};

/** بطاقة نافذة الأذان: الصورة، ثم النص، ثم العدّاد. تُستخدم في الموقع وفي تجربة لوحة التحكم. */
export default function AdhanCard({ cfg, prayerLabel, prayerId, remainingSec, playAudio, onClose }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const soundBtn = useRef<HTMLButtonElement>(null);
  /** يلغي مستمعي «فتح الصوت عند أول لمسة» (إن كانوا مسجّلين). */
  const unlockOff = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);

  // نسخ الصوت لهذه الصلاة: نبدأ من نسخة عشوائية (يتوزّع الزوار على النسخ فلا يُستنفد حد تنزيل ملف واحد)،
  // وإن فشلت نجرّب التالية. فشل الجميع = رسالة بدل الزر.
  const list = audioSources(cfg, prayerId);
  const listKey = list.join("\n");
  const [start] = useState(() => Math.floor(Math.random() * Math.max(1, list.length)));
  const [tried, setTried] = useState(0);
  useEffect(() => setTried(0), [listKey]);
  // كل نسخة: الرابط المباشر ثم المسار عبر الموقع، ثم النسخة التالية.
  const cands = list.length ? Array.from({ length: list.length }, (_, k) => audioCandidates(list[(start + k) % list.length])).flat() : [];
  const failed = cands.length > 0 && tried >= cands.length;
  const current = cands.length && !failed ? cands[tried] : "";

  useEffect(() => {
    const a = audio.current;
    if (a && current) a.volume = cfg.volume / 100;
  }, [current, cfg.volume]);

  // التشغيل التلقائي: نحاول بالصوت مباشرة. إن منعه المتصفح (لا تفاعل سابق من الزائر) نبدأ صامتين — وهذا مسموح —
  // ثم نفتح الصوت عند أول لمسة/نقرة/مفتاح في أي مكان بالصفحة، فلا يحتاج الزائر لزر تشغيل.
  useEffect(() => {
    const a = audio.current;
    if (!a || !current || !playAudio) return;
    let dead = false;
    a.muted = false;
    a.play().catch((err: unknown) => {
      // غير NotAllowedError (مصدر لا يعمل) يعالجه onError فينتقل للنسخة التالية.
      if (dead || (err as { name?: string })?.name !== "NotAllowedError") return;
      a.muted = true;
      a.play().catch(() => {});
      const evs = ["pointerdown", "keydown", "touchstart", "click"];
      const unmute = (e: Event) => {
        if (soundBtn.current?.contains(e.target as Node)) return; // زر الصوت يتولّى أمره بنفسه
        a.muted = false;
        if (a.paused) void a.play().catch(() => {});
        off();
      };
      const off = () => evs.forEach((ev) => window.removeEventListener(ev, unmute, true));
      evs.forEach((ev) => window.addEventListener(ev, unmute, { capture: true, passive: true }));
      unlockOff.current = off;
    });
    return () => {
      dead = true;
      unlockOff.current();
      unlockOff.current = () => {};
      a.pause();
    };
  }, [current, playAudio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (parentOpen) setParentOpen(false);
      else if (cfg.closable) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg.closable, onClose, parentOpen]);

  /** أيقونة الصوت: أثناء الصوت المسموع تُسكته، وغير ذلك (صامت/متوقف/انتهى) تشغّله. */
  function toggleSound() {
    const a = audio.current;
    if (!a) return;
    unlockOff.current();
    unlockOff.current = () => {};
    if (playing && !a.muted) {
      a.pause();
      return;
    }
    a.muted = false;
    if (a.ended) a.currentTime = 0;
    void a.play().catch(() => {});
  }
  const audible = playing && !muted;

  const text = cfg.text.replaceAll("{prayer}", prayerLabel);
  // التركيز الأولي على أول خيار «رجوع» (الأسلم للضغط العرضي)، وإلا على الأول.
  const focusIdx = Math.max(0, cfg.parentOptions.findIndex((o) => o.action === "back"));
  return (
    <div className="adhan-card" role="alertdialog" aria-modal="true" aria-labelledby="adhan-text">
      {cfg.closable && (
        <button type="button" className="adhan-close" onClick={onClose} aria-label="إغلاق">✕</button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="adhan-art" src={cfg.imageUrl || "/images/mosque.svg"} alt="مسجد" width={400} height={280} />
      <p id="adhan-text" className="adhan-text">{text}</p>
      <div className="adhan-timer" role="timer" aria-live="off" aria-label="الوقت المتبقي">{fmtClock(remainingSec)}</div>
      {failed && <p className="hint" role="status">تعذّر تشغيل صوت التكبيرات.</p>}
      {current && (
        <>
          <audio
            ref={audio}
            src={current}
            preload="auto"
            onError={() => setTried((t) => t + 1)}
            onPlay={() => setPlaying(true)}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          />
          <button
            ref={soundBtn}
            type="button"
            className="adhan-sound"
            onClick={toggleSound}
            aria-label={audible ? "إيقاف صوت التكبيرات" : "تشغيل صوت التكبيرات"}
            title={audible ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            <span aria-hidden="true">{audible ? "🔊" : "🔇"}</span>
          </button>
        </>
      )}
      {cfg.parentOptions.length > 0 && (
        <button type="button" className="adhan-parent" onClick={() => setParentOpen(true)}>توجيه الوالدين</button>
      )}
      {parentOpen && cfg.parentOptions.length > 0 && (
        <div className="adhan-parent-layer" onClick={() => setParentOpen(false)}>
          <div className="adhan-parent-box" role="dialog" aria-modal="true" aria-labelledby="adhan-parent-title" onClick={(e) => e.stopPropagation()}>
            <strong id="adhan-parent-title">توجيه الوالدين</strong>
            {cfg.parentOptions.map((o, k) => (
              <button
                key={o.id}
                type="button"
                className={o.action === "back" ? "btn btn--ghost" : "btn"}
                autoFocus={k === focusIdx}
                onClick={() => {
                  setParentOpen(false);
                  if (o.action === "continue") onClose(); // إغلاق نافذة الأذان ومتابعة المشاهدة
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
