"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { merge, useSettings, type SiteSettings } from "./settings";
import { isPreviewFrame } from "./previewFrame";

/**
 * جسر المعاينة الحيّة بين لوحة التحكم وإطار المعاينة (نفس الأصل):
 *  - كل تبويب إعدادات يعلن مسودته غير المحفوظة عبر usePreviewDraft.
 *  - اللوحة ترسلها إلى الإطار بـ postMessage، والإطار (PreviewReceiver) يطبّقها محليًا فقط دون حفظ.
 */
export const PREVIEW_MSG = "site-preview-settings";
export const PREVIEW_READY = "site-preview-ready";
/** من اللوحة إلى الإطار: محدِّد العنصر المراد إبرازه (والنزول إليه). */
export const PREVIEW_FOCUS_MSG = "site-preview-focus";

type Draft = Partial<SiteSettings>;
const SetCtx = createContext<(key: string, d: Draft | null) => void>(() => {});
const DraftCtx = createContext<Draft>({});

export function PreviewDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const setDraft = useCallback((key: string, d: Draft | null) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (d) next[key] = d;
      else delete next[key];
      return next;
    });
  }, []);
  const merged = useMemo<Draft>(() => Object.assign({}, ...Object.values(drafts)), [drafts]);
  return (
    <SetCtx.Provider value={setDraft}>
      <DraftCtx.Provider value={merged}>{children}</DraftCtx.Provider>
    </SetCtx.Provider>
  );
}

/** يعلن مسودة التبويب (حقول من SiteSettings) للمعاينة. مرّر null لسحبها. تُسحب تلقائيًا عند مغادرة التبويب. */
export function usePreviewDraft(key: string, partial: Draft | null) {
  const setDraft = useContext(SetCtx);
  const json = partial ? JSON.stringify(partial) : "";
  useEffect(() => {
    setDraft(key, json ? (JSON.parse(json) as Draft) : null);
    return () => setDraft(key, null);
  }, [key, json, setDraft]);
}

export function usePreviewDraftValue(): Draft {
  return useContext(DraftCtx);
}

/** يُركَّب في التخطيط العام؛ لا يفعل شيئًا إلا داخل إطار المعاينة. */
export default function PreviewReceiver() {
  const { settings, update, ready } = useSettings();
  const base = useRef<SiteSettings | null>(null);
  const latest = useRef<Draft | null>(null);
  const applied = useRef<SiteSettings | null>(null); // آخر نسخة طبّقناها نحن (لنميّزها عن تحديث حقيقي من Firestore)
  const [inFrame, setInFrame] = useState(false);
  const focusSel = useRef("");
  const focusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setInFrame(isPreviewFrame()), []);

  /** يميّز العنصر المطابق للمحدِّد (أول ظاهر). `scroll`: النزول إليه أيضًا. يعيد false إن لم يظهر بعد. */
  const mark = useCallback((scroll: boolean): boolean => {
    document.querySelectorAll("[data-pv-focus]").forEach((e) => e.removeAttribute("data-pv-focus"));
    if (!focusSel.current) return true;
    let el: HTMLElement | undefined;
    try {
      el = Array.from(document.querySelectorAll<HTMLElement>(focusSel.current)).find((e) => e.getClientRects().length > 0);
    } catch {
      return true; // محدِّد غير صالح: لا نكرّر المحاولة
    }
    if (!el) return false;
    el.setAttribute("data-pv-focus", "");
    if (scroll) el.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  }, []);

  /** العنصر قد لا يكون مرسومًا بعد (تحميل الصفحة/البيانات): نعيد المحاولة لثوانٍ قليلة. */
  const focusOn = useCallback(
    (selector: string) => {
      focusSel.current = selector;
      if (focusTimer.current) clearInterval(focusTimer.current);
      if (mark(true)) return;
      let tries = 0;
      focusTimer.current = setInterval(() => {
        if (mark(true) || ++tries >= 16) {
          if (focusTimer.current) clearInterval(focusTimer.current);
          focusTimer.current = null;
        }
      }, 250);
    },
    [mark],
  );

  useEffect(
    () => () => {
      if (focusTimer.current) clearInterval(focusTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!inFrame) return;
    const apply = () => {
      if (!base.current) return;
      const next = latest.current ? merge({ ...base.current, ...latest.current }) : base.current;
      applied.current = next;
      update(next);
      setTimeout(() => mark(false), 80); // الرسم يُعاد بعد التطبيق؛ نُبقي التمييز دون نزول جديد
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; settings?: Draft; selector?: string } | null;
      if (d?.type === PREVIEW_FOCUS_MSG) {
        focusOn(typeof d.selector === "string" ? d.selector : "");
        return;
      }
      if (!d || d.type !== PREVIEW_MSG) return;
      latest.current = d.settings && typeof d.settings === "object" ? d.settings : null;
      apply();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inFrame, update, focusOn, mark]);

  // الأساس = آخر إعدادات محفوظة وصلت من الخادم (لا ما طبّقناه نحن). أول وصول: نخبر اللوحة أننا جاهزون لاستقبال المسودة.
  useEffect(() => {
    if (!inFrame || !ready || settings === applied.current) return;
    const first = !base.current;
    base.current = settings;
    if (first) window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    else if (latest.current) {
      const next = merge({ ...settings, ...latest.current });
      applied.current = next;
      update(next);
    }
  }, [inFrame, ready, settings, update]);

  return null;
}
