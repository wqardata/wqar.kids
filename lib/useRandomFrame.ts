"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { openGrabber, probeDuration, type Grabber } from "./frameGrab";

export type FrameState = {
  status: "idle" | "loading" | "ok" | "error";
  dataUrl: string;
  /** ثانية اللقطة داخل الفيديو. */
  time: number;
  message: string;
  /** مدة الفيديو بالثواني من بياناته الوصفية (0 = غير معروفة بعد). */
  duration: number;
};
const IDLE: FrameState = { status: "idle", dataUrl: "", time: 0, message: "", duration: 0 };

const FAIL =
  "تعذّر التقاط صورة من الفيديو (قد تكون صيغته غير مدعومة في المتصفح، أو الملف غير مشارك للعموم، أو التحميل بطيء). سنستخدم صورة درايف المصغّرة.";

/**
 * يلتقط لقطة عشوائية بعد الثانية 10 من فيديو درايف عند تغيّر المعرّف،
 * ويتيح `reroll()` لالتقاط لقطة أخرى دون إعادة فتح الفيديو.
 */
export function useRandomFrame(driveId: string | null, user: User | null, enabled: boolean, wantFrame = true) {
  const [state, setState] = useState<FrameState>(IDLE);
  const grabber = useRef<Grabber | null>(null);
  const run = useRef(0); // يُبطل نتائج الطلبات القديمة

  useEffect(() => {
    const me = ++run.current;
    const drop = () => {
      grabber.current?.dispose();
      grabber.current = null;
    };
    drop();
    if (!enabled || !driveId || !user) {
      setState(IDLE);
      return;
    }
    setState({ ...IDLE, status: "loading" });
    const timer = setTimeout(async () => {
      let duration = 0;
      try {
        // المدة وحدها (بلا لقطة): نقرؤها مباشرة من درايف دون المرور بسيرفر الموقع.
        if (!wantFrame) {
          const d = await probeDuration(driveId);
          if (me !== run.current) return;
          if (d > 0) {
            setState({ ...IDLE, duration: d });
            return;
          }
        }
        const token = await user.getIdToken();
        // الوسيط للضرورة فقط: اللقطة تحتاج نفس النطاق (canvas)، أو تعذّرت القراءة المباشرة للمدة.
        const g = await openGrabber(`/api/drive-video?id=${encodeURIComponent(driveId)}&token=${encodeURIComponent(token)}`, 30_000, wantFrame ? "auto" : "metadata");
        if (me !== run.current) return g.dispose();
        grabber.current = g;
        duration = Math.round(g.duration);
        if (!wantFrame) {
          // نحتاج المدة فقط: لا نلتقط صورة.
          if (me === run.current) setState({ ...IDLE, duration });
          drop();
          return;
        }
        const f = await g.grab();
        if (me === run.current) setState({ status: "ok", dataUrl: f.dataUrl, time: f.time, message: "", duration });
      } catch {
        if (me === run.current) {
          drop();
          setState({ ...IDLE, status: "error", message: FAIL, duration });
        }
      }
    }, 700); // انتظار بسيط حتى يستقر الرابط الملصوق
    return () => {
      clearTimeout(timer);
      run.current++;
      drop();
    };
  }, [driveId, user, enabled, wantFrame]);

  const reroll = useCallback(async () => {
    const g = grabber.current;
    if (!g) return;
    const me = run.current;
    setState((s) => ({ ...s, status: "loading", message: "" }));
    try {
      const f = await g.grab();
      if (me === run.current) setState((s) => ({ status: "ok", dataUrl: f.dataUrl, time: f.time, message: "", duration: s.duration }));
    } catch {
      if (me === run.current) setState((s) => ({ ...s, status: s.dataUrl ? "ok" : "error", message: "تعذّر التقاط لقطة أخرى." }));
    }
  }, []);

  return { ...state, reroll, canReroll: state.status === "ok" && grabber.current !== null };
}
