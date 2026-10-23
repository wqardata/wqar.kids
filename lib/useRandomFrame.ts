"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { openGrabber, type Grabber } from "./frameGrab";

export type FrameState = {
  status: "idle" | "loading" | "ok" | "error";
  dataUrl: string;
  /** ثانية اللقطة داخل الفيديو. */
  time: number;
  message: string;
};
const IDLE: FrameState = { status: "idle", dataUrl: "", time: 0, message: "" };

const FAIL =
  "تعذّر التقاط صورة من الفيديو (قد تكون صيغته غير مدعومة في المتصفح، أو الملف غير مشارك للعموم، أو التحميل بطيء). سنستخدم صورة درايف المصغّرة.";

/**
 * يلتقط لقطة عشوائية بعد الثانية 10 من فيديو درايف عند تغيّر المعرّف،
 * ويتيح `reroll()` لالتقاط لقطة أخرى دون إعادة فتح الفيديو.
 */
export function useRandomFrame(driveId: string | null, user: User | null, enabled: boolean) {
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
      try {
        const token = await user.getIdToken();
        const g = await openGrabber(`/api/drive-video?id=${encodeURIComponent(driveId)}&token=${encodeURIComponent(token)}`);
        if (me !== run.current) return g.dispose();
        grabber.current = g;
        const f = await g.grab();
        if (me === run.current) setState({ status: "ok", dataUrl: f.dataUrl, time: f.time, message: "" });
      } catch {
        if (me === run.current) {
          drop();
          setState({ ...IDLE, status: "error", message: FAIL });
        }
      }
    }, 700); // انتظار بسيط حتى يستقر الرابط الملصوق
    return () => {
      clearTimeout(timer);
      run.current++;
      drop();
    };
  }, [driveId, user, enabled]);

  const reroll = useCallback(async () => {
    const g = grabber.current;
    if (!g) return;
    const me = run.current;
    setState((s) => ({ ...s, status: "loading", message: "" }));
    try {
      const f = await g.grab();
      if (me === run.current) setState({ status: "ok", dataUrl: f.dataUrl, time: f.time, message: "" });
    } catch {
      if (me === run.current) setState((s) => ({ ...s, status: s.dataUrl ? "ok" : "error", message: "تعذّر التقاط لقطة أخرى." }));
    }
  }, []);

  return { ...state, reroll, canReroll: state.status === "ok" && grabber.current !== null };
}
